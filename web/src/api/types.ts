// Mirrors the backend's SessionState / message shapes (api/src/shared/state.ts).

export type SessionStatus = "lobby" | "active" | "ended";
export type SessionScreen = "lobby" | "question" | "leaderboard" | "final";

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  totalScore: number;
  rank: number;
}

/** Player-safe view of the active question (discriminated by `type`). */
export interface WordFlashPublic {
  type: "wordflash";
  word: string;
  wordIndex: number;
  totalWords: number;
}
export interface MultipleChoicePublic {
  type: "multiplechoice";
  question: string;
  options: string[];
  revealed: boolean;
  correctAnswer?: number;
}
export interface OpenTextPublic {
  type: "opentext";
  prompt: string;
}
export type PublicQuestion =
  | WordFlashPublic
  | MultipleChoicePublic
  | OpenTextPublic;

export interface SessionState {
  sessionCode: string;
  status: SessionStatus;
  screen: SessionScreen;
  currentIndex: number;
  totalQuestions: number;
  playerCount: number;
  currentQuestion: PublicQuestion | null;
  scored: boolean;
  leaderboard: LeaderboardEntry[];
}

export interface BroadcastMessage {
  kind: "state" | "answerResult" | "playerJoined";
  state?: SessionState;
  [k: string]: unknown;
}

export interface JoinResponse {
  playerId: string;
  displayName: string;
  wpsUrl: string;
  state: SessionState;
}

export interface AnswerResponse {
  correct: boolean;
  pointsAwarded: number;
  answerRank: number;
  totalScore: number;
}
