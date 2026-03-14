"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../components/AuthContext";
import { XchangeLogoImage } from "../../components/XchangeLogoImage";
import { XchangeLogoIcon } from "../../components/XchangeLogoIcon";
import { AiMarkdown } from "../../components/AiMarkdown";
import {
  getStoredConversations,
  saveConversation,
  deleteConversation,
  getPortfolioContext,
  setPortfolioContext,
  type StoredConversation,
} from "../../lib/ai-chat-storage";

const QUICK_TOPICS: { label: string; message: string; badge: string }[] = [
  { label: "Markets Overview", message: "Give me a concise markets overview: key indices, sectors, and what’s driving price action lately.", badge: "📈" },
  { label: "Crypto Analysis", message: "What should I know about crypto right now—BTC, ETH, macro drivers, and key levels?", badge: "🪙" },
  { label: "Global Macro", message: "Summarize the main global macro themes affecting markets: rates, growth, and geopolitics.", badge: "🌍" },
  { label: "Technical Analysis", message: "Explain the main concepts of technical analysis and how I can use them in my trading.", badge: "📊" },
  { label: "Portfolio Strategy", message: "What are sound portfolio strategy principles for a retail investor?", badge: "💼" },
  { label: "Trading Psychology", message: "What are the biggest trading psychology pitfalls and how can I avoid them?", badge: "🧠" },
  { label: "News Impact", message: "How does news flow typically impact markets and how can I trade around it?", badge: "📰" },
  { label: "Learn Trading", message: "I’m new to trading. What are the first concepts I should learn and in what order?", badge: "🎓" },
];

const WELCOME_CHIPS = [
  "📈 Explain the current market conditions",
  "🔍 What is a P/E ratio?",
  "⚡ Best ETFs for a moderate investor",
  "🌍 How do interest rates affect stocks?",
  "📓 Review my trading style",
  "🚨 What are the biggest market risks now?",
];

const TOPIC_BADGES: Record<string, string> = {
  market: "📈 Discussing: Equities",
  crypto: "🪙 Discussing: Crypto",
  macro: "🌍 Discussing: Global Macro",
  technical: "📊 Discussing: Technical Analysis",
  portfolio: "💼 Discussing: Portfolio",
  psychology: "🧠 Discussing: Psychology",
  news: "📰 Discussing: News Impact",
  learn: "🎓 Discussing: Learn Trading",
};

type ChatMessage = { role: "user" | "assistant"; content: string; id: string };
const MAX_INPUT_LENGTH = 4000;

function getInitials(name: string | undefined, username: string | undefined, email: string | undefined) {
  const n = (name || username || email || "?").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function detectTopic(lastContent: string): string | null {
  const lower = lastContent.toLowerCase();
  if (/\b(equit(y|ies)|stock|index|etf|s&p|nasdaq)\b/.test(lower)) return TOPIC_BADGES.market;
  if (/\b(crypto|bitcoin|btc|eth|token)\b/.test(lower)) return TOPIC_BADGES.crypto;
  if (/\b(macro|rates|fed|inflation|geopolitic)\b/.test(lower)) return TOPIC_BADGES.macro;
  if (/\b(technical|chart|support|resistance|rsi|macd)\b/.test(lower)) return TOPIC_BADGES.technical;
  if (/\b(portfolio|diversif|allocation)\b/.test(lower)) return TOPIC_BADGES.portfolio;
  if (/\b(psycholog|emotion|discipline)\b/.test(lower)) return TOPIC_BADGES.psychology;
  if (/\b(news|headline|earnings)\b/.test(lower)) return TOPIC_BADGES.news;
  if (/\b(learn|beginner|basics)\b/.test(lower)) return TOPIC_BADGES.learn;
  return null;
}

const AI_SHARE_KEY = "xchange-ai-share";

export default function AIPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [topicBadge, setTopicBadge] = useState<string | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [recentPanelOpen, setRecentPanelOpen] = useState(true);
  const [portfolioModalOpen, setPortfolioModalOpen] = useState(false);
  const [portfolioContext, setPortfolioContextState] = useState("");
  const [followUps, setFollowUps] = useState<Record<string, string[]>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recentChats, setRecentChats] = useState<StoredConversation[]>([]);
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(null);
  const [deleteConfirmConv, setDeleteConfirmConv] = useState<StoredConversation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = messagesScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    setPortfolioContextState(getPortfolioContext());
  }, []);

  useEffect(() => {
    setRecentChats(getStoredConversations());
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [inputValue]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || loading) return;
      const userMsg: ChatMessage = {
        role: "user",
        content: trimmed,
        id: `u-${Date.now()}`,
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInputValue("");
      setLoading(true);
      setFollowUps((f) => {
        const next = { ...f };
        Object.keys(next).forEach((id) => delete next[id]);
        return next;
      });

      try {
        const res = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
            portfolioContext: getPortfolioContext() || undefined,
          }),
        });
        const data = (await res.json()) as { content?: string; followUps?: string[]; error?: string };
        if (!res.ok) {
          const err = data.error || "Something went wrong";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Sorry, I couldn’t complete that. ${err}`, id: `a-${Date.now()}` },
          ]);
          return;
        }
        const assistantId = `a-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.content ?? "", id: assistantId },
        ]);
        if (Array.isArray(data.followUps) && data.followUps.length > 0) {
          setFollowUps((f) => ({ ...f, [assistantId]: data.followUps! }));
        }
        const lastContent = data.content ?? "";
        setTopicBadge(detectTopic(lastContent));
        saveConversation([...nextMessages, { role: "assistant", content: lastContent }]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I couldn’t reach the server. Please try again.",
            id: `a-${Date.now()}`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(inputValue);
    },
    [inputValue, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(inputValue);
      }
    },
    [inputValue, sendMessage]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setTopicBadge(null);
    setFollowUps({});
    setLoadedConversationId(null);
  }, []);

  const loadConversation = useCallback((conv: StoredConversation) => {
    setMessages(
      conv.messages.map((m, i) => ({
        role: m.role,
        content: m.content,
        id: `${m.role}-${conv.id}-${i}`,
      }))
    );
    const lastAi = conv.messages.filter((m) => m.role === "assistant").pop();
    setTopicBadge(lastAi ? detectTopic(lastAi.content) : null);
    setFollowUps({});
    setLoadedConversationId(conv.id);
  }, []);

  const confirmDeleteConversation = useCallback((conv: StoredConversation) => {
    setDeleteConfirmConv(conv);
  }, []);

  const doDeleteConversation = useCallback(() => {
    if (!deleteConfirmConv) return;
    const id = deleteConfirmConv.id;
    deleteConversation(id);
    setRecentChats((prev) => prev.filter((x) => x.id !== id));
    if (loadedConversationId === id) {
      setMessages([]);
      setTopicBadge(null);
      setFollowUps({});
      setLoadedConversationId(null);
    }
    setDeleteConfirmConv(null);
  }, [deleteConfirmConv, loadedConversationId]);

  const savePortfolioContext = useCallback((value: string) => {
    setPortfolioContext(value);
    setPortfolioContextState(value);
    setPortfolioModalOpen(false);
  }, []);

  const handleShare = useCallback((content: string) => {
    if (typeof window === "undefined") return;
    const text = `💡 Xchange AI insight:\n\n${content}`;
    try {
      sessionStorage.setItem(AI_SHARE_KEY, JSON.stringify({ content: text }));
    } catch {
      // ignore
    }
    router.push("/feed");
  }, [router]);

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      },
      () => {}
    );
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();
  const username = user?.name || user?.username || "there";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 overflow-hidden app-page">
      {/* Left panels: Quick topics + Recent chats (hidden on mobile) */}
      <div
        className={`hidden min-h-0 flex-col border-r border-white/10 bg-[#0A0E1A] transition-all duration-200 lg:flex ${
          leftPanelOpen ? "lg:w-[200px]" : "lg:w-0 lg:overflow-hidden"
        }`}
      >
        <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-white/10 px-3">
          <span className="text-xs font-medium text-zinc-400">Quick topics</span>
          <button
            type="button"
            onClick={() => setLeftPanelOpen(false)}
            className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            aria-label="Collapse panel"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {QUICK_TOPICS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => sendMessage(t.message)}
              disabled={loading}
              className="w-full rounded-lg px-2 py-2 text-left text-xs text-zinc-300 transition hover:bg-white/5 hover:text-[var(--accent-color)] disabled:opacity-50"
            >
              <span className="mr-1">{t.badge}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={() => setPortfolioModalOpen(true)}
            className="w-full rounded-lg border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 px-2 py-2 text-xs font-medium text-[var(--accent-color)] transition hover:bg-[var(--accent-color)]/20"
          >
            Add my context
          </button>
        </div>
      </div>
      {/* Recent chats panel */}
      <div
        className={`hidden min-h-0 flex-col border-r border-white/10 bg-[#0A0E1A]/80 transition-all duration-200 lg:flex ${
          recentPanelOpen ? "lg:w-[200px]" : "lg:w-0 lg:overflow-hidden"
        }`}
      >
        <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-white/10 px-3">
          <span className="text-xs font-medium text-zinc-400">Recent chats</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => clearChat()}
              className="rounded px-2 py-1 text-[10px] font-medium text-[var(--accent-color)] hover:bg-white/5"
            >
              New Chat
            </button>
            <button
              type="button"
              onClick={() => setRecentPanelOpen(false)}
              className="rounded p-1 text-zinc-500 hover:bg-white/5"
              aria-label="Collapse"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {recentChats.map((c) => (
            <div
              key={c.id}
              className="group flex items-center gap-0.5 rounded-lg hover:bg-white/5"
            >
              <button
                type="button"
                onClick={() => loadConversation(c)}
                className="min-w-0 flex-1 truncate px-2 py-2 text-left text-xs text-zinc-400 hover:text-zinc-200"
                title={c.label}
              >
                {c.label}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); confirmDeleteConversation(c); }}
                className="shrink-0 rounded p-1.5 text-zinc-500 opacity-0 transition hover:bg-white/5 hover:text-red-400 group-hover:opacity-100"
                aria-label={`Delete "${c.label.slice(0, 30)}..."`}
                title="Delete conversation"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          {deleteConfirmConv && (
            <div className="mt-2 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
              <span className="shrink-0 text-amber-400" aria-hidden>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
              <p className="text-[11px] text-amber-200/90">Are you sure you want to delete this chat?</p>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={doDeleteConversation}
                  className="rounded bg-red-500/20 px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/30"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmConv(null)}
                  className="rounded bg-white/10 px-2 py-1 text-[11px] font-medium text-zinc-400 hover:bg-white/15"
                >
                  Cancel
                </button>
              </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Main chat column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--app-bg)]">
        {/* AI Assistant header + reopen panels strip just below it */}
        <div className="relative flex-shrink-0 border-b border-white/10">
          <header className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0 rounded-lg border border-white/10 bg-white/5 p-0.5">
                <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-100">AI Chat</span>
                <Link
                  href="/whiteboard"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-[var(--accent-color)]"
                >
                  Whiteboard
                </Link>
              </div>
              {topicBadge && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                  {topicBadge}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              Ask me anything about markets, trading, economics, or your portfolio
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">
              Powered by Claude
            </span>
          </div>
          </header>
          {/* Reopen panels: just under "AI Assistant" header (desktop only) */}
          {(!leftPanelOpen || !recentPanelOpen) && (
            <div
              className="absolute left-0 top-full z-20 hidden flex-col gap-0.5 rounded-br border-b border-r border-white/10 bg-[#0A0E1A] py-1.5 pl-1 pr-1.5 shadow-md lg:flex"
              aria-label="Open panels"
            >
              {!leftPanelOpen && (
                <button
                  type="button"
                  onClick={() => setLeftPanelOpen(true)}
                  className="flex items-center gap-1 rounded px-1.5 py-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-[var(--accent-color)]"
                  aria-label="Open Quick topics"
                  title="Quick topics"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-[11px] font-medium">Topics</span>
                </button>
              )}
              {!recentPanelOpen && (
                <button
                  type="button"
                  onClick={() => setRecentPanelOpen(true)}
                  className="flex items-center gap-1 rounded px-1.5 py-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-[var(--accent-color)]"
                  aria-label="Open Recent chats"
                  title="Recent chats"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-[11px] font-medium">Recent</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Messages area: only this scrolls, so layout doesn't shift */}
        <div
          ref={messagesScrollRef}
          className="ai-chat-grid-bg flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4"
          style={{ backgroundColor: "var(--app-bg)" }}
        >
          {messages.length === 0 && !loading ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
              <div className="ai-welcome-logo-pulse mb-4">
                <XchangeLogoImage size={80} />
              </div>
              <p className="text-lg font-medium text-zinc-200">
                {greeting}, {username}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                What would you like to know about the markets today?
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {WELCOME_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => sendMessage(chip)}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:border-[var(--accent-color)]/30 hover:bg-[var(--accent-color)]/10 hover:text-[var(--accent-color)]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 animate-[fadeIn_0.25s_ease-out] ${
                    m.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  {m.role === "user" ? (
                    <>
                      <div
                        className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white"
                        style={{ backgroundColor: "var(--accent-color)" }}
                      >
                        {m.content}
                      </div>
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[var(--accent-color)] ring-1 ring-white/20"
                        style={{ backgroundColor: "color-mix(in srgb, var(--accent-color) 25%, transparent)" }}
                      >
                        {user ? getInitials(user.name, user.username, user.email) : "?"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
                        style={{ backgroundColor: "#0F1520" }}
                      >
                        <XchangeLogoImage size={32} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="rounded-2xl rounded-tl-sm bg-[#0F1520] px-4 py-3 text-sm text-zinc-100"
                        >
                          <AiMarkdown content={m.content} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(m.id, m.content)}
                            className="rounded px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                          >
                            {copiedId === m.id ? "Copied!" : "Copy"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShare(m.content)}
                            className="rounded px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-white/5 hover:text-[var(--accent-color)]"
                          >
                            Share
                          </button>
                        </div>
                        {followUps[m.id]?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {followUps[m.id].map((q, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => sendMessage(q)}
                                disabled={loading}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400 transition hover:border-[var(--accent-color)]/30 hover:text-[var(--accent-color)] disabled:opacity-50"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 animate-[fadeIn_0.2s_ease-out]">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
                    style={{ backgroundColor: "#0F1520" }}
                  >
                    <XchangeLogoImage size={32} />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-[#0F1520] px-4 py-3">
                    <span className="ai-typing-dot h-2 w-2 rounded-full bg-zinc-500" />
                    <span className="ai-typing-dot h-2 w-2 rounded-full bg-zinc-500" />
                    <span className="ai-typing-dot h-2 w-2 rounded-full bg-zinc-500" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-white/10 bg-[var(--app-bg)] p-4">
          <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
            <div className="flex gap-2 rounded-xl border border-white/10 bg-[#0F1520] transition-[box-shadow] focus-within:border-[var(--accent-color)]/40 focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent-color)_20%,transparent)]">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.slice(0, MAX_INPUT_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about markets..."
                rows={1}
                disabled={loading}
                className="min-h-[44px] flex-1 resize-none bg-transparent px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none disabled:opacity-60"
                style={{ maxHeight: 160 }}
              />
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-40"
                style={{ backgroundColor: "var(--accent-color)" }}
                aria-label="Send"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
            {inputValue.length >= MAX_INPUT_LENGTH * 0.9 && (
              <p className="mt-1 text-right text-[10px] text-zinc-500">
                {inputValue.length} / {MAX_INPUT_LENGTH}
              </p>
            )}
          </form>
        </div>
      </div>

      {/* Portfolio context modal */}
      {portfolioModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPortfolioModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/10 bg-[#0F1520] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-zinc-200">Add my context</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Paste your portfolio summary or situation. This is added to the AI’s context for personalized advice (stored locally).
            </p>
            <textarea
              value={portfolioContext}
              onChange={(e) => setPortfolioContextState(e.target.value)}
              placeholder="e.g. I hold 60% stocks, 40% bonds. I’m 35 and saving for retirement..."
              rows={4}
              className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[var(--accent-color)]/50"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPortfolioModalOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => savePortfolioContext(portfolioContext)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: "var(--accent-color)" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
