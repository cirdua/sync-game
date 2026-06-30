import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { containers } from "../shared/cosmos";
import {
  badRequest,
  normalizeCode,
  notFound,
  now,
  ok,
  readJson,
  serverErrorFrom,
} from "../shared/util";
import { buildSessionState, getSession } from "../shared/state";
import {
  persistDeck,
  QuestionInput,
  validateQuestions,
} from "../shared/questions";
import { publishToSession } from "../shared/webpubsub";

// PUT /api/session/{code}/questions
// Body: { questions: QuestionInput[] }
// Replaces the entire deck for a session. LOBBY ONLY — a running/ended game
// cannot have its deck edited. Used by the host's pre-start deck editor.

export async function updateQuestions(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const code = normalizeCode(req.params.code);
    if (!code) return badRequest("Missing session code");

    const session = await getSession(code);
    if (!session) return notFound("Session not found");

    if (session.status !== "lobby") {
      return badRequest("Deck can only be edited before the game starts");
    }

    const body = await readJson<{ questions?: QuestionInput[] }>(req);
    const inputs = body.questions ?? [];
    try {
      validateQuestions(inputs);
    } catch (e) {
      return badRequest((e as Error).message);
    }

    const total = await persistDeck(code, inputs);

    // Keep updatedAt fresh; deck count feeds the lobby UI via state.
    session.updatedAt = now();
    await containers.sessions().item(session.id, code).replace(session);

    // Broadcast so any connected lobby clients see the new total (single publish).
    const state = await buildSessionState(session);
    await publishToSession(code, { kind: "state", state });

    context.log(`Updated deck for ${code}: ${total} questions`);
    return ok({ totalQuestions: total });
  } catch (err) {
    context.error("updateQuestions failed", err);
    return serverErrorFrom(err);
  }
}

app.http("updateQuestions", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "session/{code}/questions",
  handler: updateQuestions,
});
