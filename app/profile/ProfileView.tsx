"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../components/AuthContext";
import type { User } from "../../components/AuthContext";
import { getInitials as getSuggestedInitials } from "../../lib/suggested-people";
import {
  ALL_PROFILE_BUBBLES,
  BUBBLE_CATEGORIES,
  getBubblesById,
  getSelectedBubbleIds,
  MAX_SELECTED_BUBBLES,
  setSelectedBubbleIds,
} from "../../lib/profile-bubbles";
import { useTheme } from "../../components/ThemeContext";
import { ACCENT_OPTIONS } from "../../lib/accent-color";
import { BriefingPreferencesForm } from "../../components/BriefingPreferencesForm";
import { fetchBriefingPreferences, type BriefingPreferences } from "../../lib/briefing-preferences";
import { loadStreaks } from "../../lib/engagement/streaks";
import { STREAK_BADGES } from "../../lib/engagement/constants";
import { getOrCreateInviteCode, getInvitedCount } from "../../lib/engagement/invite";
import { VerifiedBadge } from "../../components/VerifiedBadge";
import { getTrades, computePnL, formatPercent } from "../../lib/journal";

const POSTS_KEY = "quantivtrade-demo-posts";
const USERNAME_CHANGED_AT_KEY = (userId: string) => `quantivtrade-username-changed-at-${userId}`;
const NAME_CHANGED_AT_KEY = (userId: string) => `quantivtrade-name-changed-at-${userId}`;

const USERNAME_COOLDOWN_DAYS = 30;
const NAME_COOLDOWN_DAYS = 14;

type StoredPost = { id: string; text: string; date: string; groupName?: string };

function formatJoinedDate(iso?: string) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
}

/** Build 7-day history [day-6 … today] from last activity date and current streak. */
function getSevenDayHistory(lastDate: string, streak: number): boolean[] {
  if (typeof window === "undefined" || !lastDate || streak <= 0) return [false, false, false, false, false, false, false];
  const today = new Date();
  const out: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const last = new Date(lastDate + "T12:00:00");
    const streakStart = new Date(last);
    streakStart.setDate(streakStart.getDate() - (streak - 1));
    const keyTime = new Date(key + "T12:00:00").getTime();
    const active = keyTime >= streakStart.getTime() && keyTime <= last.getTime();
    out.push(active);
  }
  return out;
}

function getInitials(user: User) {
  const name = (user.name || user.username || user.email || "?").trim();
  if (!name) return "?";
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

type Timeframe = "all" | "year" | "month";

function getPerformanceFromTrades(timeframe: Timeframe) {
  const trades = getTrades();
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const filtered = trades.filter((t) => {
    const d = t.exitDate ?? t.entryDate;
    if (!d) return false;
    if (timeframe === "all") return true;
    if (timeframe === "year") return d >= yearStart;
    return d >= monthStart;
  });
  type WithPnL = { trade: (typeof filtered)[0]; pnl: NonNullable<ReturnType<typeof computePnL>> };
  const withPnL: WithPnL[] = filtered.map((t) => ({ trade: t, pnl: computePnL(t) })).filter((x): x is WithPnL => x.pnl != null);
  const total = withPnL.length;
  const wins = withPnL.filter((x) => x.pnl.pnlPercent > 0).length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const avgReturn = total > 0 ? withPnL.reduce((s, x) => s + x.pnl.pnlPercent, 0) / total : 0;
  const best = withPnL.length > 0 ? withPnL.reduce((a, x) => (x.pnl.pnlPercent > a.pnl.pnlPercent ? x : a), withPnL[0]) : null;
  const worst = withPnL.length > 0 ? withPnL.reduce((a, x) => (x.pnl.pnlPercent < a.pnl.pnlPercent ? x : a), withPnL[0]) : null;
  const loginStreak = loadStreaks().loginStreak;
  return { total, winRate, avgReturn, best, worst, loginStreak };
}

function BriefingPreferencesSection() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<BriefingPreferences | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchBriefingPreferences().then((p) => { setPrefs(p); setLoaded(true); });
  }, []);

  const hasSaved = loaded && prefs !== null;

  return (
    <div className="mt-6 pt-5 border-t border-white/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-zinc-300">Morning Briefing Preferences</p>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--app-text-muted)" }}>
            {!loaded ? "Loading…" : hasSaved ? "Your briefing is personalized." : "Set up to get a personalized morning briefing."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)]"
        >
          {open ? "Close" : hasSaved ? "Edit" : "Set Up"}
        </button>
      </div>
      {open && (
        <div className="mt-4">
          <BriefingPreferencesForm
            compact
            initialPrefs={prefs}
            onSave={(p) => { setPrefs(p); setOpen(false); }}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function ProfilePerformanceCard() {
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const stats = getPerformanceFromTrades(timeframe);
  const hasData = stats.total > 0;

  return (
    <section className="mb-6 rounded-xl border-l-4 border-[#3B82F6] bg-[#3B82F6]/10 p-4" style={{ boxShadow: "0 0 24px rgba(59,130,246,0.15)" }} aria-label="Trader Performance">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
          Trader Performance
          <VerifiedBadge size={16} />
          <span className="text-xs font-normal text-zinc-400">Verified Stats</span>
        </h2>
        <div className="flex gap-1">
          {(["all", "year", "month"] as const).map((tf) => (
            <button key={tf} type="button" onClick={() => setTimeframe(tf)} className={`rounded px-2 py-1 text-xs font-medium ${timeframe === tf ? "bg-[#3B82F6]/30 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}>
              {tf === "all" ? "All Time" : tf === "year" ? "This Year" : "This Month"}
            </button>
          ))}
        </div>
      </div>
      {!hasData ? (
        <p className="mt-3 text-sm text-zinc-500">Log trades in your journal to populate your performance card.</p>
      ) : (
        <>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-black/20 p-3">
            <p className="text-xs text-zinc-400">Win Rate</p>
            <p className="text-lg font-bold text-white">{stats.winRate.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg bg-black/20 p-3">
            <p className="text-xs text-zinc-400">Total Trades</p>
            <p className="text-lg font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-lg bg-black/20 p-3">
            <p className="text-xs text-zinc-400">Avg Return</p>
            <p className="text-lg font-bold text-white">{formatPercent(stats.avgReturn)}</p>
          </div>
          <div className="rounded-lg bg-black/20 p-3">
            <p className="text-xs text-zinc-400">Best Trade</p>
            <p className="text-lg font-bold text-emerald-400">{stats.best ? `${formatPercent(stats.best.pnl.pnlPercent)} (${stats.best.trade.asset})` : "—"}</p>
          </div>
          <div className="rounded-lg bg-black/20 p-3">
            <p className="text-xs text-zinc-400">Worst Trade</p>
            <p className="text-lg font-bold text-red-400">{stats.worst ? `${formatPercent(stats.worst.pnl.pnlPercent)} (${stats.worst.trade.asset})` : "—"}</p>
          </div>
          <div className="rounded-lg bg-black/20 p-3">
            <p className="text-xs text-zinc-400">Streak</p>
            <p className="text-lg font-bold text-white">{stats.loginStreak} days</p>
          </div>
        </div>
        </>
      )}
      {hasData && (
        <button type="button" className="mt-3 rounded-lg border border-[#3B82F6]/50 bg-[#3B82F6]/10 px-3 py-1.5 text-xs font-medium text-[#3B82F6] hover:bg-[#3B82F6]/20">
          Share my performance
        </button>
      )}
    </section>
  );
}

function ProfileMonetizeSection() {
  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4" aria-label="My Community">
      <h2 className="text-sm font-semibold text-zinc-50">Create a paid community</h2>
      <p className="mt-1 text-xs text-zinc-400">Set your community name, monthly price ($5 – $100), and description. <Link href="/monetization" className="text-[var(--accent-color)] hover:underline">View our monetization policy</Link> for details on revenue share and payouts.</p>
      <div className="mt-4 space-y-3">
        <input type="text" placeholder="Community name" className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500" readOnly aria-hidden />
        <input type="number" placeholder="Monthly price ($)" className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500" readOnly aria-hidden />
        <textarea placeholder="Description" rows={2} className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500" readOnly aria-hidden />
        <button type="button" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200">
          Coming with full launch
        </button>
      </div>
    </section>
  );
}

export default function ProfileView() {
  const { user, signOut, updateProfile } = useAuth();
  const { accentColor, setAccentColor, previewAccentColor } = useTheme();
  const router = useRouter();
  type JoinedRoom = { id: string; name: string };
  const [joinedGroups, setJoinedGroups] = useState<JoinedRoom[]>([]);
  type FollowedProfile = { id: string; name: string; username: string };
  const [followedProfiles, setFollowedProfiles] = useState<FollowedProfile[]>([]);
  const [selfFollowersCount, setSelfFollowersCount] = useState<number | null>(null);
  const [selfFollowingCount, setSelfFollowingCount] = useState<number | null>(null);
  const [posts, setPosts] = useState<StoredPost[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [usernameDraft, setUsernameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [selectedBubbleIds, setSelectedBubbleIdsState] = useState<string[]>([]);
  const [editingBubbles, setEditingBubbles] = useState(false);
  const [draftBubbleIds, setDraftBubbleIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [profileChangeModal, setProfileChangeModal] = useState<{
    kind: "confirm" | "blocked";
    nameChanged: boolean;
    usernameChanged: boolean;
    nextName?: string;
    nextUsername?: string;
    messageLines: string[];
  } | null>(null);
  const [streakData, setStreakData] = useState(loadStreaks());
  const [showVerifiedModal, setShowVerifiedModal] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [verifiedSubmitting, setVerifiedSubmitting] = useState(false);
  const [verifiedSubmitError, setVerifiedSubmitError] = useState<string | null>(null);
  const [verifiedSubmitted, setVerifiedSubmitted] = useState(
    typeof window !== "undefined" && window.localStorage.getItem("quantivtrade-verified-applied") === "true"
  );
  useEffect(() => {
    // Sync verified-applied flag from DB so it persists across devices
    fetch("/api/profile/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { ui_preferences?: Record<string, unknown> }) => {
        if (data?.ui_preferences?.verified_applied) {
          window.localStorage.setItem("quantivtrade-verified-applied", "true");
          setVerifiedSubmitted(true);
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    setStreakData(loadStreaks());
  }, []);


  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      try {
        const p = window.localStorage.getItem(POSTS_KEY);
        if (p) setPosts(JSON.parse(p));
      } catch {
        // ignore
      }
    });
    fetch("/api/rooms/joined", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { rooms: [] }))
      .then((data) => {
        if (Array.isArray(data.rooms)) setJoinedGroups(data.rooms);
      })
      .catch(() => setJoinedGroups([]));
    fetch("/api/profiles/followed", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { profiles: [] }))
      .then((data) => {
        if (Array.isArray(data.profiles)) setFollowedProfiles(data.profiles);
      })
      .catch(() => setFollowedProfiles([]));
    if (user?.id) {
      fetch(`/api/profiles/${user.id}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setSelfFollowersCount(data.followersCount);
            setSelfFollowingCount(data.followingCount);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user) router.replace("/auth/sign-in");
  }, [user, router]);

  // One-time reset for verified application (e.g. to re-test): visit /profile?reset_verified=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset_verified") === "1") {
      try {
        window.localStorage.removeItem("quantivtrade-verified-applied");
      } catch {}
      setVerifiedSubmitted(false);
      params.delete("reset_verified");
      const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => setSelectedBubbleIdsState(getSelectedBubbleIds()));
  }, []);

  const openBubblesPanel = () => {
    setDraftBubbleIds(getSelectedBubbleIds());
    setEditingBubbles(true);
  };

  const closeBubblesPanel = () => {
    setEditingBubbles(false);
  };

  const saveBubbles = () => {
    setSelectedBubbleIds(draftBubbleIds);
    setSelectedBubbleIdsState(draftBubbleIds);
    setEditingBubbles(false);
    fetch("/api/profile/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bubble_ids: draftBubbleIds }),
    }).catch(() => {});
  };

  const toggleBubble = (id: string) => {
    setDraftBubbleIds((prev) => {
      if (prev.includes(id)) return prev.filter((b) => b !== id);
      if (prev.length >= MAX_SELECTED_BUBBLES) return prev;
      return [...prev, id];
    });
  };

  const displayBubbles = getBubblesById(selectedBubbleIds);

  if (!user) {
    return null;
  }

  const displayName = user.name || "Trader";
  const displayUsername = user.username?.trim() || "trader";
  const joinedStr = formatJoinedDate(user.joinedAt);

  const openBannerPicker = () => bannerInputRef.current?.click();
  const openAvatarPicker = () => avatarInputRef.current?.click();

  const onBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const url = await readFileAsDataUrl(file);
      updateProfile({ bannerImage: url });
    } catch {
      // ignore
    }
    e.target.value = "";
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const url = await readFileAsDataUrl(file);
      updateProfile({ profilePicture: url });
    } catch {
      // ignore
    }
    e.target.value = "";
  };

  const startEditing = () => {
    setNameDraft(displayName);
    setUsernameDraft(user.username?.trim() || "");
    setBioDraft(user.bio || "");
    setEditingProfile(true);
  };

  const saveProfile = () => {
    if (typeof window === "undefined") return;

    const nextName = nameDraft.trim() || undefined;
    const rawUsername = usernameDraft.trim();
    const handle =
      rawUsername
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/gi, "")
        .toLowerCase()
        .slice(0, 30) || undefined;

    const currentName = displayName;
    const currentUsername = user.username?.trim() || "";

    const nameChanged = !!nextName && nextName !== currentName;
    const usernameChanged = (handle ?? "") !== currentUsername;

    if (!nameChanged && !usernameChanged) {
      updateProfile({
        bio: bioDraft.trim() || undefined,
      });
      setEditingProfile(false);
      return;
    }

    const now = Date.now();
    const userId = user?.id ?? "";
    const nameChangedAtRaw = window.localStorage.getItem(NAME_CHANGED_AT_KEY(userId));
    const usernameChangedAtRaw = window.localStorage.getItem(USERNAME_CHANGED_AT_KEY(userId));
    const nameChangedAt = nameChangedAtRaw ? Number(nameChangedAtRaw) : 0;
    const usernameChangedAt = usernameChangedAtRaw ? Number(usernameChangedAtRaw) : 0;

    const msPerDay = 24 * 60 * 60 * 1000;
    const nameCooldownMs = NAME_COOLDOWN_DAYS * msPerDay;
    const usernameCooldownMs = USERNAME_COOLDOWN_DAYS * msPerDay;

    const blockedMessages: string[] = [];
    if (nameChanged && nameChangedAt && now - nameChangedAt < nameCooldownMs) {
      blockedMessages.push(`You can only change your display name once every ${NAME_COOLDOWN_DAYS} days.`);
    }
    if (usernameChanged && usernameChangedAt && now - usernameChangedAt < usernameCooldownMs) {
      blockedMessages.push(`You can only change your username once every ${USERNAME_COOLDOWN_DAYS} days.`);
    }
    if (blockedMessages.length > 0) {
      setProfileChangeModal({
        kind: "blocked",
        nameChanged,
        usernameChanged,
        nextName,
        nextUsername: handle,
        messageLines: blockedMessages,
      });
      return;
    }

    const lines: string[] = [];
    if (nameChanged && nextName) {
      lines.push(`Your display name will change from "${currentName}" to "${nextName}".`);
    }
    if (usernameChanged) {
      const nextUsernameLabel = handle || "(no username)";
      const currentUsernameLabel = currentUsername || "(no username)";
      lines.push(`Your username will change from "@${currentUsernameLabel}" to "@${nextUsernameLabel}".`);
    }
    if (nameChangedAt > 0) lines.push(`Display name can be changed once every ${NAME_COOLDOWN_DAYS} days.`);
    if (usernameChangedAt > 0) lines.push(`Username can be changed once every ${USERNAME_COOLDOWN_DAYS} days.`);

    setProfileChangeModal({
      kind: "confirm",
      nameChanged,
      usernameChanged,
      nextName,
      nextUsername: handle,
      messageLines: lines,
    });
  };

  const applyConfirmedProfileChanges = () => {
    if (typeof window === "undefined" || !profileChangeModal || profileChangeModal.kind !== "confirm") {
      setProfileChangeModal(null);
      return;
    }

    const now = Date.now();
    const updates: Partial<User> = {
      bio: bioDraft.trim() || undefined,
    };

    const uid = user?.id ?? "";
    if (profileChangeModal.nameChanged) {
      updates.name = profileChangeModal.nextName;
      window.localStorage.setItem(NAME_CHANGED_AT_KEY(uid), String(now));
    }
    if (profileChangeModal.usernameChanged) {
      updates.username = profileChangeModal.nextUsername;
      window.localStorage.setItem(USERNAME_CHANGED_AT_KEY(uid), String(now));
    }

    updateProfile(updates);
    setProfileChangeModal(null);
    setEditingProfile(false);
  };

  const closeProfileChangeModal = () => {
    setProfileChangeModal(null);
  };

  const cancelEditing = () => {
    setNameDraft("");
    setUsernameDraft("");
    setBioDraft("");
    setEditingProfile(false);
  };

  return (
    <>
      {profileChangeModal && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/70 p-4"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--app-card)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-100">
              {profileChangeModal.kind === "blocked" ? "Profile changes not allowed yet" : "Change profile details?"}
            </h2>
            <div className="mt-3 space-y-2 text-sm text-zinc-300">
              {profileChangeModal.messageLines.map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeProfileChangeModal}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 focus:ring-offset-2 focus:ring-offset-[var(--app-card)]"
              >
                {profileChangeModal.kind === "blocked" ? "OK" : "Cancel"}
              </button>
              {profileChangeModal.kind === "confirm" && (
                <button
                  type="button"
                  onClick={applyConfirmedProfileChanges}
                  className="rounded-full border border-[var(--accent-color)] bg-[var(--accent-color)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent-color)] transition-colors hover:bg-[var(--accent-color)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/60 focus:ring-offset-2 focus:ring-offset-[var(--app-card)]"
                >
                  Yes, save changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {showVerifiedModal && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/70 p-4" aria-modal="true" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--app-card)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-100">Verified Trader</h2>
            {verifiedSubmitted ? (
              <>
                <p className="mt-3 text-sm text-zinc-400">Under Review</p>
                <p className="mt-1 text-xs text-zinc-500">We&apos;ll notify you at {user?.email} when your application has been reviewed.</p>
                <button type="button" onClick={() => setShowVerifiedModal(false)} className="mt-4 rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">
                  Close
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-zinc-400">You must meet all requirements before submitting. We&apos;ll email your application to the same address used for feedback.</p>
                {(() => {
                  const hasBio = !!(user?.bio?.trim());
                  const hasBubbles = selectedBubbleIds.length > 0;
                  const streak30 = streakData.loginStreak >= 30;
                  const inOneRoom = joinedGroups.length > 0;
                  const allMet = hasBio && hasBubbles && streak30 && inOneRoom;
                  return (
                    <>
                      <ul className="mt-3 space-y-2 text-sm">
                        <li className={`flex items-center gap-2 ${hasBio ? "text-zinc-300" : "text-zinc-500"}`}>
                          {hasBio ? <span className="text-[var(--accent-color)]" aria-hidden>✓</span> : <span className="text-red-400" aria-hidden>✗</span>}
                          Complete profile with bio
                        </li>
                        <li className={`flex items-center gap-2 ${hasBubbles ? "text-zinc-300" : "text-zinc-500"}`}>
                          {hasBubbles ? <span className="text-[var(--accent-color)]" aria-hidden>✓</span> : <span className="text-red-400" aria-hidden>✗</span>}
                          At least one trading style / bubble selected
                        </li>
                        <li className={`flex items-center gap-2 ${streak30 ? "text-zinc-300" : "text-zinc-500"}`}>
                          {streak30 ? <span className="text-[var(--accent-color)]" aria-hidden>✓</span> : <span className="text-red-400" aria-hidden>✗</span>}
                          30 day login streak (yours: {streakData.loginStreak})
                        </li>
                        <li className={`flex items-center gap-2 ${inOneRoom ? "text-zinc-300" : "text-zinc-500"}`}>
                          {inOneRoom ? <span className="text-[var(--accent-color)]" aria-hidden>✓</span> : <span className="text-red-400" aria-hidden>✗</span>}
                          In at least one chat room (exclusive or not)
                        </li>
                      </ul>
                      {verifiedSubmitError && (
                        <p className="mt-3 text-xs text-red-400">{verifiedSubmitError}</p>
                      )}
                      <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={() => { setShowVerifiedModal(false); setVerifiedSubmitError(null); }} className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!allMet || verifiedSubmitting}
                          onClick={async () => {
                            if (!user?.email) return;
                            setVerifiedSubmitError(null);
                            setVerifiedSubmitting(true);
                            try {
                              const res = await fetch("/api/verified-apply", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({
                                  email: user.email,
                                  name: user.name ?? "",
                                  username: user.username ?? "",
                                }),
                              });
                              const data = (await res.json()) as { error?: string };
                              if (!res.ok) {
                                setVerifiedSubmitError(data.error ?? "Failed to submit. Try again.");
                                return;
                              }
                              try { window.localStorage.setItem("quantivtrade-verified-applied", "true"); } catch {}
                              setVerifiedSubmitted(true);
                              fetch("/api/profile/me", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({ ui_prefs_patch: { verified_applied: true } }),
                              }).catch(() => {});
                            } catch {
                              setVerifiedSubmitError("Could not send. Try again.");
                            } finally {
                              setVerifiedSubmitting(false);
                            }
                          }}
                          className="rounded-full bg-[var(--accent-color)] px-4 py-2 text-sm font-semibold text-[#020308] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {verifiedSubmitting ? "Sending…" : "Submit Application"}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}
    <div className="min-h-screen app-page font-[&quot;Times_New_Roman&quot;,serif]">
      <div className="mx-auto max-w-3xl px-0 sm:px-6 lg:px-8">
        <div className="mb-4" />
        {/* Banner */}
        <section className="relative h-48 w-full overflow-hidden rounded-t-2xl sm:rounded-t-3xl">
          {user.bannerImage ? (
            <Image
              src={user.bannerImage}
              alt=""
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(to bottom right, var(--app-bg), color-mix(in srgb, var(--accent-color) 22%, var(--app-bg))),
                  linear-gradient(color-mix(in srgb, var(--accent-color) 6%, transparent) 1px, transparent 1px),
                  linear-gradient(90deg, color-mix(in srgb, var(--accent-color) 6%, transparent) 1px, transparent 1px)
                `,
                backgroundSize: "100% 100%, 20px 20px, 20px 20px",
              }}
            />
          )}
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onBannerChange}
            aria-label="Upload banner image"
          />
          <button
            type="button"
            onClick={openBannerPicker}
            className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/90 transition-all duration-200 hover:bg-black/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
            aria-label="Change banner photo"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7" />
            </svg>
          </button>
        </section>

        {/* Profile info overlapping banner + avatar */}
        <div className="relative px-6 pb-4 sm:px-8">
          {/* Avatar: 120px, overlaps banner */}
          <div className="absolute left-6 top-0 sm:left-8" style={{ transform: "translateY(-60px)" }}>
            <div className="group relative flex h-[120px] w-[120px] flex-shrink-0">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarChange}
                aria-label="Upload profile photo"
              />
              <button
                type="button"
                onClick={openAvatarPicker}
                className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-all duration-200 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
                aria-label="Change profile photo"
              >
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {user.profilePicture ? (
                <Image
                  src={user.profilePicture}
                  alt="Profile"
                  width={120}
                  height={120}
                  unoptimized
                  className="h-[120px] w-[120px] rounded-full border-4 border-[var(--app-bg)] object-cover transition-all duration-200"
                />
              ) : (
                <div
                  className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-4 border-[var(--app-bg)] text-3xl font-semibold transition-all duration-200"
                  style={{ backgroundColor: "color-mix(in srgb, var(--accent-color) 15%, transparent)", color: "var(--accent-color)" }}
                  aria-hidden
                >
                  {getInitials(user)}
                </div>
              )}
            </div>
          </div>

          {/* Edit Profile button + name/bio area */}
          <div className="flex flex-col pt-16 sm:flex-row sm:items-start sm:justify-between sm:pt-14">
            <div className="min-w-0 flex-1">
              {editingProfile ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Display name"
                    className="w-full max-w-sm rounded-md border border-white/20 bg-black/40 px-3 py-2 text-lg font-semibold text-zinc-100 outline-none transition-colors duration-200 focus:border-[var(--accent-color)]"
                    autoFocus
                  />
                  <div>
                    <label htmlFor="profile-handle" className="mb-1 block text-xs text-zinc-500">
                      Handle (no email — only you see your email)
                    </label>
                    <input
                      id="profile-handle"
                      type="text"
                      value={usernameDraft}
                      onChange={(e) => setUsernameDraft(e.target.value)}
                      placeholder="e.g. trader_jane"
                      className="w-full max-w-sm rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors duration-200 focus:border-[var(--accent-color)] placeholder:text-zinc-500"
                    />
                    <p className="mt-0.5 text-xs text-zinc-500">Shown as @handle. Letters, numbers, underscores only.</p>
                  </div>
                  <textarea
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value)}
                    placeholder="Add a short bio..."
                    rows={3}
                    className="w-full rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors duration-200 focus:border-[var(--accent-color)]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveProfile}
                      className="rounded-full px-4 py-2 text-sm font-semibold text-[#020308] transition-all duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
                      style={{ backgroundColor: "var(--accent-color)" }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors duration-200 hover:border-white/25 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
                      {displayName}
                    </h1>
                    {user?.isVerified && (
                      <span className="inline-flex items-center" title="Verified Trader — Identity and track record confirmed">
                        <VerifiedBadge size={22} />
                      </span>
                    )}
                    {user?.isFounder && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400" title="Joined QuantivTrade in the early days">
                        Early Member
                      </span>
                    )}
                    {typeof window !== "undefined" && window.localStorage.getItem("quantivtrade-top-trader-week") && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400" title="Top Trader">
                        Top Trader — Week of Mar 10
                      </span>
                    )}
                    {user?.isFounder && (
                      <>
                        <style>{`
                          @keyframes founder-shimmer {
                            0%   { background-position: -200% center; }
                            100% { background-position:  200% center; }
                          }
                          .founder-badge {
                            background: linear-gradient(90deg, #92400e 0%, #d97706 25%, #fbbf24 45%, #fde68a 50%, #fbbf24 55%, #d97706 75%, #92400e 100%);
                            background-size: 200% auto;
                            -webkit-background-clip: text;
                            background-clip: text;
                            -webkit-text-fill-color: transparent;
                            animation: founder-shimmer 2.8s linear infinite;
                          }
                        `}</style>
                        <span
                          className="founder-badge inline-flex items-center rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                          title="Founder"
                        >
                          Founder
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-zinc-400">
                      @{displayUsername}
                      {user?.isVerified && (
                        <span className="inline-flex items-center" title="Verified Trader">
                          <VerifiedBadge size={16} />
                        </span>
                      )}
                    </p>
                  {user.bio ? (
                    <p className="mt-2 text-sm text-zinc-300">{user.bio}</p>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">No bio yet.</p>
                  )}
                  {(selfFollowingCount !== null || selfFollowersCount !== null) && (
                    <div className="mt-3 flex items-center gap-5">
                      <div>
                        <span className="text-sm font-bold text-zinc-100">{(selfFollowingCount ?? 0).toLocaleString()}</span>
                        <span className="ml-1.5 text-xs text-zinc-500">Following</span>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-zinc-100">{(selfFollowersCount ?? 0).toLocaleString()}</span>
                        <span className="ml-1.5 text-xs text-zinc-500">Followers</span>
                      </div>
                    </div>
                  )}
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                    {user.email}
                    <span
                      className="inline-flex items-center gap-0.5 text-zinc-500"
                      title="Only you can see your email"
                      aria-label="Private — only you can see your email"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="sr-only sm:not-sr-only sm:inline">Only you see this</span>
                    </span>
                  </p>
                </>
              )}
            </div>
            {!editingProfile && (
              <button
                type="button"
                onClick={startEditing}
                className="mt-4 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-200 transition-all duration-200 hover:border-[var(--accent-color)]/60 hover:bg-[var(--accent-color)]/10 hover:text-[var(--accent-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 focus:ring-offset-2 focus:ring-offset-[var(--app-bg)] sm:mt-0"
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* Stats row */}
          <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
            <span>{posts.length} Posts</span>
            <span aria-hidden>·</span>
            <span>{joinedGroups.length} Groups</span>
            {joinedStr && (
              <>
                <span aria-hidden>·</span>
                <span>Joined {joinedStr}</span>
              </>
            )}
          </div>

          {/* Profile bubbles / Trading Style */}
          <section className="mt-4" aria-label="Trading style and interests">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-50">Trading Style</h2>
              <button
                type="button"
                onClick={openBubblesPanel}
                className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-[var(--accent-color)]"
                title="Edit bubbles"
                aria-label="Edit trading style and interests"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {displayBubbles.map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-200"
                >
                  <span aria-hidden>{b.emoji}</span>
                  <span>{b.label}</span>
                </span>
              ))}
              {displayBubbles.length === 0 && (
                <span className="text-xs text-zinc-500">No tags yet. Click Edit to add up to {MAX_SELECTED_BUBBLES}.</span>
              )}
            </div>

            {/* Edit panel (slide down) */}
            <div
              className="overflow-hidden transition-[max-height] duration-300 ease-out"
              style={{ maxHeight: editingBubbles ? 720 : 0 }}
              aria-hidden={!editingBubbles}
            >
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-xs text-zinc-400">
                  {draftBubbleIds.length}/{MAX_SELECTED_BUBBLES} selected
                </p>
                <div className="space-y-4">
                  {BUBBLE_CATEGORIES.map(({ key, label }) => {
                    const bubblesInCategory = ALL_PROFILE_BUBBLES.filter((b) => b.category === key);
                    return (
                      <div key={key}>
                        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</h3>
                        <div className="flex flex-wrap gap-2">
                          {bubblesInCategory.map((b) => {
                            const selected = draftBubbleIds.includes(b.id);
                            const atMax = !selected && draftBubbleIds.length >= MAX_SELECTED_BUBBLES;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => !atMax && toggleBubble(b.id)}
                                disabled={atMax}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                                  selected
                                    ? "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                                    : atMax
                                      ? "cursor-not-allowed border-white/10 bg-white/5 text-zinc-600 opacity-60"
                                      : "border-white/15 bg-white/5 text-zinc-300 hover:border-[var(--accent-color)]/30 hover:bg-[var(--accent-color)]/5"
                                }`}
                              >
                                <span aria-hidden>{b.emoji}</span>
                                <span>{b.label}</span>
                                {selected && (
                                  <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={saveBubbles}
                    className="rounded-full bg-[var(--accent-color)] px-4 py-2 text-sm font-semibold text-[#020308] transition-colors hover:opacity-90"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={closeBubblesPanel}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Upgrade banner — only for non-verified users */}
          {!user?.isVerified && (
            <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-zinc-900 to-zinc-950" aria-label="Become a Verified Trader">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
              <div className="flex flex-wrap items-center justify-between gap-5 p-5 sm:flex-nowrap">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">Member Access</p>
                  <h3 className="mt-1.5 text-base font-semibold text-zinc-100">Unlock Verified Trader Status</h3>
                  <p className="mt-1 text-sm text-zinc-500">Blue checkmark · Exclusive rooms · Performance card · Sell on Marketplace</p>
                  <p className="mt-2 text-[11px] text-zinc-600">847 traders already verified</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link href="/verify" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-2.5 text-sm font-semibold text-amber-300 transition hover:border-amber-400/50 hover:bg-amber-400/15">
                    Apply for Verification
                  </Link>
                  <p className="text-[11px] text-zinc-600">From $9/mo · Cancel anytime</p>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Spacer so content below doesn't sit under overlap */}
        <div className="h-4" />

        {/* Card wrapper for rest of profile — full rounded card with spacing from content above and footer */}
        <div className="mb-12 mt-8 rounded-2xl border px-6 pb-8 pt-6 transition-colors duration-300 sm:rounded-3xl sm:px-8" style={{ backgroundColor: "var(--app-card-alt)", borderColor: "var(--app-border)" }}>
        {user?.isVerified && <ProfilePerformanceCard />}
        {user?.isVerified && <ProfileMonetizeSection />}
        {/* Your Streaks — aligned with this card, slightly bigger */}
          <section className="mb-6" aria-label="Your streaks">
            <h2 className="text-sm font-semibold text-zinc-50">Your Streaks</h2>
            <div className="mt-3 grid grid-cols-3 gap-4">
              {[
                {
                  icon: <svg className="h-5 w-5 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.5-6.5C12 5 13 7 13 7s1.5-2.5 3-3c.5 2 1 4 1 5 0 2-.5 4-3 6a5 5 0 003 1.5 4 4 0 01-6 2c-1 0-2-.5-3-1.5a6.5 6.5 0 01-1-2c0 1.5 1 3 2.5 4a8 8 0 007-7" /></svg>,
                  label: "Login", streak: streakData.loginStreak, best: streakData.bestLoginStreak, lastDate: streakData.lastLogin
                },
                {
                  icon: <svg className="h-5 w-5 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
                  label: "Journal", streak: streakData.journalStreak, best: streakData.bestJournalStreak, lastDate: streakData.lastJournal
                },
                {
                  icon: <svg className="h-5 w-5 text-[var(--accent-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
                  label: "Briefing", streak: streakData.briefingStreak, best: streakData.bestBriefingStreak, lastDate: streakData.lastBriefing
                },
              ].map(({ icon, label, streak, best, lastDate }) => {
                const history = lastDate ? getSevenDayHistory(lastDate, streak) : [false, false, false, false, false, false, false];
                return (
                <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-4 text-center">
                  <div className="flex justify-center" aria-hidden>{icon}</div>
                  <p className="mt-1.5 text-2xl font-bold text-[var(--accent-color)]">{streak}</p>
                  <p className="text-xs text-zinc-500">day streak</p>
                  <p className="mt-0.5 text-xs font-medium text-zinc-400">{label} Streak</p>
                  <div className="mt-2.5 flex justify-center gap-1">
                    {history.map((active, i) => (
                      <span key={i} className={`h-2 w-2 rounded-full ${active ? "bg-[var(--accent-color)]" : "bg-zinc-600"}`} aria-hidden />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] text-zinc-500">Best: {best} days</p>
                  {streak >= 365 && STREAK_BADGES[365] && (
                    <p className="mt-0.5 text-[10px] font-medium text-amber-400">{STREAK_BADGES[365]}</p>
                  )}
                  {streak >= 100 && streak < 365 && STREAK_BADGES[100] && (
                    <p className="mt-0.5 text-[10px] font-medium text-amber-400">{STREAK_BADGES[100]}</p>
                  )}
                  {streak >= 30 && streak < 100 && STREAK_BADGES[30] && (
                    <p className="mt-0.5 text-[10px] font-medium text-amber-400">{STREAK_BADGES[30]}</p>
                  )}
                  {streak >= 7 && streak < 30 && STREAK_BADGES[7] && (
                    <p className="mt-0.5 text-[10px] font-medium text-amber-400">{STREAK_BADGES[7]}</p>
                  )}
                </div>
              );
              })}
            </div>
          </section>

        {/* Connected Accounts */}
          <section className="mb-6 rounded-xl border border-white/10 px-4 py-4" aria-label="Connected Accounts">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Connected Accounts
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">Link your social accounts to your profile.</p>

            <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-3">
              <div className="flex items-center gap-3">
                {/* X (Twitter) logo */}
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black">
                  <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">X (Twitter)</p>
                  <p className="text-xs text-zinc-500">Not connected</p>
                </div>
              </div>
              <button
                type="button"
                disabled
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-400 cursor-not-allowed opacity-60"
                title="Coming soon"
              >
                Connect
              </button>
            </div>
          </section>

          {/* Invite Friends */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <h3 className="text-sm font-semibold text-zinc-50">Invite Friends</h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">Share your invite code</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm text-[var(--accent-color)]">
                {typeof window !== "undefined" ? getOrCreateInviteCode(user.username ?? "") : "XCH-XXXX-XXXX"}
              </code>
              <button
                type="button"
                onClick={() => {
                  const code = getOrCreateInviteCode(user.username ?? "");
                  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(code).then(() => {
                      setInviteCopied(true);
                      setTimeout(() => setInviteCopied(false), 2000);
                    }).catch(() => {});
                  }
                }}
                className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/5"
                title="Copy invite code"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                {inviteCopied ? "Copied!" : "Copy Code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const code = getOrCreateInviteCode(user.username ?? "");
                  const msg = `Join me on QuantivTrade — the social trading intelligence platform. Use my invite code ${code} at quantivtrade.app to get started. Real market data. AI analysis. Community of traders.`;
                  navigator.share?.({ text: msg, title: "Join QuantivTrade" }).catch(() => navigator.clipboard?.writeText(msg));
                }}
                className="rounded-full border border-[var(--accent-color)]/50 px-3 py-1.5 text-xs font-medium text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10"
              >
                Share
              </button>
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">{getInvitedCount()} friends invited</p>
          </div>

          {/* Apply for Verified */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowVerifiedModal(true)}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/5 hover:text-[var(--accent-color)]"
            >
              Apply for Verified
            </button>
          </div>

          {/* Morning Briefing Preferences — premium users only */}
          {user?.isVerified && (
            <BriefingPreferencesSection />
          )}

        {/* Posts */}
        <section className="mt-6 rounded-2xl border p-5 transition-colors duration-300" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card)" }}>
          <h2 className="text-sm font-semibold text-zinc-50">Your posts</h2>
          {posts.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-400">
              You haven&apos;t posted in any community yet. Join a room and share your first idea.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {posts.map((post) => (
                <li
                  key={post.id}
                  className="rounded-xl border border-white/5 bg-black/30 p-3 text-xs text-zinc-300"
                >
                  <p className="text-zinc-200">{post.text}</p>
                  <p className="mt-2 text-[10px] text-zinc-500">
                    {post.groupName && (
                      <span className="text-[var(--accent-color)]/90">{post.groupName}</span>
                    )}
                    {post.groupName && " · "}
                    {new Date(post.date).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Groups */}
        <section className="mt-6 rounded-2xl border p-5 transition-colors duration-300" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card)" }}>
          <h2 className="text-sm font-semibold text-zinc-50">Groups you&apos;re in</h2>
          {joinedGroups.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-400">
              You haven&apos;t joined any groups yet.{" "}
              <Link
                href="/communities"
                className="font-semibold text-zinc-300 transition-colors duration-200 hover:text-[var(--accent-color)]"
              >
                Explore Smart Communities
              </Link>{" "}
              to join rooms and see them here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {joinedGroups.map((room) => (
                <li key={room.id}>
                  <Link
                    href="/communities"
                    className="block rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-xs text-zinc-200 transition-colors duration-200 hover:border-[var(--accent-color)]/30 hover:bg-white/5"
                  >
                    {room.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Following */}
        <section className="mt-6 rounded-2xl border p-5 transition-colors duration-300" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card)" }}>
          <h2 className="text-sm font-semibold text-zinc-50">Following</h2>
          {followedProfiles.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-400">
              <Link href="/people" className="font-semibold text-zinc-300 transition-colors duration-200 hover:text-[var(--accent-color)]">
                Find people
              </Link>{" "}
              to follow — they&apos;ll show up here and in your feed.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {followedProfiles.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/u/${p.id}`}
                    className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-xs text-zinc-200 transition-colors duration-200 hover:border-[var(--accent-color)]/30 hover:bg-white/5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-[var(--accent-color)]">
                      {getSuggestedInitials(p.name)}
                    </span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-zinc-500">@{p.username}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        </div>
      </div>
    </div>

    </>
  );
}
