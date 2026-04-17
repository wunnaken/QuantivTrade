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

const DEFAULT_APP_STATE = { viewBackgroundColor: "#1e1e2e" };
const USER_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#e879f9", "#f87171", "#34d399"];
const CURSOR_THROTTLE_MS = 50;
const SCENE_THROTTLE_MS = 80;  // broadcast at most every 80ms for live feel
const AUTOSAVE_MS = 30_000;
const GROUP_AUTOSAVE_MS = 5_000;  // faster autosave on group boards so peers see changes via polling
const GROUP_POLL_MS = 2_000;       // how often to poll DB for remote scene changes

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
type MemberResult = { id: string; username: string; name: string | null; avatar_url?: string | null };

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
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      console.error("[group boards]", res.status, err.error);
      return [];
    }
    const data = (await res.json()) as { boards?: Board[] };
    return Array.isArray(data.boards)
      ? data.boards.map(b => ({ ...b, id: String((b as Record<string, unknown>).id) }))
      : [];
  } catch (e) {
    console.error("[group boards] fetch error", e);
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
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isGroup) return;
    fetch("/api/whiteboard/communities")
      .then(r => r.json())
      .then(d => setCommunities(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [isGroup]);

  useEffect(() => {
    if (memberSearch.trim().length < 1) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/global-search?q=${encodeURIComponent(memberSearch)}`)
        .then(r => r.json())
        .then(d => {
          const people = (d?.people ?? []) as Array<{ user_id: string; username: string; name: string; avatar_url?: string | null }>;
          setSearchResults(people.slice(0, 5).map(p => ({ id: p.user_id, username: p.username, name: p.name, avatar_url: p.avatar_url })));
        })
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
    setCreateError(null);
    try {
      if (isGroup) {
        const res = await fetch("/api/whiteboard/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            community_id: communityId || null,
            allowed_members: [],
            permissions,
          }),
        });
        const data = (await res.json()) as { board?: Board; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to create group board");
        const board = { ...data.board!, id: String((data.board as Record<string, unknown>).id) };
        // Send invites to selected members instead of auto-adding
        const boardIdRaw = board.id.startsWith("board-") ? board.id.slice("board-".length) : board.id;
        await Promise.all(selectedMembers.map(m =>
          fetch("/api/board-invites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board_id: boardIdRaw, board_name: name.trim(), invitee_id: m.id, permissions }),
          }).catch(() => {})
        ));
        onCreate(board, true);
      } else {
        const id = String(Date.now());
        onCreate({ id, name: name.trim(), scene: emptyScene() }, false);
      }
      onClose();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
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
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${isGroup ? "left-[18px]" : "left-[2px]"}`} />
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
              <div>
                <input
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Search by username..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[var(--accent-color)]/40"
                />
                {searchResults.length > 0 && (
                  <ul className="mt-1 w-full rounded-lg border border-white/10 bg-[#080B14] shadow-lg overflow-hidden">
                    {searchResults.map(m => (
                      <li
                        key={m.id}
                        onMouseDown={e => { e.preventDefault(); addMember(m); }}
                        className="flex items-center gap-2.5 cursor-pointer px-3 py-2 hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {m.avatar_url
                          ? <img src={m.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                          : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-[var(--accent-color)]">{(m.name ?? m.username).slice(0, 2).toUpperCase()}</span>
                        }
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-zinc-200">{m.name ?? m.username}</p>
                          <p className="text-[10px] text-zinc-500">@{m.username}</p>
                        </div>
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

        {createError && (
          <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{createError}</p>
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

// ── ManageMembersModal ─────────────────────────────────────────────────────────

function ManageMembersModal({
  board,
  currentUserId,
  onClose,
  onMembersChanged,
}: {
  board: Board;
  currentUserId: string;
  onClose: () => void;
  onMembersChanged: (board: Board) => void;
}) {
  type PendingInvite = { inviteId: string; member: MemberResult };

  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MemberResult[]>([]);
  const [members, setMembers] = useState<MemberResult[]>([]); // resolved profiles for allowed_members
  const [permissions, setPermissions] = useState<"edit" | "view">(board.permissions ?? "edit");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy Link");
  const [removing, setRemoving] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Resolve member profiles
  useEffect(() => {
    const ids = board.allowed_members ?? [];
    if (ids.length === 0) { setMembers([]); return; }
    fetch(`/api/whiteboard/members?ids=${ids.join(",")}`)
      .then(r => r.json())
      .then((d: MemberResult[]) => setMembers(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [board.allowed_members]);

  // Load pending invites for this board
  useEffect(() => {
    const boardIdRaw = board.id.startsWith("board-") ? board.id.slice("board-".length) : board.id;
    fetch(`/api/board-invites?boardId=${boardIdRaw}`)
      .then(r => r.json())
      .then(async (d: { invites?: Array<{ id: string; invitee_id: string; permissions: string }> }) => {
        const invites = d.invites ?? [];
        if (invites.length === 0) return;
        // Resolve invitee profiles
        const ids = invites.map(i => i.invitee_id).join(",");
        const res = await fetch(`/api/whiteboard/members?ids=${ids}`);
        const profiles = await res.json() as MemberResult[];
        const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
        setPendingInvites(invites.map(i => ({
          inviteId: i.id,
          member: profileMap[i.invitee_id] ?? { id: i.invitee_id, username: i.invitee_id.slice(0, 8), name: null },
        })));
      })
      .catch(() => {});
  }, [board.id]);

  // Member username search via global-search (same endpoint as dashboard)
  useEffect(() => {
    if (memberSearch.trim().length < 1) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/global-search?q=${encodeURIComponent(memberSearch)}`)
        .then(r => r.json())
        .then(d => {
          const people = (d?.people ?? []) as Array<{ user_id: string; username: string; name: string; avatar_url?: string | null }>;
          setSearchResults(people.slice(0, 5).map(p => ({ id: p.user_id, username: p.username, name: p.name, avatar_url: p.avatar_url })));
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [memberSearch]);

  const addMember = async (m: MemberResult) => {
    if (members.find(x => x.id === m.id)) return;
    if (pendingInvites.find(x => x.member.id === m.id)) return;
    setMemberSearch(""); setSearchResults([]);
    setInviteError(null);
    const boardIdRaw = board.id.startsWith("board-") ? board.id.slice("board-".length) : board.id;
    try {
      const res = await fetch("/api/board-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: boardIdRaw,
          board_name: board.name,
          invitee_id: m.id,
          permissions: board.permissions ?? "edit",
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setInviteError(data.error ?? "Failed to send invite");
        return;
      }
      setPendingInvites(prev => [...prev, { inviteId: String(Date.now()), member: m }]);
    } catch {
      setInviteError("Network error — invite not sent");
    }
  };

  const removeMember = async (memberId: string) => {
    setRemoving(memberId);
    const boardIdRaw = board.id.startsWith("board-") ? board.id.slice("board-".length) : board.id;
    await fetch("/api/whiteboard/group", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: boardIdRaw, action: "remove_member", memberId }),
    });
    const updated = { ...board, allowed_members: (board.allowed_members ?? []).filter(id => id !== memberId) };
    setMembers(prev => prev.filter(m => m.id !== memberId));
    onMembersChanged(updated);
    setRemoving(null);
  };

  const changePermissions = async (p: "edit" | "view") => {
    setPermissions(p);
    const boardIdRaw = board.id.startsWith("board-") ? board.id.slice("board-".length) : board.id;
    await fetch("/api/whiteboard/group", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: boardIdRaw, action: "set_permissions", permissions: p }),
    });
    onMembersChanged({ ...board, permissions: p });
  };

  const generateInviteLink = async () => {
    setGeneratingLink(true);
    const boardIdRaw = board.id.startsWith("board-") ? board.id.slice("board-".length) : board.id;
    try {
      const res = await fetch(`/api/whiteboard/invite?boardId=${boardIdRaw}`, { method: "POST" });
      const data = await res.json() as { token?: string };
      if (data.token) {
        setInviteLink(`${window.location.origin}/whiteboard/join?token=${data.token}`);
      }
    } catch { /* fail silently */ }
    finally { setGeneratingLink(false); }
  };

  const copyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy Link"), 2000);
    });
  };

  const revokeLink = async () => {
    const boardIdRaw = board.id.startsWith("board-") ? board.id.slice("board-".length) : board.id;
    await fetch(`/api/whiteboard/invite?boardId=${boardIdRaw}`, { method: "DELETE" });
    setInviteLink(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[460px] max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Manage Board</h2>
            <p className="mt-0.5 text-[10px] text-zinc-500 truncate max-w-[300px]">{board.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-600 hover:text-zinc-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Invite link */}
        <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-2 text-xs font-semibold text-zinc-300">Invite Link</p>
          <p className="mb-3 text-[10px] text-zinc-500">Anyone with this link can join the board. Share it with traders you want to collaborate with.</p>
          {inviteLink ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400">{inviteLink}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex-1 rounded-lg bg-[var(--accent-color)]/20 py-2 text-xs font-medium text-[var(--accent-color)] hover:bg-[var(--accent-color)]/30 transition-colors"
                >
                  {copyLabel}
                </button>
                <button
                  type="button"
                  onClick={revokeLink}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-colors"
                >
                  Revoke
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={generateInviteLink}
              disabled={generatingLink}
              className="w-full rounded-lg border border-dashed border-white/20 py-2.5 text-xs text-zinc-500 hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)] transition-colors disabled:opacity-50"
            >
              {generatingLink ? "Generating…" : "Generate Invite Link"}
            </button>
          )}
        </div>

        {/* Add member by username */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold text-zinc-300">Add by Username</p>
          <div>
            <input
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="Search username…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[var(--accent-color)]/40"
            />
            {searchResults.length > 0 && (
              <ul className="mt-1 w-full rounded-lg border border-white/10 bg-[#080B14] shadow-lg overflow-hidden">
                {searchResults.map(m => (
                  <li
                    key={m.id}
                    onMouseDown={e => { e.preventDefault(); addMember(m); }}
                    className="flex items-center gap-2.5 cursor-pointer px-3 py-2 hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                      : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-[var(--accent-color)]">{(m.name ?? m.username).slice(0, 2).toUpperCase()}</span>
                    }
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-zinc-200">{m.name ?? m.username}</p>
                      <p className="text-[10px] text-zinc-500">@{m.username}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {inviteError && (
          <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{inviteError}</p>
        )}

        {/* Member list */}
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold text-zinc-300">
            Members {members.length > 0 && <span className="font-normal text-zinc-600">({members.length})</span>}
          </p>
          {members.length === 0 ? (
            <p className="text-[11px] text-zinc-600">No members yet — share the invite link or add by username.</p>
          ) : (
            <ul className="space-y-1.5">
              {members.map(m => (
                <li key={m.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                  <span className="text-xs text-zinc-300">
                    <span className="font-medium">@{m.username}</span>
                    {m.name && <span className="ml-1.5 text-zinc-500">{m.name}</span>}
                  </span>
                  {m.id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      disabled={removing === m.id}
                      className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      {removing === m.id ? "…" : "Remove"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {pendingInvites.length > 0 && (
            <>
              <p className="mt-3 mb-1 text-[10px] uppercase tracking-wider text-zinc-600">Pending Invites</p>
              <ul className="space-y-1.5">
                {pendingInvites.map(({ inviteId, member }) => (
                  <li key={inviteId} className="flex items-center justify-between rounded-lg border border-amber-500/10 bg-amber-500/5 px-3 py-2">
                    <span className="text-xs text-zinc-400">
                      <span className="font-medium">@{member.username}</span>
                      {member.name && <span className="ml-1.5 text-zinc-600">{member.name}</span>}
                    </span>
                    <span className="text-[10px] text-amber-500/70">Invite sent</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Permissions */}
        <div>
          <p className="mb-2 text-xs font-semibold text-zinc-300">Member Permissions</p>
          <div className="flex gap-2">
            {(["edit", "view"] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => changePermissions(p)}
                className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                  permissions === p
                    ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]"
                    : "border border-white/10 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {p === "edit" ? "All members can edit" : "View only"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ActiveMembersBar ───────────────────────────────────────────────────────────

function ActiveMembersBar({ activeMembers, allMembers }: { activeMembers: ActiveMember[]; allMembers: MemberResult[] }) {
  const onlineIds = new Set(activeMembers.map(m => m.userId));
  // Build avatar map from resolved profiles
  const avatarMap = Object.fromEntries(allMembers.map(m => [m.id, m.avatar_url ?? null]));

  // Combine: online members first (with avatar lookup), then offline board members
  type Row = { userId: string; username: string; avatarUrl: string | null; isOnline: boolean; color: string };
  const rows: Row[] = [
    ...activeMembers.map(m => ({
      userId: m.userId,
      username: m.username,
      avatarUrl: avatarMap[m.userId] ?? null,
      isOnline: true,
      color: m.color,
    })),
    ...allMembers
      .filter(m => !onlineIds.has(m.id))
      .map(m => ({
        userId: m.id,
        username: m.username,
        avatarUrl: m.avatar_url ?? null,
        isOnline: false,
        color: getUserColor(m.id),
      })),
  ];

  if (rows.length === 0) return null;
  const shown = rows.slice(0, 7);
  const extra = rows.length - 7;

  return (
    <div className="flex items-center gap-1">
      {shown.map(m => (
        <div
          key={m.userId}
          title={`@${m.username}${m.isOnline ? " (online)" : " (offline)"}`}
          className={`relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white ring-2 ring-black transition-opacity ${m.isOnline ? "opacity-100" : "opacity-35"}`}
          style={m.avatarUrl ? undefined : { backgroundColor: m.color }}
        >
          {m.avatarUrl
            ? <img src={m.avatarUrl} alt={m.username} className="h-full w-full object-cover" />
            : (m.username[0] ?? "?").toUpperCase()
          }
          {m.isOnline && (
            <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-1 ring-black" />
          )}
        </div>
      ))}
      {extra > 0 && (
        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">+{extra}</span>
      )}
      {activeMembers.length > 0 && (
        <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      )}
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
  const [managingBoard, setManagingBoard] = useState<Board | null>(null);

  // Realtime state
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [boardAllMembers, setBoardAllMembers] = useState<MemberResult[]>([]);

  // Refs
  const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null);
  const initialDataRef = useRef(toInitialData(emptyScene()));
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cursorTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cursorThrottleRef = useRef<number>(0);
  const sceneThrottleRef = useRef<number>(0);
  const sceneHashRef = useRef<string>("");
  const sceneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncedAtRef = useRef<string>("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveFnRef = useRef<() => Promise<void>>(async () => {});
  const authUserIdRef = useRef<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const skipGroupFetchRef = useRef(false);

  // Computed
  const isGroupBoard = activeBoard?.is_group === true;
  const isViewOnly =
    isGroupBoard &&
    activeBoard?.permissions === "view" &&
    activeBoard?.user_id !== authUserId;

  // Fetch Supabase auth user ID on mount
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user: sbUser } }) => {
      const id = sbUser?.id ?? null;
      authUserIdRef.current = id;
      setAuthUserId(id);
    });
  }, []);

  // Load personal + group boards on mount, restore last active board
  useEffect(() => {
    setLastWorkspaceTab("whiteboard");
    let cancelled = false;
    const lastId = typeof window !== "undefined" ? localStorage.getItem("wb-last-board-id") : null;
    Promise.all([fetchBoardsFromApi(), fetchGroupBoardsFromApi()]).then(([list, gList]) => {
      if (cancelled) return;
      setBoards(list);
      setGroupBoards(gList);
      const all = [...list, ...gList];
      // Try to restore the board the user was last on
      const restored = lastId ? all.find(b => b.id === lastId) : null;
      const first = restored ?? list[0] ?? null;
      if (first) {
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
    if (skipGroupFetchRef.current) { skipGroupFetchRef.current = false; return; }
    fetchGroupBoardsFromApi().then(list => setGroupBoards(list));
  }, [tab]);

  // Re-fetch group boards when an invite is accepted from the notification bell
  useEffect(() => {
    const handler = () => {
      fetchGroupBoardsFromApi().then(list => setGroupBoards(list));
    };
    window.addEventListener("whiteboard-group-boards-changed", handler);
    return () => window.removeEventListener("whiteboard-group-boards-changed", handler);
  }, []);

  // If navigated here after accepting an invite (?refresh=1), re-fetch group boards
  // then auto-switch to the newest one so realtime subscribes immediately
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("refresh")) return;
    window.history.replaceState({}, "", "/whiteboard");
    const t = setTimeout(() => {
      fetchGroupBoardsFromApi().then(list => {
        if (!list.length) return;
        setGroupBoards(list);
        // Auto-switch to the newest group board (most recently updated)
        const newest = list.reduce((a, b) =>
          (a.updated_at ?? "") > (b.updated_at ?? "") ? a : b
        );
        initialDataRef.current = toInitialData(newest.scene ?? emptyScene());
        setActiveId(newest.id);
        setActiveBoard(newest);
        setBoardName(newest.name);
        setLastSavedAt(newest.updated_at ? new Date(newest.updated_at).getTime() : null);
      });
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save group board when the tab loses visibility (covers browser refresh / close)
  useEffect(() => {
    if (!isGroupBoard) return;
    const handleHide = () => { if (document.visibilityState === "hidden") saveFnRef.current(); };
    document.addEventListener("visibilitychange", handleHide);
    return () => document.removeEventListener("visibilitychange", handleHide);
  }, [isGroupBoard]);

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
        const seen = new Set<string>();
        const members: ActiveMember[] = Object.values(state).flatMap(presences =>
          presences.map(p => ({
            userId: p.userId,
            username: p.username,
            color: getUserColor(p.userId),
            joinedAt: p.joinedAt,
          }))
        ).filter(m => {
          if (seen.has(m.userId)) return false;
          seen.add(m.userId);
          return true;
        });
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
        if (status !== "SUBSCRIBED" || !isMounted) return;
        // Only expose the channel for sends AFTER it is fully subscribed
        channelRef.current = channel;
        await channel.track({ userId, username, joinedAt: Date.now() });
        // Announce presence immediately now that the channel is ready
        channel.send({
          type: "broadcast", event: "cursor",
          payload: { userId, username, x: 0.5, y: 0.5, color },
        });
      });

      // Autosave every 5s on group boards so peers can poll and see changes promptly
      autosaveIntervalRef.current = setInterval(() => { saveFnRef.current(); }, GROUP_AUTOSAVE_MS);
    };

    setup();
    return () => { isMounted = false; cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroupBoard, activeId]);

  // Poll group board scene every 2s — picks up changes from other users saved to DB
  useEffect(() => {
    if (!isGroupBoard || !activeId) return;
    const boardIdRaw = activeId.startsWith("board-") ? activeId.slice("board-".length) : activeId;
    lastSyncedAtRef.current = ""; // reset when switching boards
    const poll = setInterval(async () => {
      const res = await fetch(`/api/whiteboard/group?boardId=${boardIdRaw}`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const { scene, updated_at } = await res.json() as { scene?: { elements?: unknown[] }; updated_at?: string };
      if (!updated_at || updated_at === lastSyncedAtRef.current) return;
      lastSyncedAtRef.current = updated_at;
      const api = excalidrawAPIRef.current;
      if (!api) return;
      const remote = (scene?.elements ?? []) as unknown[];
      const merged = mergeElements(api.getSceneElements(), remote);
      api.updateScene({ elements: merged, commitToHistory: false });
    }, GROUP_POLL_MS);
    return () => clearInterval(poll);
  }, [isGroupBoard, activeId]);

  // Fetch all board members (for offline presence display) when a group board is active
  useEffect(() => {
    if (!isGroupBoard || !activeBoard?.allowed_members?.length) {
      setBoardAllMembers([]);
      return;
    }
    const ids = activeBoard.allowed_members.join(",");
    fetch(`/api/whiteboard/members?ids=${ids}`)
      .then(r => r.json())
      .then((d: MemberResult[]) => setBoardAllMembers(Array.isArray(d) ? d : []))
      .catch(() => setBoardAllMembers([]));
  }, [isGroupBoard, activeId, activeBoard?.allowed_members]);

  // Autosave personal boards every 30s
  useEffect(() => {
    if (isGroupBoard) return; // group boards autosave inside the realtime setup
    const interval = setInterval(() => { saveFnRef.current(); }, AUTOSAVE_MS);
    return () => clearInterval(interval);
  }, [isGroupBoard, activeId]);

  // Persist last active board ID so refresh restores it
  useEffect(() => {
    if (activeId) localStorage.setItem("wb-last-board-id", activeId);
  }, [activeId]);

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
        // saved silently
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
        // saved silently
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
    const boardToDelete = [...boards, ...groupBoards].find(b => b.id === id);
    const isGroup = boardToDelete?.is_group === true;
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

  const handleMembersChanged = useCallback((updated: Board) => {
    setGroupBoards(prev => prev.map(b => b.id === updated.id ? { ...b, ...updated } : b));
    if (managingBoard?.id === updated.id) setManagingBoard(updated);
  }, [managingBoard]);

  const handleBoardCreated = useCallback((board: Board, isGroup: boolean) => {
    if (isGroup) {
      skipGroupFetchRef.current = true;
      setGroupBoards(prev => [board, ...prev]);
    } else {
      setBoards(prev => [board, ...prev]);
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

  // Merge personal + group boards, newest first
  const allBoards = [...boards, ...groupBoards].sort((a, b) => {
    const ta = a.updated_at ?? "";
    const tb = b.updated_at ?? "";
    return tb.localeCompare(ta);
  });

  return (
    <>
      {showCreateModal && (
        <CreateBoardModal onClose={() => setShowCreateModal(false)} onCreate={handleBoardCreated} />
      )}
      {managingBoard && user && (
        <ManageMembersModal
          board={managingBoard}
          currentUserId={user.id}
          onClose={() => setManagingBoard(null)}
          onMembersChanged={handleMembersChanged}
        />
      )}

      <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden bg-[var(--app-bg)]">
        {/* Header */}
        <header
          className="relative flex h-12 shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#080B14] px-4"
        >
          <div className="flex min-w-0 items-center gap-0 rounded-lg border border-white/10 bg-white/5 p-0.5">
            <Link href="/ai" className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-[var(--accent-color)]">AI Chat</Link>
            <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-100">Whiteboard</span>
          </div>
          {saving && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-zinc-400">Saving…</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            {isGroupBoard && <ActiveMembersBar activeMembers={activeMembers} allMembers={boardAllMembers} />}
            {isViewOnly && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                View Only
              </span>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-[var(--app-bg)]">
            <div className="border-b border-white/10 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Boards</p>
            </div>

            {/* Board list */}
            <div className="flex-1 overflow-y-auto p-2">
              {allBoards.length === 0 ? (
                <p className="px-2 py-3 text-xs text-zinc-500">No boards yet. Create one below.</p>
              ) : (
                allBoards.map(b => (
                  <div
                    key={b.id}
                    onClick={() => { if (b.id !== activeId) switchBoard(b); }}
                    className={`mb-1.5 rounded-lg border px-2 py-2 transition-colors ${
                      b.id === activeId
                        ? "border-[var(--accent-color)]/40 bg-white/10"
                        : "cursor-pointer border-white/10 bg-white/5 hover:bg-white/8"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        onClick={e => { if (b.id === activeId) { e.stopPropagation(); setEditingBoardNameId(b.id); } }}
                        className={`truncate text-sm ${b.id === activeId ? "cursor-text text-zinc-200" : "text-zinc-300"}`}
                      >
                        {b.id === activeId ? boardName : b.name}
                      </span>
                      {b.is_group && (
                        <span className="shrink-0 rounded-full bg-[var(--accent-color)]/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--accent-color)]">
                          Group
                        </span>
                      )}
                    </div>
                    {b.is_group && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[9px] text-zinc-600">
                        {b.community_name && <span>{b.community_name} ·</span>}
                        <span>{(b.member_count ?? 0) + 1} {(b.member_count ?? 0) + 1 === 1 ? "member" : "members"}</span>
                        {b.creator_name && <span>· by @{b.creator_name}</span>}
                      </div>
                    )}
                    {b.id === activeId && (
                      <div className="mt-1.5 flex gap-1" onClick={e => e.stopPropagation()}>
                        {editingBoardNameId === b.id && (
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
                        {b.is_group && b.user_id === authUserId && (
                          <button
                            type="button"
                            onClick={() => setManagingBoard(b)}
                            className="rounded border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/10 hover:text-[var(--accent-color)]"
                          >
                            Manage
                          </button>
                        )}
                        {b.is_group && b.user_id !== authUserId && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Leave "${b.name}"? You'll need a new invite to rejoin.`)) return;
                              const boardIdRaw = b.id.startsWith("board-") ? b.id.slice("board-".length) : b.id;
                              await fetch("/api/whiteboard/group", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ boardId: boardIdRaw, action: "remove_member", memberId: authUserId }),
                              });
                              setGroupBoards(prev => prev.filter(x => x.id !== b.id));
                              if (activeId === b.id) createPersonalBoard();
                            }}
                            className="rounded border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/10 hover:text-red-400"
                          >
                            Leave
                          </button>
                        )}
                        {(!b.is_group || b.user_id === authUserId) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!confirm(`Delete "${boardName}"? This cannot be undone.`)) return;
                              deleteActive(b.id);
                            }}
                            className="rounded border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/10 hover:text-red-400"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
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


            <Excalidraw
              key={activeId}
              initialData={initialDataRef.current}
              excalidrawAPI={handleExcalidrawAPI as unknown as (api: unknown) => void}
              theme="dark"
              viewModeEnabled={isViewOnly}
              onChange={(elements: unknown) => {
                if (!isGroupBoard) return;
                const ch = channelRef.current;
                const uid = authUserIdRef.current;
                if (!ch || !uid) return;
                const now = Date.now();
                if (now - sceneThrottleRef.current < SCENE_THROTTLE_MS) return;
                sceneThrottleRef.current = now;
                ch.send({ type: "broadcast", event: "scene", payload: { userId: uid, elements } });
              }}
            />
          </main>
        </div>
      </div>
    </>
  );
}
