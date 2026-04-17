import { createClient } from "./supabase/client";

const STORAGE_KEY = "quantivtrade-sidebar-prefs";

export type SidebarPrefs = {
  order: string[];
  hidden: string[];
  collapsed: boolean;
  collapsedSections: string[];
  sectionOrder: string[];
  standaloneOrder: string[];
  hiddenStandalone: string[];
};

const DEFAULT_STANDALONE = ["/feed", "/social-feed", "/marketplace", "/brokers", "/archive"];

function getDefaultPrefs(allHrefs: string[]): SidebarPrefs {
  return { order: [...allHrefs], hidden: [], collapsed: false, collapsedSections: ["community", "markets", "analytics", "personal"], sectionOrder: [], standaloneOrder: [...DEFAULT_STANDALONE], hiddenStandalone: [] };
}

function normalizePrefs(raw: unknown, allHrefs: string[]): SidebarPrefs {
  const defaultOrder = [...allHrefs];
  const set = new Set(allHrefs);
  const standaloneSet = new Set(DEFAULT_STANDALONE);
  try {
    const parsed = raw as { order?: unknown; hidden?: unknown; collapsed?: boolean; collapsedSections?: unknown; sectionOrder?: unknown; standaloneOrder?: unknown; hiddenStandalone?: unknown };
    const order = Array.isArray(parsed?.order) ? (parsed.order as string[]) : defaultOrder;
    const hidden = Array.isArray(parsed?.hidden) ? (parsed.hidden as string[]) : [];
    const collapsed = typeof parsed?.collapsed === "boolean" ? parsed.collapsed : false;
    const collapsedSections = Array.isArray(parsed?.collapsedSections) ? (parsed.collapsedSections as string[]) : ["community", "markets", "analytics", "personal"];
    const sectionOrder = Array.isArray(parsed?.sectionOrder) ? (parsed.sectionOrder as string[]) : [];
    const standaloneOrder = Array.isArray(parsed?.standaloneOrder)
      ? (parsed.standaloneOrder as string[]).filter((h) => standaloneSet.has(h))
      : [...DEFAULT_STANDALONE];
    const missingStandalone = DEFAULT_STANDALONE.filter((h) => !standaloneOrder.includes(h));
    const hiddenStandalone = Array.isArray(parsed?.hiddenStandalone)
      ? (parsed.hiddenStandalone as string[]).filter((h) => standaloneSet.has(h))
      : [];
    const orderFiltered = order.filter((h) => set.has(h));
    const missing = allHrefs.filter((h) => !orderFiltered.includes(h));
    const hiddenFiltered = hidden.filter((h) => set.has(h) && !missing.includes(h));
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
    return { order: nextOrder, hidden: hiddenFiltered, collapsed, collapsedSections, sectionOrder, standaloneOrder: [...standaloneOrder, ...missingStandalone], hiddenStandalone };
  } catch {
    return getDefaultPrefs(allHrefs);
  }
}

function getLocalPrefs(allHrefs: string[]): SidebarPrefs {
  if (typeof window === "undefined") return getDefaultPrefs(allHrefs);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPrefs(allHrefs);
    return normalizePrefs(JSON.parse(raw), allHrefs);
  } catch {
    return getDefaultPrefs(allHrefs);
  }
}

function setLocalPrefs(prefs: SidebarPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export async function loadSidebarPrefs(userId: string | null, allHrefs: string[]): Promise<SidebarPrefs> {
  if (!userId) return getLocalPrefs(allHrefs);
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("sidebar_preferences")
      .eq("user_id", userId)
      .single();
    if (data?.sidebar_preferences) {
      return normalizePrefs(data.sidebar_preferences, allHrefs);
    }
    // First login: migrate any existing localStorage prefs into Supabase
    const local = getLocalPrefs(allHrefs);
    await supabase
      .from("profiles")
      .update({ sidebar_preferences: local })
      .eq("user_id", userId);
    return local;
  } catch {
    return getLocalPrefs(allHrefs);
  }
}

export async function saveSidebarPrefs(userId: string | null, prefs: SidebarPrefs): Promise<void> {
  setLocalPrefs(prefs); // keep localStorage in sync as offline fallback
  if (!userId) return;
  try {
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ sidebar_preferences: prefs })
      .eq("user_id", userId);
  } catch {
    // ignore — localStorage already saved above
  }
}
