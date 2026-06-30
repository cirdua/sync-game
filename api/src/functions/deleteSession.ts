import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { containers } from "../shared/cosmos";
import {
  AnswerDoc,
  PlayerDoc,
  QuestionDoc,
} from "../shared/models";
import {
  badRequest,
  normalizeCode,
  ok,
  serverErrorFrom,
} from "../shared/util";
import { getSession } from "../shared/state";
import { publishToSession } from "../shared/webpubsub";

// DELETE /api/session/{code}
// Ends + PURGES a session: broadcasts a final "ended" so every connected client
// clears its screen, then deletes all docs for the session across all four
// containers (session, questions, players, answers). Idempotent — a missing
// session is treated as already cleaned up.
//
// Used when the host ends the game: no event data lingers in Cosmos afterwards.

export async function deleteSession(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const code = normalizeCode(req.params.code);
    if (!code) return badRequest("Missing session code");

    const session = await getSession(code);
    if (!session) {
      // Already gone — nothing to do.
      return ok({ deleted: true, alreadyGone: true });
    }

    // Tell the room the game is over BEFORE we delete (so players clear their UI).
    // Single publish; Web PubSub fans out.
    try {
      await publishToSession(code, { kind: "ended" });
    } catch (e) {
      // Non-fatal: deletion still proceeds even if the broadcast fails.
      context.warn(`ended broadcast failed for ${code}: ${String(e)}`);
    }

    // Gather all child docs for the session (partition key = sessionCode).
    const [{ resources: questions }, { resources: players }, { resources: answers }] =
      await Promise.all([
        containers
          .questions()
          .items.query<QuestionDoc>({
            query: "SELECT c.id FROM c WHERE c.sessionCode = @code",
            parameters: [{ name: "@code", value: code }],
          })
          .fetchAll(),
        containers
          .players()
          .items.query<PlayerDoc>({
            query: "SELECT c.id FROM c WHERE c.sessionCode = @code",
            parameters: [{ name: "@code", value: code }],
          })
          .fetchAll(),
        containers
          .answers()
          .items.query<AnswerDoc>({
            query: "SELECT c.id FROM c WHERE c.sessionCode = @code",
            parameters: [{ name: "@code", value: code }],
          })
          .fetchAll(),
      ]);

    // Delete children, then the session doc itself.
    await Promise.all([
      ...questions.map((q) => containers.questions().item(q.id, code).delete()),
      ...players.map((p) => containers.players().item(p.id, code).delete()),
      ...answers.map((a) => containers.answers().item(a.id, code).delete()),
    ]);
    await containers.sessions().item(code, code).delete();

    context.log(
      `Deleted session ${code}: ${questions.length} questions, ` +
        `${players.length} players, ${answers.length} answers`,
    );
    return ok({
      deleted: true,
      removed: {
        questions: questions.length,
        players: players.length,
        answers: answers.length,
      },
    });
  } catch (err) {
    context.error("deleteSession failed", err);
    return serverErrorFrom(err);
  }
}

app.http("deleteSession", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "session/{code}",
  handler: deleteSession,
});
