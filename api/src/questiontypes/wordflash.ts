import { QuestionDoc, QuestionRuntimeState } from "../shared/models";
import { QuestionTypeHandler, ScoreResult } from "./types";

// Word Flash — host flashes words/phrases one at a time, paces with next/prev.
// Not scored. This is the v1 must-have, built first and completely.
//
// payload shape: { words: string[] }

export interface WordFlashPayload {
  words: string[];
}

export const WordFlashHandler: QuestionTypeHandler = {
  type: "wordflash",
  scored: false,

  initialState(_question: QuestionDoc, activatedAt: number): QuestionRuntimeState {
    return { wordIndex: 0, activatedAt };
  },

  applyHostAction(
    question: QuestionDoc,
    state: QuestionRuntimeState,
    action: string,
  ): QuestionRuntimeState | null {
    const payload = question.payload as WordFlashPayload;
    const total = payload.words?.length ?? 0;
    const current = state.wordIndex ?? 0;

    switch (action) {
      case "nextWord": {
        // Clamp at last word; host advances the *question* to go further.
        const next = Math.min(current + 1, Math.max(total - 1, 0));
        return { ...state, wordIndex: next };
      }
      case "prevWord": {
        const prev = Math.max(current - 1, 0);
        return { ...state, wordIndex: prev };
      }
      default:
        return null; // not a wordflash-specific action
    }
  },

  // Not scored — answers are never submitted for this type, but satisfy the API.
  score(): ScoreResult {
    return { correct: false, pointsAwarded: 0 };
  },

  publicPayloadForPlayers(question: QuestionDoc, state: QuestionRuntimeState) {
    const payload = question.payload as WordFlashPayload;
    const idx = state.wordIndex ?? 0;
    return {
      type: "wordflash",
      word: payload.words?.[idx] ?? "",
      wordIndex: idx,
      totalWords: payload.words?.length ?? 0,
    };
  },
};
