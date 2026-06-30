import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { containers } from "../shared/cosmos";
import { QuestionDoc, SessionDoc } from "../shared/models";
import { getHandler, isKnownType } from "../questiontypes/registry";
import {
  badRequest,
  generateSessionCode,
  now,
  ok,
  readJson,
  serverErrorFrom,
} from "../shared/util";
import { getSession } from "../shared/state";

// POST /api/session
// Body (optional): { questions?: QuestionInput[] }
//   QuestionInput = { type, payload, correctAnswer?, points?, timeLimitMs? }
// If no questions are supplied, a sensible demo deck is seeded so the host can
// run the event immediately. Returns { sessionCode }.

interface QuestionInput {
  type: string;
  payload: unknown;
  correctAnswer?: number;
  points?: number;
  timeLimitMs?: number;
}

// Demo deck: one Word Flash, one Multiple Choice. Replaceable via request body.
const DEMO_QUESTIONS: QuestionInput[] = [
  {
    type: "wordflash",
    payload: {
      words: [
        "Welcome to",
        "Guild Live",
        "Cloud Engineering",
        "Let's play!",
      ],
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

    // Validate types up front.
    for (const q of inputs) {
      if (!q.type || !isKnownType(q.type)) {
        return badRequest(`Unknown or missing question type: ${q.type}`);
      }
      // Touch the handler to ensure it resolves.
      getHandler(q.type);
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

    // Persist the ordered question deck.
    await Promise.all(
      inputs.map((q, order) => {
        const doc: QuestionDoc = {
          id: `${sessionCode}:${order}`,
          sessionCode,
          order,
          type: q.type,
          payload: q.payload,
          correctAnswer: q.correctAnswer,
          points: q.points,
          timeLimitMs: q.timeLimitMs,
        };
        return containers.questions().items.create(doc);
      }),
    );

    context.log(`Created session ${sessionCode} with ${inputs.length} questions`);
    return ok({ sessionCode, totalQuestions: inputs.length });
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
