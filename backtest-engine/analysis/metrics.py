"""
Performance metrics calculated from a vectorbt Portfolio object.
"""
import math
import numpy as np
import pandas as pd
import vectorbt as vbt


RISK_FREE_RATE_ANNUAL = 0.045  # 4.5%
TRADING_DAYS = 252


def calculate(portfolio: vbt.Portfolio, spy_close: pd.Series | None = None) -> dict:
    """
    Calculate comprehensive performance metrics from a vectorbt Portfolio.

    Returns a dict with all metrics, equity curve, drawdown curve, and trade list.
    """
    returns = portfolio.returns()
    equity = portfolio.value()

    total_return = float(portfolio.total_return())
    n_days = len(equity)
    years = n_days / TRADING_DAYS

    # Annualized return
    annualized_return = float((1 + total_return) ** (1 / max(years, 1 / TRADING_DAYS)) - 1)

    # Sharpe ratio (annualized, excess over risk-free)
    daily_rf = RISK_FREE_RATE_ANNUAL / TRADING_DAYS
    excess = returns - daily_rf
    sharpe = float(
        (excess.mean() / excess.std() * math.sqrt(TRADING_DAYS))
        if excess.std() > 0 else 0.0
    )

    # Sortino ratio (downside deviation only)
    downside = returns[returns < daily_rf] - daily_rf
    downside_std = float(np.sqrt((downside ** 2).mean())) if len(downside) > 0 else 0.0
    sortino = float(
        (excess.mean() / downside_std * math.sqrt(TRADING_DAYS))
        if downside_std > 0 else 0.0
    )

    # Max drawdown
    peak = equity.cummax()
    dd_series = (equity - peak) / peak
    max_drawdown = float(dd_series.min())

    # Max drawdown duration
    in_dd = dd_series < 0
    dd_duration = 0
    current_streak = 0
    for val in in_dd:
        if val:
            current_streak += 1
            dd_duration = max(dd_duration, current_streak)
        else:
            current_streak = 0

    # Calmar ratio
    calmar = float(annualized_return / abs(max_drawdown)) if max_drawdown != 0 else 0.0

    # Trade-level stats
    trades = portfolio.trades.records_readable
    n_trades = len(trades)
    win_rate = 0.0
    avg_win = 0.0
    avg_loss = 0.0
    best_trade = 0.0
    worst_trade = 0.0
    profit_factor = 0.0
    avg_hold_time = 0.0
    trade_list = []

    if n_trades > 0:
        rets = trades["Return"].values
        wins = rets[rets > 0]
        losses = rets[rets <= 0]
        win_rate = float(len(wins) / n_trades)
        avg_win = float(wins.mean()) if len(wins) > 0 else 0.0
        avg_loss = float(losses.mean()) if len(losses) > 0 else 0.0
        best_trade = float(rets.max())
        worst_trade = float(rets.min())

        gross_profit = float(trades.loc[trades["Return"] > 0, "PnL"].sum()) if "PnL" in trades.columns else float(wins.sum())
        gross_loss = abs(float(trades.loc[trades["Return"] <= 0, "PnL"].sum())) if "PnL" in trades.columns else abs(float(losses.sum()))
        profit_factor = float(gross_profit / gross_loss) if gross_loss > 0 else (99.0 if gross_profit > 0 else 0.0)

        if "Duration" in trades.columns:
            avg_hold_time = float(trades["Duration"].dt.days.mean())

        for _, row in trades.iterrows():
            trade_list.append({
                "entry_date": str(row.get("Entry Timestamp", ""))[:10],
                "exit_date": str(row.get("Exit Timestamp", ""))[:10],
                "entry_price": round(float(row.get("Avg Entry Price", 0)), 4),
                "exit_price": round(float(row.get("Avg Exit Price", 0)), 4),
                "return_pct": round(float(row.get("Return", 0)) * 100, 2),
                "hold_days": int(row["Duration"].days) if "Duration" in trades.columns else 0,
            })

    # Beta and Alpha vs SPY
    beta = 0.0
    alpha = 0.0
    if spy_close is not None and len(spy_close) > 1:
        spy_ret = spy_close.pct_change().dropna()
        strat_ret = returns.dropna()
        aligned = pd.DataFrame({"strat": strat_ret, "spy": spy_ret}).dropna()
        if len(aligned) > 10:
            cov = np.cov(aligned["strat"], aligned["spy"])
            beta = float(cov[0, 1] / cov[1, 1]) if cov[1, 1] != 0 else 0.0
            spy_ann = float((1 + spy_ret.mean()) ** TRADING_DAYS - 1)
            alpha = float(annualized_return - (RISK_FREE_RATE_ANNUAL + beta * (spy_ann - RISK_FREE_RATE_ANNUAL)))

    # Monthly returns
    monthly = {}
    eq_monthly = equity.resample("ME").last()
    for i in range(1, len(eq_monthly)):
        key = eq_monthly.index[i].strftime("%Y-%m")
        prev = float(eq_monthly.iloc[i - 1])
        curr = float(eq_monthly.iloc[i])
        monthly[key] = round((curr - prev) / prev * 100, 2) if prev > 0 else 0.0

    # Equity curve
    equity_curve = [
        {"date": str(ts)[:10], "value": round(float(v), 2)}
        for ts, v in equity.items()
    ]

    # Drawdown curve
    dd_curve = [
        {"date": str(ts)[:10], "drawdown": round(float(v) * 100, 2)}
        for ts, v in dd_series.items()
    ]

    return {
        "total_return": round(total_return * 100, 2),
        "annualized_return": round(annualized_return * 100, 2),
        "sharpe_ratio": round(sharpe, 3),
        "sortino_ratio": round(sortino, 3),
        "calmar_ratio": round(calmar, 3),
        "max_drawdown": round(max_drawdown * 100, 2),
        "max_drawdown_duration_days": dd_duration,
        "beta": round(beta, 3),
        "alpha": round(alpha * 100, 2),
        "win_rate": round(win_rate * 100, 2),
        "profit_factor": round(profit_factor, 3),
        "avg_win": round(avg_win * 100, 2),
        "avg_loss": round(avg_loss * 100, 2),
        "best_trade": round(best_trade * 100, 2),
        "worst_trade": round(worst_trade * 100, 2),
        "total_trades": n_trades,
        "avg_hold_time_days": round(avg_hold_time, 1),
        "monthly_returns": monthly,
        "equity_curve": equity_curve,
        "drawdown_curve": dd_curve,
        "trades": trade_list,
    }
