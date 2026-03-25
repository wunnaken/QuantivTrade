import numpy as np
import pandas as pd


def _sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period).mean()


def _ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def generate_signals(close: pd.Series, params: dict) -> tuple[pd.Series, pd.Series]:
    """
    Moving Average Crossover strategy.

    Params:
        fast_period (int): Fast MA period. Default 10.
        slow_period (int): Slow MA period. Default 30.
        ma_type (str): "sma" or "ema". Default "sma".

    Returns:
        entries (bool Series): True on bars where fast MA crosses above slow MA.
        exits (bool Series): True on bars where fast MA crosses below slow MA.
    """
    fast_period = int(params.get("fast_period", 10))
    slow_period = int(params.get("slow_period", 30))
    ma_type = str(params.get("ma_type", "sma")).lower()

    if ma_type == "ema":
        fast_ma = _ema(close, fast_period)
        slow_ma = _ema(close, slow_period)
    else:
        fast_ma = _sma(close, fast_period)
        slow_ma = _sma(close, slow_period)

    above = fast_ma > slow_ma
    entries = above & ~above.shift(1).fillna(False)
    exits = ~above & above.shift(1).fillna(False)

    return entries.fillna(False), exits.fillna(False)
