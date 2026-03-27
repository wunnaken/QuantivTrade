// CREATE TABLE screen_results (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   screen_id uuid REFERENCES saved_screens(id) ON DELETE CASCADE,
//   symbols text[] NOT NULL DEFAULT '{}',
//   checked_at timestamptz DEFAULT now()
// );

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FMP_SCREENER_BASE = "https://financialmodelingprep.com/api/v3/stock-screener";

type SavedScreen = {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, string | boolean | number | undefined>;
  alerts_enabled: boolean;
};

type ScreenResult = {
  screen_id: string;
  symbols: string[];
  checked_at: string;
};

type FMPScreenerItem = {
  symbol?: string;
};

async function fetchScreenSymbols(
  filters: SavedScreen["filters"],
  fmpApiKey: string
): Promise<string[]> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  params.set("limit", "250");
  params.set("apikey", fmpApiKey);

  try {
    const res = await fetch(`${FMP_SCREENER_BASE}?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return (data as FMPScreenerItem[])
      .map((item) => item.symbol)
      .filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

export async function GET() {
  const supabase = createServerClient();
  const fmpApiKey = process.env.FMP_API_KEY;

  if (!fmpApiKey) {
    return NextResponse.json(
      { error: "FMP_API_KEY not configured" },
      { status: 500 }
    );
  }

  // Fetch all screens with alerts enabled
  const { data: screens, error: screensError } = await supabase
    .from("saved_screens")
    .select("id, user_id, name, filters, alerts_enabled")
    .eq("alerts_enabled", true);

  if (screensError) {
    return NextResponse.json({ error: screensError.message }, { status: 500 });
  }

  if (!Array.isArray(screens) || screens.length === 0) {
    return NextResponse.json({ checked: 0, totalEntered: 0, totalExited: 0 });
  }

  let totalEntered = 0;
  let totalExited = 0;

  for (const screen of screens as SavedScreen[]) {
    try {
      // Fetch current symbols from FMP
      const currentSymbols = await fetchScreenSymbols(
        screen.filters ?? {},
        fmpApiKey
      );
      const currentSet = new Set(currentSymbols);

      // Fetch most recent screen_result for this screen
      const { data: lastResult } = await supabase
        .from("screen_results")
        .select("symbols, checked_at")
        .eq("screen_id", screen.id)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const previousSymbols: string[] = (lastResult as ScreenResult | null)?.symbols ?? [];
      const previousSet = new Set(previousSymbols);

      // Diff
      const entered = currentSymbols.filter((s) => !previousSet.has(s));
      const exited = previousSymbols.filter((s) => !currentSet.has(s));

      const hasChanges = entered.length > 0 || exited.length > 0;

      // Insert new screen_result only when there are changes (or no previous result)
      if (hasChanges || lastResult === null) {
        await supabase.from("screen_results").insert({
          screen_id: screen.id,
          symbols: currentSymbols,
        });
      }

      // Insert notifications for entered/exited stocks when there are changes
      if (hasChanges) {
        const notifications: {
          user_id: string;
          type: string;
          message: string;
          metadata: { screen_id: string; ticker: string };
        }[] = [];

        for (const ticker of entered) {
          notifications.push({
            user_id: screen.user_id,
            type: "screen_entry",
            message: `${ticker} entered your screen "${screen.name}"`,
            metadata: { screen_id: screen.id, ticker },
          });
        }

        for (const ticker of exited) {
          notifications.push({
            user_id: screen.user_id,
            type: "screen_exit",
            message: `${ticker} exited your screen "${screen.name}"`,
            metadata: { screen_id: screen.id, ticker },
          });
        }

        if (notifications.length > 0) {
          await supabase.from("in_app_notifications").insert(notifications);
        }

        totalEntered += entered.length;
        totalExited += exited.length;
      }
    } catch (err) {
      console.error(
        `[check-alerts] Error processing screen ${screen.id}:`,
        err instanceof Error ? err.message : err
      );
      // Continue to next screen
    }
  }

  return NextResponse.json({
    checked: (screens as SavedScreen[]).length,
    totalEntered,
    totalExited,
  });
}
