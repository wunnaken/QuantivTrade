"""
Monte Carlo simulation: resample trade returns to estimate outcome distribution.
"""
import numpy as np
import pandas as pd


def run(
    trade_returns: list[float],
    initial_capital: float,
    n_runs: int = 1000,
) -> dict:
    """
    Simulate `n_runs` equity paths by randomly resampling the trade return sequence.

    Args:
        trade_returns: List of per-trade return fractions (e.g. 0.05 = +5%).
        initial_capital: Starting portfolio value.
        n_runs: Number of Monte Carlo paths.

    Returns:
        Confidence interval bands (5th, 25th, 50th, 75th, 95th percentiles),
        final equity distribution, and probability metrics.
    """
    if not trade_returns:
        return {
            "error": "No trades to simulate",
            "percentile_curves": {},
            "final_equity": {},
            "probability_metrics": {},
        }

    rng = np.random.default_rng(42)
    n_trades = len(trade_returns)
    arr = np.array(trade_returns)

    # Build equity paths
    all_final: list[float] = []
    # Store every path's equity progression (trade-by-trade)
    paths = np.zeros((n_runs, n_trades + 1))
    paths[:, 0] = initial_capital

    for run_i in range(n_runs):
        sampled = rng.choice(arr, size=n_trades, replace=True)
        equity = initial_capital
        for j, r in enumerate(sampled):
            equity *= 1 + r
            paths[run_i, j + 1] = equity
        all_final.append(equity)

    all_final_arr = np.array(all_final)

    # Percentile curves at each trade step
    pcts = [5, 25, 50, 75, 95]
    pct_curves = {}
    for p in pcts:
        pct_curves[f"p{p}"] = [round(float(v), 2) for v in np.percentile(paths, p, axis=0)]

    # Final equity distribution
    final_stats = {
        "p5": round(float(np.percentile(all_final_arr, 5)), 2),
        "p25": round(float(np.percentile(all_final_arr, 25)), 2),
        "p50": round(float(np.percentile(all_final_arr, 50)), 2),
        "p75": round(float(np.percentile(all_final_arr, 75)), 2),
        "p95": round(float(np.percentile(all_final_arr, 95)), 2),
        "mean": round(float(all_final_arr.mean()), 2),
        "std": round(float(all_final_arr.std()), 2),
    }

    # Probability metrics
    prob_profit = float((all_final_arr > initial_capital).mean())
    prob_loss_10 = float((all_final_arr < initial_capital * 0.90).mean())
    prob_loss_25 = float((all_final_arr < initial_capital * 0.75).mean())
    prob_double = float((all_final_arr >= initial_capital * 2.0).mean())

    # Trade index labels (x-axis)
    trade_labels = list(range(n_trades + 1))

    return {
        "n_runs": n_runs,
        "n_trades": n_trades,
        "trade_labels": trade_labels,
        "percentile_curves": pct_curves,
        "final_equity": final_stats,
        "probability_metrics": {
            "prob_profit": round(prob_profit * 100, 1),
            "prob_loss_10pct": round(prob_loss_10 * 100, 1),
            "prob_loss_25pct": round(prob_loss_25 * 100, 1),
            "prob_double": round(prob_double * 100, 1),
        },
    }
