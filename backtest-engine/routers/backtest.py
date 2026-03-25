from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import vectorbt as vbt
import yfinance as yf
import pandas as pd

from strategies import ma_crossover, rsi_strategy, breakout_strategy
from strategies import options_strategy
from analysis import metrics as metrics_module
from analysis import walk_forward, monte_carlo

router = APIRouter(tags=["backtest"])


# ─── Request model ────────────────────────────────────────────────────────────

class BacktestRequest(BaseModel):
    ticker: str
    start_date: str                    # YYYY-MM-DD
    end_date: str                      # YYYY-MM-DD
    initial_capital: float = 10000
    strategy_type: str = "ma_crossover"  # ma_crossover | rsi | breakout | options | custom
    params: dict = {}
    position_size: float = 0.95        # fraction of capital per trade
    commission: float = 0.001          # 0.1% per trade
    use_stop_loss: bool = False
    stop_loss_pct: float = 0.05
    use_take_profit: bool = False
    take_profit_pct: float = 0.10
    walk_forward: bool = False
    monte_carlo: bool = False
    monte_carlo_runs: int = 1000


# ─── Claude AI analysis ───────────────────────────────────────────────────────

async def _claude_analysis(metrics: dict, strategy_type: str, ticker: str,
                           start_date: str, end_date: str) -> str:
    import httpx

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return "AI analysis unavailable (ANTHROPIC_API_KEY not set)."

    prompt = f"""You are a quantitative trading analyst. Analyze this backtest result and provide a concise, data-driven assessment.

Strategy: {strategy_type}
Ticker: {ticker} | Period: {start_date} to {end_date}

Key Metrics:
- Total Return: {metrics['total_return']}%
- Annualized Return: {metrics['annualized_return']}%
- Sharpe Ratio: {metrics['sharpe_ratio']}
- Sortino Ratio: {metrics['sortino_ratio']}
- Max Drawdown: {metrics['max_drawdown']}%
- Win Rate: {metrics['win_rate']}%
- Profit Factor: {metrics['profit_factor']}
- Total Trades: {metrics['total_trades']}
- Avg Hold Time: {metrics['avg_hold_time_days']} days
- Alpha vs SPY: {metrics['alpha']}%
- Beta: {metrics['beta']}
- Calmar Ratio: {metrics['calmar_ratio']}

Provide EXACTLY 5 short paragraphs (no headers, no bullets, no markdown):
1. Overall performance assessment — is this a good strategy?
2. Key strengths of the strategy based on the data
3. Key weaknesses and risk factors
4. Specific, actionable improvements to consider (parameter changes, filters, etc.)
5. Market conditions where this strategy performs best and worst

Be specific and data-driven. Reference the actual numbers. Max 250 words total."""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 600,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data["content"][0]["text"].strip()
            return f"AI analysis unavailable (API error {resp.status_code})."
    except Exception as e:
        return f"AI analysis unavailable ({e})."


# ─── Main endpoint ────────────────────────────────────────────────────────────

@router.post("/run")
async def run_backtest(req: BacktestRequest):
    ticker = req.ticker.upper().strip()

    # 1. Fetch price data
    try:
        df = yf.download(
            ticker,
            start=req.start_date,
            end=req.end_date,
            auto_adjust=True,
            progress=False,
        )
        if df.empty or len(df) < 30:
            raise HTTPException(status_code=404, detail=f"Insufficient data for {ticker} in the given date range.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data fetch failed: {e}")

    close = df["Close"].squeeze()
    high = df["High"].squeeze()
    low = df["Low"].squeeze()
    volume = df["Volume"].squeeze()

    # 2. Fetch SPY for benchmark
    spy_close = None
    try:
        spy_df = yf.download("SPY", start=req.start_date, end=req.end_date,
                             auto_adjust=True, progress=False)
        if not spy_df.empty:
            spy_close = spy_df["Close"].squeeze()
    except Exception:
        pass

    # 3. Generate entry/exit signals
    wf_result = None
    mc_result = None
    portfolio = None

    if req.strategy_type == "options":
        # Options strategies don't use vectorbt — return trade-level simulation
        try:
            trades = options_strategy.simulate(close, ticker, req.params)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Options simulation failed: {e}")

        if not trades:
            raise HTTPException(status_code=400, detail="No options trades generated for the given period.")

        trade_returns = [t["pnl_pct"] / 100 for t in trades]
        total_return = sum(
            (1 + r) for r in trade_returns
        ) - 1 if trade_returns else 0.0

        simple_metrics = {
            "total_return": round(total_return * 100, 2),
            "annualized_return": 0.0,
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
            "calmar_ratio": 0.0,
            "max_drawdown": 0.0,
            "max_drawdown_duration_days": 0,
            "beta": 0.0,
            "alpha": 0.0,
            "win_rate": round(sum(1 for r in trade_returns if r > 0) / len(trade_returns) * 100, 2),
            "profit_factor": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "best_trade": round(max(trade_returns) * 100, 2) if trade_returns else 0.0,
            "worst_trade": round(min(trade_returns) * 100, 2) if trade_returns else 0.0,
            "total_trades": len(trades),
            "avg_hold_time_days": float(req.params.get("expiry_days", 30)),
            "monthly_returns": {},
            "equity_curve": [],
            "drawdown_curve": [],
            "trades": trades,
        }

        if req.monte_carlo:
            mc_result = monte_carlo.run(trade_returns, req.initial_capital, req.monte_carlo_runs)

        analysis = await _claude_analysis(simple_metrics, req.strategy_type, ticker, req.start_date, req.end_date)
        return {
            "ticker": ticker,
            "strategy_type": req.strategy_type,
            "metrics": simple_metrics,
            "walk_forward": None,
            "monte_carlo": mc_result,
            "ai_analysis": analysis,
        }

    # Non-options strategies
    try:
        if req.strategy_type == "ma_crossover":
            entries, exits = ma_crossover.generate_signals(close, req.params)
        elif req.strategy_type == "rsi":
            entries, exits = rsi_strategy.generate_signals(close, req.params)
        elif req.strategy_type == "breakout":
            entries, exits = breakout_strategy.generate_signals(close, high, low, volume, req.params)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown strategy_type: {req.strategy_type}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signal generation failed: {e}")

    # 4. Build vectorbt portfolio
    sl_stop = req.stop_loss_pct if req.use_stop_loss else None
    tp_stop = req.take_profit_pct if req.use_take_profit else None

    try:
        pf_kwargs = dict(
            init_cash=req.initial_capital,
            fees=req.commission,
            size=req.position_size,
            size_type="percent",
            upon_opposite_entry="ignore",
        )
        if sl_stop is not None:
            pf_kwargs["sl_stop"] = sl_stop
        if tp_stop is not None:
            pf_kwargs["tp_stop"] = tp_stop

        portfolio = vbt.Portfolio.from_signals(close, entries, exits, **pf_kwargs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Portfolio construction failed: {e}")

    # 5. Walk-forward analysis
    if req.walk_forward:
        try:
            wf_result = walk_forward.run(
                close, high, low, volume,
                req.strategy_type,
                req.initial_capital,
                req.commission,
                req.position_size,
            )
        except Exception:
            wf_result = {"error": "Walk-forward analysis failed"}

    # 6. Calculate metrics
    try:
        result_metrics = metrics_module.calculate(portfolio, spy_close)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Metrics calculation failed: {e}")

    # 7. Monte Carlo
    if req.monte_carlo:
        try:
            trade_returns = [t["return_pct"] / 100 for t in result_metrics.get("trades", [])]
            mc_result = monte_carlo.run(trade_returns, req.initial_capital, req.monte_carlo_runs)
        except Exception:
            mc_result = {"error": "Monte Carlo simulation failed"}

    # 8. AI analysis
    analysis = await _claude_analysis(result_metrics, req.strategy_type, ticker, req.start_date, req.end_date)

    # 9. Return
    return {
        "ticker": ticker,
        "strategy_type": req.strategy_type,
        "params": req.params,
        "metrics": result_metrics,
        "walk_forward": wf_result,
        "monte_carlo": mc_result,
        "ai_analysis": analysis,
    }


# ─── Portfolio optimizer endpoint ─────────────────────────────────────────────

class OptimizeRequest(BaseModel):
    tickers: list[str]
    start_date: str
    end_date: str


@router.post("/optimize")
def optimize_portfolio(req: OptimizeRequest):
    from analysis import portfolio_optimizer
    try:
        result = portfolio_optimizer.run(req.tickers, req.start_date, req.end_date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
