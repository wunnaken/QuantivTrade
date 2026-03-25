"""
Walk-forward analysis: optimize on in-sample, validate on out-of-sample.
"""
import itertools
import numpy as np
import pandas as pd
import vectorbt as vbt


def _build_param_grid(strategy_type: str) -> list[dict]:
    """Return a small parameter grid for the given strategy type."""
    if strategy_type == "ma_crossover":
        return [
            {"fast_period": f, "slow_period": s, "ma_type": m}
            for f, s, m in itertools.product(
                [5, 10, 20],
                [30, 50, 100],
                ["sma", "ema"],
            )
            if f < s
        ]
    if strategy_type == "rsi":
        return [
            {"rsi_period": p, "oversold": os, "overbought": ob}
            for p, os, ob in itertools.product([7, 14, 21], [25, 30], [70, 75])
        ]
    if strategy_type == "breakout":
        return [
            {"lookback_period": lb, "volume_confirmation": vc}
            for lb, vc in itertools.product([10, 20, 40], [True, False])
        ]
    return [{}]


def _run_single(close: pd.Series, high: pd.Series, low: pd.Series, volume: pd.Series,
                strategy_type: str, params: dict, initial_capital: float,
                commission: float, position_size: float) -> float:
    """Run a quick backtest and return Sharpe ratio for ranking."""
    from strategies import ma_crossover, rsi_strategy, breakout_strategy

    if strategy_type == "ma_crossover":
        entries, exits = ma_crossover.generate_signals(close, params)
    elif strategy_type == "rsi":
        entries, exits = rsi_strategy.generate_signals(close, params)
    elif strategy_type == "breakout":
        entries, exits = breakout_strategy.generate_signals(close, high, low, volume, params)
    else:
        return 0.0

    try:
        pf = vbt.Portfolio.from_signals(
            close, entries, exits,
            init_cash=initial_capital,
            fees=commission,
            size=position_size,
            size_type="percent",
            upon_opposite_entry="ignore",
        )
        ret = pf.returns()
        excess = ret - 0.045 / 252
        sharpe = float(excess.mean() / excess.std() * (252 ** 0.5)) if excess.std() > 0 else 0.0
        return sharpe
    except Exception:
        return 0.0


def run(
    close: pd.Series,
    high: pd.Series,
    low: pd.Series,
    volume: pd.Series,
    strategy_type: str,
    initial_capital: float,
    commission: float,
    position_size: float,
    n_splits: int = 3,
) -> dict:
    """
    Walk-forward analysis over `n_splits` windows.

    Each window: 70% in-sample, 30% out-of-sample.
    """
    n = len(close)
    window_size = n // n_splits
    grid = _build_param_grid(strategy_type)

    results = []
    for split in range(n_splits):
        start = split * window_size
        end_is = start + int(window_size * 0.7)
        end_oos = min(start + window_size, n)

        is_close = close.iloc[start:end_is]
        is_high = high.iloc[start:end_is]
        is_low = low.iloc[start:end_is]
        is_vol = volume.iloc[start:end_is]

        oos_close = close.iloc[end_is:end_oos]
        oos_high = high.iloc[end_is:end_oos]
        oos_low = low.iloc[end_is:end_oos]
        oos_vol = volume.iloc[end_is:end_oos]

        if len(is_close) < 30 or len(oos_close) < 10:
            continue

        # Find best params on in-sample
        best_sharpe = -np.inf
        best_params: dict = {}
        for p in grid:
            s = _run_single(is_close, is_high, is_low, is_vol,
                            strategy_type, p, initial_capital, commission, position_size)
            if s > best_sharpe:
                best_sharpe = s
                best_params = p

        # Test best params on out-of-sample
        oos_sharpe = _run_single(oos_close, oos_high, oos_low, oos_vol,
                                 strategy_type, best_params, initial_capital, commission, position_size)

        results.append({
            "split": split + 1,
            "in_sample_start": str(is_close.index[0])[:10],
            "in_sample_end": str(is_close.index[-1])[:10],
            "oos_start": str(oos_close.index[0])[:10] if len(oos_close) > 0 else "",
            "oos_end": str(oos_close.index[-1])[:10] if len(oos_close) > 0 else "",
            "best_params": best_params,
            "in_sample_sharpe": round(best_sharpe, 3),
            "oos_sharpe": round(oos_sharpe, 3),
            "efficiency_ratio": round(oos_sharpe / best_sharpe, 3) if best_sharpe > 0 else None,
        })

    avg_is = float(np.mean([r["in_sample_sharpe"] for r in results])) if results else 0.0
    avg_oos = float(np.mean([r["oos_sharpe"] for r in results])) if results else 0.0

    return {
        "splits": results,
        "avg_in_sample_sharpe": round(avg_is, 3),
        "avg_oos_sharpe": round(avg_oos, 3),
        "avg_efficiency_ratio": round(avg_oos / avg_is, 3) if avg_is > 0 else None,
        "verdict": (
            "Strategy appears robust (OOS efficiency > 50%)"
            if avg_is > 0 and avg_oos / avg_is > 0.5
            else "Potential overfitting — OOS performance significantly below in-sample"
        ),
    }
