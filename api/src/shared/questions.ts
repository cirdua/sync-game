import { containers } from "./cosmos";
import { QuestionDoc } from "./models";
import { getHandler, isKnownType } from "../questiontypes/registry";
import { getQuestions } from "./state";

// Shared deck authoring: one validator + one persist routine used by both
// createSession (seed deck) and updateQuestions (lobby editor). Keeping these in
// one place means the question shape + rules live in exactly one spot.

/** The author-facing shape for a question (host editor / create body). */
export interface QuestionInput {
  type: string;
  payload: unknown;
  correctAnswer?: number;
  points?: number;
  timeLimitMs?: number;
}

/** Throws a descriptive Error if any question is invalid. */
export function validateQuestions(inputs: QuestionInput[]): void {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error("At least one question is required");
  }
  for (const q of inputs) {
    if (!q.type || !isKnownType(q.type)) {
      throw new Error(`Unknown or missing question type: ${q.type}`);
    }
    // Resolve the handler to ensure it exists.
    getHandler(q.type);
  }
}

/**
 * Replace the entire deck for a session: delete existing question docs, then
 * create the new ordered set. Used at create (no existing docs) and on edit.
 */
export async function persistDeck(
  sessionCode: string,
  inputs: QuestionInput[],
): Promise<number> {
  // Remove any existing questions for this session first.
  const existing = await getQuestions(sessionCode);
  await Promise.all(
    existing.map((q) =>
      containers.questions().item(q.id, sessionCode).delete(),
    ),
  );

  // Create the new ordered deck.
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

  return inputs.length;
}
