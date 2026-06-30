import { AnswerDoc, QuestionDoc, QuestionRuntimeState } from "../shared/models";

// =============================================================================
// Question-type abstraction (architecture.md §4).
//
// The core game loop is type-agnostic: it advances questions, broadcasts state,
// and records answers without knowing what a question *is*. Each concrete type
// plugs in by implementing this interface and registering itself (registry.ts).
//
// Adding a new type = add one file implementing QuestionTypeHandler + register.
// No changes to the control/answer/leaderboard Functions are required.
// =============================================================================

/** Result of scoring a single answer for a scored question. */
export interface ScoreResult {
  correct: boolean;
  pointsAwarded: number;
}

export interface QuestionTypeHandler {
  /** Discriminator stored on QuestionDoc.type. */
  readonly type: string;

  /** Whether answers earn points. WordFlash = false; MultipleChoice = true. */
  readonly scored: boolean;

  /** Initial runtime state when this question becomes active. */
  initialState(question: QuestionDoc, activatedAt: number): QuestionRuntimeState;

  /**
   * Handle a host "advance within question" action (e.g. wordflash next/prev).
   * Return the new runtime state, or null if the action doesn't apply.
   * `action` is a free-form verb from the host control payload.
   */
  applyHostAction(
    question: QuestionDoc,
    state: QuestionRuntimeState,
    action: string,
  ): QuestionRuntimeState | null;

  /**
   * Score a single incoming answer. Only called for scored types.
   * `state` carries activatedAt (when the question went live) for speed scoring.
   * `rank` is the 1-based order this answer arrived (1 = first).
   * Non-scored types should return { correct: false, pointsAwarded: 0 }.
   */
  score(
    question: QuestionDoc,
    state: QuestionRuntimeState,
    choice: number,
    serverReceivedAt: number,
    rank: number,
  ): ScoreResult;

  /**
   * What of the question is safe to send to PLAYERS while it's live.
   * Must hide correctAnswer for scored types until revealed.
   */
  publicPayloadForPlayers(
    question: QuestionDoc,
    state: QuestionRuntimeState,
  ): unknown;

  /** Optional: shape the per-question result shown after reveal. */
  resultSummary?(question: QuestionDoc, answers: AnswerDoc[]): unknown;
}
