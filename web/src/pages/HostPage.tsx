import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { SessionState } from "../api/types";
import { useRealtime } from "../api/useRealtime";
import {
  clearHostCode,
  loadHostCode,
  saveHostCode,
} from "../api/storage";
import { GuildBadge } from "../components/GuildBadge";
import { Leaderboard } from "../components/Leaderboard";
import { QRCode } from "../components/QRCode";
import { getRenderer } from "../questiontypes/renderers";

export function HostPage() {
  const [code, setCode] = useState<string | null>(null);
  const [wpsUrl, setWpsUrl] = useState<string | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Rehydrate if the host refreshes mid-session.
  useEffect(() => {
    const stored = loadHostCode();
    if (stored) attachToSession(stored).catch(() => clearHostCode());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMessage = useCallback((msg: { state?: SessionState }) => {
    if (msg.state) setState(msg.state);
  }, []);

  useRealtime({ url: wpsUrl, sessionCode: code, onMessage });

  // Build the player join URL the QR encodes.
  const joinUrl = code
    ? `${window.location.origin}/join?code=${code}`
    : "";

  async function attachToSession(c: string) {
    const [{ state }, neg] = await Promise.all([
      api.getState(c),
      api.negotiate(c, "host"),
    ]);
    setCode(c);
    setState(state);
    setWpsUrl(neg.url);
    saveHostCode(c);
  }

  async function createSession() {
    setError("");
    setCreating(true);
    try {
      const { sessionCode } = await api.createSession();
      await attachToSession(sessionCode);
      setShowQR(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  const control = useCallback(
    async (action: string) => {
      if (!code) return;
      try {
        const { state } = await api.control(code, action);
        setState(state); // optimistic; broadcast will also arrive
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [code],
  );

  function endSession() {
    if (!confirm("End this session for everyone?")) return;
    control("end");
    clearHostCode();
  }

  // ---- No session yet ----
  if (!code || !state) {
    return (
      <div className="center-screen">
        <GuildBadge fixed />
        <div className="card" style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ color: "var(--ing-orange)" }}>Host Guild Live</h1>
          <p className="muted">
            Create a session, then show the QR for the room to join.
          </p>
          {error && <div className="error-text">{error}</div>}
          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={createSession}
            disabled={creating}
            style={{ marginTop: 16 }}
          >
            {creating ? "Creating…" : "Create session"}
          </button>
        </div>
      </div>
    );
  }

  // ---- Full-screen QR overlay ----
  if (showQR) {
    return (
      <div className="qr-fullscreen">
        <GuildBadge fixed />
        <h1 className="qr-title">Join at {window.location.host}/join</h1>
        <div className="qr-code-wrap">
          <QRCode value={joinUrl} size={Math.min(window.innerWidth, 520) - 80} />
        </div>
        <div className="qr-code-big">
          Code: <span>{code}</span>
        </div>
        <p className="muted">{state.playerCount} players joined</p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => {
            if (state.status === "lobby") control("start");
            setShowQR(false);
          }}
        >
          {state.status === "lobby" ? "Start game ▶" : "Back to game"}
        </button>
      </div>
    );
  }

  // ---- Projector / control view ----
  return (
    <div className="host-screen">
      <GuildBadge fixed />
      <header className="host-header">
        <div className="row">
          <span className="host-code">Code {code}</span>
          <span className="muted">{state.playerCount} players</span>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => setShowQR(true)}>
            Show QR
          </button>
          <button className="btn btn-ghost" onClick={endSession}>
            End
          </button>
        </div>
      </header>

      <main className="host-stage">
        {state.screen === "lobby" && (
          <div className="center-col">
            <h1>Ready when you are</h1>
            <p className="muted">{state.playerCount} players in the lobby</p>
            <button className="btn btn-primary btn-lg" onClick={() => control("start")}>
              Start game ▶
            </button>
          </div>
        )}

        {state.screen === "question" && state.currentQuestion && (
          <HostQuestion state={state} control={control} />
        )}

        {state.screen === "leaderboard" && (
          <div className="center-col" style={{ width: "100%" }}>
            <h1>Leaderboard</h1>
            <Leaderboard entries={state.leaderboard} />
          </div>
        )}

        {state.screen === "final" && (
          <div className="center-col" style={{ width: "100%" }}>
            <Leaderboard entries={state.leaderboard} final />
          </div>
        )}
      </main>

      <footer className="host-controls">
        <button
          className="btn btn-ghost btn-lg"
          onClick={() => control("prevQuestion")}
          disabled={state.currentIndex <= 0}
        >
          ◀ Prev Q
        </button>
        <button
          className="btn btn-secondary btn-lg"
          onClick={() => control("showLeaderboard")}
        >
          Leaderboard
        </button>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => control("nextQuestion")}
        >
          {state.currentIndex >= state.totalQuestions - 1 ? "Finish ▶" : "Next Q ▶"}
        </button>
      </footer>
    </div>
  );
}

function HostQuestion({
  state,
  control,
}: {
  state: SessionState;
  control: (action: string) => void;
}) {
  const q = state.currentQuestion!;
  const renderer = getRenderer(q.type);
  if (!renderer) return <p className="muted">Unsupported question type.</p>;
  const { Host } = renderer;
  return (
    <div style={{ width: "100%" }}>
      <div className="host-qmeta muted">
        Question {state.currentIndex + 1} / {state.totalQuestions}
      </div>
      <Host question={q} state={state} control={control} />
    </div>
  );
}
