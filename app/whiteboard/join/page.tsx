"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../components/AuthContext";

type BoardPreview = {
  boardId: string;
  boardName: string;
  creatorName: string | null;
  permissions: "edit" | "view";
  memberCount: number;
};

export default function JoinBoardPage() {
  const { user, authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [preview, setPreview] = useState<BoardPreview | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  // Load board preview
  useEffect(() => {
    if (!token) { setFetchError("No invite token in the link."); return; }
    fetch(`/api/whiteboard/invite?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((d: BoardPreview & { error?: string }) => {
        if (d.error) setFetchError(d.error);
        else setPreview(d);
      })
      .catch(() => setFetchError("Could not load invite. The link may be expired."));
  }, [token]);

  const handleJoin = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/whiteboard/join?token=${token}`)}`);
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/whiteboard/invite?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
      });
      const data = await res.json() as { boardId?: string; boardName?: string; alreadyMember?: boolean; error?: string };
      if (!res.ok || data.error) {
        setFetchError(data.error ?? "Failed to join board.");
        return;
      }
      setJoined(true);
      setTimeout(() => router.push("/whiteboard"), 1500);
    } catch {
      setFetchError("Something went wrong. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--app-card)] p-8 shadow-2xl">

        {/* Icon */}
        <div className="mb-5 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-color)]/10">
            <svg className="h-7 w-7 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>

        {fetchError ? (
          <>
            <h1 className="mb-2 text-center text-base font-semibold text-zinc-200">Invite Invalid</h1>
            <p className="text-center text-sm text-zinc-500">{fetchError}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 w-full rounded-xl bg-white/5 py-2.5 text-sm text-zinc-400 hover:bg-white/10 transition-colors"
            >
              Go Home
            </button>
          </>
        ) : joined ? (
          <>
            <h1 className="mb-2 text-center text-base font-semibold text-zinc-200">You&apos;re in!</h1>
            <p className="text-center text-sm text-zinc-500">Taking you to the board…</p>
            <div className="mt-4 flex justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" />
            </div>
          </>
        ) : preview ? (
          <>
            <p className="mb-1 text-center text-[10px] uppercase tracking-wider text-zinc-600">You&apos;ve been invited to a group board</p>
            <h1 className="mb-1 text-center text-xl font-bold text-zinc-100">{preview.boardName}</h1>
            {preview.creatorName && (
              <p className="mb-4 text-center text-xs text-zinc-500">Created by @{preview.creatorName}</p>
            )}

            {/* Details */}
            <div className="mb-6 space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Your access</span>
                <span className={preview.permissions === "edit" ? "font-medium text-emerald-400" : "font-medium text-amber-400"}>
                  {preview.permissions === "edit" ? "Can edit" : "View only"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Members</span>
                <span className="text-zinc-300">{preview.memberCount + 1} {preview.memberCount === 0 ? "person" : "people"}</span>
              </div>
            </div>

            {!user && (
              <p className="mb-3 text-center text-[11px] text-zinc-600">
                You&apos;ll need to sign in to join.
              </p>
            )}

            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full rounded-xl bg-[var(--accent-color)]/20 py-3 text-sm font-semibold text-[var(--accent-color)] hover:bg-[var(--accent-color)]/30 transition-colors disabled:opacity-50"
            >
              {joining ? "Joining…" : user ? "Join Board" : "Sign in & Join"}
            </button>

            <button
              onClick={() => router.push("/")}
              className="mt-3 w-full rounded-xl py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Maybe later
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" />
            <p className="text-xs text-zinc-600">Loading invite…</p>
          </div>
        )}
      </div>
    </div>
  );
}
