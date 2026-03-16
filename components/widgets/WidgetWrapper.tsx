"use client";

import { useState } from "react";
import type { WidgetId } from "../../lib/dashboard";
import { WIDGET_CONFIG } from "../../lib/dashboard";

interface WidgetWrapperProps {
  id: string;
  widgetId: WidgetId;
  editMode: boolean;
  onRemove?: () => void;
  onSettings?: () => void;
  onRefresh?: () => void;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  title?: string;
}

export function WidgetWrapper({
  id,
  widgetId,
  editMode,
  onRemove,
  onSettings,
  onRefresh,
  children,
  loading,
  error,
  title,
}: WidgetWrapperProps) {
  const [minimized, setMinimized] = useState(false);
  const config = WIDGET_CONFIG[widgetId];
  const displayTitle = title ?? config?.name ?? widgetId;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-[#0F1520] text-zinc-200" style={{ borderColor: "var(--app-border, #1a2535)" }}>
      <div
        className={`widget-header flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3 py-2 ${editMode ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ backgroundColor: "#080B14" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-medium text-zinc-200">{displayTitle}</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {editMode && (
            <>
              <button type="button" onClick={() => setMinimized((m) => !m)} className="rounded p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300" title={minimized ? "Expand" : "Minimize"} aria-label={minimized ? "Expand" : "Minimize"}>
                {minimized ? "+" : "−"}
              </button>
              <button type="button" onClick={onRefresh} className="rounded p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300" title="Refresh" aria-label="Refresh">↻</button>
              <button type="button" onClick={onSettings} className="rounded p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300" title="Settings" aria-label="Settings">⚙</button>
              <button type="button" onClick={onRemove} className="rounded p-1.5 text-zinc-500 hover:bg-white/5 hover:text-red-400" title="Remove" aria-label="Remove">×</button>
            </>
          )}
        </div>
      </div>
      {!minimized && (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-auto">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0F1520]/80">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-color)] border-t-transparent" />
            </div>
          )}
          {error && (
            <div className="flex h-full min-h-[60px] items-center justify-center p-3 text-center text-xs text-red-400">
              {error}
            </div>
          )}
          {!error && (loading ? <div className="h-full min-h-[40px]" /> : <div className="min-h-0 flex-1">{children}</div>)}
        </div>
      )}
      {editMode && !minimized && (
        <div className="pointer-events-none absolute bottom-0 right-0 h-4 w-4" style={{ borderRight: "2px solid var(--accent-color)", borderBottom: "2px solid var(--accent-color)", borderBottomRightRadius: 4 }} aria-hidden />
      )}
    </div>
  );
}
