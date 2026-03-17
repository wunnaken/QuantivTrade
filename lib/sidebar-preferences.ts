const STORAGE_KEY = "xchange-sidebar-prefs";

export type SidebarPrefs = {
  order: string[];
  hidden: string[];
  collapsed: boolean;
};

function getDefaultOrder(allHrefs: string[]): string[] {
  return [...allHrefs];
}

export function getSidebarPrefs(allHrefs: string[]): SidebarPrefs {
  const defaultOrder = getDefaultOrder(allHrefs);
  const set = new Set(allHrefs);
  if (typeof window === "undefined") return { order: defaultOrder, hidden: [], collapsed: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { order: defaultOrder, hidden: [], collapsed: false };
    const parsed = JSON.parse(raw) as { order?: unknown; hidden?: unknown; collapsed?: boolean };
    const order = Array.isArray(parsed?.order) ? (parsed.order as string[]) : defaultOrder;
    const hidden = Array.isArray(parsed?.hidden) ? (parsed.hidden as string[]) : [];
    const collapsed = typeof parsed?.collapsed === "boolean" ? parsed.collapsed : false;
    const orderFiltered = order.filter((h) => set.has(h));
    const missing = allHrefs.filter((h) => !orderFiltered.includes(h));
    const hiddenFiltered = hidden.filter((h) => set.has(h) && !missing.includes(h));

    // If the app adds a new tab, insert it into a sane place for existing users
    // instead of dumping it at the very bottom (often off-screen).
    const nextOrder = [...orderFiltered];
    missing.forEach((href) => {
      if (href === "/sentiment") {
        const after = "/map";
        const idx = nextOrder.indexOf(after);
        if (idx >= 0) nextOrder.splice(idx + 1, 0, href);
        else nextOrder.unshift(href);
      } else {
        nextOrder.push(href);
      }
    });
    return {
      order: nextOrder,
      hidden: hiddenFiltered,
      collapsed,
    };
  } catch {
    return { order: defaultOrder, hidden: [], collapsed: false };
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
