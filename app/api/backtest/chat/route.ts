import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Message = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are a backtesting assistant for QuantivTrade. Your job is to help users set up a backtest by asking the right questions conversationally. Be concise and direct.

You need to gather all of the following before running a backtest:
- Ticker symbol (e.g. AAPL, BTC-USD, SPY)
- Asset type (stock, etf, crypto, index, forex)
- Date range (start and end dates, e.g. 2020-01-01 to 2024-12-31)
- Strategy type: one of: ma_crossover, rsi, breakout, macd, bollinger_bands, stochastic, cci, williams_r, adx, parabolic_sar, volume, ichimoku, orderflow, options, portfolio_optimizer
- Strategy parameters (depend on strategy type — use sensible defaults if the user doesn't specify)
- Initial capital (default $10,000 if not specified)
- Timeframe: 1m, 5m, 15m, 1h, 4h, 1d, 1wk (default 1d)
- Direction: long, short, or both (default long)
- Risk management: stop loss and take profit (optional)
- Position sizing: pct (default 95%), fixed_dollar, or kelly

When the user describes a strategy in natural language, map it to the closest strategy type. For example:
- "moving average crossover" or "golden cross" → ma_crossover
- "buy when oversold" or "RSI strategy" → rsi
- "breakout strategy" → breakout
- "MACD crossover" → macd
- "bollinger band bounce" → bollinger_bands
- "mean reversion" → bollinger_bands or cci
- "trend following" → ma_crossover, adx, or ichimoku

Strategy parameter defaults by type:
- ma_crossover: fast_period=10, slow_period=30, ma_type=sma (also ema/wma/dema/tema)
- rsi: rsi_period=14, oversold=30, overbought=70
- breakout: lookback_period=20, volume_confirmation=true, atr_multiplier=1.5
- macd: fast_period=12, slow_period=26, signal_period=9
- bollinger_bands: period=20, std_dev=2
- stochastic: k_period=14, d_period=3, overbought=80, oversold=20
- cci: period=20, overbought=100, oversold=-100
- williams_r: period=14, overbought=-20, oversold=-80
- adx: period=14, threshold=25
- parabolic_sar: step=0.02, max_step=0.2
- ichimoku: tenkan_period=9, kijun_period=26, senkou_period=52
- volume: vwap_period=20, obv_ma_period=20
- orderflow: threshold=0.6, vwap_period=20
- options: strategy_type=covered_call, expiry_days=30, delta_target=0.30

Ask questions naturally — don't list everything at once. Start with what they want to test, then fill in gaps. If they give you enough info in their first message, don't ask unnecessary questions.

When you have enough information to run the backtest, output ONLY a JSON block wrapped in \`\`\`json ... \`\`\` with this exact structure (no other text outside the JSON block):

\`\`\`json
{
  "ready": true,
  "config": {
    "ticker": "AAPL",
    "asset_type": "stock",
    "start_date": "2020-01-01",
    "end_date": "2024-12-31",
    "initial_capital": 10000,
    "timeframe": "1d",
    "direction": "long",
    "leverage": 1,
    "position_sizing_type": "pct",
    "position_size": 0.95,
    "fixed_dollar_size": 1000,
    "commission": 0.001,
    "slippage": 0.0005,
    "strategy_type": "ma_crossover",
    "params": { "fast_period": 10, "slow_period": 30, "ma_type": "sma" },
    "use_stop_loss": false,
    "stop_loss_type": "fixed",
    "stop_loss_pct": 0.05,
    "stop_loss_atr_multiplier": 2,
    "use_take_profit": false,
    "take_profit_pct": 0.10,
    "use_multiple_tp": false,
    "take_profit_targets": [],
    "walk_forward": false,
    "monte_carlo": false,
    "monte_carlo_runs": 1000
  }
}
\`\`\`

IMPORTANT: Only output the JSON block when you're confident you have enough information. Before that, ask questions conversationally. Keep responses short (2-3 sentences max per question). If the user says something like "run it" or "that looks good" or "go ahead", output the JSON with the information gathered so far using sensible defaults for anything missing.`;

async function callClaude(messages: Message[]): Promise<string> {
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
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
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
  let body: { messages: Message[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  try {
    const reply = await callClaude(body.messages);

    // Check if Claude returned a ready config
    const jsonMatch = reply.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.ready && parsed.config) {
          return NextResponse.json({ reply, config: parsed.config });
        }
      } catch {
        // Not valid JSON, treat as regular message
      }
    }

    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
