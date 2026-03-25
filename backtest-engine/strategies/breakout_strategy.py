import pandas as pd
import ta


def generate_signals(
    close: pd.Series,
    high: pd.Series,
    low: pd.Series,
    volume: pd.Series,
    params: dict,
) -> tuple[pd.Series, pd.Series]:
    """
    Breakout Strategy.

    Params:
        lookback_period (int): Periods to look back for highest high. Default 20.
        volume_confirmation (bool): Require volume > 20-period average. Default True.
        atr_multiplier (float): ATR multiplier for stop loss. Default 1.5.

    Entry: Price breaks above the highest high of the lookback period
           (optionally confirmed by above-average volume).
    Exit:  Price falls below entry price minus ATR * atr_multiplier (tracked externally),
           or falls below the rolling 20-period lowest low as a trailing exit.
    """
    lookback = int(params.get("lookback_period", 20))
    vol_confirm = bool(params.get("volume_confirmation", True))
    atr_mult = float(params.get("atr_multiplier", 1.5))

    # Resistance: highest high of prior `lookback` bars (shift by 1 to avoid lookahead)
    highest_high = high.shift(1).rolling(window=lookback).max()

    breakout = close > highest_high

    if vol_confirm:
        avg_volume = volume.rolling(window=20).mean()
        breakout = breakout & (volume > avg_volume)

    entries = breakout & ~breakout.shift(1).fillna(False)

    # Exit: price falls below the rolling lowest low of the lookback window
    lowest_low = low.rolling(window=lookback).min()
    below_support = close < lowest_low
    exits = below_support & ~below_support.shift(1).fillna(False)

    return entries.fillna(False), exits.fillna(False)
