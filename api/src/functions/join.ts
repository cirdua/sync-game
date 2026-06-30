import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { containers } from "../shared/cosmos";
import { PlayerDoc } from "../shared/models";
import {
  badRequest,
  newId,
  normalizeCode,
  notFound,
  now,
  ok,
  readJson,
  serverErrorFrom,
} from "../shared/util";
import { buildSessionState, getSession } from "../shared/state";
import {
  getGroupAccessToken,
  publishToSession,
} from "../shared/webpubsub";

// POST /api/join
// Body: { code, displayName?, playerId? }
//   - First join: { code, displayName } -> creates player, returns token+state.
//   - Reconnect:  { code, playerId }    -> reuses player, returns fresh token+state.
// Returns: { playerId, displayName, wpsUrl, state }
// wpsUrl is a group-scoped Web PubSub client URL the frontend opens directly.

export async function join(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const body = await readJson<{
      code?: string;
      displayName?: string;
      playerId?: string;
    }>(req);

    const code = normalizeCode(body.code);
    if (!code) return badRequest("Missing session code");

    const session = await getSession(code);
    if (!session) return notFound("Session not found — check the code");

    let player: PlayerDoc | undefined;

    if (body.playerId) {
      // Reconnect path: load existing player.
      try {
        const { resource } = await containers
          .players()
          .item(body.playerId, code)
          .read<PlayerDoc>();
        player = resource;
      } catch {
        player = undefined;
      }
    }

    if (!player) {
      const displayName = (body.displayName ?? "").trim();
      if (!displayName) return badRequest("Missing display name");
      if (displayName.length > 24) {
        return badRequest("Display name too long (max 24)");
      }

      const playerId = newId();
      player = {
        id: playerId,
        sessionCode: code,
        playerId,
        displayName,
        joinedAt: now(),
        totalScore: 0,
      };
      await containers.players().items.create(player);
    }

    // Mint a group-scoped Web PubSub token for this player.
    const { url } = await getGroupAccessToken(code, player.playerId);

    // Build current state for immediate render (covers reconnect rehydration).
    const state = await buildSessionState(session);

    // Tell the room a player joined so the lobby count updates live.
    // Single publish to the group — fan-out handled by Web PubSub.
    // state already reflects the new player (buildSessionState re-queries players).
    await publishToSession(code, { kind: "state", state });

    return ok({
      playerId: player.playerId,
      displayName: player.displayName,
      wpsUrl: url,
      state,
    });
  } catch (err) {
    context.error("join failed", err);
    return serverErrorFrom(err);
  }
}

app.http("join", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "join",
  handler: join,
});
