/**
 * localStorage keys and helpers for AI Assistant:
 * - Last 10 conversation starters (for "Recent chats")
 * - User portfolio/context (added to system prompt)
 */

const CONVERSATIONS_KEY = "quantivtrade-ai-conversations";
const PORTFOLIO_CONTEXT_KEY = "quantivtrade-ai-portfolio-context";
const MAX_CONVERSATIONS = 10;

export type StoredConversation = {
  id: string;
  /** First user message (used as label) */
  label: string;
  /** Full messages for reload */
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** When last updated */
  at: number;
};

export function getStoredConversations(): StoredConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (c): c is StoredConversation =>
          c &&
          typeof c === "object" &&
          typeof (c as StoredConversation).id === "string" &&
          typeof (c as StoredConversation).label === "string" &&
          Array.isArray((c as StoredConversation).messages)
      )
      .slice(0, MAX_CONVERSATIONS)
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  } catch {
    return [];
  }
}

export function deleteConversation(id: string): void {
  if (typeof window === "undefined") return;
  const list = getStoredConversations().filter((c) => c.id !== id);
  window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list));
  fetch("/api/profile/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ui_prefs_patch: { ai_conversations: list } }),
  }).catch(() => {});
}

export function saveConversation(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): void {
  if (typeof window === "undefined" || messages.length === 0) return;
  const userFirst = messages.find((m) => m.role === "user");
  const label =
    userFirst?.content?.slice(0, 60)?.trim()?.replace(/\s+/g, " ") || "New chat";
  const list = getStoredConversations();
  const id = `conv-${Date.now()}`;
  const entry: StoredConversation = {
    id,
    label,
    messages: [...messages],
    at: Date.now(),
  };
  const next = [entry, ...list.filter((c) => c.id !== id)].slice(0, MAX_CONVERSATIONS);
  window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(next));
  fetch("/api/profile/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ui_prefs_patch: { ai_conversations: next } }),
  }).catch(() => {});
}

export function getPortfolioContext(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PORTFOLIO_CONTEXT_KEY) ?? "";
}

export function setPortfolioContext(context: string): void {
  if (typeof window === "undefined") return;
  const trimmed = context.trim();
  window.localStorage.setItem(PORTFOLIO_CONTEXT_KEY, trimmed);
  fetch("/api/profile/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ui_prefs_patch: { ai_portfolio_context: trimmed } }),
  }).catch(() => {});
}

/** On login, sync AI chat state from DB. Call once after authentication. */
export async function loadAIChatFromDB(): Promise<void> {
  try {
    const res = await fetch("/api/profile/me", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json() as { ui_preferences?: Record<string, unknown> };
    const prefs = data?.ui_preferences ?? {};

    if (typeof prefs.ai_portfolio_context === "string" && prefs.ai_portfolio_context) {
      window.localStorage.setItem(PORTFOLIO_CONTEXT_KEY, prefs.ai_portfolio_context);
    }
    if (Array.isArray(prefs.ai_conversations) && prefs.ai_conversations.length > 0) {
      window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify((prefs.ai_conversations as StoredConversation[]).slice(0, MAX_CONVERSATIONS)));
    }
  } catch { /* ignore */ }
}
