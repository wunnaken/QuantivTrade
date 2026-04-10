/**
 * Invite code and early member badge.
 * localStorage cache + synced to Supabase profiles columns.
 */

const EARLY_MEMBER_KEY = "quantivtrade-early-member";
const INVITE_CODE_KEY = "quantivtrade-invite-code";
const INVITED_COUNT_KEY = "quantivtrade-invited-count";

export function setEarlyMember(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(EARLY_MEMBER_KEY, "true"); } catch { /* ignore */ }
  fetch("/api/profile/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ is_early_member: true }),
  }).catch(() => {});
}

export function isEarlyMember(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(EARLY_MEMBER_KEY) === "true";
}

export function getOrCreateInviteCode(username: string): string {
  if (typeof window === "undefined") return "XCH-XXXX-XXXX";
  try {
    let code = window.localStorage.getItem(INVITE_CODE_KEY);
    if (code) return code;
    const prefix = (username || "user").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "USER";
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    code = `XCH-${prefix}-${suffix}`;
    window.localStorage.setItem(INVITE_CODE_KEY, code);
    // Persist to DB
    fetch("/api/profile/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ invite_code: code }),
    }).catch(() => {});
    return code;
  } catch {
    return "XCH-XXXX-XXXX";
  }
}

export function getInvitedCount(): number {
  if (typeof window === "undefined") return 0;
  const n = parseInt(window.localStorage.getItem(INVITED_COUNT_KEY) ?? "0", 10);
  return isNaN(n) ? 0 : n;
}

export function setInvitedCount(count: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INVITED_COUNT_KEY, String(count));
  fetch("/api/profile/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ invited_count: count }),
  }).catch(() => {});
}

/** On login, load invite data from DB and sync local cache. */
export async function loadInviteFromDB(): Promise<void> {
  try {
    const res = await fetch("/api/profile/me", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json() as {
      invite_code?: string | null;
      invited_count?: number;
      is_early_member?: boolean;
    };
    if (data.invite_code) window.localStorage.setItem(INVITE_CODE_KEY, data.invite_code);
    if (typeof data.invited_count === "number") window.localStorage.setItem(INVITED_COUNT_KEY, String(data.invited_count));
    if (data.is_early_member) window.localStorage.setItem(EARLY_MEMBER_KEY, "true");
  } catch { /* ignore */ }
}
