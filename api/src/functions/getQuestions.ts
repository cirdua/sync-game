import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  badRequest,
  normalizeCode,
  notFound,
  ok,
  serverErrorFrom,
} from "../shared/util";
import { getQuestions, getSession } from "../shared/state";

// GET /api/session/{code}/questions
// AUTHORING view of the full deck (includes correctAnswer) for the host's lobby
// editor. This is intentionally NOT part of SessionState — SessionState is
// broadcast to players and must never leak correct answers. Only the host calls
// this (no auth, by event design), and only meaningfully in the lobby.

export async function getQuestionsFn(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const code = normalizeCode(req.params.code);
    if (!code) return badRequest("Missing session code");

    const session = await getSession(code);
    if (!session) return notFound("Session not found");

    const questions = await getQuestions(code);
    return ok({ sessionCode: code, questions });
  } catch (err) {
    context.error("getQuestions failed", err);
    return serverErrorFrom(err);
  }
}

app.http("getQuestions", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "session/{code}/questions",
  handler: getQuestionsFn,
});
