from fastapi import APIRouter, HTTPException, Query
import yfinance as yf
import pandas as pd
import numpy as np
from itertools import combinations
import traceback

router = APIRouter(tags=["correlations"])

ASSETS: dict[str, list[str]] = {
    "us_indices": ["SPY", "QQQ", "DIA", "IWM", "VIX"],
    "global_indices": ["EWJ", "FXI", "EWG", "EWU", "EWA", "EWZ", "INDA", "EWY"],
    "precious_metals": ["GLD", "SLV", "PPLT", "PALL"],
    "commodities": ["USO", "BNO", "UNG", "CPER", "WEAT", "CORN"],
    "forex": ["UUP", "FXE", "FXY", "FXB", "CYB"],
    "bonds": ["TLT", "IEF", "SHY", "HYG", "EMB", "BNDX"],
    "crypto": ["BTC-USD", "ETH-USD"],
    "volatility": ["VIXY"],
}

# Build ticker -> class lookup
TICKER_CLASS: dict[str, str] = {}
ALL_TICKERS: list[str] = []
for cls, tickers in ASSETS.items():
    for t in tickers:
        TICKER_CLASS[t] = cls
        ALL_TICKERS.append(t)

# Weights: higher = more surprising cross-class correlation
CLASS_PAIR_WEIGHTS: dict[tuple[str, str], float] = {
    ("bonds", "crypto"): 2.0,
    ("forex", "crypto"): 2.0,
    ("us_indices", "forex"): 2.0,
    ("precious_metals", "crypto"): 1.9,
    ("us_indices", "precious_metals"): 1.8,
    ("commodities", "bonds"): 1.8,
    ("us_indices", "commodities"): 1.7,
    ("forex", "commodities"): 1.7,
    ("global_indices", "bonds"): 1.7,
    ("bonds", "volatility"): 1.6,
    ("precious_metals", "bonds"): 1.6,
    ("forex", "bonds"): 1.5,
}


def get_class_weight(cls_a: str, cls_b: str) -> float:
    key = tuple(sorted([cls_a, cls_b]))  # type: ignore[arg-type]
    return CLASS_PAIR_WEIGHTS.get(key, 1.3)  # type: ignore[arg-type]


@router.get("/matrix")
def get_correlation_matrix(
    days: int = Query(90, ge=10, le=365, description="Lookback window in calendar days"),
):
    period = f"{days}d"

    try:
        raw = yf.download(ALL_TICKERS, period=period, auto_adjust=True, progress=False, threads=True)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"yfinance download failed: {exc}")

    # Extract Close prices — multi-ticker download uses MultiIndex columns
    if isinstance(raw.columns, pd.MultiIndex):
        closes: pd.DataFrame = raw["Close"].copy()
    else:
        # Single ticker fallback (shouldn't happen with our list)
        closes = raw[["Close"]].copy()

    # Keep columns that have sufficient data
    min_rows = max(5, int(len(closes) * 0.5))
    closes = closes.dropna(axis=1, thresh=min_rows)
    closes.index = pd.to_datetime(closes.index).tz_localize(None)

    valid_tickers = [t for t in ALL_TICKERS if t in closes.columns]

    # Daily returns for correlation
    returns: pd.DataFrame = closes[valid_tickers].pct_change().dropna()

    # Full Pearson correlation matrix
    corr_matrix: pd.DataFrame = returns.corr()

    # Convert matrix to nested dict
    matrix_dict: dict[str, dict[str, float | None]] = {}
    for ta in valid_tickers:
        matrix_dict[ta] = {}
        for tb in valid_tickers:
            v = corr_matrix.loc[ta, tb] if ta in corr_matrix.index and tb in corr_matrix.columns else None
            matrix_dict[ta][tb] = round(float(v), 4) if v is not None and not np.isnan(float(v)) else None

    # Surprising cross-class pairs with abs(corr) > 0.70
    surprising_pairs = []
    for ta, tb in combinations(valid_tickers, 2):
        cls_a = TICKER_CLASS.get(ta)
        cls_b = TICKER_CLASS.get(tb)
        if not cls_a or not cls_b or cls_a == cls_b:
            continue
        if ta not in corr_matrix.index or tb not in corr_matrix.columns:
            continue
        val = corr_matrix.loc[ta, tb]
        if np.isnan(float(val)):
            continue
        abs_corr = abs(float(val))
        if abs_corr < 0.70:
            continue
        weight = get_class_weight(cls_a, cls_b)
        surprising_pairs.append({
            "assetA": ta,
            "assetB": tb,
            "classA": cls_a,
            "classB": cls_b,
            "correlation": round(float(val), 4),
            "surprise_score": round(abs_corr * weight, 4),
        })

    surprising_pairs.sort(key=lambda x: x["surprise_score"], reverse=True)
    top_20 = surprising_pairs[:20]

    # Safe haven scores: 30-day correlation vs SPY
    safe_haven_tickers = ["GLD", "TLT", "UUP", "FXY", "FXB"]
    safe_haven_scores: dict[str, float | None] = {}
    returns_30 = returns.tail(30)
    if "SPY" in returns_30.columns:
        for asset in safe_haven_tickers:
            if asset in returns_30.columns and len(returns_30) >= 5:
                v = returns_30["SPY"].corr(returns_30[asset])
                safe_haven_scores[asset] = round(float(v), 4) if not np.isnan(float(v)) else None
            else:
                safe_haven_scores[asset] = None

    # Asset performance: 1D, 1W, 1M returns + current price
    performance: dict[str, dict[str, dict]] = {}
    for cls, tickers in ASSETS.items():
        performance[cls] = {}
        for ticker in tickers:
            if ticker not in closes.columns:
                continue
            s = closes[ticker].dropna()
            if len(s) < 2:
                continue
            perf: dict[str, float | None] = {"price": round(float(s.iloc[-1]), 4)}
            perf["1d"] = round(float((s.iloc[-1] / s.iloc[-2] - 1) * 100), 2) if len(s) >= 2 else None
            perf["1w"] = round(float((s.iloc[-1] / s.iloc[-6] - 1) * 100), 2) if len(s) >= 6 else None
            perf["1m"] = round(float((s.iloc[-1] / s.iloc[-22] - 1) * 100), 2) if len(s) >= 22 else None
            performance[cls][ticker] = perf

    # Normalized price series (indexed to 100 at start) for all valid tickers
    normalized_series: dict[str, list[dict]] = {}
    for ticker in valid_tickers:
        s = closes[ticker].dropna()
        if len(s) < 2:
            continue
        first = float(s.iloc[0])
        if first == 0:
            continue
        series = []
        for date_idx, price in s.items():
            try:
                date_str = date_idx.strftime("%Y-%m-%d")
            except Exception:
                date_str = str(date_idx)[:10]
            series.append({"date": date_str, "value": round(float(price) / first * 100, 2)})
        normalized_series[ticker] = series

    return {
        "matrix": matrix_dict,
        "tickers": valid_tickers,
        "surprisingPairs": top_20,
        "safeHavenScores": safe_haven_scores,
        "performance": performance,
        "normalizedSeries": normalized_series,
        "days": days,
    }
