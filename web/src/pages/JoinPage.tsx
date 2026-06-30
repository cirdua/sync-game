import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { AnswerResponse, SessionState } from "../api/types";
import { useRealtime } from "../api/useRealtime";
import { clearPlayer, loadPlayer, savePlayer } from "../api/storage";
import { GuildBadge } from "../components/GuildBadge";
import { Leaderboard } from "../components/Leaderboard";
import { getRenderer } from "../questiontypes/renderers";

export function JoinPage() {
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [wpsUrl, setWpsUrl] = useState<string | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  // Per-question personal answer tracking.
  const [answeredOrder, setAnsweredOrder] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResponse | null>(null);

  // Attempt rehydration on mount if we have a stored session.
  useEffect(() => {
    const stored = loadPlayer();
    if (stored && (!params.get("code") || params.get("code")?.toUpperCase() === stored.code)) {
      reconnect(stored.code, stored.playerId, stored.displayName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMessage = useCallback((msg: { state?: SessionState }) => {
    if (msg.state) {
      setState(msg.state);
    }
  }, []);

  useRealtime({ url: wpsUrl, sessionCode: state?.sessionCode ?? null, onMessage });

  async function doJoin() {
    setError("");
    if (!code.trim()) return setError("Enter a session code");
    if (!name.trim()) return setError("Enter a display name");
    setJoining(true);
    try {
      const res = await api.join(code.trim().toUpperCase(), name.trim());
      setPlayerId(res.playerId);
      setWpsUrl(res.wpsUrl);
      setState(res.state);
      savePlayer({
        code: code.trim().toUpperCase(),
        playerId: res.playerId,
        displayName: res.displayName,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  async function reconnect(c: string, pid: string, dn: string) {
    try {
      const res = await api.join(c, dn, pid);
      setCode(c);
      setName(dn);
      setPlayerId(res.playerId);
      setWpsUrl(res.wpsUrl);
      setState(res.state);
    } catch {
      clearPlayer(); // stale session — fall back to the join form
    }
  }

  // Reset per-question answer state when the question changes.
  useEffect(() => {
    if (state && answeredOrder !== state.currentIndex) {
      setResult(null);
      setAnsweredOrder(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.currentIndex, state?.screen]);

  const answer = useCallback(
    async (choice: number) => {
      if (!state || !playerId) return;
      setAnsweredOrder(state.currentIndex);
      try {
        const res = await api.submitAnswer(
          state.sessionCode,
          playerId,
          state.currentIndex,
          choice,
        );
        setResult(res);
      } catch (e) {
        setError((e as Error).message);
        setAnsweredOrder(null); // allow retry on failure
      }
    },
    [state, playerId],
  );

  // ---- Not joined yet: show the join form ----
  if (!playerId || !state) {
    return (
      <div className="center-screen">
        <GuildBadge fixed />
        <div className="card" style={{ maxWidth: 420, width: "100%" }}>
          <h1 style={{ color: "var(--ing-orange)" }}>Join Guild Live</h1>
          <div className="stack">
            <input
              className="input"
              placeholder="CODE"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ letterSpacing: "0.3em", textAlign: "center", fontWeight: 700 }}
            />
            <input
              className="input"
              placeholder="Your name"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <div className="error-text">{error}</div>}
            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={doJoin}
              disabled={joining}
            >
              {joining ? "Joining…" : "Join"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Joined: render based on session screen ----
  const myEntry = state.leaderboard.find((e) => e.playerId === playerId);

  return (
    <div className="player-screen">
      <GuildBadge fixed />
      <div className="player-topbar">
        <span className="muted">{name}</span>
        <span className="player-score">{myEntry?.totalScore ?? 0} pts</span>
      </div>

      <div className="player-body">
        {state.screen === "lobby" && (
          <div className="center-col">
            <div className="result-emoji">🎮</div>
            <h2>You're in!</h2>
            <p className="muted">Waiting for the host to start…</p>
            <p className="muted">{state.playerCount} players joined</p>
          </div>
        )}

        {state.screen === "question" && state.currentQuestion && (
          <PlayerQuestion
            state={state}
            answer={answer}
            answered={answeredOrder === state.currentIndex}
            result={result ? { correct: result.correct, pointsAwarded: result.pointsAwarded } : null}
          />
        )}

        {state.screen === "leaderboard" && (
          <div className="center-col" style={{ width: "100%" }}>
            <h2>Leaderboard</h2>
            <Leaderboard entries={state.leaderboard} highlightPlayerId={playerId} />
          </div>
        )}

        {state.screen === "final" && (
          <div className="center-col" style={{ width: "100%" }}>
            <Leaderboard entries={state.leaderboard} final highlightPlayerId={playerId} />
            <p className="muted" style={{ marginTop: 16 }}>
              You finished #{myEntry?.rank ?? "—"} — thanks for playing!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerQuestion({
  state,
  answer,
  answered,
  result,
}: {
  state: SessionState;
  answer: (choice: number) => void;
  answered: boolean;
  result: { correct: boolean; pointsAwarded: number } | null;
}) {
  const q = state.currentQuestion!;
  const renderer = getRenderer(q.type);
  if (!renderer) return <p className="muted">Unsupported question type.</p>;
  const { Player } = renderer;
  return <Player question={q} state={state} answer={answer} answered={answered} result={result} />;
}
