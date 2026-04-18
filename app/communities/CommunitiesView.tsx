"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../components/AuthContext";


const TAGS = ["Equities", "Global Macro", "Crypto", "FX & Rates", "Commodities", "Options"] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

type Room = {
  id: string;
  name: string;
  description: string;
  slug: string;
  member_count: number;
  host_name: string | null;
  is_paid: boolean;
  monthly_price: number | null;
};


export default function CommunitiesView() {
  const { user } = useAuth();
  const router = useRouter();
  const [joinedRoomIds, setJoinedRoomIds] = useState<string[]>([]);
  const [hostedRoomIds, setHostedRoomIds] = useState<Set<string>>(new Set());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomMode, setRoomMode] = useState<"all" | "joined">("all");
  const [leaveConfirmRoom, setLeaveConfirmRoom] = useState<string | null>(null);
  const [justJoinedRoom, setJustJoinedRoom] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Admin panel state
  type RoomMember = { user_id: string; username: string | null };
  const [adminRoom, setAdminRoom] = useState<{ id: string; name: string } | null>(null);
  const [adminMembers, setAdminMembers] = useState<RoomMember[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [kickingUser, setKickingUser] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);

  const openAdminPanel = async (roomId: string | number, roomName: string) => {
    const id = String(roomId);
    setAdminRoom({ id, name: roomName });
    setRenameDraft(roomName);
    setAdminLoading(true);
    try {
      const res = await fetch(`/api/rooms/${id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const seen = new Set<string>();
        const deduped: RoomMember[] = [];
        for (const m of data.members ?? []) {
          if (!seen.has(m.user_id)) { seen.add(m.user_id); deduped.push({ user_id: m.user_id, username: m.username }); }
        }
        setAdminMembers(deduped);
      }
    } catch {}
    setAdminLoading(false);
  };

  const handleKick = async (userId: string) => {
    if (!adminRoom) return;
    setKickingUser(userId);
    try {
      const res = await fetch(`/api/rooms/${adminRoom.id}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setAdminMembers((prev) => prev.filter((m) => m.user_id !== userId));
      }
    } catch {}
    setKickingUser(null);
  };

  // Application form state
  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({ name: "", description: "", category: "General", pricing: "free" as "free" | "paid", monthlyPrice: "" });
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<"success" | "error" | null>(null);
  const [applyError, setApplyError] = useState("");

  // Fetch public rooms from API
  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((data: { rooms?: Room[] }) => setRooms(data.rooms ?? []))
      .catch(() => {})
      .finally(() => setRoomsLoading(false));
  }, []);

  const refreshJoined = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms/joined", { credentials: "include" });
      const data = await res.json();
      if (Array.isArray(data.rooms)) {
        setJoinedRoomIds(data.rooms.map((r: { id: number | string }) => String(r.id)));
        setHostedRoomIds(new Set(data.rooms.filter((r: any) => r.is_host).map((r: { id: number | string }) => String(r.id))));
      }
    } catch {
      setJoinedRoomIds([]);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => refreshJoined()); }, [refreshJoined]);

  const handleJoinRoom = async (roomName: string, roomId: string | number) => {
    if (!user) return;
    const id = String(roomId);
    try {
      await fetch(`/api/rooms/${id}/join`, { method: "POST", credentials: "include" });
      setJoinedRoomIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      router.push(`/messages?room=${id}`);
    } catch {}
  };

  const handleLeaveRoom = async (roomId: string | number) => {
    const id = String(roomId);
    try {
      await fetch(`/api/rooms/${id}/leave`, { method: "DELETE", credentials: "include" });
      setJoinedRoomIds((prev) => prev.filter((rid) => rid !== id));
      setLeaveConfirmRoom(null);
    } catch {
      setLeaveConfirmRoom(null);
    }
  };

  const handleApply = async () => {
    if (!user || !applyForm.name.trim() || !applyForm.description.trim()) return;
    setApplyLoading(true);
    setApplyResult(null);
    setApplyError("");
    try {
      const res = await fetch("/api/communities/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: applyForm.name,
          description: applyForm.description,
          category: applyForm.category,
          pricing: applyForm.pricing,
          monthlyPrice: applyForm.pricing === "paid" ? Math.max(5, Math.min(100, parseInt(applyForm.monthlyPrice) || 5)) : 0,
          applicantName: user.name || "",
          applicantUsername: user.username || "",
          applicantEmail: user.email || "",
        }),
      });
      if (res.ok) {
        setApplyResult("success");
        setApplyForm({ name: "", description: "", category: "General", pricing: "free", monthlyPrice: "" });
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setApplyError(data.error ?? "Failed to submit");
        setApplyResult("error");
      }
    } catch {
      setApplyError("Network error. Please try again.");
      setApplyResult("error");
    } finally {
      setApplyLoading(false);
    }
  };

  const visibleRooms = rooms.filter((r) => {
    if (roomMode === "joined" && !joinedRoomIds.includes(String(r.id))) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const leaveRoomName = leaveConfirmRoom
    ? rooms.find((r) => String(r.id) === leaveConfirmRoom)?.name ?? leaveConfirmRoom
    : "";

  return (
    <div className="min-h-screen app-page">
      {/* Leave room confirmation */}
      {leaveConfirmRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={() => setLeaveConfirmRoom(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--app-bg)] p-6 shadow-2xl">
            <h3 id="leave-title" className="text-lg font-semibold text-zinc-50">Leave room?</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Are you sure you want to leave <span className="font-medium text-zinc-200">{leaveRoomName}</span>? You can rejoin anytime.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setLeaveConfirmRoom(null)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/5">
                Go back
              </button>
              <button type="button" onClick={() => { if (leaveConfirmRoom) handleLeaveRoom(leaveConfirmRoom); }}
                className="rounded-full bg-red-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
                Yes, leave
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-14">
        {/* Page Header */}
        <div className="mb-10">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-color)]/80">Communities</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">
            Trade where the right people gather.
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Curated rooms for different asset classes, strategies, and time zones. Follow the conversations that move your portfolio.
          </p>
        </div>

        {/* Filters */}
        <section className="mb-8 rounded-2xl border border-white/5 bg-[var(--app-card-alt)] px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
              <span className="mr-1 text-zinc-400">Filter by focus:</span>
              {TAGS.map((tag) => (
                <button key={tag} type="button"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-200 transition hover:border-[var(--accent-color)]/50 hover:text-[var(--accent-color)]">
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <button type="button" onClick={() => setRoomMode("all")}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  roomMode === "all" ? "border border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10 text-[var(--accent-color)]" : "border border-white/10 text-zinc-300 hover:border-white/30"
                }`}>
                All rooms
              </button>
              <button type="button" onClick={() => setRoomMode("joined")}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  roomMode === "joined" ? "border border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10 text-[var(--accent-color)]" : "border border-white/10 text-zinc-300 hover:border-white/30"
                }`}>
                Joined
              </button>
            </div>
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rooms..."
              className="w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-[var(--accent-color)]/50"
            />
          </div>
        </section>

        {/* Rooms */}
        <section>

          {justJoinedRoom && (
            <div className="mb-4 rounded-xl border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-3 py-2 text-[11px] font-medium text-[var(--accent-color)]">
              You joined <span className="font-semibold">{justJoinedRoom}</span>. It&apos;s now in your profile under Groups.
            </div>
          )}

          {roomsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />)}
            </div>
          ) : roomMode === "joined" && visibleRooms.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-8 text-center">
              <p className="text-sm font-medium text-zinc-300">You haven&apos;t joined any rooms yet.</p>
              <p className="mt-2 text-xs text-zinc-500">Switch to &quot;All rooms&quot; to browse and join.</p>
              <button type="button" onClick={() => setRoomMode("all")}
                className="mt-4 rounded-full border border-[var(--accent-color)]/50 bg-[var(--accent-color)]/10 px-4 py-2 text-xs font-medium text-[var(--accent-color)] hover:bg-[var(--accent-color)]/20">
                Show all rooms
              </button>
            </div>
          ) : visibleRooms.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                <svg className="h-5 w-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-300">No rooms yet</p>
              <p className="mt-2 text-xs text-zinc-500">Communities will appear here as they are created. Check back soon.</p>
            </div>
          ) : (<>
            {/* Paid / Private rooms — gold card style */}
            {visibleRooms.filter((r) => r.is_paid).length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">Private Rooms</p>
                  <div className="h-px flex-1 bg-gradient-to-r from-amber-400/20 to-transparent" />
                </div>
                <div className="mb-4 flex items-center gap-2 text-[10px] text-zinc-500">
                  <svg className="h-3 w-3 text-amber-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  <span>All private rooms are reviewed and approved by QuantivTrade for quality and security.</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleRooms.filter((r) => r.is_paid).map((room) => {
                    const isJoined = joinedRoomIds.includes(String(room.id));
                    return (
                      <article key={room.id} className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/5 to-transparent" style={{ minHeight: 200 }}>
                        {/* Header */}
                        <div className="relative z-[2] border-b border-white/10 bg-[var(--app-bg)]/80 backdrop-blur-sm p-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-zinc-50">{room.name}</h3>
                            <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                              ${room.monthly_price}/mo
                            </span>
                          </div>
                          {room.description && <p className="mt-0.5 text-[11px] text-zinc-500">{room.description}</p>}
                          <p className="mt-1 text-[10px] text-zinc-600">
                            {room.member_count} member{room.member_count !== 1 ? "s" : ""}
                            {room.host_name ? ` · hosted by ${room.host_name}` : ""}
                          </p>
                        </div>
                        {/* Decorative gradient fill */}
                        <div className="p-4 flex-1 flex flex-col justify-end">
                          <div className="mb-3 flex items-center gap-2 text-[10px] text-amber-400/50">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            <span>Paid membership required</span>
                          </div>
                        </div>
                        {/* Footer action */}
                        <div className="relative z-[2] border-t border-white/10 bg-[var(--app-bg)]/80 backdrop-blur-sm p-4">
                          {isJoined ? (
                            <div className="flex gap-2">
                              <button type="button" onClick={() => router.push(`/messages?room=${room.id}`)}
                                className="flex-1 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/20">
                                Enter Room
                              </button>
                              {hostedRoomIds.has(String(room.id)) ? (
                                <button type="button" onClick={() => openAdminPanel(room.id, room.name)}
                                  className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/20">
                                  Manage
                                </button>
                              ) : (
                                <button type="button" onClick={() => setLeaveConfirmRoom(String(room.id))}
                                  className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-500 transition hover:border-red-500/30 hover:text-red-400">
                                  Leave
                                </button>
                              )}
                            </div>
                          ) : (
                            <button type="button"
                              className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                user ? "border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20" : "border border-white/10 text-zinc-500 cursor-not-allowed"
                              }`}
                              disabled={!user}
                              onClick={() => handleJoinRoom(room.name, room.id)}>
                              {user ? "Join Room" : "Sign in to join"}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Free / Public rooms — standard list style */}
            {visibleRooms.filter((r) => !r.is_paid).length > 0 && (
              <div>
                {visibleRooms.some((r) => r.is_paid) && (
                  <div className="flex items-center gap-3 mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/70">Public Rooms</p>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--accent-color)]/20 to-transparent" />
                  </div>
                )}
                <div className="space-y-3">
                  {visibleRooms.filter((r) => !r.is_paid).map((room) => {
                    const isJoined = joinedRoomIds.includes(String(room.id));
                    return (
                      <article key={room.id}
                        className="group rounded-2xl border border-white/5 bg-[var(--app-card-alt)] p-4 transition hover:border-[var(--accent-color)]/30">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h2 className="text-sm font-semibold text-zinc-50">{room.name}</h2>
                              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">Free</span>
                            </div>
                            {room.description && <p className="mt-0.5 text-[11px] text-zinc-500">{room.description}</p>}
                            <p className="mt-1 text-[10px] text-zinc-600">
                              {room.member_count} member{room.member_count !== 1 ? "s" : ""}
                              {room.host_name ? ` · hosted by ${room.host_name}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2" onClick={(e) => e.stopPropagation()}>
                            {isJoined ? (<>
                              <button type="button" onClick={() => router.push(`/messages?room=${room.id}`)}
                                className="rounded-full border border-[var(--accent-color)]/50 bg-[var(--accent-color)]/15 px-3 py-1 text-[11px] font-medium text-[var(--accent-color)] hover:bg-[var(--accent-color)]/25"
                                title="Enter room">
                                Enter Room
                              </button>
                              {hostedRoomIds.has(String(room.id)) && (
                                <button type="button" onClick={() => openAdminPanel(room.id, room.name)}
                                  className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20"
                                  title="Manage room">
                                  Manage
                                </button>
                              )}
                              {!hostedRoomIds.has(String(room.id)) && (
                                <button type="button" onClick={() => setLeaveConfirmRoom(String(room.id))}
                                  className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-500 transition hover:border-red-500/30 hover:text-red-400"
                                  title="Leave room">
                                  Leave
                                </button>
                              )}
                            </>) : (
                              <button type="button"
                                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                                  user ? "border border-[var(--accent-color)]/70 bg-[var(--accent-color)]/10 text-[var(--accent-color)] hover:bg-[var(--accent-color)]/20" : "border border-white/10 text-zinc-400 cursor-not-allowed"
                                }`}
                                disabled={!user}
                                title={user ? "Join this room" : "Sign in to join rooms"}
                                onClick={() => handleJoinRoom(room.name, room.id)}>
                                Join room
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </>)}
        </section>

        {/* ── Create Community Application ──────────────────────────────────── */}
        <section className="mt-10">
          <div className="flex items-center gap-3 mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]/70">Create a Community</p>
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--accent-color)]/20 to-transparent" />
          </div>

          {!user ? (
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-6 text-center">
              <p className="text-sm text-zinc-400">Sign in to apply for a community.</p>
              <Link href="/auth/sign-in" className="mt-3 inline-block rounded-full bg-[var(--accent-color)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110">
                Sign In
              </Link>
            </div>
          ) : !user.isVerified ? (
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10">
                <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <p className="text-sm font-medium text-zinc-300">Verified traders only</p>
              <p className="mt-1 text-xs text-zinc-500">You must be a verified trader to create a community.</p>
              <Link href="/verify" className="mt-3 inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20">
                Get Verified
              </Link>
            </div>
          ) : !showApply ? (
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-6 text-center">
              <p className="text-sm text-zinc-300">Want to lead your own trading community?</p>
              <p className="mt-1 text-xs text-zinc-500">Submit an application and our team will review it. You can create free or paid communities.</p>
              <button type="button" onClick={() => { setShowApply(true); setApplyResult(null); }}
                className="mt-4 rounded-full bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-black hover:brightness-110 transition">
                Apply to Create a Community
              </button>
            </div>
          ) : applyResult === "success" ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-emerald-400">Application submitted</p>
              <p className="mt-1 text-xs text-zinc-500">We&apos;ll review your application and get back to you via email.</p>
              <button type="button" onClick={() => { setShowApply(false); setApplyResult(null); }}
                className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition">
                Close
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-50">Community Application</h3>
                <button type="button" onClick={() => setShowApply(false)} className="text-zinc-500 hover:text-zinc-300">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-zinc-400">Community Name *</label>
                  <input type="text" value={applyForm.name} onChange={(e) => setApplyForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Options Flow Desk"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[var(--accent-color)]/50" />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-medium text-zinc-400">Description *</label>
                  <textarea value={applyForm.description} onChange={(e) => setApplyForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What will this community focus on? Who is it for?"
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[var(--accent-color)]/50" />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-medium text-zinc-400">Category</label>
                  <select value={applyForm.category} onChange={(e) => setApplyForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[var(--accent-color)]/50"
                    style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                    {["General", "Equities", "Global Macro", "Crypto", "FX & Rates", "Commodities", "Options", "Technical Analysis", "Fundamental Analysis"].map((c) => (
                      <option key={c} value={c} style={{ background: "#1a1a2e" }}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-medium text-zinc-400">Pricing</label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setApplyForm((f) => ({ ...f, pricing: "free" }))}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-center text-xs font-medium transition ${
                        applyForm.pricing === "free"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : "border-white/10 text-zinc-400 hover:border-white/20"
                      }`}>
                      <span className="block text-sm font-semibold">Free</span>
                      <span className="mt-0.5 block text-[10px] opacity-70">Open to everyone</span>
                    </button>
                    <button type="button" onClick={() => setApplyForm((f) => ({ ...f, pricing: "paid" }))}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-center text-xs font-medium transition ${
                        applyForm.pricing === "paid"
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                          : "border-white/10 text-zinc-400 hover:border-white/20"
                      }`}>
                      <span className="block text-sm font-semibold">Paid</span>
                      <span className="mt-0.5 block text-[10px] opacity-70">Monthly subscription</span>
                    </button>
                  </div>
                </div>

                {applyForm.pricing === "paid" && (
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-zinc-400">Monthly Price ($)</label>
                    <input type="text" inputMode="numeric" placeholder="e.g. 19" value={applyForm.monthlyPrice}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "");
                        setApplyForm((f) => ({ ...f, monthlyPrice: v }));
                      }}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-[var(--accent-color)]/50" />
                    <p className="mt-1 text-[10px] text-zinc-600">$5 – $100 per month. Revenue share details in our <Link href="/monetization" className="text-[var(--accent-color)] hover:underline">monetization policy</Link>.</p>
                  </div>
                )}

                {applyResult === "error" && (
                  <p className="text-xs text-red-400">{applyError}</p>
                )}

                <button type="button" onClick={handleApply}
                  disabled={applyLoading || !applyForm.name.trim() || !applyForm.description.trim()}
                  className="w-full rounded-lg bg-[var(--accent-color)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
                  {applyLoading ? "Submitting..." : "Submit Application"}
                </button>

                <p className="text-[10px] text-zinc-600 text-center">
                  Applications are reviewed by our team. You&apos;ll receive a response via email.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Admin Panel Modal */}
        {adminRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAdminRoom(null)} />
            <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[var(--app-bg)] p-6 shadow-2xl" style={{ maxHeight: "80vh", overflow: "auto" }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-blue-400">Room Admin</p>
                  <h3 className="mt-0.5 text-base font-semibold text-zinc-50">{adminRoom.name}</h3>
                </div>
                <button type="button" onClick={() => setAdminRoom(null)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Rename */}
              <div className="mb-4">
                <p className="mb-1.5 text-[10px] font-medium text-zinc-400">Community Name</p>
                <div className="flex gap-2">
                  <input type="text" value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-[var(--accent-color)]/50" />
                  <button type="button" disabled={renaming || !renameDraft.trim() || renameDraft === adminRoom.name}
                    onClick={async () => {
                      setRenaming(true);
                      try {
                        const res = await fetch(`/api/rooms/${adminRoom.id}/rename`, {
                          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                          body: JSON.stringify({ name: renameDraft.trim() }),
                        });
                        if (res.ok) {
                          setAdminRoom((prev) => prev ? { ...prev, name: renameDraft.trim() } : prev);
                          setRooms((prev) => prev.map((r) => String(r.id) === adminRoom.id ? { ...r, name: renameDraft.trim() } : r));
                        }
                      } catch {}
                      setRenaming(false);
                    }}
                    className="rounded-lg bg-[var(--accent-color)] px-3 py-1.5 text-xs font-semibold text-black transition hover:brightness-110 disabled:opacity-40">
                    {renaming ? "..." : "Save"}
                  </button>
                </div>
              </div>

              <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[10px] text-blue-400">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                <span>Your messages are highlighted as admin messages in chat.</span>
              </div>

              <p className="mb-2 text-xs font-medium text-zinc-300">Members ({adminMembers.length})</p>

              {adminLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />)}
                </div>
              ) : adminMembers.length === 0 ? (
                <p className="text-xs text-zinc-500">No members yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {adminMembers.map((member) => {
                    const isYou = member.user_id === user?.id;
                    return (
                      <li key={member.user_id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-zinc-400">
                            {(member.username ?? "??").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs text-zinc-200">@{member.username ?? "unknown"}</p>
                            {isYou && <p className="text-[9px] text-blue-400">You · Host</p>}
                          </div>
                        </div>
                        {!isYou && (
                          <button type="button" onClick={() => handleKick(member.user_id)}
                            disabled={kickingUser === member.user_id}
                            className="rounded-lg border border-red-500/20 bg-red-500/5 px-2 py-1 text-[10px] font-medium text-red-400 transition hover:bg-red-500/15 disabled:opacity-50">
                            {kickingUser === member.user_id ? "..." : "Kick"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[10px] text-zinc-500">
                  As the host, your messages appear with an admin badge in the room chat. Kicked users are removed immediately and a system message is posted.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
