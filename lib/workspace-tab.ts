/**
 * Remember which Workspace tab (AI, Dashboard, Whiteboard) the user was last on.
 * Used so "Workspace" in the sidebar returns to the same tab.
 */

const STORAGE_KEY = "quantivtrade-workspace-tab";

export type WorkspaceTab = "ai" | "dashboard" | "whiteboard";

const DEFAULT: WorkspaceTab = "ai";

export function getLastWorkspaceTab(): WorkspaceTab {
  if (typeof window === "undefined") return DEFAULT;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "ai" || v === "dashboard" || v === "whiteboard") return v;
  return DEFAULT;
}

export function setLastWorkspaceTab(tab: WorkspaceTab): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, tab);
}
