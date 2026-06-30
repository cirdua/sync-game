import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  badRequest,
  normalizeCode,
  notFound,
  ok,
  serverErrorFrom,
} from "../shared/util";
import {
  computeLeaderboard,
  getPlayers,
  getSession,
} from "../shared/state";

// GET /api/session/{code}/leaderboard
// Explicit leaderboard aggregation endpoint. The live game pushes leaderboard
// updates over Web PubSub, but this lets the final-ranking screen (or a late
// projector) pull the authoritative ranking on demand.

export async function leaderboardFn(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const code = normalizeCode(req.params.code);
    if (!code) return badRequest("Missing session code");

    const session = await getSession(code);
    if (!session) return notFound("Session not found");

    const players = await getPlayers(code);
    const leaderboard = computeLeaderboard(players);

    return ok({ sessionCode: code, leaderboard });
  } catch (err) {
    context.error("leaderboard failed", err);
    return serverErrorFrom(err);
  }
}

app.http("leaderboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "session/{code}/leaderboard",
  handler: leaderboardFn,
});
