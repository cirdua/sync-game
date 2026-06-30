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
import { DeckEditor } from "../components/DeckEditor";
import { getRenderer } from "../questiontypes/renderers";

export function HostPage() {
  const [code, setCode] = useState<string | null>(null);
  const [wpsUrl, setWpsUrl] = useState<string | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showQR, setShowQR] = useState(false);
  // Lobby deck editor is collapsed by default; "Edit deck" reveals it.
  const [showEditor, setShowEditor] = useState(false);

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
      // Land on the lobby (with the deck editor). Host opens the QR when ready
      // for the room to join via "Show QR".
      setShowQR(false);
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

  function resetToSetup() {
    // Drop all session state -> renders the "Create session" setup screen again.
    setCode(null);
    setState(null);
    setWpsUrl(null);
    setShowQR(false);
    setShowEditor(false);
    setError("");
    clearHostCode();
  }

  async function endSession() {
    if (!confirm("End this session for everyone? This deletes the game data.")) {
      return;
    }
    const c = code;
    // Return to the setup screen immediately; purge in the background.
    resetToSetup();
    if (c) {
      try {
        await api.deleteSession(c); // broadcasts "ended" + deletes all data
      } catch (e) {
        // Non-fatal for the host UI — they're already back at setup.
        console.warn("deleteSession failed:", (e as Error).message);
      }
    }
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
        <div className="row">
          <button className="btn btn-ghost btn-lg" onClick={() => setShowQR(false)}>
            {state.status === "lobby" ? "◀ Back to lobby" : "◀ Back to game"}
          </button>
          {state.status === "lobby" && (
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                control("start");
                setShowQR(false);
              }}
            >
              Start game ▶
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- Projector / control view ----
  // Label for the single "Next ▶" button reflects what the next press will do,
  // mirroring the backend `advance` sequence:
  //   scored question (not revealed) -> "Reveal answer"
  //   scored question (revealed)     -> "Show leaderboard"
  //   leaderboard                    -> "Next question" / "Finish"
  //   unscored question              -> "Next question" / "Finish"
  function advanceLabel(): string {
    const isLast = state!.currentIndex >= state!.totalQuestions - 1;
    const q = state!.currentQuestion as { revealed?: boolean } | null;
    if (state!.screen === "question" && state!.scored) {
      if (!q?.revealed) return "Reveal answer ▶";
      return "Show leaderboard ▶";
    }
    if (state!.screen === "leaderboard") {
      return isLast ? "Finish ▶" : "Next question ▶";
    }
    // unscored question or other
    return isLast ? "Finish ▶" : "Next question ▶";
  }

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
          <div className="center-col" style={{ width: "100%", maxWidth: 720 }}>
            <h1>Ready when you are</h1>
            <p className="muted">
              {state.playerCount} players in the lobby · {state.totalQuestions}{" "}
              questions
            </p>

            <div className="row" style={{ flexWrap: "wrap", justifyContent: "center" }}>
              <button
                className={`btn ${showEditor ? "btn-secondary" : "btn-ghost"}`}
                onClick={() => setShowEditor((v) => !v)}
              >
                {showEditor ? "Hide deck editor" : "Edit deck"}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowQR(true)}>
                Show QR
              </button>
            </div>

            {/* Pre-start deck editor — host can add/remove/reorder/edit.
                Remounts each time it's opened so it always loads the latest deck. */}
            {showEditor && <DeckEditor key={`editor-${code}`} code={code} />}

            <button
              className="btn btn-primary btn-lg"
              onClick={() => control("start")}
              style={{ marginTop: 8 }}
            >
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
        {/* Manual jump to leaderboard (independent of the stepped flow). */}
        {state.screen !== "leaderboard" && (
          <button
            className="btn btn-secondary btn-lg"
            onClick={() => control("showLeaderboard")}
          >
            Leaderboard
          </button>
        )}
        {/* Single primary button walks the per-question sequence (advance). */}
        <button
          className="btn btn-primary btn-lg"
          onClick={() => control("advance")}
        >
          {advanceLabel()}
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
