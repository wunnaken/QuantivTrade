"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addTrade,
  updateTrade,
  deleteTrade,
  formatCurrency,
  formatPercent,
  type JournalTrade,
  type Direction,
  type Strategy,
  STRATEGIES,
  type JournalTradeInput,
} from "@/lib/journal";
import { tickJournalStreak } from "@/lib/engagement/streaks";
import { addXPFromTrade } from "@/lib/engagement/xp";
import { useToast } from "@/components/ToastContext";

/**
 * Modal for logging a new trade or editing an existing one.
 *
 * Persistence:
 *   - Tries POST /api/trades (or PUT for existing server trades) first.
 *   - Falls back to localStorage via addTrade/updateTrade if the server save
 *     fails, then surfaces the trade through onSaveFailed so the host page
 *     can show a "saved locally — retry" banner.
 *
 * The host (JournalView) handles cache invalidation for the AI insights view.
 */
export function LogTradeModal({
  initialTrade,
  onClose,
  onSaved,
  onSaveFailed,
}: {
  initialTrade: JournalTrade | null;
  onClose: () => void;
  onSaved: (savedTrade?: JournalTrade) => void;
  onSaveFailed?: (localTrade: JournalTrade) => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [asset, setAsset] = useState("");
  const [direction, setDirection] = useState<Direction>("LONG");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exitDate, setExitDate] = useState("");
  const [positionSize, setPositionSize] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("Momentum");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [optionPl, setOptionPl] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [currentPriceLoading, setCurrentPriceLoading] = useState(false);
  const [manualOutcome, setManualOutcome] = useState(false);
  const [manualPnlDollars, setManualPnlDollars] = useState("");
  const [manualPnlPercent, setManualPnlPercent] = useState("");

  // Debounced live price fetch as the user types the asset symbol.
  useEffect(() => {
    const sym = asset.trim().toUpperCase();
    if (sym.length < 2) {
      setCurrentPrice(null);
      return;
    }
    setCurrentPriceLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/ticker-quote?ticker=${encodeURIComponent(sym)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setCurrentPrice(d?.price ?? null))
        .catch(() => setCurrentPrice(null))
        .finally(() => setCurrentPriceLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [asset]);

  // Sync form fields whenever the modal opens for a different trade.
  useEffect(() => {
    if (initialTrade) {
      setAsset(initialTrade.asset);
      setDirection(initialTrade.direction);
      setEntryPrice(initialTrade.entryPrice.toString());
      setExitPrice(initialTrade.exitPrice != null ? initialTrade.exitPrice.toString() : "");
      setEntryDate(initialTrade.entryDate.slice(0, 10));
      setExitDate(initialTrade.exitDate ? initialTrade.exitDate.slice(0, 10) : "");
      setPositionSize(initialTrade.positionSize.toString());
      setStrategy(initialTrade.strategy);
      setNotes(initialTrade.notes);
      setTags(initialTrade.tags.join(" "));
      setOptionPl(initialTrade.optionPl != null ? initialTrade.optionPl.toString() : "");
      const hasManual = initialTrade.pnlDollars != null || initialTrade.pnlPercent != null;
      setManualOutcome(hasManual);
      setManualPnlDollars(initialTrade.pnlDollars != null ? Number(initialTrade.pnlDollars).toFixed(2) : "");
      setManualPnlPercent(initialTrade.pnlPercent != null ? Number(initialTrade.pnlPercent).toFixed(2) : "");
    } else {
      setAsset("");
      setDirection("LONG");
      setEntryPrice("");
      setExitPrice("");
      setEntryDate(new Date().toISOString().slice(0, 10));
      setExitDate("");
      setPositionSize("");
      setStrategy("Momentum");
      setNotes("");
      setTags("");
      setOptionPl("");
      setManualOutcome(false);
      setManualPnlDollars("");
      setManualPnlPercent("");
    }
  }, [initialTrade]);

  const exitNum = exitPrice === "" ? null : parseFloat(exitPrice);
  const entryNum = parseFloat(entryPrice);
  const sizeNum = parseFloat(positionSize);
  const optionPlNum = optionPl === "" ? null : parseFloat(optionPl);
  const manualPnlDollarsNum = manualPnlDollars === "" ? null : parseFloat(manualPnlDollars);
  const manualPnlPercentNum = manualPnlPercent === "" ? null : parseFloat(manualPnlPercent);

  const pnl = useMemo(() => {
    if (manualOutcome) {
      if (Number.isFinite(manualPnlDollarsNum) || Number.isFinite(manualPnlPercentNum)) {
        const cost = entryNum * sizeNum;
        const dollars = manualPnlDollarsNum ?? (cost !== 0 && manualPnlPercentNum != null ? (manualPnlPercentNum / 100) * cost : 0);
        const percent = manualPnlPercentNum ?? (cost !== 0 ? (dollars / cost) * 100 : 0);
        return {
          pnlDollars: Math.round(dollars * 100) / 100,
          pnlPercent: Math.round(percent * 100) / 100,
        };
      }
      return null;
    }
    let pnlDollars = 0;
    let pnlPercent = 0;
    if (exitNum != null && Number.isFinite(entryNum) && Number.isFinite(sizeNum) && entryNum !== 0) {
      const mult = direction === "LONG" ? 1 : -1;
      pnlDollars = (exitNum - entryNum) * mult * sizeNum;
      pnlPercent = ((exitNum - entryNum) / entryNum) * 100 * mult;
    }
    if (optionPlNum != null && Number.isFinite(optionPlNum)) pnlDollars += optionPlNum;
    if (pnlDollars === 0 && pnlPercent === 0 && optionPlNum == null) return null;
    return {
      pnlDollars: Math.round(pnlDollars * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 100) / 100,
    };
  }, [exitNum, entryNum, sizeNum, direction, optionPlNum, manualOutcome, manualPnlDollarsNum, manualPnlPercentNum]);

  const manualPnlPayload = useMemo(() => {
    if (!manualOutcome || (!Number.isFinite(manualPnlDollarsNum) && !Number.isFinite(manualPnlPercentNum))) return null;
    const cost = entryNum * sizeNum;
    const dollars = manualPnlDollarsNum ?? (cost !== 0 && manualPnlPercentNum != null ? (manualPnlPercentNum / 100) * cost : undefined);
    const percent = manualPnlPercentNum ?? (cost !== 0 && dollars !== undefined ? (dollars / cost) * 100 : undefined);
    return {
      pnl_dollars: dollars !== undefined ? Math.round(dollars * 100) / 100 : undefined,
      pnl_percent: percent !== undefined ? Math.round(percent * 100) / 100 : undefined,
    };
  }, [manualOutcome, manualPnlDollarsNum, manualPnlPercentNum, entryNum, sizeNum]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset.trim() || !Number.isFinite(entryNum) || entryNum <= 0 || !Number.isFinite(sizeNum) || sizeNum <= 0) return;
    const input: JournalTradeInput = {
      asset: asset.trim().toUpperCase(),
      direction,
      entryPrice: entryNum,
      exitPrice: exitNum ?? null,
      entryDate: new Date(entryDate).toISOString(),
      exitDate: exitDate ? new Date(exitDate).toISOString() : null,
      positionSize: sizeNum,
      strategy,
      notes: notes.trim(),
      tags: tags.split(/[\s,#]+/).filter(Boolean).map((t) => t.trim()),
      optionPl: optionPlNum,
      ...(manualPnlPayload && {
        pnlDollars: manualPnlPayload.pnl_dollars,
        pnlPercent: manualPnlPayload.pnl_percent,
      }),
    };
    setSaving(true);
    try {
      if (initialTrade) {
        const isLocalId = initialTrade.id.startsWith("tj_");
        if (isLocalId) {
          // Local-only trade being upgraded → POST as new server record, then
          // remove the localStorage copy so we don't double-list it.
          const body: Record<string, unknown> = {
            asset: input.asset,
            direction: input.direction,
            entry_price: input.entryPrice,
            exit_price: input.exitPrice,
            position_size: input.positionSize,
            entry_date: input.entryDate.slice(0, 10),
            exit_date: input.exitDate ? input.exitDate.slice(0, 10) : null,
            strategy: input.strategy,
            notes: input.notes,
            tags: input.tags,
          };
          if (manualPnlPayload) {
            body.pnl_dollars = manualPnlPayload.pnl_dollars;
            body.pnl_percent = manualPnlPayload.pnl_percent;
          }
          const res = await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          if (res.ok) {
            const saved = (await res.json()) as JournalTrade;
            deleteTrade(initialTrade.id);
            onSaved(saved);
          } else {
            throw new Error("Save failed");
          }
        } else {
          const putBody: Record<string, unknown> = {
            id: initialTrade.id,
            asset: input.asset,
            direction: input.direction,
            entry_price: input.entryPrice,
            exit_price: input.exitPrice,
            position_size: input.positionSize,
            entry_date: input.entryDate.slice(0, 10),
            exit_date: input.exitDate ? input.exitDate.slice(0, 10) : null,
            strategy: input.strategy,
            notes: input.notes,
            tags: input.tags,
          };
          if (manualPnlPayload) {
            putBody.pnl_dollars = manualPnlPayload.pnl_dollars;
            putBody.pnl_percent = manualPnlPayload.pnl_percent;
          }
          const res = await fetch("/api/trades", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(putBody),
          });
          if (res.ok) {
            const saved = (await res.json()) as JournalTrade;
            onSaved(saved);
          } else {
            throw new Error("Save failed");
          }
        }
      } else {
        const body: Record<string, unknown> = {
          asset: input.asset,
          direction: input.direction,
          entry_price: input.entryPrice,
          exit_price: input.exitPrice,
          position_size: input.positionSize,
          entry_date: input.entryDate.slice(0, 10),
          exit_date: input.exitDate ? input.exitDate.slice(0, 10) : null,
          strategy: input.strategy,
          notes: input.notes,
          tags: input.tags,
        };
        if (manualPnlPayload) {
          body.pnl_dollars = manualPnlPayload.pnl_dollars;
          body.pnl_percent = manualPnlPayload.pnl_percent;
        }
        const res = await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (res.ok) {
          const saved = (await res.json()) as JournalTrade;
          const { milestone } = tickJournalStreak();
          addXPFromTrade();
          if (milestone) {
            toast.showToast(`${milestone} Day Journal Streak! Keep logging.`, "celebration");
          }
          onSaved(saved);
        } else {
          throw new Error("Save failed");
        }
      }
    } catch {
      // Server save failed → keep the trade locally so the user doesn't lose
      // their work. updateTrade returns null if the original record can't be
      // found (e.g. server-only trade ID); fall back to adding it as new.
      const localTrade = initialTrade
        ? updateTrade(initialTrade.id, input) ?? addTrade(input)
        : addTrade(input);
      if (!initialTrade) {
        const { milestone } = tickJournalStreak();
        addXPFromTrade();
        if (milestone) {
          toast.showToast(`${milestone} Day Journal Streak! Keep logging.`, "celebration");
        }
      }
      onSaveFailed?.(localTrade);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Log a trade"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-[var(--app-card)] shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[var(--app-card)] px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-100">{initialTrade ? "Edit trade" : "Log a trade"}</h2>
          <button type="button" onClick={onClose} className="rounded p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-200">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="journal-modal space-y-4 p-6">
          <div>
            <label className="block text-xs font-medium text-zinc-400">Asset</label>
            <input
              type="text"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              placeholder="NVDA, BTC, EUR/USD"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400">Direction</label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setDirection("LONG")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${direction === "LONG" ? "bg-emerald-500/30 text-emerald-300" : "bg-white/5 text-zinc-400"}`}
              >
                LONG
              </button>
              <button
                type="button"
                onClick={() => setDirection("SHORT")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${direction === "SHORT" ? "bg-red-500/30 text-red-300" : "bg-white/5 text-zinc-400"}`}
              >
                SHORT
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400">Entry price</label>
              <input
                type="number"
                step="any"
                min="0"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100"
                required
              />
              {currentPriceLoading && <p className="mt-1 text-[10px] text-zinc-500">Loading price…</p>}
              {!currentPriceLoading && currentPrice != null && (
                <p className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                  <span>Current price: ${currentPrice >= 1 ? currentPrice.toFixed(2) : currentPrice.toFixed(4)}</span>
                  <button
                    type="button"
                    onClick={() => setEntryPrice(currentPrice >= 1 ? currentPrice.toFixed(2) : currentPrice.toFixed(4))}
                    className="text-[var(--accent-color)] hover:underline"
                  >
                    Use current
                  </button>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">Exit price (optional)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100"
                placeholder="Open trade"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400">Entry date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">Exit date (optional)</label>
              <input
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400">Position size</label>
            <input
              type="number"
              step="any"
              min="0"
              value={positionSize}
              onChange={(e) => setPositionSize(e.target.value)}
              placeholder="Shares/units"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as Strategy)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[var(--app-card)] px-3 py-2 text-sm text-zinc-100"
            >
              {STRATEGIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400">Option P/L (optional)</label>
            <input
              type="number"
              step="any"
              value={optionPl}
              onChange={(e) => setOptionPl(e.target.value)}
              placeholder="e.g. premium P/L in $"
              className="mt-1 w-full rounded-lg border border-white/10 bg-[var(--app-card)] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="manual-outcome"
              checked={manualOutcome}
              onChange={(e) => setManualOutcome(e.target.checked)}
              className="size-4 rounded border-white/30 bg-white/5 accent-[var(--accent-color)]"
            />
            <label htmlFor="manual-outcome" className="text-xs font-medium text-zinc-400">
              Manual outcome (e.g. options) — override calculated P&L
            </label>
          </div>
          {manualOutcome && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400">P&L ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualPnlDollars}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManualPnlDollars(val);
                    const num = parseFloat(val);
                    const cost = entryNum * sizeNum;
                    if (Number.isFinite(num) && Number.isFinite(cost) && cost !== 0) {
                      setManualPnlPercent(((num / cost) * 100).toFixed(2));
                    } else if (val.trim() === "") {
                      setManualPnlPercent("");
                    }
                  }}
                  placeholder="e.g. 150 or -50"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">P&L (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualPnlPercent}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManualPnlPercent(val);
                    const num = parseFloat(val);
                    const cost = entryNum * sizeNum;
                    if (Number.isFinite(num) && Number.isFinite(cost) && cost !== 0) {
                      setManualPnlDollars(((num / 100) * cost).toFixed(2));
                    } else if (val.trim() === "") {
                      setManualPnlDollars("");
                    }
                  }}
                  placeholder="e.g. 12.5 or -5"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
            </div>
          )}
          {pnl != null && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-zinc-500">Outcome</p>
              <p className={pnl.pnlDollars >= 0 ? "text-emerald-400" : "text-red-400"}>
                {formatCurrency(pnl.pnlDollars)}
                {pnl.pnlPercent !== 0 && ` (${formatPercent(pnl.pnlPercent)})`}
              </p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-zinc-400">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Trade reasoning..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="#earnings #breakout"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-white/10 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-full py-2.5 text-sm font-semibold text-[#020308] transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#020308] border-t-transparent" />
                  {initialTrade ? "Saving…" : "Logging…"}
                </span>
              ) : initialTrade ? "Save changes" : "Log trade"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
