// Domain models — mirror the Cosmos data model in architecture.md §3.
// Every container is partitioned by /sessionCode.

export type SessionStatus = "lobby" | "active" | "ended";

/** Per-question presentation state the host drives. Kept generic so each
 *  question type can stash whatever it needs (e.g. wordflash word index). */
export interface QuestionRuntimeState {
  /** For wordflash: index of the currently shown word. */
  wordIndex?: number;
  /** For scored types: whether the answer has been revealed. */
  revealed?: boolean;
  /** Server epoch ms when this question became active (basis for speed scoring). */
  activatedAt?: number;
}

export interface SessionDoc {
  id: string; // == sessionCode
  sessionCode: string;
  status: SessionStatus;
  /** Index into the ordered question list; -1 means "lobby, not started". */
  currentIndex: number;
  /** "lobby" | "question" | "leaderboard" | "final" — what screen everyone shows. */
  screen: SessionScreen;
  questionState: QuestionRuntimeState;
  createdAt: number;
  updatedAt: number;
}

export type SessionScreen = "lobby" | "question" | "leaderboard" | "final";

export interface QuestionDoc {
  id: string; // `${sessionCode}:${order}`
  sessionCode: string;
  order: number;
  type: string; // "wordflash" | "multiplechoice" | ...
  payload: unknown; // type-specific (see questiontypes/*)
  /** Index of the correct option, for scored types. */
  correctAnswer?: number;
  /** Max points for a fully-fast correct answer (scored types). */
  points?: number;
  /** Answer window in ms (scored types) — used by the speed formula. */
  timeLimitMs?: number;
}

export interface PlayerDoc {
  id: string; // playerId (uuid)
  sessionCode: string;
  playerId: string;
  displayName: string;
  connectionId?: string;
  joinedAt: number;
  totalScore: number;
}

export interface AnswerDoc {
  id: string; // `${sessionCode}:${order}:${playerId}`
  sessionCode: string;
  questionOrder: number;
  playerId: string;
  displayName: string;
  choice: number;
  serverReceivedAt: number; // server-stamped; NEVER from client
  pointsAwarded: number;
  /** 1 = answered first, 2 = second, … (derived from serverReceivedAt order). */
  answerRank: number;
  correct: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  totalScore: number;
  rank: number;
}
