const STORAGE_KEY = "xchange-sidebar-prefs";

export type SidebarPrefs = {
  order: string[];
  hidden: string[];
};

function getDefaultOrder(allHrefs: string[]): string[] {
  return [...allHrefs];
}

export function getSidebarPrefs(allHrefs: string[]): SidebarPrefs {
  const defaultOrder = getDefaultOrder(allHrefs);
  const set = new Set(allHrefs);
  if (typeof window === "undefined") return { order: defaultOrder, hidden: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { order: defaultOrder, hidden: [] };
    const parsed = JSON.parse(raw) as { order?: unknown; hidden?: unknown };
    const order = Array.isArray(parsed?.order) ? (parsed.order as string[]) : defaultOrder;
    const hidden = Array.isArray(parsed?.hidden) ? (parsed.hidden as string[]) : [];
    const orderFiltered = order.filter((h) => set.has(h));
    const missing = allHrefs.filter((h) => !orderFiltered.includes(h));
    return {
      order: [...orderFiltered, ...missing],
      hidden: hidden.filter((h) => set.has(h)),
    };
  } catch {
    return { order: defaultOrder, hidden: [] };
  }
}

export function saveSidebarPrefs(prefs: SidebarPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
