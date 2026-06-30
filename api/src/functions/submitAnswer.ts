import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { containers } from "../shared/cosmos";
import { AnswerDoc, PlayerDoc } from "../shared/models";
import { getHandler } from "../questiontypes/registry";
import {
  badRequest,
  normalizeCode,
  notFound,
  now,
  ok,
  readJson,
  serverError,
} from "../shared/util";
import {
  buildSessionState,
  getCurrentQuestion,
  getSession,
} from "../shared/state";
import { publishToSession } from "../shared/webpubsub";

// POST /api/answer
// Body: { code, playerId, questionOrder, choice }
// - Stamps serverReceivedAt SERVER-SIDE (never trusts client time).
// - Computes answerRank (1 = first) from existing answers' timestamps.
// - Scores via the question type's handler (speed-based for MC).
// - Updates player.totalScore, broadcasts fresh leaderboard to the group.
// Idempotent per (session, question, player): a second submit is rejected.

export async function submitAnswer(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const serverReceivedAt = now(); // stamp as early as possible
    const body = await readJson<{
      code?: string;
      playerId?: string;
      questionOrder?: number;
      choice?: number;
    }>(req);

    const code = normalizeCode(body.code);
    if (!code) return badRequest("Missing session code");
    if (!body.playerId) return badRequest("Missing playerId");
    if (typeof body.questionOrder !== "number") {
      return badRequest("Missing questionOrder");
    }
    if (typeof body.choice !== "number") {
      return badRequest("Missing choice");
    }

    const session = await getSession(code);
    if (!session) return notFound("Session not found");

    // Only accept answers for the currently-active question.
    if (session.currentIndex !== body.questionOrder) {
      return badRequest("Question is not currently active");
    }

    const question = await getCurrentQuestion(session);
    if (!question) return notFound("Question not found");

    const handler = getHandler(question.type);
    if (!handler.scored) {
      // Word Flash etc. accept no answers.
      return badRequest("This question does not accept answers");
    }

    // Load the player (must exist + belong to this session).
    let player: PlayerDoc;
    try {
      const { resource } = await containers
        .players()
        .item(body.playerId, code)
        .read<PlayerDoc>();
      if (!resource) return notFound("Player not found");
      player = resource;
    } catch {
      return notFound("Player not found");
    }

    const answerId = `${code}:${body.questionOrder}:${body.playerId}`;

    // Reject duplicate answers (idempotency / no double-scoring).
    try {
      const { resource: existing } = await containers
        .answers()
        .item(answerId, code)
        .read<AnswerDoc>();
      if (existing) {
        return badRequest("You have already answered this question");
      }
    } catch {
      // not found -> fine, continue
    }

    // Determine rank: how many answers already exist for this question.
    // NOTE: under heavy concurrency two near-simultaneous answers could read the
    // same count and store the same answerRank. That's acceptable because rank is
    // only a stored hint — the AUTHORITATIVE "who answered first" is always
    // recoverable by sorting on serverReceivedAt (see resultSummary), and points
    // are computed from serverReceivedAt, not from this rank.
    const { resources: priorAnswers } = await containers
      .answers()
      .items.query<AnswerDoc>({
        query:
          "SELECT * FROM c WHERE c.sessionCode = @code AND c.questionOrder = @order",
        parameters: [
          { name: "@code", value: code },
          { name: "@order", value: body.questionOrder },
        ],
      })
      .fetchAll();
    const answerRank = priorAnswers.length + 1;

    // Score using the type handler + the question's activation time.
    const { correct, pointsAwarded } = handler.score(
      question,
      session.questionState,
      body.choice,
      serverReceivedAt,
      answerRank,
    );

    const answer: AnswerDoc = {
      id: answerId,
      sessionCode: code,
      questionOrder: body.questionOrder,
      playerId: body.playerId,
      displayName: player.displayName,
      choice: body.choice,
      serverReceivedAt,
      pointsAwarded,
      answerRank,
      correct,
    };
    await containers.answers().items.create(answer);

    // Update running total.
    if (pointsAwarded > 0) {
      player.totalScore += pointsAwarded;
      await containers.players().item(player.id, code).replace(player);
    }

    // Broadcast updated leaderboard/state to the whole group (single publish).
    const state = await buildSessionState(session);
    await publishToSession(code, { kind: "state", state });

    // Personal result back to the answering player only (HTTP response).
    return ok({
      correct,
      pointsAwarded,
      answerRank,
      totalScore: player.totalScore,
    });
  } catch (err) {
    context.error("submitAnswer failed", err);
    return serverError();
  }
}

app.http("submitAnswer", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "answer",
  handler: submitAnswer,
});
