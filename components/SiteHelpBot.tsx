"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };

const PAGE_LABELS: Record<string, string> = {
  "/feed": "Home Feed",
  "/social-feed": "Social Feed",
  "/communities": "Communities",
  "/messages": "Messages",
  "/trade-rooms": "Trade Rooms",
  "/news": "News",
  "/map": "Global Map",
  "/bonds": "Bonds",
  "/dividends": "Dividends",
  "/forex": "Forex",
  "/futures": "Futures",
  "/crypto": "Crypto",
  "/market-relations": "Market Relations",
  "/building-data": "Building Data",
  "/sentiment": "Sentiment Radar",
  "/insider-trades": "Insider Trades",
  "/fiscalwatch": "FiscalWatch",
  "/portfolios": "Portfolios",
  "/ceos": "CEOs",
  "/calendar": "Economic Calendar",
  "/screener": "Screener",
  "/supply-chain": "Supply Chain",
  "/archive": "Archive",
  "/marketplace": "Marketplace",
  "/datahub": "DataHub",
  "/backtest": "Backtest",
  "/journal": "Journal",
  "/predict": "Prediction Markets",
  "/watchlist": "My Watchlist",
  "/workspace": "Workspace",
  "/profile": "Profile",
  "/settings": "Settings",
  "/plans": "Plans",
  "/ai": "AI Chat",
};

function getPageLabel(pathname: string): string {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  // Handle dynamic segments like /u/username
  if (pathname.startsWith("/u/")) return "User Profile";
  if (pathname.startsWith("/communities/")) return "Community";
  if (pathname.startsWith("/trade-rooms/")) return "Trade Room";
  return "This Page";
}

const BASE_SUGGESTIONS = [
  "Explain this page",
  "What can I do here?",
  "How do I navigate the site?",
  "Where do I manage my account?",
  "What is the chat assistant for?",
];

export function SiteHelpBot() {
  const pathname = usePathname();
  const pageLabel = getPageLabel(pathname);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevPathRef = useRef(pathname);

  // Reset conversation when the user navigates to a different page
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      setMessages([]);
      setInput("");
    }
  }, [pathname]);

  // Scroll to bottom & focus input when panel opens or new message arrives
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
    if (open && messages.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [open, messages.length]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/help-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, currentPage: pathname }),
      });
      const json = await res.json() as { text?: string; error?: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: json.text ?? json.error ?? "Sorry, something went wrong." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 flex w-80 flex-col rounded-2xl border border-white/10 bg-[var(--app-bg)]"
          style={{ maxHeight: "min(540px, calc(100vh - 100px))" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between rounded-t-2xl px-4 py-3"
            style={{ background: "linear-gradient(135deg, var(--accent-color) 0%, color-mix(in srgb, var(--accent-color) 60%, #7C3AED) 100%)" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">Site Guide</p>
                <p className="flex items-center gap-1 text-[10px] text-white/75">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/60" />
                  {pageLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="rounded-full p-1 text-white/60 hover:bg-white/20 hover:text-white focus:outline-none"
                  aria-label="Clear chat"
                  title="Clear conversation"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-white/60 hover:bg-white/20 hover:text-white focus:outline-none"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ minHeight: 0 }}>
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-zinc-300">
                    👋 Hi! I&apos;m your QuantivTrade guide.
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    You&apos;re on <span className="font-medium text-zinc-300">{pageLabel}</span>. Ask me anything about this page or the site.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BASE_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s === "Explain this page" ? `Explain the ${pageLabel} page` : s)}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-[var(--accent-color)]/40 hover:bg-[var(--accent-color)]/10 hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "rounded-br-sm text-white"
                        : "rounded-bl-sm border border-white/8 bg-white/5 text-zinc-200"
                    }`}
                    style={m.role === "user" ? { backgroundColor: "var(--accent-color)" } : undefined}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-white/8 bg-white/5 px-3 py-2.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-zinc-500"
                      style={{ animation: `helpbot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/8 px-3 py-2.5">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${pageLabel}…`}
                className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-[var(--accent-color)]/50 focus:bg-white/8"
                disabled={loading}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition disabled:opacity-30 hover:opacity-90"
                style={{ backgroundColor: "var(--accent-color)" }}
                aria-label="Send"
              >
                <svg className="h-3.5 w-3.5 text-[#020308]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full transition hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
        style={{ backgroundColor: "var(--accent-color)" }}
        aria-label={open ? "Close site guide" : "Open site guide"}
      >
        {open ? (
          <svg className="h-5 w-5 text-[#020308]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-[#020308]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>

      <style>{`
        @keyframes helpbot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
