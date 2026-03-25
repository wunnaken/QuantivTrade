"""
Options strategy simulator using Black-Scholes pricing.

Supported strategy types:
  covered_call, cash_secured_put, bull_call_spread, bear_put_spread,
  iron_condor, straddle
"""
import math
import numpy as np
import pandas as pd
from scipy.stats import norm
import yfinance as yf


# ─── Black-Scholes helpers ────────────────────────────────────────────────────

def _d1(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0:
        return 0.0
    return (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))


def _d2(S, K, T, r, sigma):
    return _d1(S, K, T, r, sigma) - sigma * math.sqrt(T)


def bs_call(S, K, T, r, sigma):
    if T <= 0:
        return max(S - K, 0.0)
    d1 = _d1(S, K, T, r, sigma)
    d2 = _d2(S, K, T, r, sigma)
    return S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)


def bs_put(S, K, T, r, sigma):
    if T <= 0:
        return max(K - S, 0.0)
    d1 = _d1(S, K, T, r, sigma)
    d2 = _d2(S, K, T, r, sigma)
    return K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)


def _fetch_iv(ticker: str) -> float:
    """Try to fetch ATM implied volatility from yfinance options chain."""
    try:
        tk = yf.Ticker(ticker)
        info = tk.info
        spot = info.get("currentPrice") or info.get("regularMarketPrice", 100)
        exps = tk.options
        if not exps:
            return 0.25
        chain = tk.option_chain(exps[0])
        calls = chain.calls
        # Find ATM call
        calls = calls[calls["strike"] > 0].copy()
        calls["dist"] = (calls["strike"] - spot).abs()
        atm = calls.nsmallest(1, "dist")
        iv = float(atm["impliedVolatility"].iloc[0]) if not atm.empty else 0.25
        return max(iv, 0.05)
    except Exception:
        return 0.25


# ─── Strategy simulators ─────────────────────────────────────────────────────

def simulate(
    close: pd.Series,
    ticker: str,
    params: dict,
) -> list[dict]:
    """
    Simulate options strategy trades on a price series.

    Params:
        strategy_type: covered_call | cash_secured_put | bull_call_spread |
                       bear_put_spread | iron_condor | straddle
        expiry_days (int): Days to expiration per trade. Default 30.
        delta_target (float): Approximate delta for strike selection. Default 0.30.

    Returns list of trade dicts with entry_date, exit_date, pnl, pnl_pct, strategy.
    """
    strategy_type = str(params.get("strategy_type", "covered_call"))
    expiry_days = int(params.get("expiry_days", 30))
    delta_target = float(params.get("delta_target", 0.30))
    r = 0.045  # risk-free rate

    iv = _fetch_iv(ticker)
    T_years = expiry_days / 365.0
    trades = []

    # Step through the series in `expiry_days` increments
    dates = close.index
    i = 0
    while i < len(dates) - expiry_days:
        entry_date = dates[i]
        exit_idx = min(i + expiry_days, len(dates) - 1)
        exit_date = dates[exit_idx]
        S_entry = float(close.iloc[i])
        S_exit = float(close.iloc[exit_idx])

        # Approximate strike from delta target
        # For a call: delta ≈ N(d1), so d1 ≈ N_inv(delta)
        # Strike ≈ S * exp(-(N_inv(delta) * sigma * sqrt(T) - (r + 0.5*sigma^2)*T))
        sigma = iv
        d1_target = norm.ppf(delta_target)
        K_call = S_entry * math.exp(-(d1_target * sigma * math.sqrt(T_years) - (r + 0.5 * sigma ** 2) * T_years))
        K_put = S_entry * math.exp((d1_target * sigma * math.sqrt(T_years) - (r + 0.5 * sigma ** 2) * T_years))
        K_call = round(K_call / 0.5) * 0.5
        K_put = round(K_put / 0.5) * 0.5

        pnl = 0.0
        collateral = S_entry  # per-share collateral approximation

        if strategy_type == "covered_call":
            # Sell ATM call, hold 100 shares
            premium = bs_call(S_entry, K_call, T_years, r, sigma)
            # At expiry
            stock_pnl = S_exit - S_entry
            option_pnl = premium - max(S_exit - K_call, 0)
            pnl = stock_pnl + option_pnl
            collateral = S_entry

        elif strategy_type == "cash_secured_put":
            # Sell OTM put, cash secured
            premium = bs_put(S_entry, K_put, T_years, r, sigma)
            pnl = premium - max(K_put - S_exit, 0)
            collateral = K_put

        elif strategy_type == "bull_call_spread":
            # Buy lower-strike call, sell higher-strike call
            K_low = K_put  # lower strike (closer to ATM)
            K_high = K_call  # higher strike
            cost = bs_call(S_entry, K_low, T_years, r, sigma) - bs_call(S_entry, K_high, T_years, r, sigma)
            payoff = max(S_exit - K_low, 0) - max(S_exit - K_high, 0)
            pnl = payoff - cost
            collateral = cost

        elif strategy_type == "bear_put_spread":
            K_high = K_call
            K_low = K_put
            cost = bs_put(S_entry, K_high, T_years, r, sigma) - bs_put(S_entry, K_low, T_years, r, sigma)
            payoff = max(K_high - S_exit, 0) - max(K_low - S_exit, 0)
            pnl = payoff - cost
            collateral = cost

        elif strategy_type == "iron_condor":
            # Sell OTM call + put, buy further OTM call + put for protection
            K_sc = K_call  # short call
            K_lc = K_call * 1.05  # long call (5% higher)
            K_sp = K_put  # short put
            K_lp = K_put * 0.95  # long put (5% lower)
            premium_in = (
                bs_call(S_entry, K_sc, T_years, r, sigma)
                - bs_call(S_entry, K_lc, T_years, r, sigma)
                + bs_put(S_entry, K_sp, T_years, r, sigma)
                - bs_put(S_entry, K_lp, T_years, r, sigma)
            )
            call_loss = max(S_exit - K_sc, 0) - max(S_exit - K_lc, 0)
            put_loss = max(K_sp - S_exit, 0) - max(K_lp - S_exit, 0)
            pnl = premium_in - call_loss - put_loss
            collateral = (K_lc - K_sc)  # max risk wing

        elif strategy_type == "straddle":
            # Buy ATM call + put
            cost = bs_call(S_entry, S_entry, T_years, r, sigma) + bs_put(S_entry, S_entry, T_years, r, sigma)
            payoff = max(S_exit - S_entry, 0) + max(S_entry - S_exit, 0)
            pnl = payoff - cost
            collateral = cost

        pnl_pct = (pnl / collateral) if collateral > 0 else 0.0
        trades.append({
            "entry_date": str(entry_date.date()),
            "exit_date": str(exit_date.date()),
            "entry_price": round(S_entry, 2),
            "exit_price": round(S_exit, 2),
            "strategy": strategy_type,
            "pnl": round(pnl, 4),
            "pnl_pct": round(pnl_pct * 100, 2),
            "implied_volatility": round(iv, 4),
        })

        i += expiry_days

    return trades
