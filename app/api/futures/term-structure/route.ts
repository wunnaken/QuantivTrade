import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Accept": "application/json",
};

const MONTH_CODES = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function futuresChain(
  root: string,
  exchange: string,
  count = 4
): Array<{ symbol: string; label: string }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const chain = [{ symbol: `${root}=F`, label: "Front" }];
  for (let i = 1; i <= count; i++) {
    const idx = (month + i) % 12;
    const yr = year + Math.floor((month + i) / 12);
    chain.push({
      symbol: `${root}${MONTH_CODES[idx]}${String(yr).slice(-2)}.${exchange}`,
      label: `${MONTH_NAMES[idx]} '${String(yr).slice(-2)}`,
    });
  }
  return chain;
}

async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    };
    return data.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch { return null; }
}

async function buildCurve(chain: Array<{ symbol: string; label: string }>) {
  const prices = await Promise.all(chain.map((c) => fetchPrice(c.symbol)));
  const points = chain
    .map((c, i) => ({ label: c.label, price: prices[i] }))
    .filter((p): p is { label: string; price: number } => p.price != null);

  if (points.length < 2) return { points, status: "unknown" as const };
  const status = points[points.length - 1].price > points[0].price ? "contango" : "backwardation";
  return { points, status };
}

export async function GET() {
  const [oil, gold, gas] = await Promise.all([
    buildCurve(futuresChain("CL", "NYM", 4)),
    buildCurve(futuresChain("GC", "CMX", 4)),
    buildCurve(futuresChain("NG", "NYM", 3)),
  ]);

  return NextResponse.json({ oil, gold, gas, fetchedAt: new Date().toISOString() });
}
