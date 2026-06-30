import { PublicQuestion, SessionState } from "../api/types";

// =============================================================================
// Frontend question-type renderers — the client-side mirror of the backend's
// QuestionTypeHandler registry. Each type provides a HOST view (projector) and a
// PLAYER view. The page components look the renderer up by `type` and never
// hard-code a specific question type. Adding a type = add a renderer here.
// =============================================================================

export interface HostRenderProps {
  question: PublicQuestion;
  state: SessionState;
  control: (action: string) => void;
}

export interface PlayerRenderProps {
  question: PublicQuestion;
  state: SessionState;
  /** Submit an answer choice (scored types). Resolves with personal result. */
  answer: (choice: number) => void;
  /** Whether this player has already answered the current question. */
  answered: boolean;
  /** Last personal result for the current question, if any. */
  result: { correct: boolean; pointsAwarded: number } | null;
}

// ---- Word Flash -------------------------------------------------------------
function WordFlashHost({ question, control }: HostRenderProps) {
  if (question.type !== "wordflash") return null;
  return (
    <div className="wf-host">
      <div className="wf-word">{question.word || "…"}</div>
      <div className="wf-progress muted">
        {question.wordIndex + 1} / {question.totalWords}
      </div>
      <div className="row" style={{ justifyContent: "center", marginTop: 24 }}>
        <button
          className="btn btn-ghost btn-lg"
          onClick={() => control("prevWord")}
          disabled={question.wordIndex <= 0}
        >
          ◀ Prev
        </button>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => control("nextWord")}
          disabled={question.wordIndex >= question.totalWords - 1}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}

function WordFlashPlayer({ question }: PlayerRenderProps) {
  if (question.type !== "wordflash") return null;
  // Players mirror the flashed word; no interaction.
  return (
    <div className="wf-player">
      <div className="wf-word-sm">{question.word || "…"}</div>
      <p className="muted">Watch the big screen ✨</p>
    </div>
  );
}

// ---- Multiple Choice --------------------------------------------------------
const CHOICE_COLORS = ["var(--ing-orange)", "var(--blue)", "var(--violet)", "#2e9e5b"];

function MultipleChoiceHost({ question, control }: HostRenderProps) {
  if (question.type !== "multiplechoice") return null;
  return (
    <div className="mc-host">
      <h2 className="mc-question">{question.question}</h2>
      <div className="mc-grid">
        {question.options.map((opt, i) => {
          const isCorrect = question.revealed && question.correctAnswer === i;
          return (
            <div
              key={i}
              className="mc-option"
              style={{
                background: CHOICE_COLORS[i % CHOICE_COLORS.length],
                outline: isCorrect ? "6px solid #181c21" : "none",
                opacity: question.revealed && !isCorrect ? 0.45 : 1,
              }}
            >
              {opt}
              {isCorrect && <span className="mc-check"> ✓</span>}
            </div>
          );
        })}
      </div>
      <div className="row" style={{ justifyContent: "center", marginTop: 20 }}>
        {!question.revealed ? (
          <button
            className="btn btn-secondary btn-lg"
            onClick={() => control("reveal")}
          >
            Reveal answer
          </button>
        ) : (
          <span className="muted">Answer revealed</span>
        )}
      </div>
    </div>
  );
}

function MultipleChoicePlayer({
  question,
  answer,
  answered,
  result,
}: PlayerRenderProps) {
  if (question.type !== "multiplechoice") return null;

  if (answered || result) {
    return (
      <div className="mc-answered">
        {result ? (
          result.correct ? (
            <>
              <div className="result-emoji">✅</div>
              <h2>Correct!</h2>
              <p className="points">+{result.pointsAwarded} pts</p>
            </>
          ) : (
            <>
              <div className="result-emoji">❌</div>
              <h2>Not this time</h2>
            </>
          )
        ) : (
          <>
            <div className="result-emoji">⏳</div>
            <h2>Answer locked in</h2>
            <p className="muted">Waiting for results…</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mc-player-grid">
      {question.options.map((opt, i) => (
        <button
          key={i}
          className="mc-player-option"
          style={{ background: CHOICE_COLORS[i % CHOICE_COLORS.length] }}
          onClick={() => answer(i)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ---- OpenText (stub renderer for the extension example) ---------------------
function OpenTextHost({ question }: HostRenderProps) {
  if (question.type !== "opentext") return null;
  return <h2 className="mc-question">{question.prompt}</h2>;
}
function OpenTextPlayer({ question }: PlayerRenderProps) {
  if (question.type !== "opentext") return null;
  return <p className="muted">{question.prompt} (open-text — coming soon)</p>;
}

// ---- Registry ---------------------------------------------------------------
interface Renderer {
  Host: (p: HostRenderProps) => JSX.Element | null;
  Player: (p: PlayerRenderProps) => JSX.Element | null;
}

const RENDERERS: Record<string, Renderer> = {
  wordflash: { Host: WordFlashHost, Player: WordFlashPlayer },
  multiplechoice: { Host: MultipleChoiceHost, Player: MultipleChoicePlayer },
  opentext: { Host: OpenTextHost, Player: OpenTextPlayer },
};

export function getRenderer(type: string): Renderer | null {
  return RENDERERS[type] ?? null;
}
