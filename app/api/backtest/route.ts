import { NextResponse } from "next/server";
import { fetchOHLCV } from "@/lib/backtest/fetcher";
import { runBacktest, type ParsedStrategy } from "@/lib/backtest/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return data.content?.[0]?.text?.trim() ?? "";
}

export async function POST(req: Request) {
  let body: {
    assetType: string;
    ticker: string;
    startDate: string;
    endDate: string;
    entryConditions: string;
    exitConditions: string;
    positionSizing: string;
    startingCapital: number;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Step 1: Parse strategy with Claude
  const parsePrompt = `You are a trading strategy parser. Convert the user's described strategy into a JSON object.

User inputs:
- Asset type: ${body.assetType}
- Ticker: ${body.ticker}
- Period: ${body.startDate} to ${body.endDate}
- Entry conditions: "${body.entryConditions}"
- Exit conditions: "${body.exitConditions}"
- Position sizing: "${body.positionSizing}"
- Starting capital: $${body.startingCapital}

Output ONLY valid JSON (no markdown, no explanation):
{
  "ticker": "AAPL",
  "startDate": "2020-01-01",
  "endDate": "2025-01-01",
  "direction": "long",
  "startingCapital": 10000,
  "description": "short one-sentence description",
  "entryConditions": [
    // Choose from ONLY these exact types:
    // {"type":"rsi_below","period":14,"threshold":30}
    // {"type":"rsi_above","period":14,"threshold":70}
    // {"type":"price_above_sma","period":50}
    // {"type":"price_below_sma","period":50}
    // {"type":"price_above_ema","period":20}
    // {"type":"price_below_ema","period":20}
    // {"type":"price_crosses_above_sma","period":50}
    // {"type":"price_crosses_below_sma","period":50}
    // {"type":"bb_below_lower","period":20}
    // {"type":"bb_above_upper","period":20}
    // {"type":"macd_bullish_crossover"}
    // {"type":"macd_bearish_crossover"}
  ],
  "exitConditions": [
    // Choose from ONLY these exact types:
    // {"type":"profit_target","value":0.10}
    // {"type":"stop_loss","value":0.05}
    // {"type":"time_limit","days":30}
    // {"type":"rsi_above","period":14,"threshold":70}
    // {"type":"rsi_below","period":14,"threshold":30}
    // {"type":"price_below_sma","period":50}
    // {"type":"price_above_sma","period":50}
  ],
  "positionSizing":
    // ONE of:
    // {"type":"fixed_amount","value":1000}
    // {"type":"percent_portfolio","value":0.10}
}

Rules:
- ticker uppercase, crypto uses dash (BTC-USD)
- RSI oversold = rsi_below threshold 30; overbought = rsi_above threshold 70
- Always include stop_loss and profit_target in exits if not specified
- If no sizing mentioned, use {"type":"fixed_amount","value":${Math.min(1000, body.startingCapital * 0.1)}}
- startingCapital from user input: ${body.startingCapital}`;

  let strategy: ParsedStrategy;
  try {
    const text = await callClaude(parsePrompt, 1024);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");
    strategy = JSON.parse(match[0]) as ParsedStrategy;
  } catch (err) {
    return NextResponse.json({ error: `Strategy parsing failed: ${err instanceof Error ? err.message : "unknown"}` }, { status: 500 });
  }

  // Step 2: Fetch data
  let data;
  try {
    data = await fetchOHLCV(strategy.ticker, strategy.startDate, strategy.endDate);
    if (data.length < 30) throw new Error(`Only ${data.length} trading days found — try a longer time period or check the ticker symbol.`);
  } catch (err) {
    return NextResponse.json({ error: `Data fetch failed: ${err instanceof Error ? err.message : "unknown"}` }, { status: 500 });
  }

  // Step 3: Run backtest
  let result;
  try {
    result = runBacktest(data, strategy);
  } catch (err) {
    return NextResponse.json({ error: `Backtest error: ${err instanceof Error ? err.message : "unknown"}` }, { status: 500 });
  }

  // Step 4: AI analysis
  const pct = (n: number) => (n * 100).toFixed(1) + "%";
  const analysisPrompt = `You are a quantitative trading analyst. Analyze these backtest results and give a direct, professional assessment.

Strategy: ${strategy.description}
Ticker: ${strategy.ticker} | Period: ${strategy.startDate} to ${strategy.endDate}

Total Return: ${pct(result.metrics.totalReturn)} | Buy & Hold: ${pct(result.metrics.buyHoldReturn)} | Alpha: ${pct(result.metrics.alpha)}
Annualized: ${pct(result.metrics.annualizedReturn)} | Max Drawdown: ${pct(result.metrics.maxDrawdown)}
Sharpe: ${result.metrics.sharpeRatio.toFixed(2)} | Win Rate: ${pct(result.metrics.winRate)}
Avg Win: ${pct(result.metrics.avgWin)} | Avg Loss: ${pct(result.metrics.avgLoss)} | Profit Factor: ${result.metrics.profitFactor.toFixed(2)}
Trades: ${result.metrics.totalTrades} | Avg Hold: ${result.metrics.avgHoldTime.toFixed(0)} days | Grade: ${result.grade}
Yearly: ${Object.entries(result.metrics.yearlyReturns).map(([y, r]) => `${y}: ${pct(r)}`).join(", ")}

Write 3 short paragraphs (no headers, no bullets, no markdown):
1. Overall performance assessment
2. Key strengths and weaknesses
3. Specific, actionable improvement suggestions

Be direct and specific. Max 200 words total.`;

  let analysis = "";
  try {
    analysis = await callClaude(analysisPrompt, 400);
  } catch { analysis = "AI analysis unavailable."; }

  return NextResponse.json({ result, strategy, analysis });
}
