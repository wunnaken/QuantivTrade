/** localStorage key for joined community rooms (array of room names). Shared by communities page and profile page. */
export const JOINED_ROOMS_KEY = "xchange-demo-joined-groups";

export function getJoinedRooms(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(JOINED_ROOMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addJoinedRoom(roomName: string): void {
  const list = getJoinedRooms();
  if (list.includes(roomName)) return;
  list.push(roomName);
  window.localStorage.setItem(JOINED_ROOMS_KEY, JSON.stringify(list));
}

export function removeJoinedRoom(roomName: string): void {
  const list = getJoinedRooms().filter((name) => name !== roomName);
  window.localStorage.setItem(JOINED_ROOMS_KEY, JSON.stringify(list));
}

export function isRoomJoined(roomName: string): boolean {
  return getJoinedRooms().includes(roomName);
}
