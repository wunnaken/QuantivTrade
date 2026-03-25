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
}

export function getPortfolioContext(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PORTFOLIO_CONTEXT_KEY) ?? "";
}

export function setPortfolioContext(context: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PORTFOLIO_CONTEXT_KEY, context.trim());
}
