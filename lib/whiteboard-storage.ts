/**
 * Whiteboard boards: localStorage cache + Supabase sync via /api/whiteboard.
 */

const BOARDS_KEY = "quantivtrade-whiteboard-boards";
const BANNER_KEY = "quantivtrade-whiteboard-banner-dismissed";
export const MAX_BOARDS = 5;

export type SavedBoard = {
  id: string;
  name: string;
  scene: {
    elements: unknown[];
    appState: Record<string, unknown>;
    files?: Record<string, unknown>;
  };
  updatedAt: number;
};

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (v instanceof Map) return Object.fromEntries(v.entries());
      if (v instanceof Set) return Array.from(v.values());
      if (typeof v === "function") return undefined;
      return v;
    })
  ) as T;
}

function getBoards(): SavedBoard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BOARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedBoard[]).slice(0, MAX_BOARDS) : [];
  } catch { return []; }
}

export function getSavedBoards(): SavedBoard[] {
  return getBoards().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function saveBoard(id: string, name: string, scene: SavedBoard["scene"]): void {
  if (typeof window === "undefined") return;
  const list = getBoards().filter((b) => b.id !== id);
  const safeScene = toJsonSafe(scene);
  list.unshift({ id, name, scene: safeScene, updatedAt: Date.now() });
  window.localStorage.setItem(BOARDS_KEY, JSON.stringify(list.slice(0, MAX_BOARDS)));
  // Sync to Supabase (boardId must be numeric for the existing API)
  const boardIdForApi = id.startsWith("board-") ? id.slice("board-".length) : id;
  fetch("/api/whiteboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ boardId: boardIdForApi, name, scene: safeScene }),
  }).catch(() => {});
}

export function deleteBoard(id: string): void {
  if (typeof window === "undefined") return;
  const list = getBoards().filter((b) => b.id !== id);
  window.localStorage.setItem(BOARDS_KEY, JSON.stringify(list));
  const boardIdForApi = id.startsWith("board-") ? id.slice("board-".length) : id;
  fetch(`/api/whiteboard?boardId=${encodeURIComponent(boardIdForApi)}`, {
    method: "DELETE",
    credentials: "include",
  }).catch(() => {});
}

/** On login, load boards from DB and merge with local (DB wins on conflict). */
export async function loadBoardsFromDB(): Promise<void> {
  try {
    const res = await fetch("/api/whiteboard", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json() as { boards?: Array<{ id: string; name: string; scene?: SavedBoard["scene"]; updated_at?: string }> };
    if (!Array.isArray(data.boards) || data.boards.length === 0) return;
    const local = getBoards();
    const merged: SavedBoard[] = [...local];
    for (const dbBoard of data.boards) {
      const idx = merged.findIndex((b) => b.id === dbBoard.id || b.id === `board-${dbBoard.id}`);
      const updatedAt = dbBoard.updated_at ? new Date(dbBoard.updated_at).getTime() : 0;
      if (idx === -1) {
        merged.push({ id: dbBoard.id, name: dbBoard.name, scene: dbBoard.scene ?? { elements: [], appState: {} }, updatedAt });
      } else if (updatedAt > merged[idx].updatedAt) {
        merged[idx] = { ...merged[idx], name: dbBoard.name, scene: dbBoard.scene ?? merged[idx].scene, updatedAt };
      }
    }
    window.localStorage.setItem(BOARDS_KEY, JSON.stringify(merged.slice(0, MAX_BOARDS)));
  } catch { /* ignore */ }
}

export function getCollaborationBannerDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(BANNER_KEY) === "1";
}

export function setCollaborationBannerDismissed(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BANNER_KEY, "1");
}
