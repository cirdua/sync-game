import { MultipleChoiceHandler } from "./multiplechoice";
import { OpenTextStubHandler } from "./opentext.stub";
import { QuestionTypeHandler } from "./types";
import { WordFlashHandler } from "./wordflash";

// Single registration point for all question types. The core game loop only
// ever looks types up here — it never imports a concrete handler directly.
// To add a type: implement QuestionTypeHandler and add it to this array.

const HANDLERS: QuestionTypeHandler[] = [
  WordFlashHandler,
  MultipleChoiceHandler,
  OpenTextStubHandler, // stub / extension example (not used by v1 flows)
];

const byType = new Map<string, QuestionTypeHandler>(
  HANDLERS.map((h) => [h.type, h]),
);

export function getHandler(type: string): QuestionTypeHandler {
  const h = byType.get(type);
  if (!h) {
    throw new Error(`Unknown question type: ${type}`);
  }
  return h;
}

export function isKnownType(type: string): boolean {
  return byType.has(type);
}

export function listTypes(): string[] {
  return [...byType.keys()];
}
