import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { containers } from "../shared/cosmos";
import { QuestionDoc, SessionDoc } from "../shared/models";
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
  getQuestions,
  getSession,
} from "../shared/state";
import { publishToSession } from "../shared/webpubsub";

// POST /api/control
// Body: { code, action, ... }
// Host-only state machine. Actions:
//   "start"           -> move from lobby to first question
//   "nextQuestion"    -> advance to next question (or "final" at the end)
//   "prevQuestion"    -> go back a question
//   "showLeaderboard" -> switch the room to the leaderboard screen
//   "showFinal"       -> final ranking screen
//   "end"             -> mark session ended
//   <type action>     -> delegated to the current question's handler
//                        (e.g. "nextWord"/"prevWord" for wordflash, "reveal" for MC)
//
// The CORE LOOP knows nothing about specific types: anything it doesn't handle
// itself is passed to handler.applyHostAction. This is the extensibility seam.
//
// NOTE (no-auth event): there is intentionally no host authentication. Knowing
// the session code is sufficient to control it. Acceptable for a single trusted
// presenter in one room; documented as an assumption.

const CORE_ACTIONS = new Set([
  "start",
  "nextQuestion",
  "prevQuestion",
  "showLeaderboard",
  "showFinal",
  "end",
]);

async function activateQuestion(
  session: SessionDoc,
  index: number,
  questions: QuestionDoc[],
): Promise<void> {
  const q = questions[index];
  const handler = getHandler(q.type);
  session.currentIndex = index;
  session.screen = "question";
  session.questionState = handler.initialState(q, now());
}

export async function control(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const body = await readJson<{ code?: string; action?: string }>(req);
    const code = normalizeCode(body.code);
    const action = (body.action ?? "").trim();

    if (!code) return badRequest("Missing session code");
    if (!action) return badRequest("Missing action");

    const session = await getSession(code);
    if (!session) return notFound("Session not found");

    const questions = await getQuestions(code);

    if (CORE_ACTIONS.has(action)) {
      switch (action) {
        case "start":
          if (questions.length === 0) return badRequest("No questions to start");
          session.status = "active";
          await activateQuestion(session, 0, questions);
          break;

        case "nextQuestion": {
          const next = session.currentIndex + 1;
          if (next >= questions.length) {
            session.screen = "final";
          } else {
            await activateQuestion(session, next, questions);
          }
          break;
        }

        case "prevQuestion": {
          const prev = Math.max(0, session.currentIndex - 1);
          await activateQuestion(session, prev, questions);
          break;
        }

        case "showLeaderboard":
          session.screen = "leaderboard";
          break;

        case "showFinal":
          session.screen = "final";
          break;

        case "end":
          session.status = "ended";
          session.screen = "final";
          break;
      }
    } else {
      // Type-specific action — delegate to the current question's handler.
      const current = await getCurrentQuestion(session);
      if (!current) return badRequest("No active question for this action");
      const handler = getHandler(current.type);
      const newState = handler.applyHostAction(
        current,
        session.questionState,
        action,
      );
      if (newState === null) {
        return badRequest(
          `Action "${action}" is not valid for question type "${current.type}"`,
        );
      }
      session.questionState = newState;
    }

    session.updatedAt = now();
    await containers.sessions().item(session.id, code).replace(session);

    // One publish to the group -> every player + projector reacts.
    const state = await buildSessionState(session);
    await publishToSession(code, { kind: "state", state });

    return ok({ state });
  } catch (err) {
    context.error("control failed", err);
    return serverError();
  }
}

app.http("control", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "control",
  handler: control,
});
