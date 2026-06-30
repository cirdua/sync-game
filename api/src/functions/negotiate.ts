import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  badRequest,
  newId,
  normalizeCode,
  notFound,
  ok,
  serverError,
} from "../shared/util";
import { getSession } from "../shared/state";
import { getGroupAccessToken } from "../shared/webpubsub";

// GET /api/negotiate?code=XXXX[&userId=...]
// Returns a group-scoped Web PubSub client URL for a connection.
//
// Players normally get their URL from /join. This endpoint serves the HOST
// (which has no player record) and any client that just needs to (re)connect to
// the session group — e.g. the projector view, or a player re-establishing the
// socket after a network blip without re-running the full join.

export async function negotiate(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const code = normalizeCode(req.query.get("code"));
    if (!code) return badRequest("Missing session code");

    const session = await getSession(code);
    if (!session) return notFound("Session not found");

    // userId is informational only; tokens are scoped to the group regardless.
    const userId = req.query.get("userId") || `host-${newId()}`;
    const { url } = await getGroupAccessToken(code, userId);

    return ok({ url, userId });
  } catch (err) {
    context.error("negotiate failed", err);
    return serverError();
  }
}

app.http("negotiate", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "negotiate",
  handler: negotiate,
});
