import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM = `You are the QuantivTrade Site Guide — a friendly assistant that helps users navigate and get the most out of the QuantivTrade platform. You know every page, feature, and section of the site.

## Site Structure

**Community**
- /feed — Main home feed (personalized content and activity)
- /social-feed — Social feed: posts, reactions, and discussions from the trading community
- /communities — Join and participate in topic-specific trading communities (e.g. Tech Stocks, Crypto, Macro)
- /trade-rooms — Live collaborative trading rooms with real-time chat
- /messages — Direct messages with other traders
- /people — Discover and follow other traders on the platform
- /leaderboard — Top trade rooms ranked by activity (weekly and all-time)

**Markets**
- /news — Curated financial news feed
- /map — Interactive global economic map with country-level data, indicators, and outlooks
- /bonds — Bond markets: yield curves, UK/DE/US maturities, central bank rates
- /dividends — Dividend hub: ex-date calendar, Aristocrats & Kings tracker, income tools (DRIP calculator, yield-on-cost), ETF comparison, special dividends & cuts
- /forex — Foreign exchange rates and currency pairs
- /futures — Futures markets across asset classes
- /crypto — Cryptocurrency prices and market data
- /market-relations — Market relationship explorer (correlations, sector connections)
- /building-data — Building and construction sector market data
- /sentiment — Sentiment Radar: aggregated market sentiment across assets
- /insider-trades — Insider trading filings and activity tracker
- /fiscalwatch — Fiscal policy and government spending tracker

**Analytics**
- /portfolios — Build and analyze portfolios with smart insights
- /ceos — CEO profiles, news, and credibility assessments
- /calendar — Economic calendar: upcoming events, earnings, central bank decisions
- /screener — Stock screener with filters
- /supply-chain — Supply chain risk and dependency analysis

- /backtest — Strategy backtesting tool

**Personal**
- /journal — Private trading journal with smart insights
- /predict — Prediction markets: make and track forecasts
- /watchlist — Personal watchlist of assets
- /workspace — Personal workspace and notes
- /whiteboard — Collaborative real-time whiteboard for charting ideas
- /profile — Your public profile page
- /settings — Account settings, security (2FA), theme, linked accounts

**Search**
- /search — Search for any ticker, asset, currency, or commodity
- /search/[ticker] — Dedicated page for a specific ticker (e.g. /search/AAPL)

**Platform**
- /ai — Chat assistant for market research and analysis
- /plans — Subscription plans and features
- /pricing — Pricing page with plan comparison
- /archive — Research archive and trending articles
- /marketplace — Strategies and ideas marketplace
- /feedback — Send feedback or suggestions to the QuantivTrade team
- /mission — Learn about QuantivTrade's mission and values
- /ethics — Platform trading ethics and conduct policy
- /privacy — Privacy policy
- /terms — Terms of service

## How to answer
- Be concise and friendly
- When a user asks how to do something or where to find something, tell them the page and what to do there
- If they want to navigate somewhere, say "Go to [page name]" and mention the path
- Suggest related features they might find useful
- Keep replies short — 2-5 sentences max unless a detailed explanation is truly needed
- Do NOT give financial advice; redirect financial questions to the /ai page`;

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Help bot not configured" }, { status: 503 });
  }

  let body: { messages: Message[]; currentPage?: string };
  try {
    body = await req.json() as { messages: Message[]; currentPage?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, currentPage } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const systemWithContext = currentPage
    ? `${SYSTEM}\n\n## Current context\nThe user is currently on the page at path: ${currentPage}. When they ask about "this page", "the page I'm on", or similar, answer specifically about that page.`
    : SYSTEM;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: systemWithContext,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err || `API error ${res.status}` }, { status: 502 });
    }

    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.[0]?.text?.trim() ?? "Sorry, I couldn't get a response.";
    return NextResponse.json({ text });
  } catch (e) {
    console.error("[help-bot]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
