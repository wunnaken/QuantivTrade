"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../components/AuthContext";

export default function CreateRoomPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(50);
  const [isInviteOnly, setIsInviteOnly] = useState(true);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          maxMembers,
          isInviteOnly,
          scheduledAt: scheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create room"); setSubmitting(false); return; }
      router.push(`/trade-rooms/${data.roomId}`);
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <main className="app-page min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <p className="text-sm text-zinc-400">Sign in to create a trade room.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg space-y-6">
        <header>
          <Link href="/trade-rooms" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
            ← Back to Trade Rooms
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent-color)" }}>
            Live Trading
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-100">Create a Room</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Room Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Room Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SPY Options Scalping"
              maxLength={60}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will you be trading? Strategy, focus, etc."
              maxLength={280}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
            />
          </div>

          {/* Max Members */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Max Members</label>
            <div className="relative">
              <select
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="w-full appearance-none rounded-lg border border-white/10 bg-[var(--app-card-alt)] px-3 py-2.5 pr-8 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none"
              >
                <option value={10}>10 members</option>
                <option value={25}>25 members</option>
                <option value={50}>50 members</option>
                <option value={100}>100 members</option>
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            {/* Invite Only */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200">Invite Only</p>
                <p className="text-xs text-zinc-500">Members can only join via invite code</p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteOnly((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isInviteOnly ? "bg-[var(--accent-color)]" : "bg-white/10"}`}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
                  style={{ left: isInviteOnly ? "22px" : "2px" }}
                />
              </button>
            </div>

            {/* Schedule */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200">Schedule for Later</p>
                <p className="text-xs text-zinc-500">Set a future start time</p>
              </div>
              <button
                type="button"
                onClick={() => setScheduled((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${scheduled ? "bg-[var(--accent-color)]" : "bg-white/10"}`}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
                  style={{ left: scheduled ? "22px" : "2px" }}
                />
              </button>
            </div>
            {scheduled && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent-color)]/50 focus:outline-none"
              />
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3">
            <Link
              href="/trade-rooms"
              className="flex-1 rounded-lg border border-white/10 py-2.5 text-center text-sm font-medium text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 rounded-lg bg-[var(--accent-color)] py-2.5 text-sm font-semibold text-[#020308] transition hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? "Creating…" : "Create Room"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
