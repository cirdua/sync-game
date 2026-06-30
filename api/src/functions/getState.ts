import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  badRequest,
  normalizeCode,
  notFound,
  ok,
  serverErrorFrom,
} from "../shared/util";
import { buildSessionState, getSession } from "../shared/state";

// GET /api/session/{code}/state
// Lightweight rehydration endpoint. Returns the canonical SessionState so any
// client (host refresh, player refresh, projector) can redraw without replaying
// missed Web PubSub messages. Cosmos is the source of truth.

export async function getStateFn(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const code = normalizeCode(req.params.code);
    if (!code) return badRequest("Missing session code");

    const session = await getSession(code);
    if (!session) return notFound("Session not found");

    const state = await buildSessionState(session);
    return ok({ state });
  } catch (err) {
    context.error("getState failed", err);
    return serverErrorFrom(err);
  }
}

app.http("getState", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "session/{code}/state",
  handler: getStateFn,
});
