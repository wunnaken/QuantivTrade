import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FinnhubProfile = {
  name?: string;
  finnhubIndustry?: string;
  marketCapitalization?: number;
  logo?: string;
  weburl?: string;
  country?: string;
  currency?: string;
  exchange?: string;
};

type FinnhubEarningsItem = {
  actual?: number | null;
  estimate?: number | null;
  period?: string;
  quarter?: number;
  year?: number;
  surprise?: number | null;
  surprisePercent?: number | null;
};

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    return NextResponse.json({ error: "FINNHUB_API_KEY not set" }, { status: 500 });
  }

  const [profileRes, earningsRes] = await Promise.allSettled([
    fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`,
      { next: { revalidate: 3600 } }
    ),
    fetch(
      `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(symbol)}&limit=40&token=${token}`,
      { next: { revalidate: 900 } }
    ),
  ]);

  let profile: FinnhubProfile = {};
  if (profileRes.status === "fulfilled" && profileRes.value.ok) {
    try {
      profile = (await profileRes.value.json()) as FinnhubProfile;
    } catch {}
  }

  let earningsHistory: FinnhubEarningsItem[] = [];
  if (earningsRes.status === "fulfilled" && earningsRes.value.ok) {
    try {
      earningsHistory = (await earningsRes.value.json()) as FinnhubEarningsItem[];
    } catch {}
  }

  return NextResponse.json({ profile, earningsHistory });
}
