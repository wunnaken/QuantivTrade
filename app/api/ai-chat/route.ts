import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_SYSTEM = `You are QuantivTrade AI — a world-class financial markets expert embedded in QuantivTrade, a social trading intelligence platform.

You have the same depth of knowledge as any top-tier AI assistant. You know:
- Historical and recent prices, closing prices, highs, lows, volume for any publicly traded stock, ETF, index, crypto, forex pair, commodity, or futures contract
- Earnings reports, revenue, EPS, guidance, and fundamental data for all major companies
- Economic indicators: GDP, CPI, PPI, employment, PMI, consumer sentiment, central bank rates globally
- Broker platforms, order types, margin rules, regulations (SEC, FINRA, ESMA, etc.)
- Technical analysis patterns, indicators, chart formations, backtesting concepts
- Options, futures, swaps, bonds, yield curves, credit markets
- Global macro themes, geopolitical events, trade policy, sanctions
- Portfolio theory, risk management, position sizing, Kelly criterion
- Trading psychology, behavioral finance, market microstructure

CRITICAL RULES ABOUT DATA:
- When live market data is provided below, use those exact numbers — they are real-time
- For historical data you know from training, state it directly without hedging
- NEVER say "I don't have access to", "I can't look up", "I don't have real-time", "my training data has a cutoff", or any variation. Just answer the question with what you know
- If you genuinely don't know a specific number, give your best informed estimate or the most recent figure you do know, and move on. Do not apologize or explain limitations
- Treat every market question the same way you would any other knowledge question — answer it

Personality:
- Direct, confident, knowledgeable
- Plain English, explain jargon when used
- Back up points with specific data and examples
- Concise but complete

Formatting:
- Bullet points for lists
- Bold for key terms
- Clear sections for complex topics
- When citing news articles from the context below, use a markdown link like [Source Name](url). Only cite articles from well-known sources (Reuters, CNBC, Bloomberg, WSJ, MarketWatch, Financial Times, etc.). Skip articles from unknown or press release sources

Rules:
- Frame investment ideas as educational, not advice
- Add a brief disclaimer when relevant
- You can reference the user's risk profile if mentioned

Marketplace verification:
- When users paste marketplace content (strategies, code, courses), analyze: legitimacy, quality, red flags, and verdict
- Be honest — flag low quality or misleading content clearly

Optional follow-ups: end your reply with exactly one line:
FOLLOWUPS: Question one? | Question two? | Question three?
Up to 3 short follow-ups separated by | . Omit if not relevant.`;

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }

  let body: { messages: Message[]; portfolioContext?: string };
  try {
    body = (await req.json()) as { messages: Message[]; portfolioContext?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, portfolioContext } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  // Extract any ticker-like symbols from the latest user message (1-5 uppercase letters)
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content ?? "";
  const NOISE_WORDS = new Set(["I","A","AM","AN","AT","BE","BY","DO","GO","IF","IN","IS","IT","ME","MY","NO","OF","OK","ON","OR","SO","TO","UP","US","WE","THE","AND","FOR","NOT","BUT","YOU","ALL","CAN","HAS","HER","WAS","ONE","OUR","OUT","DAY","HAD","HAS","HIM","HOW","ITS","MAY","NEW","NOW","OLD","SEE","WAY","WHO","DID","GET","HAS","HIM","LET","SAY","SHE","TOO","USE","DAD","MOM","WHY","HOW","ARE","BUY","HIT","LOW","HIGH","WHAT","WHEN","WITH","WILL","FROM","HAVE","THIS","THAT","BEEN","LIKE","JUST","OVER","ALSO","BACK","INTO","YEAR","YOUR","LONG","MUCH","SOME","TIME","VERY","THAN","THEM","WELL","WERE","BEEN","DOES","EACH","EVEN","FIND","HELP","HERE","KEEP","LAST","MADE","MANY","MOST","MUST","NAME","NEXT","ONLY","OPEN","PART","TAKE","TELL","WENT","COME","MAKE","LOOK","GOOD","GIVE","MOST","SAME","SHOW","SIDE","TALK","TURN","WORK","MOVE","LIVE","REAL","LEFT","BEST","KNOW","SELL","HOLD","STOP","GAIN","LOSS","RISK","RATE","BOND","GOLD","CALL","PUTS","BEAR","BULL","FUND","DEBT","CASH","BANK","NYSE","FELL","ROSE","RISE","FALL","DROP","JUMP","DOWN"]);
  const tickerMatches = lastUserMsg.match(/\b[A-Z]{1,5}\b/g) ?? [];
  const mentionedTickers = [...new Set(tickerMatches)].filter(t => !NOISE_WORDS.has(t) && t.length >= 2).slice(0, 8);

  // Always include major indices + any mentioned tickers
  const tickersToFetch = [
    ...new Set([
      ...["SPY", "QQQ", "DIA", "IWM"],
      ...mentionedTickers,
    ])
  ];

  let marketContext = "";
  try {
    const finnhubKey = process.env.FINNHUB_API_KEY?.trim();
    if (finnhubKey) {
      const results = await Promise.all(
        tickersToFetch.map(async (sym) => {
          try {
            // Fetch quote + recent candles in parallel
            const [quoteRes, candleRes] = await Promise.all([
              fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${finnhubKey}`, { cache: "no-store", signal: AbortSignal.timeout(5000) }),
              mentionedTickers.includes(sym)
                ? fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${Math.floor(Date.now() / 1000) - 30 * 86400}&to=${Math.floor(Date.now() / 1000)}&token=${finnhubKey}`, { cache: "no-store", signal: AbortSignal.timeout(5000) })
                : Promise.resolve(null),
            ]);

            if (!quoteRes.ok) return null;
            const q = await quoteRes.json() as { c?: number; dp?: number; d?: number; h?: number; l?: number; o?: number; pc?: number };
            if (!q.c) return null;

            let line = `${sym}: $${q.c.toFixed(2)} | Change: ${(q.dp ?? 0) >= 0 ? "+" : ""}${(q.dp ?? 0).toFixed(2)}% | Open: $${(q.o ?? 0).toFixed(2)} | High: $${(q.h ?? 0).toFixed(2)} | Low: $${(q.l ?? 0).toFixed(2)} | Prev Close: $${(q.pc ?? 0).toFixed(2)}`;

            // Add recent daily closes if this ticker was specifically mentioned
            if (candleRes && candleRes.ok) {
              const candles = await candleRes.json() as { s?: string; t?: number[]; c?: number[]; o?: number[]; h?: number[]; l?: number[]; v?: number[] };
              if (candles.s === "ok" && candles.t?.length && candles.c?.length) {
                const recent = candles.t.slice(-10).map((ts, i) => {
                  const date = new Date(ts * 1000).toISOString().slice(0, 10);
                  return `  ${date}: O:$${candles.o![candles.t!.length - 10 + i]?.toFixed(2)} H:$${candles.h![candles.t!.length - 10 + i]?.toFixed(2)} L:$${candles.l![candles.t!.length - 10 + i]?.toFixed(2)} C:$${candles.c![candles.t!.length - 10 + i]?.toFixed(2)} Vol:${((candles.v![candles.t!.length - 10 + i] ?? 0) / 1e6).toFixed(1)}M`;
                });
                line += `\n  Recent daily OHLCV:\n${recent.join("\n")}`;
              }
            }
            return line;
          } catch { return null; }
        })
      );

      const valid = results.filter(Boolean);
      if (valid.length > 0) {
        const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
        marketContext = `\n\n**Live market data as of ${now} ET:**\n${valid.join("\n")}`;
      }
    }
  } catch { /* proceed without */ }

  // Fetch recent market news for context
  let newsContext = "";
  try {
    const finnhubKey = process.env.FINNHUB_API_KEY?.trim();
    if (finnhubKey) {
      // Fetch general market news + ticker-specific news
      const newsPromises: Promise<Array<{ headline: string; source: string; url: string; datetime: number }>>[] = [
        fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`, { cache: "no-store", signal: AbortSignal.timeout(5000) })
          .then(r => r.ok ? r.json() : [])
          .catch(() => []),
      ];
      // Add ticker-specific news for mentioned tickers
      for (const sym of mentionedTickers.slice(0, 3)) {
        const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const to = new Date().toISOString().slice(0, 10);
        newsPromises.push(
          fetch(`https://finnhub.io/api/v1/company-news?symbol=${sym}&from=${from}&to=${to}&token=${finnhubKey}`, { cache: "no-store", signal: AbortSignal.timeout(5000) })
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        );
      }
      const allNews = await Promise.all(newsPromises);
      const articles: Array<{ headline: string; source: string; url: string }> = [];
      const seenUrls = new Set<string>();
      const BAD_DOMAINS = ["benzinga.com/pressreleases", "accesswire.com", "globenewswire.com", "prnewswire.com", "businesswire.com"];
      for (const batch of allNews) {
        for (const a of (batch ?? []).slice(0, 15)) {
          const url = typeof a.url === "string" ? a.url.trim() : "";
          if (!a.headline || !url || !url.startsWith("https://") || seenUrls.has(url)) continue;
          if (BAD_DOMAINS.some(d => url.includes(d))) continue;
          if (url.length > 500) continue; // tracking URLs
          seenUrls.add(url);
          articles.push({ headline: a.headline, source: a.source ?? "", url });
        }
      }
      if (articles.length > 0) {
        const newsLines = articles.slice(0, 20).map(a => `- "${a.headline}" (${a.source}) [${a.url}]`);
        newsContext = `\n\n**Recent market news articles (use these to cite sources in your response — include the URL when referencing an article):**\n${newsLines.join("\n")}`;
      }
    }
  } catch { /* proceed without */ }

  const system =
    portfolioContext?.trim()
      ? `${BASE_SYSTEM}${marketContext}${newsContext}\n\n**User-provided context (use only to personalize advice, do not repeat verbatim):**\n${portfolioContext.trim()}`
      : `${BASE_SYSTEM}${marketContext}${newsContext}`;

  const anthropicMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system,
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: err || `Anthropic API error: ${res.status}` },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    let text = data.content?.[0]?.text?.trim() ?? "";
    const followUps: string[] = [];
    const followupMatch = text.match(/\nFOLLOWUPS:\s*(.+)$/im);
    if (followupMatch) {
      text = text.replace(/\nFOLLOWUPS:\s*.+$/im, "").trim();
      followupMatch[1]
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3)
        .forEach((q) => followUps.push(q));
    }
    return NextResponse.json({ content: text, followUps });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
