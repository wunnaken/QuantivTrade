const FOUNDER_EMAIL = "zack.mutz01@gmail.com";

/**
 * The one account that gets the founder badge (visible to everyone).
 * Uses zack.mutz01@gmail.com; override with NEXT_PUBLIC_SPECIAL_ACCOUNT_EMAIL in .env if needed.
 */
export function isSpecialAccount(email: string | undefined): boolean {
  if (!email) return false;
  const special = process.env.NEXT_PUBLIC_SPECIAL_ACCOUNT_EMAIL?.trim().toLowerCase() || FOUNDER_EMAIL.trim().toLowerCase();
  return email.trim().toLowerCase() === special;
}
