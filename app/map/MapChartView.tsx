"use client";

import { useMemo, useState } from "react";

interface Layer {
  label: string;
  formatValue: (v: number | null) => string;
  valueToColor: (v: number | null) => string;
}

interface Props {
  layerData: {
    byIso3: Record<string, number>;
    byName: Record<string, number>;
    history?: Record<string, { year: string; value: number }[]>;
  };
  activeLayer: Layer;
  isLoading?: boolean;
  dataAsOf?: string;
  getDisplayValueForCountry: (name: string) => number | null;
  onCountryClick: (name: string, id: string) => void;
}

const DEFAULT_COUNT = 15;

export function MapChartView({ layerData, activeLayer, isLoading, dataAsOf, getDisplayValueForCountry, onCountryClick }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  // All countries that have a value, sorted highest → lowest
  const masterList = useMemo(() => {
    const seen = new Set<string>();
    const out: { name: string; value: number }[] = [];

    for (const [name, value] of Object.entries(layerData.byName)) {
      if (typeof value === "number" && !Number.isNaN(value) && !seen.has(name)) {
        seen.add(name);
        out.push({ name, value });
      }
    }

    return out.sort((a, b) => b.value - a.value);
  }, [layerData.byName]);

  const defaultSelected = useMemo(() => masterList.slice(0, DEFAULT_COUNT).map((r) => r.name), [masterList]);
  const activeSelection = new Set(selected.length > 0 ? selected : defaultSelected);

  const filtered = useMemo(() => {
    const base = search.trim()
      ? masterList.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
      : masterList;
    return base;
  }, [masterList, search]);

  // Bar chart entries from activeSelection (maintains sorted order)
  const barEntries = useMemo(
    () => masterList.filter((r) => activeSelection.has(r.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [masterList, selected, defaultSelected],
  );

  const maxAbs = useMemo(() => Math.max(...barEntries.map((e) => Math.abs(e.value)), 1), [barEntries]);
  const hasNeg = barEntries.some((e) => e.value < 0);

  const toggle = (name: string) => {
    const base = selected.length > 0 ? selected : defaultSelected;
    setSelected(base.includes(name) ? base.filter((n) => n !== name) : [...base, name]);
  };

  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height: "calc(100vh - 160px)", minHeight: 600, background: "var(--app-card-alt)" }}
    >
      {/* Sidebar */}
      <div className="flex w-64 shrink-0 flex-col border-r border-white/5">
        <div className="border-b border-white/5 px-3 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {activeSelection.size} of {masterList.length} countries
          </p>
          <input
            type="text"
            placeholder="Search country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-[var(--accent-color)]"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
          {isLoading ? (
            <div className="flex flex-col gap-2 px-3 py-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-white/5" style={{ width: `${55 + (i % 4) * 12}%` }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-zinc-600">No results</p>
          ) : (
            filtered.map((row) => {
              const isOn = activeSelection.has(row.name);
              return (
                <button
                  key={row.name}
                  type="button"
                  onClick={() => toggle(row.name)}
                  className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs transition ${
                    isOn ? "bg-white/5 text-zinc-200" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  }`}
                >
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full border transition"
                    style={
                      isOn
                        ? { background: activeLayer.valueToColor(row.value), borderColor: activeLayer.valueToColor(row.value) }
                        : { borderColor: "#3f3f46" }
                    }
                  />
                  <span className="flex-1 leading-snug">{row.name}</span>
                  <span className="mt-0.5 shrink-0 font-mono text-[10px] text-zinc-600">
                    {activeLayer.formatValue(row.value)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {selected.length > 0 && (
          <div className="border-t border-white/5 px-3 py-2">
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-[10px] text-zinc-600 transition hover:text-zinc-400"
            >
              Reset to top {DEFAULT_COUNT}
            </button>
          </div>
        )}
      </div>

      {/* Chart area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/5 px-5 py-3">
          <p className="text-sm font-semibold text-zinc-200">{activeLayer.label}</p>
          {dataAsOf && (
            <span className="ml-auto text-[11px] text-zinc-500">
              Data as of: <span className="text-zinc-400">{dataAsOf}</span>
            </span>
          )}
        </div>

        {/* Bars */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: "thin" }}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-color)] border-t-transparent" />
            </div>
          ) : barEntries.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-500">No data available for this layer.</p>
            </div>
          ) : (
            barEntries.map((row, i) => {
              const pct = (Math.abs(row.value) / maxAbs) * 100;
              const isNeg = row.value < 0;
              const color = activeLayer.valueToColor(row.value);
              return (
                <button
                  key={row.name}
                  type="button"
                  onClick={() => onCountryClick(row.name, row.name)}
                  className="group mb-2 flex w-full items-center gap-4 rounded-lg px-2 py-2 text-left transition hover:bg-white/5"
                >
                  {/* Rank */}
                  <span className="w-6 shrink-0 text-right text-[11px] text-zinc-600">{i + 1}</span>

                  {/* Country name */}
                  <span className="w-48 shrink-0 text-sm font-medium leading-snug text-zinc-300 group-hover:text-zinc-100">
                    {row.name}
                  </span>

                  {/* Bar */}
                  <div className="relative flex h-6 flex-1 items-center">
                    {hasNeg && (
                      <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
                    )}
                    <div
                      className="h-4 rounded transition-all"
                      style={{
                        width: `${pct / (hasNeg ? 2 : 1)}%`,
                        marginLeft: isNeg
                          ? `${50 - pct / 2}%`
                          : hasNeg
                          ? "50%"
                          : "0",
                        background: color,
                        opacity: 0.85,
                      }}
                    />
                  </div>

                  {/* Value */}
                  <span className="w-24 shrink-0 text-right font-mono text-sm text-zinc-300">
                    {activeLayer.formatValue(row.value)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
