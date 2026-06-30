import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { containers } from "../shared/cosmos";
import { SessionDoc } from "../shared/models";
import {
  generateSessionCode,
  now,
  ok,
  readJson,
  badRequest,
  serverErrorFrom,
} from "../shared/util";
import { getSession } from "../shared/state";
import {
  persistDeck,
  QuestionInput,
  validateQuestions,
} from "../shared/questions";

// POST /api/session
// Body (optional): { questions?: QuestionInput[] }
//   QuestionInput = { type, payload, correctAnswer?, points?, timeLimitMs? }
// If no questions are supplied, a sensible demo deck is seeded so the host can
// run the event immediately (and then tweak it in the lobby editor).
// Returns { sessionCode }.

// Demo deck: one Word Flash, one Multiple Choice. The host can edit/replace this
// in the lobby before starting (see updateQuestions).
const DEMO_QUESTIONS: QuestionInput[] = [
  {
    type: "wordflash",
    payload: {
      words: ["Welcome to", "Guild Live", "Cloud Engineering", "Let's play!"],
    },
  },
  {
    type: "multiplechoice",
    payload: {
      question: "Which Azure service fans out real-time messages to a group?",
      options: ["Service Bus", "Web PubSub", "Event Grid", "Storage Queue"],
    },
    correctAnswer: 1,
    points: 1000,
    timeLimitMs: 20000,
  },
];

async function generateUniqueCode(): Promise<string> {
  // Retry on the rare collision (alphabet^6 keyspace makes this nearly never).
  for (let i = 0; i < 5; i++) {
    const code = generateSessionCode();
    const existing = await getSession(code);
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique session code");
}

export async function createSession(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const body = await readJson<{ questions?: QuestionInput[] }>(req);
    const inputs =
      body.questions && body.questions.length > 0
        ? body.questions
        : DEMO_QUESTIONS;

    try {
      validateQuestions(inputs);
    } catch (e) {
      return badRequest((e as Error).message);
    }

    const sessionCode = await generateUniqueCode();
    const ts = now();

    const session: SessionDoc = {
      id: sessionCode,
      sessionCode,
      status: "lobby",
      currentIndex: -1,
      screen: "lobby",
      questionState: {},
      createdAt: ts,
      updatedAt: ts,
    };
    await containers.sessions().items.create(session);

    const total = await persistDeck(sessionCode, inputs);

    context.log(`Created session ${sessionCode} with ${total} questions`);
    return ok({ sessionCode, totalQuestions: total });
  } catch (err) {
    context.error("createSession failed", err);
    return serverErrorFrom(err);
  }
}

app.http("createSession", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "session",
  handler: createSession,
});
