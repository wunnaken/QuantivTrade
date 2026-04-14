import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { FiscalContract } from "../route";

export const dynamic = "force-dynamic";

const TRANSACTIONS_URL = "https://api.usaspending.gov/api/v2/search/spending_by_transaction/";
const AWARDS_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sortByAmount = searchParams.get("sort") === "amount";

  const today = new Date();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const timePeriod = [{ start_date: fmt(ninetyDaysAgo), end_date: fmt(today) }];

  if (!sortByAmount) {
    // Transactions endpoint has a real "Action Date" — always populated, reliably sorted
    const body = {
      filters: {
        award_type_codes: ["A", "B", "C", "D"],
        time_period: timePeriod,
      },
      fields: [
        "Action Date",
        "Award ID",
        "Recipient Name",
        "Transaction Amount",
        "Awarding Agency",
        "Transaction Description",
      ],
      sort: "Action Date",
      order: "desc",
      limit: 50,
      page: 1,
    };

    try {
      const res = await fetch(TRANSACTIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[fiscalwatch/contracts date] error", res.status, text);
        return NextResponse.json({ contracts: [] });
      }

      const json = (await res.json()) as {
        results?: Array<{
          "Action Date"?: string;
          "Award ID"?: string;
          "Recipient Name"?: string;
          "Transaction Amount"?: number;
          "Awarding Agency"?: string;
          "Transaction Description"?: string;
        }>;
      };

      const contracts: FiscalContract[] = (json.results ?? []).map((r, i) => ({
        id: r["Award ID"] ?? `txn-${i}`,
        recipient: r["Recipient Name"] ?? "Unknown Recipient",
        amount: r["Transaction Amount"] ?? 0,
        agency: r["Awarding Agency"] ?? "Unknown Agency",
        date: r["Action Date"] ?? "",
        description: (r["Transaction Description"] ?? "").slice(0, 100),
      }));

      return NextResponse.json({ contracts });
    } catch (err) {
      console.error("[fiscalwatch/contracts date] fetch error", err);
      return NextResponse.json({ contracts: [] });
    }
  }

  // sort=amount: awards endpoint sorted by total contract value
  // Use a 2-year window so we catch genuinely new large contracts
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 86_400_000);
  const twoYearCutoff = fmt(twoYearsAgo);
  const twoYearPeriod = [{ start_date: twoYearCutoff, end_date: fmt(today) }];

  const body = {
    filters: {
      award_type_codes: ["A", "B", "C", "D"],
      time_period: twoYearPeriod,
      award_amounts: [{ lower_bound: 10_000_000 }],
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Award Amount",
      "Awarding Agency",
      "Description",
      "Action Date",
      "Period of Performance Start Date",
    ],
    sort: "Award Amount",
    order: "desc",
    limit: 200,
    page: 1,
  };

  try {
    const res = await fetch(AWARDS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[fiscalwatch/contracts amount] error", res.status, text);
      return NextResponse.json({ contracts: [] });
    }

    const json = (await res.json()) as {
      results?: Array<{
        "Award ID"?: string;
        "Recipient Name"?: string;
        "Award Amount"?: number;
        "Awarding Agency"?: string;
        "Description"?: string;
        "Action Date"?: string | null;
        "Period of Performance Start Date"?: string | null;
      }>;
    };

    // time_period filters by action date — old contracts with recent amendments pass through.
    // Exclude any contract whose period of performance started before the 2-year cutoff.
    const contracts: FiscalContract[] = (json.results ?? [])
      .filter((r) => {
        const start = r["Period of Performance Start Date"] ?? "";
        return !start || start >= twoYearCutoff;
      })
      .map((r, i) => ({
        id: r["Award ID"] ?? `award-${i}`,
        recipient: r["Recipient Name"] ?? "Unknown Recipient",
        amount: r["Award Amount"] ?? 0,
        agency: r["Awarding Agency"] ?? "Unknown Agency",
        date: r["Action Date"] ?? r["Period of Performance Start Date"] ?? "",
        description: (r["Description"] ?? "").slice(0, 100),
      }));

    return NextResponse.json({ contracts });
  } catch (err) {
    console.error("[fiscalwatch/contracts amount] fetch error", err);
    return NextResponse.json({ contracts: [] });
  }
}
