/**
 * Invite code and early member badge. localStorage.
 */

const EARLY_MEMBER_KEY = "xchange-early-member";
const INVITE_CODE_KEY = "xchange-invite-code";
const INVITED_COUNT_KEY = "xchange-invited-count";

export function setEarlyMember(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EARLY_MEMBER_KEY, "true");
  } catch {
    // ignore
  }
}

export function isEarlyMember(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(EARLY_MEMBER_KEY) === "true";
}

/** Generate and store invite code from username. Format: XCH-USER-XXXX */
export function getOrCreateInviteCode(username: string): string {
  if (typeof window === "undefined") return "XCH-XXXX-XXXX";
  try {
    let code = window.localStorage.getItem(INVITE_CODE_KEY);
    if (code) return code;
    const prefix = (username || "user").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "USER";
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    code = `XCH-${prefix}-${suffix}`;
    window.localStorage.setItem(INVITE_CODE_KEY, code);
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
}
