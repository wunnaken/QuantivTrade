"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/AuthContext";
import { createClient } from "../../../lib/supabase/client";
import { getProfileInfo } from "../../../lib/get-profile-id";

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
};

type Message = {
  id: number;
  room_id: number;
  user_id: string;
  content: string;
  type: string;
  is_pinned: boolean;
  created_at: string;
  username?: string | null;
};

type Member = {
  id: number;
  room_id: number;
  user_id: string;
  username?: string | null;
};

type TradeCall = {
  id: number;
  room_id: number;
  host_user_id: number;
  ticker: string;
  direction: "long" | "short";
  entry_price: number;
  target_price: number | null;
  stop_loss: number | null;
  current_price: number | null;
  status: "open" | "closed";
  result_pnl: number | null;
  result_pnl_percent: number | null;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
};

function fmt(n: number | null | undefined, prefix = "$") {
  if (n == null) return "—";
  return prefix + n.toFixed(2);
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return null;
  const sign = n >= 0 ? "+" : "";
  return sign + n.toFixed(2) + "%";
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

export default function RoomView({ roomId }: { roomId: number }) {
  const { user } = useAuth();
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tradeCalls, setTradeCalls] = useState<TradeCall[]>([]);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [hostAuthUid, setHostAuthUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isHost, setIsHost] = useState(false);

  const [msgInput, setMsgInput] = useState("");
  const [sending, setSending] = useState(false);

  const [showTradeForm, setShowTradeForm] = useState(false);
  const [tcTicker, setTcTicker] = useState("");
  const [tcDirection, setTcDirection] = useState<"long" | "short">("long");
  const [tcEntry, setTcEntry] = useState("");
  const [tcTarget, setTcTarget] = useState("");
  const [tcStop, setTcStop] = useState("");
  const [tcNotes, setTcNotes] = useState("");
  const [tcSubmitting, setTcSubmitting] = useState(false);

  const [goingLive, setGoingLive] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        setLoading(true);

        // Use API route (service role) to bypass RLS on room_members
        const res = await fetch(`/api/rooms/${roomId}`);
        if (!res.ok) { return; }
        const data = await res.json();

        setRoom(data.room);
        setIsMember(data.isMember);
        setIsHost(data.isHost);
        setMembers(data.members);
        setMessages(data.messages);
        setTradeCalls(data.tradeCalls);
        setAuthUid(data.authUid);
        setHostAuthUid(data.hostAuthUid ?? null);

        // profileId (bigint) still needed for isHost comparison
        const info = await getProfileInfo(supabase);
        if (info) setProfileId(info.id);
      } catch (err) {
        console.error("RoomView load error:", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user, roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isMember) return;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const msg = payload.new as Message;
          const { data: p } = await supabase.from("profiles").select("username, name").eq("user_id", msg.user_id).single();
          const username = p?.username || p?.name || null;
          setMessages((prev) => [...prev, { ...msg, username }]);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const member = payload.new as Member;
          const { data: p } = await supabase.from("profiles").select("username, name").eq("user_id", member.user_id).single();
          const username = p?.username || p?.name || null;
          setMembers((prev) => [...prev, { ...member, username }]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const old = payload.old as Member;
          setMembers((prev) => prev.filter((m) => m.id !== old.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_trade_calls", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setTradeCalls((prev) => [payload.new as TradeCall, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "room_trade_calls", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setTradeCalls((prev) =>
            prev.map((tc) => (tc.id === (payload.new as TradeCall).id ? (payload.new as TradeCall) : tc))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          setRoom((prev) => ({ ...prev, ...(payload.new as Room) }));
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [isMember, roomId]);

  useEffect(() => {
    const openCalls = tradeCalls.filter((tc) => tc.status === "open");
    if (!openCalls.length) return;

    async function pollPrices() {
      const tickers = [...new Set(openCalls.map((tc) => tc.ticker))];
      for (const ticker of tickers) {
        try {
          const res = await fetch(`/api/market/quote?symbol=${ticker}`);
          if (!res.ok) continue;
          const data = await res.json();
          const price: number | null = data.c ?? data.price ?? null;
          if (price == null) continue;
          setTradeCalls((prev) =>
            prev.map((tc) => {
              if (tc.ticker !== ticker || tc.status !== "open") return tc;
              const pnlPct =
                tc.direction === "long"
                  ? ((price - tc.entry_price) / tc.entry_price) * 100
                  : ((tc.entry_price - price) / tc.entry_price) * 100;
              return { ...tc, current_price: price, result_pnl_percent: pnlPct };
            })
          );
        } catch { /* ignore */ }
      }
    }

    void pollPrices();
    const interval = setInterval(pollPrices, 30000);
    return () => clearInterval(interval);
  }, [tradeCalls.filter((tc) => tc.status === "open").length]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!msgInput.trim() || sending) return;
    setSending(true);
    try {
      await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: msgInput.trim() }),
      });
      setMsgInput("");
    } finally {
      setSending(false);
    }
  }

  async function toggleLive() {
    setGoingLive(true);
    try {
      await fetch(`/api/rooms/${roomId}/go-live`, { method: "PATCH" });
    } finally {
      setGoingLive(false);
    }
  }

  async function handleLeave() {
    if (!confirm("Leave this room?")) return;
    setLeaving(true);
    try {
      await fetch(`/api/rooms/${roomId}/leave`, { method: "POST" });
      router.push("/trade-rooms");
    } catch {
      setLeaving(false);
    }
  }

  async function submitTradeCall(e: React.FormEvent) {
    e.preventDefault();
    if (!tcTicker.trim() || !tcEntry) return;
    setTcSubmitting(true);
    try {
      const res = await fetch("/api/rooms/trade-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: roomId,
          ticker: tcTicker.trim().toUpperCase(),
          direction: tcDirection,
          entryPrice: parseFloat(tcEntry),
          targetPrice: tcTarget ? parseFloat(tcTarget) : null,
          stopLoss: tcStop ? parseFloat(tcStop) : null,
          notes: tcNotes.trim() || null,
        }),
      });
      if (res.ok) {
        setShowTradeForm(false);
        setTcTicker(""); setTcEntry(""); setTcTarget(""); setTcStop(""); setTcNotes("");
      }
    } finally {
      setTcSubmitting(false);
    }
  }

  async function closeTradeCall(id: number) {
    await fetch("/api/rooms/trade-call/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradeCallId: id }),
    });
  }

  function copyInvite() {
    if (!room) return;
    navigator.clipboard.writeText(room.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const pinnedMessages = messages.filter((m) => m.is_pinned);

  if (!user) {
    return (
      <main className="app-page min-h-screen flex items-center justify-center">
        <p className="text-sm text-zinc-400">Sign in to access trade rooms.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="app-page min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent-color)]" />
      </main>
    );
  }

  if (!room) {
    return (
      <main className="app-page min-h-screen flex items-center justify-center">
        <p className="text-sm text-zinc-400">Room not found.</p>
      </main>
    );
  }

  if (!isMember) {
    return (
      <main className="app-page min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="font-medium text-zinc-200">You are not a member of this room.</p>
          <Link href="/trade-rooms" className="text-sm text-[var(--accent-color)] hover:underline">
            Back to Trade Rooms
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page flex flex-col" style={{ height: "calc(100vh - 60px)" }}>
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[var(--app-card-alt)] pl-2 pr-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/trade-rooms" className="text-zinc-500 hover:text-zinc-300 transition">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-zinc-100 leading-tight">{room.name}</h1>
              {room.ended_at ? (
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-500">Ended</span>
              ) : room.is_live ? (
                <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  LIVE
                </span>
              ) : null}
            </div>
            <p className="text-xs text-zinc-500">{members.length} / {room.max_members} members</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyInvite}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? "Copied!" : room.invite_code}
          </button>

          {isHost && (
            <>
              <button
                onClick={() => setShowTradeForm((v) => !v)}
                className="rounded-lg border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent-color)] transition hover:bg-[var(--accent-color)]/20"
              >
                + Trade Call
              </button>
              <button
                onClick={toggleLive}
                disabled={goingLive || !!room.ended_at}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                  room.is_live
                    ? "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "bg-red-500 text-white hover:bg-red-600"
                }`}
              >
                {goingLive ? "..." : room.is_live ? "End Live" : "Go Live"}
              </button>
            </>
          )}

          {!isHost && (
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-red-500/30 hover:text-red-400 disabled:opacity-40"
            >
              {leaving ? "Leaving..." : "Leave"}
            </button>
          )}
        </div>
      </div>

      {/* Trade call form (host only) */}
      {showTradeForm && isHost && (
        <div className="shrink-0 border-b border-white/10 bg-[var(--app-card-alt)] px-4 py-3">
          <form onSubmit={submitTradeCall} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-zinc-500">TICKER</label>
              <input
                value={tcTicker}
                onChange={(e) => setTcTicker(e.target.value.toUpperCase())}
                placeholder="SPY"
                maxLength={10}
                required
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-zinc-500">DIRECTION</label>
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTcDirection("long")}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${tcDirection === "long" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-zinc-500 hover:text-zinc-300"}`}
                >
                  Long
                </button>
                <button
                  type="button"
                  onClick={() => setTcDirection("short")}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${tcDirection === "short" ? "bg-red-500/20 text-red-400" : "bg-white/5 text-zinc-500 hover:text-zinc-300"}`}
                >
                  Short
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-zinc-500">ENTRY</label>
              <input
                value={tcEntry}
                onChange={(e) => setTcEntry(e.target.value)}
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
                required
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-zinc-500">TARGET</label>
              <input
                value={tcTarget}
                onChange={(e) => setTcTarget(e.target.value)}
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-zinc-500">STOP</label>
              <input
                value={tcStop}
                onChange={(e) => setTcStop(e.target.value)}
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
              />
            </div>
            <div className="flex-1 space-y-1 min-w-[120px]">
              <label className="text-[10px] font-medium text-zinc-500">NOTES</label>
              <input
                value={tcNotes}
                onChange={(e) => setTcNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowTradeForm(false)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={tcSubmitting}
                className="rounded-lg bg-[var(--accent-color)] px-4 py-1.5 text-xs font-semibold text-[#020308] transition hover:opacity-90 disabled:opacity-40"
              >
                {tcSubmitting ? "Posting..." : "Post Call"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: messages */}
        <div className="flex flex-1 flex-col min-w-0 border-r border-white/10">
          {/* Trade calls strip */}
          {tradeCalls.length > 0 && (
            <div className="shrink-0 border-b border-white/10 bg-[var(--app-card-alt)] px-4 py-2">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Trade Calls</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {tradeCalls.map((tc) => {
                  const pct = fmtPct(tc.result_pnl_percent);
                  const isUp = (tc.result_pnl_percent ?? 0) >= 0;
                  return (
                    <div
                      key={tc.id}
                      className={`flex shrink-0 flex-col gap-0.5 rounded-xl border px-3 py-2 ${
                        tc.status === "closed"
                          ? "border-white/10 bg-white/5"
                          : tc.direction === "long"
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-red-500/20 bg-red-500/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-100">{tc.ticker}</span>
                        <span className={`text-[10px] font-semibold uppercase ${tc.direction === "long" ? "text-emerald-400" : "text-red-400"}`}>
                          {tc.direction}
                        </span>
                        {tc.status === "closed" ? (
                          <span className="text-[10px] text-zinc-500">Closed</span>
                        ) : (
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span>Entry {fmt(tc.entry_price)}</span>
                        {tc.current_price != null && tc.status === "open" && (
                          <span>Now {fmt(tc.current_price)}</span>
                        )}
                        {pct && (
                          <span className={isUp ? "text-emerald-400" : "text-red-400"}>{pct}</span>
                        )}
                      </div>
                      {tc.target_price != null && (
                        <div className="text-[10px] text-zinc-500">
                          TP {fmt(tc.target_price)}{tc.stop_loss != null ? ` · SL ${fmt(tc.stop_loss)}` : ""}
                        </div>
                      )}
                      {tc.notes && <p className="text-[10px] text-zinc-500 max-w-[180px] truncate">{tc.notes}</p>}
                      {isHost && tc.status === "open" && (
                        <button
                          onClick={() => closeTradeCall(tc.id)}
                          className="mt-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition text-left"
                        >
                          Close call
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages feed */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-zinc-500">No messages yet. Say something!</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.user_id === authUid;
                const prevMsg = messages[i - 1];
                const showName = !prevMsg || prevMsg.user_id !== msg.user_id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {showName && (
                      <span className={`mb-0.5 text-[10px] font-medium ${isMe ? "text-[var(--accent-color)]" : "text-zinc-500"}`}>
                        {msg.username ?? "Unknown"}
                      </span>
                    )}
                    <div
                      className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                        isMe
                          ? "rounded-tr-sm bg-[var(--accent-color)]/20 text-zinc-100"
                          : "rounded-tl-sm bg-white/5 text-zinc-200"
                      }`}
                    >
                      {msg.content}
                      <span className="ml-2 text-[10px] text-zinc-600">{timeAgo(msg.created_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          {!room.ended_at ? (
            <form onSubmit={sendMessage} className="shrink-0 flex items-center gap-2 border-t border-white/10 bg-[var(--app-card-alt)] px-4 py-3">
              <input
                type="text"
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                placeholder={room.is_live ? "Send a message..." : "Room is not live yet..."}
                disabled={sending}
                maxLength={500}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !msgInput.trim()}
                className="rounded-xl bg-[var(--accent-color)] px-4 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90 disabled:opacity-40"
              >
                Send
              </button>
            </form>
          ) : (
            <div className="shrink-0 border-t border-white/10 bg-[var(--app-card-alt)] px-4 py-3 text-center text-xs text-zinc-500">
              This room has ended.
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="hidden lg:flex w-64 shrink-0 flex-col overflow-y-auto bg-[var(--app-card-alt)]">
          {/* Members */}
          <div className="border-b border-white/10 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Members ({members.length})
            </p>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-medium text-zinc-400">
                      {(m.username ?? "?")[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs text-zinc-300">{m.username ?? "Unknown"}</span>
                  </div>
                  {hostAuthUid && hostAuthUid === m.user_id && (
                    <span
                      className="rounded-full border border-[var(--accent-color)]/30 px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{ color: "var(--accent-color)" }}
                    >
                      HOST
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pinned messages */}
          {pinnedMessages.length > 0 && (
            <div className="border-b border-white/10 px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Pinned</p>
              <div className="space-y-2">
                {pinnedMessages.map((m) => (
                  <div key={m.id} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-300">
                    {m.content}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Room stats */}
          <div className="px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Room Stats</p>
            <div className="space-y-1.5 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Total messages</span>
                <span className="text-zinc-200">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Trade calls</span>
                <span className="text-zinc-200">{tradeCalls.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Open calls</span>
                <span className="text-zinc-200">{tradeCalls.filter((t) => t.status === "open").length}</span>
              </div>
              {room.description && (
                <p className="mt-2 text-zinc-500 leading-relaxed">{room.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
