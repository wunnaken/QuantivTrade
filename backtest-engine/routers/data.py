from fastapi import APIRouter, HTTPException, Query
import yfinance as yf
import pandas as pd

router = APIRouter(tags=["data"])


@router.get("/price")
def get_price(
    ticker: str = Query(..., description="Ticker symbol"),
    period: str = Query("1y", description="Period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max"),
    interval: str = Query("1d", description="Interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo"),
):
    try:
        tk = yf.Ticker(ticker.upper())
        df = tk.history(period=period, interval=interval)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data found for {ticker}")
        df.index = pd.to_datetime(df.index)
        result = []
        for ts, row in df.iterrows():
            result.append({
                "date": ts.strftime("%Y-%m-%d") if interval == "1d" else ts.isoformat(),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]),
            })
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info")
def get_info(ticker: str = Query(..., description="Ticker symbol")):
    try:
        tk = yf.Ticker(ticker.upper())
        info = tk.info
        if not info:
            raise HTTPException(status_code=404, detail=f"No info found for {ticker}")
        # Return a curated subset of useful fields
        fields = [
            "symbol", "shortName", "longName", "sector", "industry",
            "country", "currency", "exchange", "marketCap", "enterpriseValue",
            "trailingPE", "forwardPE", "priceToBook", "priceToSalesTrailing12Months",
            "dividendYield", "trailingAnnualDividendYield",
            "fiftyTwoWeekLow", "fiftyTwoWeekHigh", "fiftyDayAverage", "twoHundredDayAverage",
            "currentPrice", "regularMarketPrice",
            "beta", "shortRatio", "sharesOutstanding", "floatShares",
            "revenueGrowth", "earningsGrowth", "returnOnEquity", "returnOnAssets",
            "profitMargins", "operatingMargins", "grossMargins",
            "totalRevenue", "netIncomeToCommon", "totalDebt", "totalCash",
            "longBusinessSummary",
        ]
        return {k: info.get(k) for k in fields}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/options")
def get_options(ticker: str = Query(..., description="Ticker symbol")):
    try:
        tk = yf.Ticker(ticker.upper())
        expirations = tk.options
        if not expirations:
            raise HTTPException(status_code=404, detail=f"No options data for {ticker}")

        result = {}
        # Return data for the first 4 expiration dates to keep response manageable
        for exp in expirations[:4]:
            chain = tk.option_chain(exp)
            calls = chain.calls[["strike", "lastPrice", "bid", "ask", "volume",
                                  "openInterest", "impliedVolatility", "inTheMoney"]].copy()
            puts = chain.puts[["strike", "lastPrice", "bid", "ask", "volume",
                                "openInterest", "impliedVolatility", "inTheMoney"]].copy()
            result[exp] = {
                "calls": calls.fillna(0).to_dict(orient="records"),
                "puts": puts.fillna(0).to_dict(orient="records"),
            }
        return {"ticker": ticker.upper(), "expirations": expirations, "chains": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
