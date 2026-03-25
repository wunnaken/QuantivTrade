"use client";

import { useEffect, useState } from "react";
import {
  type BriefingPreferences,
  EMPTY_PREFERENCES,
  saveBriefingPreferences,
} from "../lib/briefing-preferences";

const TRADING_STYLES = [
  { id: "day-trading", label: "Day Trading" },
  { id: "swing-trading", label: "Swing Trading" },
  { id: "long-term", label: "Long-Term Investing" },
  { id: "options", label: "Options Trading" },
];

const ASSET_CLASSES = [
  { id: "stocks", label: "US Stocks" },
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
  { id: "commodities", label: "Commodities" },
  { id: "etfs", label: "ETFs" },
  { id: "futures", label: "Futures" },
];

const SECTORS = [
  { id: "tech", label: "Technology" },
  { id: "energy", label: "Energy" },
  { id: "healthcare", label: "Healthcare" },
  { id: "financials", label: "Financials" },
  { id: "consumer", label: "Consumer" },
  { id: "industrials", label: "Industrials" },
  { id: "real-estate", label: "Real Estate" },
];

const RISK_LEVELS = [
  { id: "conservative", label: "Conservative", desc: "Capital preservation first" },
  { id: "moderate", label: "Moderate", desc: "Balanced risk and reward" },
  { id: "aggressive", label: "Aggressive", desc: "High risk, high reward" },
];

type Props = {
  initialPrefs?: BriefingPreferences | null;
  onSave?: (prefs: BriefingPreferences) => void;
  onCancel?: () => void;
  compact?: boolean;
};

export function BriefingPreferencesForm({ initialPrefs, onSave, onCancel, compact = false }: Props) {
  const [prefs, setPrefs] = useState<BriefingPreferences>(initialPrefs ?? { ...EMPTY_PREFERENCES });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync if initialPrefs changes (e.g. loaded async from parent)
  useEffect(() => {
    if (initialPrefs) setPrefs(initialPrefs);
  }, [initialPrefs]);

  function toggleMulti(field: "assetClasses" | "sectors", id: string) {
    setPrefs((p) => {
      const list = p[field];
      return {
        ...p,
        [field]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const ok = await saveBriefingPreferences(prefs);
    setSaving(false);
    if (!ok) {
      setSaveError("Failed to save. Please try again.");
      return;
    }
    onSave?.(prefs);
  }

  const chipBase = "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer select-none";
  const chipOn = "border-[var(--accent-color)]/50 bg-[var(--accent-color)]/15 text-[var(--accent-color)]";
  const chipOff = "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-300";

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {/* Trading style */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Trading Style
        </label>
        <div className="flex flex-wrap gap-2">
          {TRADING_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setPrefs((p) => ({ ...p, tradingStyle: p.tradingStyle === s.id ? "" : s.id }))}
              className={`${chipBase} ${prefs.tradingStyle === s.id ? chipOn : chipOff}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset classes */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Asset Classes{" "}
          <span className="normal-case font-normal text-zinc-500">(select all that apply)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {ASSET_CLASSES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleMulti("assetClasses", a.id)}
              className={`${chipBase} ${prefs.assetClasses.includes(a.id) ? chipOn : chipOff}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sectors */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Sectors of Interest{" "}
          <span className="normal-case font-normal text-zinc-500">(select all that apply)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {SECTORS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleMulti("sectors", s.id)}
              className={`${chipBase} ${prefs.sectors.includes(s.id) ? chipOn : chipOff}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Watchlist tickers */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Key Tickers to Watch
        </label>
        <input
          type="text"
          value={prefs.watchTickers}
          onChange={(e) => setPrefs((p) => ({ ...p, watchTickers: e.target.value }))}
          placeholder="e.g. NVDA, TSLA, BTC-USD, SPY"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
        />
      </div>

      {/* Risk tolerance */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Risk Tolerance
        </label>
        <div className="flex flex-wrap gap-2">
          {RISK_LEVELS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setPrefs((p) => ({ ...p, riskTolerance: p.riskTolerance === r.id ? "" : r.id }))}
              className={`${chipBase} flex flex-col items-start gap-0.5 px-3 py-2 ${prefs.riskTolerance === r.id ? chipOn : chipOff}`}
            >
              <span>{r.label}</span>
              <span className="text-[10px] font-normal opacity-70">{r.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Additional context */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Anything Else?{" "}
          <span className="normal-case font-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          value={prefs.additionalContext}
          onChange={(e) => setPrefs((p) => ({ ...p, additionalContext: e.target.value }))}
          placeholder="e.g. Focused on earnings season, watching Fed policy, trading the open only..."
          rows={2}
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
        />
      </div>

      {saveError && <p className="text-xs text-red-400">{saveError}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[var(--accent-color)] px-4 py-2 text-sm font-semibold text-[#020308] transition hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Preferences"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
