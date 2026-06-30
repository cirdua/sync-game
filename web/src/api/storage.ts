// Small localStorage wrapper so a player/host survives a refresh and rehydrates
// (architecture.md §6). Stored per session code.

interface PlayerSession {
  code: string;
  playerId: string;
  displayName: string;
}

const PLAYER_KEY = "guildlive.player";

export function savePlayer(p: PlayerSession): void {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(p));
}

export function loadPlayer(): PlayerSession | null {
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    return raw ? (JSON.parse(raw) as PlayerSession) : null;
  } catch {
    return null;
  }
}

export function clearPlayer(): void {
  localStorage.removeItem(PLAYER_KEY);
}

// ---- Host session (so the presenter survives a refresh mid-game) ----
const HOST_KEY = "guildlive.host";

export function saveHostCode(code: string): void {
  localStorage.setItem(HOST_KEY, code);
}
export function loadHostCode(): string | null {
  return localStorage.getItem(HOST_KEY);
}
export function clearHostCode(): void {
  localStorage.removeItem(HOST_KEY);
}
