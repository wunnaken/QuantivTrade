"""
Portfolio optimization: efficient frontier, max-Sharpe, min-variance.
"""
import numpy as np
import pandas as pd
from scipy.optimize import minimize
import yfinance as yf


TRADING_DAYS = 252
RISK_FREE_RATE = 0.045


def _fetch_prices(tickers: list[str], start: str, end: str) -> pd.DataFrame:
    data = yf.download(tickers, start=start, end=end, auto_adjust=True, progress=False)
    if isinstance(data.columns, pd.MultiIndex):
        prices = data["Close"]
    else:
        prices = data
    return prices.dropna(axis=1, how="all").dropna(how="all")


def _portfolio_stats(weights: np.ndarray, mean_returns: np.ndarray, cov: np.ndarray) -> tuple[float, float, float]:
    port_return = float(np.dot(weights, mean_returns) * TRADING_DAYS)
    port_vol = float(np.sqrt(weights @ cov @ weights) * np.sqrt(TRADING_DAYS))
    sharpe = (port_return - RISK_FREE_RATE) / port_vol if port_vol > 0 else 0.0
    return port_return, port_vol, sharpe


def run(tickers: list[str], start_date: str, end_date: str) -> dict:
    """
    Calculate efficient frontier and optimal portfolios.

    Returns max-Sharpe portfolio, min-variance portfolio, equal-weight portfolio,
    efficient frontier points, correlation matrix, and individual asset stats.
    """
    prices = _fetch_prices(tickers, start_date, end_date)
    available_tickers = list(prices.columns)

    if len(available_tickers) < 2:
        return {"error": "Need at least 2 tickers with available data"}

    returns = prices.pct_change().dropna()
    mean_ret = returns.mean().values
    cov = returns.cov().values
    n = len(available_tickers)

    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
    bounds = [(0.0, 1.0)] * n
    w0 = np.ones(n) / n

    # Max Sharpe portfolio
    def neg_sharpe(w):
        r, v, _ = _portfolio_stats(w, mean_ret, cov)
        return -(r - RISK_FREE_RATE) / v if v > 0 else 0.0

    ms_result = minimize(neg_sharpe, w0, method="SLSQP", bounds=bounds, constraints=constraints)
    ms_weights = ms_result.x
    ms_return, ms_vol, ms_sharpe = _portfolio_stats(ms_weights, mean_ret, cov)

    # Min variance portfolio
    def portfolio_vol(w):
        return float(np.sqrt(w @ cov @ w) * np.sqrt(TRADING_DAYS))

    mv_result = minimize(portfolio_vol, w0, method="SLSQP", bounds=bounds, constraints=constraints)
    mv_weights = mv_result.x
    mv_return, mv_vol, mv_sharpe = _portfolio_stats(mv_weights, mean_ret, cov)

    # Equal weight portfolio
    eq_weights = np.ones(n) / n
    eq_return, eq_vol, eq_sharpe = _portfolio_stats(eq_weights, mean_ret, cov)

    # Efficient frontier (50 points)
    target_returns = np.linspace(
        float(mean_ret.min() * TRADING_DAYS),
        float(mean_ret.max() * TRADING_DAYS),
        50,
    )
    frontier = []
    for target in target_returns:
        cons = [
            {"type": "eq", "fun": lambda w: np.sum(w) - 1},
            {"type": "eq", "fun": lambda w, t=target: _portfolio_stats(w, mean_ret, cov)[0] - t},
        ]
        res = minimize(portfolio_vol, w0, method="SLSQP", bounds=bounds, constraints=cons)
        if res.success:
            r, v, s = _portfolio_stats(res.x, mean_ret, cov)
            frontier.append({"return": round(r * 100, 2), "volatility": round(v * 100, 2), "sharpe": round(s, 3)})

    # Correlation matrix
    corr = returns.corr()
    corr_matrix = {
        t: {t2: round(float(corr.loc[t, t2]), 3) for t2 in available_tickers}
        for t in available_tickers
    }

    # Individual asset stats
    asset_stats = {}
    for i, t in enumerate(available_tickers):
        ann_ret = float(mean_ret[i] * TRADING_DAYS)
        ann_vol = float(returns[t].std() * np.sqrt(TRADING_DAYS))
        asset_stats[t] = {
            "annual_return": round(ann_ret * 100, 2),
            "annual_volatility": round(ann_vol * 100, 2),
            "sharpe": round((ann_ret - RISK_FREE_RATE) / ann_vol, 3) if ann_vol > 0 else 0.0,
            "max_drawdown": round(float(((prices[t] / prices[t].cummax()) - 1).min() * 100), 2),
        }

    def fmt_port(weights, ret, vol, sharpe):
        return {
            "weights": {t: round(float(w), 4) for t, w in zip(available_tickers, weights)},
            "expected_annual_return": round(ret * 100, 2),
            "expected_annual_volatility": round(vol * 100, 2),
            "sharpe_ratio": round(sharpe, 3),
        }

    return {
        "tickers": available_tickers,
        "max_sharpe_portfolio": fmt_port(ms_weights, ms_return, ms_vol, ms_sharpe),
        "min_variance_portfolio": fmt_port(mv_weights, mv_return, mv_vol, mv_sharpe),
        "equal_weight_portfolio": fmt_port(eq_weights, eq_return, eq_vol, eq_sharpe),
        "efficient_frontier": frontier,
        "correlation_matrix": corr_matrix,
        "asset_stats": asset_stats,
    }
