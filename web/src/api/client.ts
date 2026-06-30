import {
  AnswerResponse,
  EditableQuestion,
  JoinResponse,
  SessionState,
} from "./types";

// In production (SWA) the Functions app lives at a different host, injected at
// build time via VITE_API_BASE_URL. In local dev that var is empty and we use
// relative /api/* which Vite proxies to the local func host (vite.config.ts).
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function url(path: string): string {
  return `${API_BASE}${path}`;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function putJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(url(path));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(url(path), { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createSession: (questions?: unknown[]) =>
    postJson<{ sessionCode: string; totalQuestions: number }>("/api/session", {
      questions,
    }),

  join: (code: string, displayName?: string, playerId?: string) =>
    postJson<JoinResponse>("/api/join", { code, displayName, playerId }),

  negotiate: (code: string, userId?: string) =>
    getJson<{ url: string; userId: string }>(
      `/api/negotiate?code=${encodeURIComponent(code)}${
        userId ? `&userId=${encodeURIComponent(userId)}` : ""
      }`,
    ),

  submitAnswer: (
    code: string,
    playerId: string,
    questionOrder: number,
    choice: number,
  ) =>
    postJson<AnswerResponse>("/api/answer", {
      code,
      playerId,
      questionOrder,
      choice,
    }),

  control: (code: string, action: string) =>
    postJson<{ state: SessionState }>("/api/control", { code, action }),

  getState: (code: string) =>
    getJson<{ state: SessionState }>(
      `/api/session/${encodeURIComponent(code)}/state`,
    ),

  leaderboard: (code: string) =>
    getJson<{ sessionCode: string; leaderboard: SessionState["leaderboard"] }>(
      `/api/session/${encodeURIComponent(code)}/leaderboard`,
    ),

  // ---- Authoring (host deck editor) ----
  getQuestions: (code: string) =>
    getJson<{ sessionCode: string; questions: EditableQuestion[] }>(
      `/api/session/${encodeURIComponent(code)}/questions`,
    ),

  updateQuestions: (code: string, questions: EditableQuestion[]) =>
    putJson<{ totalQuestions: number }>(
      `/api/session/${encodeURIComponent(code)}/questions`,
      { questions },
    ),

  // End + purge a session (deletes all its data). Broadcasts "ended" first.
  deleteSession: (code: string) =>
    del<{ deleted: boolean }>(`/api/session/${encodeURIComponent(code)}`),
};
