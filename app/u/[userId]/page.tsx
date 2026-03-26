"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../components/AuthContext";
import { VerifiedBadge } from "../../../components/VerifiedBadge";
import { getBubblesById } from "../../../lib/profile-bubbles";
import { getRankTitle } from "../../../lib/engagement/constants";

type PublicProfile = {
  user_id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  is_founder: boolean | null;
  created_at: string;
};

type Post = {
  id: string;
  content: string;
  created_at: string;
  comments_count: number;
};

type Group = { id: number; name: string };

type ProfileData = {
  profile: PublicProfile;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  bubbleIds: string[];
  xpTotal: number;
  posts: Post[];
  groups: Group[];
};

function getInitials(name: string | null, username: string | null): string {
  const n = (name || username || "?").trim();
  const parts = n.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatJoined(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

function FounderBadge() {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400"
      style={{ width: 16, height: 16 }}
      title="Founder"
    >
      <svg width={10} height={10} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
    </span>
  );
}


export default function PublicProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const { user } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "groups">("posts");

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (isOwnProfile) { router.replace("/profile"); return; }
    setLoading(true);
    fetch(`/api/profiles/${userId}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((d: ProfileData | null) => {
        if (!d) return;
        setData(d);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [userId, isOwnProfile, router]);

  const toggleFollow = async () => {
    if (!user || !data || followLoading) return;
    setFollowLoading(true);

    // Optimistic update
    const wasFollowing = data.isFollowing;
    setData((d) => d
      ? { ...d, isFollowing: !wasFollowing, followersCount: wasFollowing ? Math.max(0, d.followersCount - 1) : d.followersCount + 1 }
      : d);

    try {
      let res: Response;
      if (wasFollowing) {
        res = await fetch(`/api/follows?following_id=${userId}`, { method: "DELETE" });
      } else {
        res = await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ following_id: userId }),
        });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        console.error("[follow] API error", res.status, body);
        setFollowError(body.error ?? "Failed to update follow");
        // Revert optimistic update on failure
        setData((d) => d
          ? { ...d, isFollowing: wasFollowing, followersCount: wasFollowing ? d.followersCount + 1 : Math.max(0, d.followersCount - 1) }
          : d);
      } else {
        setFollowError(null);
      }
    } catch {
      setFollowError("Network error");
      // Revert on network error
      setData((d) => d
        ? { ...d, isFollowing: wasFollowing, followersCount: wasFollowing ? d.followersCount + 1 : Math.max(0, d.followersCount - 1) }
        : d);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="app-page flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" />
      </main>
    );
  }

  if (notFound || !data) {
    return (
      <main className="app-page flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-zinc-400">This profile doesn&apos;t exist or has been removed.</p>
        <Link href="/people" className="text-sm text-[var(--accent-color)] hover:underline">Browse people</Link>
      </main>
    );
  }

  const { profile, followersCount, followingCount, isFollowing, bubbleIds, xpTotal, posts, groups } = data;
  const initials = getInitials(profile.name, profile.username);
  const displayName = profile.name || profile.username || "Trader";
  const handle = profile.username ? `@${profile.username}` : null;
  const joined = formatJoined(profile.created_at);
  const rank = getRankTitle(xpTotal);
  const bubbles = getBubblesById(bubbleIds);

  return (
    <main className="app-page min-h-screen">
      {/* Banner */}
      <div
        className="h-36 w-full sm:h-48"
        style={{ background: "linear-gradient(135deg, var(--accent-color)/30 0%, #0A0E1A 100%)", backgroundColor: "#0F1520" }}
      />

      <div className="mx-auto max-w-2xl px-4">
        {/* Avatar + actions row */}
        <div className="-mt-12 flex items-end justify-between gap-4 sm:-mt-16">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-[#0A0E1A] bg-[#0F1520] sm:h-32 sm:w-32 flex items-center justify-center text-3xl font-bold text-[var(--accent-color)]">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>

          {user && !isOwnProfile && (
            <div className="flex gap-2 pb-1">
              <Link
                href={`/messages?with=${profile.username}`}
                className="rounded-full border border-white/20 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
              >
                Message
              </Link>
              <button
                type="button"
                onClick={toggleFollow}
                disabled={followLoading}
                className={`rounded-full px-5 py-2 text-sm font-bold transition disabled:opacity-50 ${
                  isFollowing
                    ? "border border-white/20 bg-transparent text-zinc-200 hover:border-red-500/40 hover:text-red-400"
                    : "bg-zinc-100 text-zinc-900 hover:bg-white"
                }`}
              >
                {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          )}
        </div>
        {followError && (
          <p className="mt-2 text-xs text-red-400">{followError}</p>
        )}

        {/* Name + badges + bio */}
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">{displayName}</h1>
            {profile.is_verified && <VerifiedBadge size={20} />}
            {profile.is_founder && <FounderBadge />}
          </div>
          {handle && <p className="text-sm text-zinc-500">{handle}</p>}
          {profile.bio && (
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-300">{profile.bio}</p>
          )}

          {/* Meta row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            {joined && (
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Joined {joined}
              </span>
            )}
            {xpTotal > 0 && (
              <span className="flex items-center gap-1" title={`${xpTotal} XP`}>
                <svg className="h-3.5 w-3.5 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-[var(--accent-color)] font-medium">{xpTotal.toLocaleString()} XP</span>
                <span>·</span>
                <span>{rank}</span>
              </span>
            )}
          </div>

          {/* Bubble icons summary */}
          {bubbles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {bubbles.map((b) => (
                <span
                  key={b.id}
                  title={b.label}
                  className="flex items-center gap-1 rounded-full border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/10 px-2.5 py-1 text-xs text-[var(--accent-color)]"
                >
                  <span>{b.emoji}</span>
                  <span className="font-medium">{b.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* Following / Followers */}
          <div className="mt-3 flex items-center gap-5">
            <button type="button" className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition">
              <span className="font-bold text-zinc-100">{followingCount.toLocaleString()}</span>
              <span>Following</span>
            </button>
            <button type="button" className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition">
              <span className="font-bold text-zinc-100">{followersCount.toLocaleString()}</span>
              <span className="font-semibold">{followersCount === 1 ? "Follower" : "Followers"}</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex border-b border-white/10">
          {(["posts", "groups"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-[var(--accent-color)] text-[var(--accent-color)]"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab === "posts" ? "Posts" : "Groups"}
              {tab === "posts" && posts.length > 0 && (
                <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {posts.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="py-4 pb-12">

          {/* Posts */}
          {activeTab === "posts" && (
            <div className="space-y-0">
              {posts.length === 0 ? (
                <div className="py-16 text-center text-sm text-zinc-500">No posts yet.</div>
              ) : (
                posts.map((post) => (
                  <div
                    key={post.id}
                    className="border-b border-white/5 px-1 py-4 transition hover:bg-white/[0.02]"
                  >
                    {/* Mini avatar + name row */}
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-[var(--accent-color)]">
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                          {displayName}
                          {profile.is_verified && <VerifiedBadge size={13} />}
                        </div>
                        {handle && <p className="text-xs text-zinc-500">{handle}</p>}
                      </div>
                      <span className="ml-auto text-xs text-zinc-600">{timeAgo(post.created_at)}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-200 pl-11">{post.content}</p>
                    {post.comments_count > 0 && (
                      <p className="mt-2 pl-11 text-xs text-zinc-600">
                        {post.comments_count} {post.comments_count === 1 ? "comment" : "comments"}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}


          {/* Groups */}
          {activeTab === "groups" && (
            <div>
              {groups.length === 0 ? (
                <div className="py-16 text-center text-sm text-zinc-500">Not in any trade rooms.</div>
              ) : (
                <div className="space-y-2 pt-2">
                  {groups.map((g) => (
                    <Link
                      key={g.id}
                      href={`/trade-rooms/${g.id}`}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-[var(--accent-color)]/30 hover:bg-[var(--accent-color)]/5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-color)]/10 text-xs font-bold text-[var(--accent-color)]">
                        {g.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-zinc-200">{g.name}</span>
                      <svg className="ml-auto h-4 w-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
