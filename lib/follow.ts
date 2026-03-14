const FOLLOW_KEY = "xchange-following";

export function getFollowed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FOLLOW_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export function follow(userId: string): void {
  const list = getFollowed();
  const id = userId.trim();
  if (!id || list.includes(id)) return;
  list.push(id);
  try {
    window.localStorage.setItem(FOLLOW_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function unfollow(userId: string): void {
  const list = getFollowed().filter((x) => x !== userId.trim());
  try {
    window.localStorage.setItem(FOLLOW_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function isFollowing(userId: string): boolean {
  return getFollowed().includes(userId.trim());
}
