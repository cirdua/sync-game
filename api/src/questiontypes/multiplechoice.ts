import { AnswerDoc, QuestionDoc, QuestionRuntimeState } from "../shared/models";
import { QuestionTypeHandler, ScoreResult } from "./types";

// Multiple Choice — has a correct option, Kahoot-style speed scoring.
//
// payload shape: { question: string, options: string[] }
// QuestionDoc.correctAnswer = index of correct option
// QuestionDoc.points        = max points (default 1000)
// QuestionDoc.timeLimitMs   = answer window (default 20s)

export interface MultipleChoicePayload {
  question: string;
  options: string[];
}

const DEFAULT_MAX_POINTS = 1000;
const DEFAULT_TIME_LIMIT_MS = 20_000;
// Floor so a late-but-correct answer still scores (architecture.md §5.3).
const MIN_FRACTION = 0.5;

export const MultipleChoiceHandler: QuestionTypeHandler = {
  type: "multiplechoice",
  scored: true,

  initialState(_question: QuestionDoc, activatedAt: number): QuestionRuntimeState {
    return { revealed: false, activatedAt };
  },

  applyHostAction(
    _question: QuestionDoc,
    state: QuestionRuntimeState,
    action: string,
  ): QuestionRuntimeState | null {
    if (action === "reveal") {
      return { ...state, revealed: true };
    }
    return null;
  },

  score(
    question: QuestionDoc,
    state: QuestionRuntimeState,
    choice: number,
    serverReceivedAt: number,
    _rank: number,
  ): ScoreResult {
    const correct = choice === question.correctAnswer;
    if (!correct) {
      return { correct: false, pointsAwarded: 0 };
    }

    const maxPoints = question.points ?? DEFAULT_MAX_POINTS;
    const timeLimit = question.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
    // activatedAt is stamped server-side when the question goes live.
    const activatedAt = state.activatedAt;
    const elapsed =
      activatedAt != null ? serverReceivedAt - activatedAt : timeLimit;

    // points = maxPoints * (1 - timeTaken/timeLimit), floored at MIN_FRACTION.
    const fraction = Math.max(MIN_FRACTION, 1 - elapsed / timeLimit);
    const pointsAwarded = Math.round(maxPoints * Math.min(fraction, 1));
    return { correct: true, pointsAwarded };
  },

  publicPayloadForPlayers(question: QuestionDoc, state: QuestionRuntimeState) {
    const payload = question.payload as MultipleChoicePayload;
    return {
      type: "multiplechoice",
      question: payload.question,
      options: payload.options,
      revealed: !!state.revealed,
      // Only expose the answer once the host has revealed it.
      correctAnswer: state.revealed ? question.correctAnswer : undefined,
    };
  },

  resultSummary(question: QuestionDoc, answers: AnswerDoc[]) {
    const payload = question.payload as MultipleChoicePayload;
    const counts = new Array(payload.options?.length ?? 0).fill(0);
    for (const a of answers) {
      if (a.choice >= 0 && a.choice < counts.length) counts[a.choice]++;
    }
    const first = answers
      .slice()
      .sort((a, b) => a.serverReceivedAt - b.serverReceivedAt)
      .find((a) => a.correct);
    return {
      counts,
      correctAnswer: question.correctAnswer,
      firstCorrectPlayer: first?.displayName ?? null,
      totalAnswers: answers.length,
    };
  },
};
