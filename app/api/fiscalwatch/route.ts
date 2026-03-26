import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type FiscalContract = {
  id: string;
  recipient: string;
  amount: number;
  agency: string;
  date: string;
  description: string;
};

const TREASURY_DEBT_URL =
  "https://api.fiscaldata.treasury.gov/services/api/v1/accounting/od/debt_to_penny" +
  "?fields=record_date,tot_pub_debt_out_amt&sort=-record_date&limit=1";

function treasuryStartOfYearUrl(year: number): string {
  return (
    "https://api.fiscaldata.treasury.gov/services/api/v1/accounting/od/debt_to_penny" +
    `?fields=record_date,tot_pub_debt_out_amt&filter=record_date:gte:${year}-01-01,record_date:lte:${year}-01-10&sort=record_date&limit=1`
  );
}

async function fetchStartOfYearDebt(year: number): Promise<number> {
  const res = await fetch(treasuryStartOfYearUrl(year), { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error("Start of year debt fetch failed");
  const json = (await res.json()) as { data?: { record_date: string; tot_pub_debt_out_amt: string }[] };
  const row = json.data?.[0];
  if (!row) throw new Error("No start of year data");
  return parseFloat(row.tot_pub_debt_out_amt.replace(/,/g, ""));
}

const USA_SPENDING_URL =
  "https://api.usaspending.gov/api/v2/search/spending_by_award/";

async function fetchCurrentDebt(): Promise<{ currentDebt: number; debtDate: string }> {
  const res = await fetch(TREASURY_DEBT_URL, { next: { revalidate: 21600 } });
  if (!res.ok) throw new Error("Treasury debt fetch failed");
  const json = (await res.json()) as {
    data?: { record_date: string; tot_pub_debt_out_amt: string }[];
  };
  const row = json.data?.[0];
  if (!row) throw new Error("No debt data");
  return {
    currentDebt: parseFloat(row.tot_pub_debt_out_amt.replace(/,/g, "")),
    debtDate: new Date(row.record_date + "T12:00:00Z").toISOString(),
  };
}

async function fetchContracts(): Promise<FiscalContract[]> {
  const today = new Date();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const body = {
    filters: {
      award_type_codes: ["A", "B", "C", "D"],
      time_period: [{ start_date: fmt(ninetyDaysAgo), end_date: fmt(today) }],
      award_amounts: [{ lower_bound: 10_000_000 }],
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Award Amount",
      "Awarding Agency",
      "Description",
      "Period of Performance Start Date",
    ],
    sort: "Period of Performance Start Date",
    order: "desc",
    limit: 100,
    page: 1,
  };

  const res = await fetch(USA_SPENDING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`USASpending error: ${res.status}`);

  const json = (await res.json()) as {
    results?: Array<{
      "Award ID"?: string;
      "Recipient Name"?: string;
      "Award Amount"?: number;
      "Awarding Agency"?: string;
      "Description"?: string;
      "Period of Performance Start Date"?: string;
    }>;
  };

  // Sort by most recent date server-side (API sort may be inconsistent)
  const sorted = [...(json.results ?? [])].sort((a, b) => {
    const da = new Date(a["Period of Performance Start Date"] ?? "").getTime() || 0;
    const db = new Date(b["Period of Performance Start Date"] ?? "").getTime() || 0;
    return db - da;
  });

  return sorted.map((r, i) => ({
    id: r["Award ID"] ?? `award-${i}`,
    recipient: r["Recipient Name"] ?? "Unknown Recipient",
    amount: r["Award Amount"] ?? 0,
    agency: r["Awarding Agency"] ?? "Unknown Agency",
    date: r["Period of Performance Start Date"] ?? "",
    description: (r["Description"] ?? "").slice(0, 100),
  }));
}

export async function GET() {
  const year = new Date().getFullYear();
  const [debtResult, startYearResult, contractsResult] = await Promise.allSettled([
    fetchCurrentDebt(),
    fetchStartOfYearDebt(year),
    fetchContracts(),
  ]);

  const { currentDebt, debtDate } =
    debtResult.status === "fulfilled"
      ? debtResult.value
      : { currentDebt: 36_500_000_000_000, debtDate: new Date(Date.now() - 86_400_000).toISOString() };

  // Fallback: assume ~$500B was the debt on Jan 1 if API fails
  const startOfYearDebt =
    startYearResult.status === "fulfilled" ? startYearResult.value : currentDebt - 500_000_000_000;

  const debtThisYear = Math.max(0, currentDebt - startOfYearDebt);

  const contracts =
    contractsResult.status === "fulfilled" ? contractsResult.value : [];

  if (contractsResult.status === "rejected") {
    console.error("[fiscalwatch] contracts error:", contractsResult.reason);
  }

  return NextResponse.json({ currentDebt, debtDate, debtThisYear, startOfYearDebt, contracts });
}
