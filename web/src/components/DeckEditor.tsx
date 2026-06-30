import { useEffect, useState } from "react";
import { api } from "../api/client";
import { EditableQuestion } from "../api/types";

// =============================================================================
// Lobby deck editor (host only, pre-start). Add / remove / reorder / edit
// Word Flash and Multiple Choice questions, then Save. Replaces the whole deck
// server-side via PUT /session/{code}/questions.
//
// Type-extensible like the renderer registry: each question type provides a
// `blank()` factory + an `Editor` sub-component, registered in TYPE_EDITORS.
// Adding a type = one entry here (plus its backend handler + player renderer).
// =============================================================================

interface TypeEditor {
  label: string;
  blank: () => EditableQuestion;
  Editor: (props: {
    q: EditableQuestion;
    index: number;
    onChange: (q: EditableQuestion) => void;
  }) => JSX.Element;
}

// ---- Word Flash editor ------------------------------------------------------
function WordFlashEditor({
  q,
  onChange,
}: {
  q: EditableQuestion;
  index: number;
  onChange: (q: EditableQuestion) => void;
}) {
  const words = (q.payload as { words: string[] }).words ?? [];
  const setWords = (next: string[]) =>
    onChange({ ...q, payload: { words: next } });

  return (
    <div className="stack">
      {words.map((w, i) => (
        <div className="row" key={i}>
          <input
            className="input"
            value={w}
            placeholder={`Word / phrase ${i + 1}`}
            onChange={(e) => {
              const next = [...words];
              next[i] = e.target.value;
              setWords(next);
            }}
          />
          <button
            className="btn btn-ghost"
            onClick={() => setWords(words.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button className="btn btn-ghost" onClick={() => setWords([...words, ""])}>
        + Add word
      </button>
    </div>
  );
}

// ---- Multiple Choice editor -------------------------------------------------
function MultipleChoiceEditor({
  q,
  index,
  onChange,
}: {
  q: EditableQuestion;
  index: number;
  onChange: (q: EditableQuestion) => void;
}) {
  const payload = q.payload as { question: string; options: string[] };
  const options = payload.options ?? [];

  const update = (patch: Partial<EditableQuestion>) => onChange({ ...q, ...patch });
  const setOptions = (next: string[]) =>
    update({ payload: { ...payload, options: next } });

  return (
    <div className="stack">
      <input
        className="input"
        placeholder="Question text"
        value={payload.question}
        onChange={(e) =>
          update({ payload: { ...payload, question: e.target.value } })
        }
      />
      {options.map((opt, i) => (
        <div className="row" key={i}>
          <input
            type="radio"
            name={`correct-q${index}`}
            checked={q.correctAnswer === i}
            onChange={() => update({ correctAnswer: i })}
            title="Mark as correct answer"
          />
          <input
            className="input"
            value={opt}
            placeholder={`Option ${i + 1}`}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              setOptions(next);
            }}
          />
          {options.length > 2 && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                const next = options.filter((_, j) => j !== i);
                // keep correctAnswer valid after removal
                let correct = q.correctAnswer ?? 0;
                if (correct === i) correct = 0;
                else if (correct > i) correct -= 1;
                update({ payload: { ...payload, options: next }, correctAnswer: correct });
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {options.length < 4 && (
        <button
          className="btn btn-ghost"
          onClick={() => setOptions([...options, ""])}
        >
          + Add option
        </button>
      )}
      <div className="row">
        <label className="muted" style={{ minWidth: 90 }}>
          Max points
        </label>
        <input
          className="input"
          type="number"
          value={q.points ?? 1000}
          onChange={(e) => update({ points: Number(e.target.value) || 0 })}
        />
        <label className="muted" style={{ minWidth: 90 }}>
          Time (ms)
        </label>
        <input
          className="input"
          type="number"
          value={q.timeLimitMs ?? 20000}
          onChange={(e) => update({ timeLimitMs: Number(e.target.value) || 0 })}
        />
      </div>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Select the radio next to the correct option.
      </p>
    </div>
  );
}

const TYPE_EDITORS: Record<string, TypeEditor> = {
  wordflash: {
    label: "Word Flash",
    blank: () => ({ type: "wordflash", payload: { words: [""] } }),
    Editor: WordFlashEditor,
  },
  multiplechoice: {
    label: "Multiple Choice",
    blank: () => ({
      type: "multiplechoice",
      payload: { question: "", options: ["", ""] },
      correctAnswer: 0,
      points: 1000,
      timeLimitMs: 20000,
    }),
    Editor: MultipleChoiceEditor,
  },
};

export function DeckEditor({ code }: { code: string }) {
  const [deck, setDeck] = useState<EditableQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    api
      .getQuestions(code)
      .then((r) => setDeck(r.questions))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [code]);

  const updateAt = (i: number, q: EditableQuestion) =>
    setDeck((d) => d.map((item, j) => (j === i ? q : item)));

  const removeAt = (i: number) =>
    setDeck((d) => d.filter((_, j) => j !== i));

  const move = (i: number, dir: -1 | 1) =>
    setDeck((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const add = (type: string) =>
    setDeck((d) => [...d, TYPE_EDITORS[type].blank()]);

  async function save() {
    setError("");
    setSaving(true);
    try {
      await api.updateQuestions(code, deck);
      const refreshed = await api.getQuestions(code);
      setDeck(refreshed.questions);
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Loading deck…</p>;

  return (
    <div className="deck-editor">
      <h2 style={{ marginTop: 0 }}>Edit the deck</h2>
      {error && <div className="error-text">{error}</div>}

      <div className="stack">
        {deck.map((q, i) => {
          const editor = TYPE_EDITORS[q.type];
          return (
            <div className="card deck-card" key={i}>
              <div className="deck-card-head">
                <span className="deck-card-title">
                  {i + 1}. {editor?.label ?? q.type}
                </span>
                <div className="row">
                  <button
                    className="btn btn-ghost"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => move(i, 1)}
                    disabled={i === deck.length - 1}
                  >
                    ↓
                  </button>
                  <button className="btn btn-ghost" onClick={() => removeAt(i)}>
                    Delete
                  </button>
                </div>
              </div>
              {editor ? (
                <editor.Editor
                  q={q}
                  index={i}
                  onChange={(nq) => updateAt(i, nq)}
                />
              ) : (
                <p className="muted">No editor for type “{q.type}”.</p>
              )}
            </div>
          );
        })}
        {deck.length === 0 && (
          <p className="muted">No questions yet — add one below.</p>
        )}
      </div>

      <div className="row" style={{ flexWrap: "wrap", marginTop: 14 }}>
        {Object.entries(TYPE_EDITORS).map(([type, def]) => (
          <button
            key={type}
            className="btn btn-ghost"
            onClick={() => add(type)}
          >
            + Add {def.label}
          </button>
        ))}
        <button
          className="btn btn-secondary"
          onClick={save}
          disabled={saving || deck.length === 0}
        >
          {saving ? "Saving…" : "Save deck"}
        </button>
        {savedAt && <span className="muted">Saved ✓</span>}
      </div>
    </div>
  );
}
