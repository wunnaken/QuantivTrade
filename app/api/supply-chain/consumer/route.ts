import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function fetchFREDSeries(seriesId: string, key: string, limit = 24) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FRED ${seriesId} failed: ${res.status}`);
  const json = await res.json() as { observations?: Array<{ date: string; value: string }> };
  return (json.observations ?? [])
    .filter((o) => o.value !== ".")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
}

async function fetchSECLatestFiling(cik: string, formType: string) {
  const url = `https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "QuantivTrade research@quantivtrade.com" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`SEC EDGAR fetch failed for CIK ${cik}: ${res.status}`);
  const data = await res.json() as {
    name?: string;
    filings?: {
      recent?: {
        form?: string[];
        filingDate?: string[];
        accessionNumber?: string[];
        primaryDocument?: string[];
      };
    };
  };
  const filings = data.filings?.recent;
  if (!filings) return null;
  const idx = filings.form?.findIndex((f) => f === formType) ?? -1;
  if (idx === -1) return null;
  return {
    companyName: data.name,
    filingDate: filings.filingDate?.[idx],
    accessionNumber: filings.accessionNumber?.[idx],
    primaryDocument: filings.primaryDocument?.[idx],
    cik,
  };
}

export async function GET() {
  const fredKey = process.env.FRED_API_KEY?.trim();
  if (!fredKey) {
    return NextResponse.json(
      { error: "FRED_API_KEY not configured", message: "FRED API key required for consumer data." },
      { status: 503 }
    );
  }

  const fredSeries = [
    { id: "RETAILIMSA", label: "Retail Inventories (Adj)", unit: "millions of dollars" },
    { id: "MRTSIR44X722USS", label: "Retail & Food Services Sales", unit: "millions of dollars" },
    { id: "UMCSENT", label: "University of Michigan Consumer Sentiment", unit: "index 1966Q1=100" },
    { id: "CSCICP03USM665S", label: "Consumer Confidence Index", unit: "index" },
  ];

  const seriesResults = await Promise.allSettled(
    fredSeries.map(async (s) => ({ ...s, history: await fetchFREDSeries(s.id, fredKey) }))
  );

  const series: Record<string, unknown> = {};
  fredSeries.forEach((s, i) => {
    const r = seriesResults[i];
    if (r.status === "fulfilled") {
      series[s.id] = {
        label: s.label,
        unit: s.unit,
        history: r.value.history,
        latest: r.value.history[r.value.history.length - 1] ?? null,
      };
    } else {
      series[s.id] = { label: s.label, error: String(r.reason) };
    }
  });

  // Retail inventory-to-sales ratio (computed)
  const retailInv = (series["RETAILIMSA"] as { history?: { value: number }[] })?.history;
  const retailSales = (series["MRTSIR44X722USS"] as { history?: { date: string; value: number }[] })?.history;
  let invToSales: { date: string; value: number }[] = [];
  if (retailInv && retailSales) {
    const minLen = Math.min(retailInv.length, retailSales.length);
    invToSales = retailSales.slice(-minLen).map((s, i) => ({
      date: s.date,
      value: retailInv[retailInv.length - minLen + i]?.value && s.value
        ? Math.round((retailInv[retailInv.length - minLen + i].value / s.value) * 1000) / 1000
        : 0,
    }));
  }

  // SEC EDGAR — latest 10-Q filings
  // NFLX CIK: 1065280, DIS: 1001039, AMZN: 1018724
  const secCompanies = [
    { cik: "1065280", ticker: "NFLX", name: "Netflix" },
    { cik: "1001039", ticker: "DIS", name: "Walt Disney" },
    { cik: "1018724", ticker: "AMZN", name: "Amazon" },
  ];

  const secResults = await Promise.allSettled(
    secCompanies.map((c) => fetchSECLatestFiling(c.cik, "10-Q"))
  );

  const secFilings = secCompanies.map((c, i) => {
    const r = secResults[i];
    if (r.status === "fulfilled" && r.value) {
      return {
        ticker: c.ticker,
        name: c.name,
        filingDate: r.value.filingDate,
        accessionNumber: r.value.accessionNumber,
        secEdgarUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${c.cik}&type=10-Q&dateb=&owner=include&count=4`,
      };
    }
    return { ticker: c.ticker, name: c.name, error: r.status === "rejected" ? String(r.reason) : "Filing not found" };
  });

  return NextResponse.json({
    source: "Federal Reserve (FRED) + SEC EDGAR",
    series,
    invToSales: {
      history: invToSales,
      label: "Retail Inventory-to-Sales Ratio",
      unit: "ratio",
      note: "Rising ratio = inventory buildup relative to sales = potential consumer slowdown signal",
    },
    secFilings: {
      data: secFilings,
      label: "Streaming Platform Subscriber Data — Latest 10-Q Filings",
      disclaimer:
        "Subscriber counts are reported quarterly in SEC 10-Q filings — this is NOT real-time data. Numbers are updated 4 times per year during earnings season. The links below go to SEC EDGAR filing pages where you can read the actual 10-Q documents.",
      updateFrequency: "Quarterly — approximately 45 days after quarter end",
    },
    paywalled: {
      title: "Consumer tech supply chain data behind paid subscriptions",
      items: [
        {
          name: "App Store Revenue Estimates",
          provider: "Sensor Tower",
          estimatedCost: "~$1,000+/month",
          description: "Monthly app store revenue, download, and engagement data for iOS/Android. Key leading indicator for AAPL and GOOGL services revenue.",
        },
        {
          name: "Mobile Ad Spend",
          provider: "Appsflyer / Adjust",
          estimatedCost: "Subscription required",
          description: "Mobile marketing spend by category. Leading indicator for META, SNAP, GOOGL advertising revenue.",
        },
        {
          name: "Streaming Viewership Minutes",
          provider: "Nielsen Gauge",
          estimatedCost: "Research subscription",
          description: "Monthly streaming platform viewership share data. Indicator for NFLX, DIS+, AMZN Prime subscriber engagement and churn risk.",
        },
        {
          name: "Consumer Electronics Sell-Through",
          provider: "NPD / Circana",
          estimatedCost: "Research subscription",
          description: "Point-of-sale consumer electronics revenue. Leading indicator for AAPL hardware revenue and PC vendor earnings.",
        },
      ],
    },
    fredLabels: {
      RETAILIMSA: "Source: US Census Bureau via FRED | Monthly — released ~2 weeks after month end",
      MRTSIR44X722USS: "Source: US Census Bureau via FRED (Advance Retail Sales) | Monthly",
      UMCSENT: "Source: University of Michigan Surveys of Consumers via FRED | Monthly",
      CSCICP03USM665S: "Source: OECD/Conference Board via FRED | Monthly",
    },
  });
}
