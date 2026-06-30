import {
  LeaderboardEntry,
  PlayerDoc,
  QuestionDoc,
  SessionDoc,
} from "./models";
import { containers } from "./cosmos";
import { getHandler } from "../questiontypes/registry";

// Centralised reads + the canonical "session state" object that gets both
// broadcast over Web PubSub and returned on join/rehydrate. One shape, one
// source of truth (Cosmos), so reconnection is just "fetch + render".

export async function getSession(
  sessionCode: string,
): Promise<SessionDoc | undefined> {
  try {
    const { resource } = await containers
      .sessions()
      .item(sessionCode, sessionCode)
      .read<SessionDoc>();
    return resource;
  } catch {
    return undefined;
  }
}

export async function getQuestions(
  sessionCode: string,
): Promise<QuestionDoc[]> {
  const { resources } = await containers
    .questions()
    .items.query<QuestionDoc>({
      query:
        "SELECT * FROM c WHERE c.sessionCode = @code ORDER BY c.order ASC",
      parameters: [{ name: "@code", value: sessionCode }],
    })
    .fetchAll();
  return resources;
}

export async function getCurrentQuestion(
  session: SessionDoc,
): Promise<QuestionDoc | undefined> {
  if (session.currentIndex < 0) return undefined;
  const id = `${session.sessionCode}:${session.currentIndex}`;
  try {
    const { resource } = await containers
      .questions()
      .item(id, session.sessionCode)
      .read<QuestionDoc>();
    return resource;
  } catch {
    return undefined;
  }
}

export async function getPlayers(
  sessionCode: string,
): Promise<PlayerDoc[]> {
  const { resources } = await containers
    .players()
    .items.query<PlayerDoc>({
      query: "SELECT * FROM c WHERE c.sessionCode = @code",
      parameters: [{ name: "@code", value: sessionCode }],
    })
    .fetchAll();
  return resources;
}

export function computeLeaderboard(players: PlayerDoc[]): LeaderboardEntry[] {
  return players
    .slice()
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((p, i) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      totalScore: p.totalScore,
      rank: i + 1,
    }));
}

/** The full state every client renders from. Broadcast + join both use this. */
export interface SessionState {
  sessionCode: string;
  status: SessionDoc["status"];
  screen: SessionDoc["screen"];
  currentIndex: number;
  totalQuestions: number;
  playerCount: number;
  /** Player-safe view of the current question (hides answers until revealed). */
  currentQuestion: unknown | null;
  scored: boolean;
  leaderboard: LeaderboardEntry[];
}

export async function buildSessionState(
  session: SessionDoc,
): Promise<SessionState> {
  const [players, questions, current] = await Promise.all([
    getPlayers(session.sessionCode),
    getQuestions(session.sessionCode),
    getCurrentQuestion(session),
  ]);

  let currentQuestion: unknown | null = null;
  let scored = false;
  if (current) {
    const handler = getHandler(current.type);
    scored = handler.scored;
    currentQuestion = handler.publicPayloadForPlayers(
      current,
      session.questionState,
    );
  }

  return {
    sessionCode: session.sessionCode,
    status: session.status,
    screen: session.screen,
    currentIndex: session.currentIndex,
    totalQuestions: questions.length,
    playerCount: players.length,
    currentQuestion,
    scored,
    leaderboard: computeLeaderboard(players),
  };
}

/** Standard envelope for everything we publish to a session group. */
export interface BroadcastMessage {
  kind: "state" | "answerResult" | "playerJoined";
  state?: SessionState;
  [k: string]: unknown;
}
