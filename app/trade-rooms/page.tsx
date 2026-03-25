"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthContext";

type Room = {
  id: number;
  name: string;
  description: string | null;
  slug: string;
  host_user_id: number;
  is_live: boolean;
  is_invite_only: boolean;
  max_members: number;
  invite_code: string;
  scheduled_at: string | null;
  ended_at: string | null;
  created_at: string;
  member_count?: number;
  host_username?: string | null;
};

function LiveBadge({ isLive, scheduledAt, endedAt }: { isLive: boolean; scheduledAt: string | null; endedAt: string | null }) {
  if (endedAt) {
    return <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-500">Ended</span>;
  }
  if (isLive) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        LIVE
      </span>
    );
  }
  if (scheduledAt) {
    return (
      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
        {new Date(scheduledAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
      </span>
    );
  }
  return <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-500">Scheduled</span>;
}

export default function TradeRoomsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteInput, setInviteInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/rooms/joined");
        if (res.ok) {
          const data = await res.json();
          setRooms(data.rooms ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteInput.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: inviteInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setJoinError(data.error ?? "Failed to join"); setJoining(false); return; }
      router.push(`/trade-rooms/${data.roomId}`);
    } catch {
      setJoinError("Network error");
      setJoining(false);
    }
  }

  if (!user) {
    return (
      <main className="app-page min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-zinc-400">Sign in to access trade rooms.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent-color)" }}>
            Live Trading
          </p>
          <h1 className="mt-1 text-3xl font-bold text-zinc-100">Trade Rooms</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Invite-only live trading sessions with real-time trade calls and analysis.
          </p>
        </header>

        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/trade-rooms/create"
            className="ml-auto rounded-lg bg-[var(--accent-color)] px-4 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90"
          >
            + Create a Room
          </Link>
          <form onSubmit={handleJoin} className="flex items-center gap-2">
            <input
              type="text"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
              placeholder="Invite code"
              maxLength={12}
              className="w-36 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={joining || !inviteInput.trim()}
              className="rounded-lg border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-3 py-2 text-sm font-medium text-[var(--accent-color)] transition hover:bg-[var(--accent-color)]/20 disabled:opacity-40"
            >
              {joining ? "Joining…" : "Join"}
            </button>
          </form>
        </div>
        {joinError && <p className="text-xs text-red-400">{joinError}</p>}

        {/* Rooms grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl border border-white/10 bg-white/5" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-8 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <svg className="h-6 w-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <p className="font-medium text-zinc-300">No rooms yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Create your own trade room or join one with an invite code.
            </p>
            <Link
              href="/trade-rooms/create"
              className="mt-4 inline-block rounded-lg bg-[var(--accent-color)] px-4 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90"
            >
              Create Your First Room
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-zinc-400">Your Rooms</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <div key={room.id} className="flex flex-col rounded-xl border border-white/10 bg-[#050713] p-4 transition hover:border-white/20">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-zinc-100 leading-tight">{room.name}</h3>
                    <LiveBadge isLive={room.is_live} scheduledAt={room.scheduled_at} endedAt={room.ended_at} />
                  </div>
                  {room.host_username && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Hosted by <span style={{ color: "var(--accent-color)" }}>@{room.host_username}</span>
                    </p>
                  )}
                  <p className="mt-1 text-xs text-zinc-500">{room.member_count ?? 0} / {room.max_members} members</p>
                  {room.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{room.description}</p>
                  )}
                  <div className="mt-auto pt-4">
                    <Link
                      href={`/trade-rooms/${room.id}`}
                      className="block w-full rounded-lg border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 py-2 text-center text-sm font-medium text-[var(--accent-color)] transition hover:bg-[var(--accent-color)]/20"
                    >
                      Enter Room
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
