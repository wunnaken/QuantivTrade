"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import "@excalidraw/excalidraw/index.css";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useToast } from "../../components/ToastContext";
import { getSavedBoards, saveBoard, deleteBoard } from "../../lib/whiteboard-storage";
import { setLastWorkspaceTab } from "../../lib/workspace-tab";
import { useAuth } from "../../components/AuthContext";
import { createClient } from "../../lib/supabase/client";

const TOP_BAR_BG = "#080B14";
const DEFAULT_APP_STATE = { viewBackgroundColor: "#1e1e2e" };
const USER_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#e879f9", "#f87171", "#34d399"];
const CURSOR_THROTTLE_MS = 50;
const SCENE_POLL_MS = 500;
const AUTOSAVE_MS = 30_000;

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[var(--app-bg)] text-zinc-400">
        Loading whiteboard...
      </div>
    ),
  }
) as React.ComponentType<Record<string, unknown>>;

// ── Types ──────────────────────────────────────────────────────────────────────

type SceneData = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files?: Record<string, unknown> | null;
};

type Board = {
  id: string;
  name: string;
  scene: SceneData;
  updated_at?: string;
  is_group?: boolean;
  community_id?: string | null;
  community_name?: string | null;
  allowed_members?: string[];
  permissions?: "edit" | "view";
  user_id?: string;
  creator_name?: string | null;
  member_count?: number;
};

type RemoteCursor = { userId: string; username: string; x: number; y: number; color: string };
type ActiveMember = { userId: string; username: string; color: string; joinedAt: number };
type Community = { id: string; name: string };
type MemberResult = { id: string; username: string; name: string | null };

type ExcalidrawAPI = {
  getSceneElements: () => unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
  updateScene: (opts: { elements?: unknown[]; commitToHistory?: boolean }) => void;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function getUserColor(userId: string): string {
  let h = 0;
  for (const ch of userId) h = ((h * 31) + ch.charCodeAt(0)) | 0;
  return USER_COLORS[Math.abs(h) % USER_COLORS.length] ?? USER_COLORS[0];
}

function sanitizeAppState(appState: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const base = appState && typeof appState === "object" ? { ...appState } : {};
  return { ...base, collaborators: new Map() };
}

function emptyScene(): SceneData {
  return { elements: [], appState: sanitizeAppState({ ...DEFAULT_APP_STATE }), files: {} };
}

function toInitialData(scene: SceneData) {
  return {
    elements: scene.elements ?? [],
    appState: sanitizeAppState(scene.appState ?? { ...DEFAULT_APP_STATE }),
    files: (scene.files as Record<string, unknown>) ?? {},
  };
}

function serializeScene(scene: SceneData): SceneData {
  return {
    elements: JSON.parse(JSON.stringify(scene.elements)),
    appState: JSON.parse(
      JSON.stringify(scene.appState, (_k, v) => {
        if (v instanceof Map) return Object.fromEntries(v.entries());
        if (v instanceof Set) return Array.from(v.values());
        if (typeof v === "function") return undefined;
        return v;
      })
    ),
    files: scene.files ? JSON.parse(JSON.stringify(scene.files)) : {},
  };
}

function mergeElements(local: unknown[], remote: unknown[]): unknown[] {
  const map = new Map((local as Array<{ id: string; version?: number }>).map(e => [e.id, e]));
  for (const el of remote as Array<{ id: string; version?: number }>) {
    const existing = map.get(el.id);
    if (!existing || (el.version ?? 0) >= (existing.version ?? 0)) map.set(el.id, el);
  }
  return Array.from(map.values());
}

async function fetchBoardsFromApi(): Promise<Board[]> {
  try {
    const res = await fetch("/api/whiteboard", { cache: "no-store" });
    if (!res.ok) throw new Error("api");
    const data = (await res.json()) as { boards?: Board[] };
    const boards = Array.isArray(data.boards) ? data.boards : [];
    return boards.map((b) => ({ ...b, id: String((b as Record<string, unknown>).id) }));
  } catch {
    return getSavedBoards().map((b) => ({
      id: b.id.startsWith("board-") ? b.id.slice("board-".length) : b.id,
      name: b.name,
      scene: b.scene,
      updated_at: String(b.updatedAt),
    }));
  }
}

async function fetchGroupBoardsFromApi(): Promise<Board[]> {
  try {
    const res = await fetch("/api/whiteboard/group", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { boards?: Board[] };
    return Array.isArray(data.boards)
      ? data.boards.map(b => ({ ...b, id: String((b as Record<string, unknown>).id) }))
      : [];
  } catch {
    return [];
  }
}

// ── CreateBoardModal ───────────────────────────────────────────────────────────

function CreateBoardModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (board: Board, isGroup: boolean) => void;
}) {
  const [name, setName] = useState("My Trading Board");
  const [isGroup, setIsGroup] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MemberResult[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<MemberResult[]>([]);
  const [permissions, setPermissions] = useState<"edit" | "view">("edit");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isGroup) return;
    fetch("/api/whiteboard/communities")
      .then(r => r.json())
      .then(d => setCommunities(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [isGroup]);

  useEffect(() => {
    if (!memberSearch.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/whiteboard/members?q=${encodeURIComponent(memberSearch)}`)
        .then(r => r.json())
        .then(d => setSearchResults(Array.isArray(d) ? (d as MemberResult[]).slice(0, 5) : []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [memberSearch]);

  const addMember = (m: MemberResult) => {
    if (!selectedMembers.find(x => x.id === m.id)) setSelectedMembers(prev => [...prev, m]);
    setMemberSearch(""); setSearchResults([]);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      if (isGroup) {
        const res = await fetch("/api/whiteboard/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            community_id: communityId || null,
            allowed_members: selectedMembers.map(m => m.id),
            permissions,
          }),
        });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as { board: Board };
        onCreate({ ...data.board, id: String((data.board as Record<string, unknown>).id) }, true);
      } else {
        const id = String(Date.now());
        onCreate({ id, name: name.trim(), scene: emptyScene() }, false);
      }
      onClose();
    } catch { /* fail silently */ }
    finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[440px] max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-zinc-100">New Board</h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Board Name</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[var(--accent-color)]/40"
          />
        </label>

        <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <div>
            <p className="text-sm text-zinc-200">Group Board</p>
            <p className="text-[10px] text-zinc-500">Share with community members</p>
          </div>
          <button
            type="button"
            onClick={() => setIsGroup(v => !v)}
            className={`relative h-5 w-9 rounded-full transition-colors ${isGroup ? "bg-[var(--accent-color)]" : "bg-zinc-700"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isGroup ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>

        {isGroup && (
          <>
            <label className="mb-3 block">
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Community (optional)</span>
              <select
                value={communityId}
                onChange={e => setCommunityId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2 text-sm text-zinc-400 outline-none"
              >
                <option value="">No community</option>
                {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">Add Members</span>
              <div className="relative">
                <input
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Search by username..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[var(--accent-color)]/40"
                />
                {searchResults.length > 0 && (
                  <ul className="absolute top-full z-10 mt-1 w-full rounded-lg border border-white/10 bg-[#080B14] shadow-lg">
                    {searchResults.map(m => (
                      <li
                        key={m.id}
                        onClick={() => addMember(m)}
                        className="cursor-pointer px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg"
                      >
                        <span className="font-medium">@{m.username}</span>
                        {m.name && <span className="ml-1.5 text-zinc-500">{m.name}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {selectedMembers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedMembers.map(m => (
                    <span key={m.id} className="flex items-center gap-1 rounded-full bg-[var(--accent-color)]/10 px-2 py-0.5 text-[11px] text-[var(--accent-color)]">
                      @{m.username}
                      <button type="button" onClick={() => setSelectedMembers(prev => prev.filter(x => x.id !== m.id))} className="opacity-60 hover:opacity-100">×</button>
                    </span>
                  ))}
                </div>
              )}
            </label>

            <div className="mb-4">
              <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">Permissions</span>
              <div className="flex gap-2">
                {(["edit", "view"] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPermissions(p)}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                      permissions === p
                        ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]"
                        : "border border-white/10 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {p === "edit" ? "All members can edit" : "View only for members"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-zinc-400 hover:text-zinc-300">Cancel</button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="flex-1 rounded-lg bg-[var(--accent-color)]/20 py-2 text-sm font-medium text-[var(--accent-color)] hover:bg-[var(--accent-color)]/30 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Board"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ActiveMembersBar ───────────────────────────────────────────────────────────

function ActiveMembersBar({ members }: { members: ActiveMember[] }) {
  if (members.length === 0) return null;
  const shown = members.slice(0, 5);
  const extra = members.length - 5;
  return (
    <div className="flex items-center gap-1">
      {shown.map(m => (
        <div
          key={m.userId}
          title={`@${m.username}`}
          style={{ backgroundColor: m.color }}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-black"
        >
          {(m.username[0] ?? "?").toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">+{extra} more</span>
      )}
      <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WhiteboardPage() {
  const toast = useToast();
  const { user } = useAuth();

  // Board state
  const [tab, setTab] = useState<"personal" | "group">("personal");
  const [boards, setBoards] = useState<Board[]>([]);
  const [groupBoards, setGroupBoards] = useState<Board[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string>("");
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [boardName, setBoardName] = useState("My Trading Board");
  const [editingBoardNameId, setEditingBoardNameId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Realtime state
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);

  // Refs
  const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null);
  const initialDataRef = useRef(toInitialData(emptyScene()));
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cursorTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cursorThrottleRef = useRef<number>(0);
  const sceneHashRef = useRef<string>("");
  const sceneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveFnRef = useRef<() => Promise<void>>(async () => {});
  const authUserIdRef = useRef<string | null>(null);

  // Computed
  const isGroupBoard = activeBoard?.is_group === true;
  const isViewOnly =
    isGroupBoard &&
    activeBoard?.permissions === "view" &&
    activeBoard?.user_id !== authUserIdRef.current;

  // Fetch Supabase auth user ID on mount
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user: sbUser } }) => {
      authUserIdRef.current = sbUser?.id ?? null;
    });
  }, []);

  // Load personal boards on mount
  useEffect(() => {
    setLastWorkspaceTab("whiteboard");
    let cancelled = false;
    fetchBoardsFromApi().then(list => {
      if (cancelled) return;
      setBoards(list);
      if (list.length > 0) {
        const first = list[0];
        initialDataRef.current = toInitialData(first.scene);
        setActiveId(first.id);
        setActiveBoard(first);
        setBoardName(first.name);
        setLastSavedAt(first.updated_at ? new Date(first.updated_at).getTime() : null);
      } else {
        const id = String(Date.now());
        const nb: Board = { id, name: "My Trading Board", scene: emptyScene() };
        initialDataRef.current = toInitialData(emptyScene());
        setBoards([nb]);
        setActiveId(id);
        setActiveBoard(nb);
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Load group boards when switching to group tab
  useEffect(() => {
    if (tab !== "group") return;
    fetchGroupBoardsFromApi().then(list => setGroupBoards(list));
  }, [tab]);

  // Realtime channel lifecycle — subscribe when on a group board
  useEffect(() => {
    const cleanup = async () => {
      if (sceneIntervalRef.current) { clearInterval(sceneIntervalRef.current); sceneIntervalRef.current = null; }
      if (autosaveIntervalRef.current) { clearInterval(autosaveIntervalRef.current); autosaveIntervalRef.current = null; }
      if (channelRef.current) {
        try { await channelRef.current.unsubscribe(); } catch { /* ignore */ }
        channelRef.current = null;
      }
      setRemoteCursors({});
      setActiveMembers([]);
    };

    if (!isGroupBoard || !activeId) { cleanup(); return; }

    let isMounted = true;

    const setup = async () => {
      await cleanup();
      if (!isMounted) return;

      const supabase = createClient();
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      const userId = sbUser?.id;
      if (!userId || !isMounted) return;
      authUserIdRef.current = userId;

      const username = (user as Record<string, unknown>)?.username as string
        ?? (user as Record<string, unknown>)?.name as string
        ?? "User";
      const color = getUserColor(userId);

      const channel = supabase.channel(`whiteboard-${activeId}`, {
        config: { broadcast: { self: false }, presence: { key: userId } },
      });

      // Presence sync — who's online
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId: string; username: string; joinedAt: number }>();
        const members: ActiveMember[] = Object.values(state).flatMap(presences =>
          presences.map(p => ({
            userId: p.userId,
            username: p.username,
            color: getUserColor(p.userId),
            joinedAt: p.joinedAt,
          }))
        );
        if (isMounted) setActiveMembers(members);
      });

      // Incoming scene from other users — merge elements
      channel.on("broadcast", { event: "scene" }, ({ payload }: Record<string, unknown>) => {
        const p = payload as { userId?: string; elements?: unknown[] };
        const api = excalidrawAPIRef.current;
        if (!api || p.userId === userId || !isMounted) return;
        const merged = mergeElements(api.getSceneElements(), p.elements ?? []);
        api.updateScene({ elements: merged, commitToHistory: false });
      });

      // Incoming cursors from other users
      channel.on("broadcast", { event: "cursor" }, ({ payload }: Record<string, unknown>) => {
        const p = payload as RemoteCursor;
        if (!isMounted || p.userId === userId) return;
        setRemoteCursors(prev => ({ ...prev, [p.userId]: p }));
        clearTimeout(cursorTimerRef.current[p.userId]);
        cursorTimerRef.current[p.userId] = setTimeout(() => {
          if (isMounted) setRemoteCursors(prev => { const { [p.userId]: _, ...rest } = prev; return rest; });
        }, 3000);
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && isMounted) {
          await channel.track({ userId, username, joinedAt: Date.now() });
        }
      });

      channelRef.current = channel;

      // Poll scene and broadcast changes at SCENE_POLL_MS
      sceneIntervalRef.current = setInterval(() => {
        const api = excalidrawAPIRef.current;
        const ch = channelRef.current;
        if (!api || !ch || !isMounted) return;
        const elements = api.getSceneElements();
        const hash = JSON.stringify(elements).slice(0, 300);
        if (hash === sceneHashRef.current) return;
        sceneHashRef.current = hash;
        ch.send({ type: "broadcast", event: "scene", payload: { userId, elements } });
      }, SCENE_POLL_MS);

      // Autosave every 30s
      autosaveIntervalRef.current = setInterval(() => { saveFnRef.current(); }, AUTOSAVE_MS);

      // Announce cursor presence immediately
      channel.send({
        type: "broadcast", event: "cursor",
        payload: { userId, username, x: 0.5, y: 0.5, color },
      });
    };

    setup();
    return () => { isMounted = false; cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroupBoard, activeId]);

  // Switch to a board
  const switchBoard = useCallback((b: Board) => {
    initialDataRef.current = toInitialData(b.scene);
    setActiveId(b.id);
    setActiveBoard(b);
    setBoardName(b.name);
    setEditingBoardNameId(null);
    setLastSavedAt(b.updated_at ? new Date(b.updated_at).getTime() : null);
    sceneHashRef.current = "";
  }, []);

  const createPersonalBoard = useCallback(() => {
    const id = String(Date.now());
    const nb: Board = { id, name: "My Trading Board", scene: emptyScene() };
    initialDataRef.current = toInitialData(emptyScene());
    setBoards(prev => [nb, ...prev]);
    setActiveId(id);
    setActiveBoard(nb);
    setBoardName("My Trading Board");
    setEditingBoardNameId(null);
    setLastSavedAt(null);
    setTab("personal");
  }, []);

  // Save current board
  const saveCurrent = useCallback(async () => {
    const api = excalidrawAPIRef.current;
    if (!api) { toast.showToast("Whiteboard not ready", "warning"); return; }
    setSaving(true);
    const effectiveName = boardName.trim() || "My Trading Board";
    const scene = { elements: api.getSceneElements(), appState: api.getAppState(), files: api.getFiles() ?? {} };
    const payload = serializeScene(scene);

    try {
      if (activeBoard?.is_group) {
        const res = await fetch("/api/whiteboard/group", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId: activeId, name: effectiveName, scene: payload }),
        });
        if (!res.ok) throw new Error("API error");
        setLastSavedAt(Date.now());
        setGroupBoards(prev => prev.map(b =>
          b.id === activeId ? { ...b, name: effectiveName, scene: payload, updated_at: new Date().toISOString() } : b
        ));
        toast.showToast("Board saved", "success");
      } else {
        const res = await fetch("/api/whiteboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId: activeId, name: effectiveName, scene: payload }),
        });
        let bodyText = "";
        try { bodyText = await res.text(); } catch { /* ignore */ }
        if (!res.ok) throw new Error(bodyText || `HTTP ${res.status}`);
        setLastSavedAt(Date.now());
        setBoards(prev => {
          const updated: Board = { id: activeId, name: effectiveName, scene: payload, updated_at: new Date().toISOString() };
          const idx = prev.findIndex(b => b.id === activeId);
          return idx >= 0 ? prev.map(b => b.id === activeId ? updated : b) : [updated, ...prev];
        });
        toast.showToast("Whiteboard saved", "success");
      }
    } catch {
      if (!activeBoard?.is_group) {
        saveBoard(activeId, effectiveName, { ...payload, files: payload.files ?? {} });
        setLastSavedAt(Date.now());
        toast.showToast("Saved locally", "warning");
      } else {
        toast.showToast("Failed to save board", "warning");
      }
    } finally {
      setSaving(false);
    }
  }, [activeId, activeBoard, boardName, toast]);

  // Keep saveFnRef current so autosave always calls latest version
  saveFnRef.current = saveCurrent;

  const renameActive = useCallback((name: string) => setBoardName(name), []);

  const persistBoardNameToStore = useCallback(async (nextNameRaw: string) => {
    const nextName = nextNameRaw.trim() || "My Trading Board";
    setBoardName(nextName);
    setEditingBoardNameId(null);
    setBoards(prev => prev.map(b => b.id === activeId ? { ...b, name: nextName } : b));
    setGroupBoards(prev => prev.map(b => b.id === activeId ? { ...b, name: nextName } : b));
    const api = excalidrawAPIRef.current;
    if (!api) return;
    const scene = { elements: api.getSceneElements(), appState: api.getAppState(), files: api.getFiles() ?? {} };
    const payload = serializeScene(scene);
    try {
      if (activeBoard?.is_group) {
        await fetch("/api/whiteboard/group", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId: activeId, name: nextName, scene: payload }),
        });
      } else {
        const res = await fetch("/api/whiteboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId: activeId, name: nextName, scene: payload }),
        });
        if (!res.ok) throw new Error("API error");
      }
      setLastSavedAt(Date.now());
    } catch {
      if (!activeBoard?.is_group) {
        saveBoard(activeId, nextName, { ...payload, files: payload.files ?? {} });
        setLastSavedAt(Date.now());
        toast.showToast("Saved locally (rename)", "warning");
      }
    }
  }, [activeId, activeBoard, toast]);

  const deleteActive = useCallback(async (id: string) => {
    const isGroup = activeBoard?.is_group;
    if (isGroup) {
      await fetch(`/api/whiteboard/group?boardId=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
      setGroupBoards(prev => prev.filter(b => b.id !== id));
    } else {
      try { await fetch(`/api/whiteboard?boardId=${encodeURIComponent(id)}`, { method: "DELETE" }); }
      catch { deleteBoard(id); }
      setBoards(prev => prev.filter(b => b.id !== id));
    }
    if (activeId === id) {
      const list = (isGroup ? groupBoards : boards).filter(b => b.id !== id);
      if (list.length > 0) switchBoard(list[0]);
      else createPersonalBoard();
    }
  }, [activeId, activeBoard, boards, groupBoards, switchBoard, createPersonalBoard]);

  const handleExcalidrawAPI = useCallback((api: ExcalidrawAPI | null) => {
    excalidrawAPIRef.current = api;
  }, []);

  // Throttled cursor broadcast
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isGroupBoard || !channelRef.current) return;
    const now = Date.now();
    if (now - cursorThrottleRef.current < CURSOR_THROTTLE_MS) return;
    cursorThrottleRef.current = now;
    const userId = authUserIdRef.current;
    if (!userId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const username = (user as Record<string, unknown>)?.username as string
      ?? (user as Record<string, unknown>)?.name as string ?? "User";
    channelRef.current.send({
      type: "broadcast", event: "cursor",
      payload: { userId, username, x, y, color: getUserColor(userId) },
    });
  }, [isGroupBoard, user]);

  const handleBoardCreated = useCallback((board: Board, isGroup: boolean) => {
    if (isGroup) {
      setGroupBoards(prev => [board, ...prev]);
      setTab("group");
    } else {
      setBoards(prev => [board, ...prev]);
      setTab("personal");
    }
    initialDataRef.current = toInitialData(board.scene ?? emptyScene());
    setActiveId(board.id);
    setActiveBoard(board);
    setBoardName(board.name);
    setLastSavedAt(null);
    setEditingBoardNameId(null);
    sceneHashRef.current = "";
  }, []);

  if (!loaded) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-[var(--app-bg)] text-zinc-400">
        Loading boards...
      </div>
    );
  }
  if (!activeId) return null;

  const currentBoards = tab === "group" ? groupBoards : boards;

  return (
    <>
      {showCreateModal && (
        <CreateBoardModal onClose={() => setShowCreateModal(false)} onCreate={handleBoardCreated} />
      )}

      <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden bg-[var(--app-bg)]">
        {/* Header */}
        <header
          className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4"
          style={{ backgroundColor: TOP_BAR_BG }}
        >
          <div className="flex min-w-0 items-center gap-0 rounded-lg border border-white/10 bg-white/5 p-0.5">
            <Link href="/ai" className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-[var(--accent-color)]">AI Chat</Link>
            <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-100">Whiteboard</span>
          </div>
          <div className="flex items-center gap-3">
            {isGroupBoard && <ActiveMembersBar members={activeMembers} />}
            {isViewOnly && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                View Only
              </span>
            )}
            <button
              type="button"
              onClick={saveCurrent}
              disabled={saving || isViewOnly}
              className="rounded bg-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/15 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Whiteboard"}
            </button>
            <span className="text-[10px] text-zinc-500">
              {lastSavedAt == null
                ? "Not saved yet"
                : `Last saved ${Math.floor((Date.now() - lastSavedAt) / 60000)}m ago`}
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-[var(--app-bg)]">
            {/* Tab selector */}
            <div className="flex gap-1 border-b border-white/10 p-1.5">
              {(["personal", "group"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-md py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    tab === t ? "bg-white/10 text-zinc-100" : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  {t === "personal" ? "My Boards" : "Group"}
                </button>
              ))}
            </div>

            {/* Board list */}
            <div className="flex-1 overflow-y-auto p-2">
              {currentBoards.length === 0 ? (
                <p className="px-2 py-3 text-xs text-zinc-500">
                  {tab === "group" ? "No group boards yet." : "No boards yet. Save to create one."}
                </p>
              ) : (
                currentBoards.map(b => (
                  <div
                    key={b.id}
                    className={`mb-1.5 rounded-lg border px-2 py-2 ${
                      b.id === activeId
                        ? "border-[var(--accent-color)]/40 bg-white/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (b.id === activeId) setEditingBoardNameId(b.id);
                        else switchBoard(b);
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm text-zinc-200">{b.id === activeId ? boardName : b.name}</span>
                        {b.is_group && (
                          <span className="shrink-0 rounded-full bg-[var(--accent-color)]/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--accent-color)]">
                            Group
                          </span>
                        )}
                      </div>
                      {b.is_group && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[9px] text-zinc-600">
                          {b.community_name && <span>{b.community_name}</span>}
                          {b.creator_name && <span>by {b.creator_name}</span>}
                          {(b.member_count ?? 0) > 0 && <span>· {b.member_count}m</span>}
                        </div>
                      )}
                    </button>
                    <div className="mt-1.5 flex gap-1">
                      {b.id === activeId && editingBoardNameId === b.id && (
                        <input
                          autoFocus
                          value={boardName}
                          onChange={e => renameActive(e.target.value)}
                          onBlur={() => persistBoardNameToStore(boardName)}
                          onKeyDown={e => {
                            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditingBoardNameId(null);
                          }}
                          className="min-w-0 flex-1 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300 outline-none"
                        />
                      )}
                      {(!b.is_group || b.user_id === authUserIdRef.current) && (
                        <button
                          type="button"
                          onClick={() => deleteActive(b.id)}
                          className="rounded border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/10"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* New board */}
            <div className="border-t border-white/10 p-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="w-full rounded border border-dashed border-white/20 py-2 text-xs font-medium text-zinc-400 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]"
              >
                + New Board
              </button>
            </div>
          </aside>

          {/* Canvas */}
          <main
            className="relative min-h-0 flex-1"
            ref={canvasRef}
            onMouseMove={handleMouseMove}
          >
            {/* Remote cursors overlay */}
            {isGroupBoard && Object.values(remoteCursors).map(c => (
              <div
                key={c.userId}
                className="pointer-events-none absolute z-20"
                style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, transform: "translate(-4px, -4px)" }}
              >
                <div style={{ backgroundColor: c.color }} className="h-3 w-3 rounded-full ring-2 ring-black" />
                <span
                  className="absolute left-3.5 top-0 whitespace-nowrap rounded px-1 py-0.5 text-[10px] text-white"
                  style={{ backgroundColor: c.color }}
                >
                  {c.username}
                </span>
              </div>
            ))}

            {/* View-only notice */}
            {isViewOnly && (
              <div className="absolute bottom-4 right-4 z-10 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                View only — drawing is disabled
              </div>
            )}

            {/* Autosave indicator */}
            {isGroupBoard && !isViewOnly && (
              <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-lg border border-white/10 bg-[var(--app-card)]/90 px-2.5 py-1.5 text-[10px] text-zinc-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live · auto-saves every 30s
              </div>
            )}

            {/* Save reminder for personal boards */}
            {!isGroupBoard && (
              <div className="absolute bottom-4 left-1/2 z-10 w-[90%] max-w-sm -translate-x-1/2 rounded border border-white/10 bg-[var(--app-card)]/90 px-3 py-2 text-xs text-zinc-400 shadow-lg">
                <p className="font-medium text-zinc-200">Save Whiteboard</p>
                <p className="mt-1">Click Save to persist to Supabase. No auto-save.</p>
              </div>
            )}

            <Excalidraw
              key={activeId}
              initialData={initialDataRef.current}
              excalidrawAPI={handleExcalidrawAPI as unknown as (api: unknown) => void}
              theme="dark"
              viewModeEnabled={isViewOnly}
            />
          </main>
        </div>
      </div>
    </>
  );
}
