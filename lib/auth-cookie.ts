/** Cookie used by middleware to protect /profile. Set from client when user signs in or hydrates from localStorage. */
export const AUTH_COOKIE_NAME = "xchange-demo-auth";
const AUTH_COOKIE_MAX_AGE_DAYS = 7;
export const AUTH_EMAIL_COOKIE = "xchange-demo-email";
export const AUTH_NAME_COOKIE = "xchange-demo-name";
const MAX_AGE = AUTH_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;

export function setAuthCookie(payload?: { email: string; name: string }): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=1; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  if (payload) {
    const email = encodeURIComponent(payload.email.trim().toLowerCase());
    const name = encodeURIComponent((payload.name || "Trader").trim().slice(0, 200));
    document.cookie = `${AUTH_EMAIL_COOKIE}=${email}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
    document.cookie = `${AUTH_NAME_COOKIE}=${name}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  }
}

export function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${AUTH_EMAIL_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${AUTH_NAME_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
