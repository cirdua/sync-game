import { QuestionDoc, QuestionRuntimeState } from "../shared/models";
import { QuestionTypeHandler, ScoreResult } from "./types";

// =============================================================================
// EXTENSION POINT — Open Text / Word Cloud (STUB, not wired into v1).
//
// This shows how a 3rd question type slots in with zero core changes:
//   1. Implement QuestionTypeHandler (below).
//   2. Register it in registry.ts.
//   3. Add a renderer on the frontend keyed by `type`.
//
// payload shape (proposed): { prompt: string }
// answers would be free text; aggregation = word-frequency for a word cloud.
// Left unscored and inert here on purpose.
// =============================================================================

export interface OpenTextPayload {
  prompt: string;
}

export const OpenTextStubHandler: QuestionTypeHandler = {
  type: "opentext",
  scored: false,

  initialState(_q: QuestionDoc, activatedAt: number): QuestionRuntimeState {
    return { activatedAt };
  },

  applyHostAction(): QuestionRuntimeState | null {
    return null; // no host-paced sub-actions in the stub
  },

  score(): ScoreResult {
    return { correct: false, pointsAwarded: 0 };
  },

  publicPayloadForPlayers(question: QuestionDoc) {
    const payload = question.payload as OpenTextPayload;
    return { type: "opentext", prompt: payload.prompt };
  },

  // A real implementation would tally word frequencies here for a word cloud.
  // resultSummary(question, answers) { ... }
};
