import pandas as pd
import ta


def generate_signals(close: pd.Series, params: dict) -> tuple[pd.Series, pd.Series]:
    """
    RSI Strategy.

    Params:
        rsi_period (int): RSI calculation period. Default 14.
        oversold (float): RSI level to enter long. Default 30.
        overbought (float): RSI level to exit long. Default 70.
        rsi_ma_period (int): Optional smoothing MA on RSI (0 = no smoothing). Default 0.

    Entry: RSI crosses above the oversold level (was below, now above).
    Exit:  RSI crosses above the overbought level.
    """
    rsi_period = int(params.get("rsi_period", 14))
    oversold = float(params.get("oversold", 30))
    overbought = float(params.get("overbought", 70))
    rsi_ma_period = int(params.get("rsi_ma_period", 0))

    rsi = ta.momentum.RSIIndicator(close=close, window=rsi_period).rsi()

    if rsi_ma_period > 1:
        rsi = rsi.rolling(window=rsi_ma_period).mean()

    was_oversold = rsi.shift(1) < oversold
    now_above_oversold = rsi >= oversold
    entries = was_oversold & now_above_oversold

    was_below_overbought = rsi.shift(1) < overbought
    now_above_overbought = rsi >= overbought
    exits = was_below_overbought & now_above_overbought

    return entries.fillna(False), exits.fillna(False)
