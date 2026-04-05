import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SEC_HEADERS = { "User-Agent": "Quantiv research@quantiv.trade", "Accept": "application/json" };

const FAMOUS_INVESTORS = [
  { id: "buffett", name: "Warren Buffett", fund: "Berkshire Hathaway", cik: "0001067983" },
  { id: "burry", name: "Michael Burry", fund: "Scion Asset Management", cik: "0001517175" },
  { id: "wood", name: "Cathie Wood", fund: "ARK Invest", cik: "0001579982" },
  { id: "ackman", name: "Bill Ackman", fund: "Pershing Square", cik: "0001336528" },
  { id: "tepper", name: "David Tepper", fund: "Appaloosa Management", cik: "0001656690" },
  { id: "druckenmiller", name: "Stanley Druckenmiller", fund: "Duquesne Family Office", cik: "0001536411" },
  { id: "dalio", name: "Ray Dalio", fund: "Bridgewater Associates", cik: "0001350694" },
  { id: "soros", name: "George Soros", fund: "Soros Fund Management", cik: "0000801166" },
];

async function getLatest13FDate(cik: string): Promise<{ date: string; accession: string } | null> {
  try {
    const paddedCik = cik.replace(/^0+/, "").padStart(10, "0");
    const res = await fetch(`https://data.sec.gov/submissions/CIK${paddedCik}.json`, {
      headers: SEC_HEADERS,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      filings: { recent: { form: string[]; filingDate: string[]; accessionNumber: string[] } };
    };
    const forms = data.filings.recent.form;
    const idx = forms.findIndex((f) => f === "13F-HR");
    if (idx === -1) return null;
    return {
      date: data.filings.recent.filingDate[idx],
      accession: data.filings.recent.accessionNumber[idx],
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ checked: 0, newFilings: [] });
  }

  const supabase = createClient(url, key);
  const newFilings: string[] = [];

  for (const investor of FAMOUS_INVESTORS) {
    try {
      const latest = await getLatest13FDate(investor.cik);
      if (!latest) continue;

      // Check if we already have this filing recorded
      const { data: existing } = await supabase
        .from("portfolio_filings_seen")
        .select("accession")
        .eq("investor_id", investor.id)
        .eq("accession", latest.accession)
        .maybeSingle();

      if (existing) continue;

      // New filing found — record it
      await supabase.from("portfolio_filings_seen").upsert({
        investor_id: investor.id,
        accession: latest.accession,
        filing_date: latest.date,
        seen_at: new Date().toISOString(),
      });

      // Get all users who follow this investor
      const { data: follows } = await supabase
        .from("portfolio_follows")
        .select("user_id")
        .eq("investor_id", investor.id);

      if (follows && follows.length > 0) {
        const notifications = follows.map((f: { user_id: string }) => ({
          user_id: f.user_id,
          type: "portfolio_filing",
          title: `New 13F: ${investor.name}`,
          body: `${investor.fund} filed their latest 13F on ${latest.date}. View their updated holdings.`,
          data: JSON.stringify({ investor_id: investor.id, filing_date: latest.date }),
          read: false,
          created_at: new Date().toISOString(),
        }));
        await supabase.from("notifications").insert(notifications);
        newFilings.push(investor.id);
      }
    } catch {
      // Non-fatal: continue to next investor
    }
  }

  return NextResponse.json({ checked: FAMOUS_INVESTORS.length, newFilings });
}
