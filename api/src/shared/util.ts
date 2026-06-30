import { HttpResponseInit } from "@azure/functions";
import { randomUUID } from "node:crypto";

// ---- Join codes -------------------------------------------------------------
// 6 chars, no ambiguous glyphs (no 0/O/1/I/L). Uppercase for easy reading on a
// projector and typing on a phone.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateSessionCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(code: string | undefined | null): string {
  return (code ?? "").trim().toUpperCase();
}

export function newId(): string {
  return randomUUID();
}

export function now(): number {
  return Date.now();
}

// ---- HTTP helpers -----------------------------------------------------------
export function json(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    jsonBody: body,
    headers: { "Content-Type": "application/json" },
  };
}

export function ok(body: unknown): HttpResponseInit {
  return json(200, body);
}

export function badRequest(message: string): HttpResponseInit {
  return json(400, { error: message });
}

export function notFound(message = "Not found"): HttpResponseInit {
  return json(404, { error: message });
}

export function serverError(message = "Internal error"): HttpResponseInit {
  return json(500, { error: message });
}

/**
 * Build a 500 that includes the real error text. Safe for this no-auth internal
 * event and invaluable for debugging a deployed instance. Pass the caught error.
 */
export function serverErrorFrom(err: unknown): HttpResponseInit {
  const detail =
    err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return json(500, { error: "Internal error", detail });
}

/** Safe JSON body parse for HttpRequest. Returns {} on empty/invalid. */
export async function readJson<T = any>(req: {
  text: () => Promise<string>;
}): Promise<T> {
  try {
    const raw = await req.text();
    if (!raw) return {} as T;
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}
