import { NextRequest, NextResponse } from "next/server";

export const revalidate = 86400;

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

  const token = process.env.FINNHUB_API_KEY;
  if (!token) return NextResponse.json({ ownership: null, fundOwnership: null });

  const [ownershipRes, fundRes] = await Promise.all([
    fetch(
      `https://finnhub.io/api/v1/institutional/ownership?symbol=${encodeURIComponent(ticker)}&limit=10&token=${token}`,
      { next: { revalidate: 86400 } }
    ).catch(() => null),
    fetch(
      `https://finnhub.io/api/v1/stock/fund-ownership?symbol=${encodeURIComponent(ticker)}&limit=10&token=${token}`,
      { next: { revalidate: 86400 } }
    ).catch(() => null),
  ]);

  let ownership = null;
  if (ownershipRes?.ok) {
    const data = await ownershipRes.json();
    ownership = data?.ownership ?? null;
  }

  let fundOwnership = null;
  if (fundRes?.ok) {
    const data = await fundRes.json();
    fundOwnership = Array.isArray(data) ? data.slice(0, 10) : null;
  }

  return NextResponse.json({
    ownership,
    fundOwnership,
    thirteenFUnavailable: !ownership,
    thirteenFReason: !ownership
      ? "Full 13F institutional holdings by fund require a Finnhub premium subscription or SEC EDGAR API integration."
      : null,
  });
}
