import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SocrataRecord {
  market_and_exchange_names?: string;
  report_date_as_yyyy_mm_dd?: string;
  noncomm_positions_long_all?: string;
  noncomm_positions_short_all?: string;
  comm_positions_long_all?: string;
  comm_positions_short_all?: string;
  change_in_noncomm_long_all?: string;
  change_in_noncomm_short_all?: string;
  change_in_comm_long_all?: string;
  change_in_comm_short_all?: string;
}

const COT_MARKETS = [
  { name: "Crude Oil",    symbol: "CL", search: "CRUDE OIL, LIGHT SWEET" },
  { name: "Gold",         symbol: "GC", search: "GOLD - COMMODITY EXCHANGE INC" },
  { name: "S&P 500",      symbol: "ES", search: "S&P 500 STOCK INDEX" },
  { name: "Euro FX",      symbol: "6E", search: "EURO FX - CHICAGO MERCANTILE EXCHANGE" },
  { name: "10-Yr T-Note", symbol: "ZN", search: "10-YEAR U.S. TREASURY NOTES" },
  { name: "Soybeans",     symbol: "ZS", search: "SOYBEANS - CHICAGO BOARD OF TRADE" },
  { name: "Wheat",        symbol: "ZW", search: "WHEAT - CHICAGO BOARD OF TRADE" },
  { name: "Natural Gas",  symbol: "NG", search: "NATURAL GAS - NEW YORK MERCANTILE" },
];

async function fetchCOT(search: string): Promise<SocrataRecord | null> {
  try {
    const params = new URLSearchParams({
      "$where": `upper(market_and_exchange_names) like upper('%${search.split(" ")[0]}%')`,
      "$limit": "1",
      "$order": "report_date_as_yyyy_mm_dd DESC",
    });
    const url = `https://publicreporting.cftc.gov/resource/jun7-fc8e.json?${params}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Quantiv research@quantiv.trade", "Accept": "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json() as SocrataRecord[];
    return data[0] ?? null;
  } catch { return null; }
}

export async function GET() {
  const markets = await Promise.all(
    COT_MARKETS.map(async (m) => {
      const r = await fetchCOT(m.search);
      if (!r) {
        return {
          name: m.name, symbol: m.symbol,
          commercialLong: null, commercialShort: null,
          nonCommLong: null, nonCommShort: null,
          commercialNet: null, nonCommNet: null,
          weeklyChange: null, reportDate: null,
        };
      }
      const cL = parseInt(r.comm_positions_long_all ?? "0");
      const cS = parseInt(r.comm_positions_short_all ?? "0");
      const nL = parseInt(r.noncomm_positions_long_all ?? "0");
      const nS = parseInt(r.noncomm_positions_short_all ?? "0");
      const wNL = parseInt(r.change_in_noncomm_long_all ?? "0");
      const wNS = parseInt(r.change_in_noncomm_short_all ?? "0");
      return {
        name: m.name,
        symbol: m.symbol,
        commercialLong: cL,
        commercialShort: cS,
        nonCommLong: nL,
        nonCommShort: nS,
        commercialNet: cL - cS,
        nonCommNet: nL - nS,
        weeklyChange: wNL - wNS,
        reportDate: r.report_date_as_yyyy_mm_dd ?? null,
      };
    })
  );

  return NextResponse.json({ markets, fetchedAt: new Date().toISOString() });
}
