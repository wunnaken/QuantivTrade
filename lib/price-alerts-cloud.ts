import { PRICE_ALERTS_KEY, type PriceAlert } from "./price-alerts";

const RETRY_MS = 5 * 60 * 1000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let hasSyncIssue = false;

function isLocalOnlyAlertId(id: string): boolean {
  // Legacy/local IDs used before Supabase-backed alerts.
  return id.startsWith("alert-") || id.startsWith("local-");
}

function readLocalAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRICE_ALERTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PriceAlert[]) : [];
  } catch {
    return [];
  }
}

function writeLocalAlerts(alerts: PriceAlert[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(alerts));
}

function setSyncIssue(v: boolean) {
  hasSyncIssue = v;
}

export function getPriceAlertSyncIssue() {
  return hasSyncIssue;
}

function scheduleRetry(task: () => Promise<void>) {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    try {
      await task();
      setSyncIssue(false);
    } catch {
      setSyncIssue(true);
      scheduleRetry(task);
    }
  }, RETRY_MS);
}

export async function fetchPriceAlertsCloud(): Promise<{ alerts: PriceAlert[]; syncIssue: boolean }> {
  try {
    const res = await fetch("/api/price-alerts", { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error("api failed");
    const data = (await res.json()) as { alerts?: PriceAlert[] };
    const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
    writeLocalAlerts(alerts);
    setSyncIssue(false);
    return { alerts, syncIssue: false };
  } catch {
    setSyncIssue(true);
    return { alerts: readLocalAlerts(), syncIssue: true };
  }
}

export async function migrateLocalAlertsToCloud(): Promise<{ attempted: number; migrated: number; syncIssue: boolean }> {
  const local = readLocalAlerts().filter((a) => isLocalOnlyAlertId(String(a.id ?? "")));
  if (local.length === 0) return { attempted: 0, migrated: 0, syncIssue: false };
  let migrated = 0;
  for (const a of local) {
    try {
      const res = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ticker: a.ticker,
          company: a.company,
          condition: a.condition,
          target_price: a.targetPrice,
          current_price: a.currentPrice,
          name: a.name,
          repeat: a.repeat,
          notify_browser: a.notifyBrowser,
          notify_in_app: a.notifyInApp,
        }),
      });
      if (res.ok) migrated += 1;
    } catch {
      // continue
    }
  }
  const success = migrated >= local.length;
  if (success) {
    localStorage.removeItem(PRICE_ALERTS_KEY);
    setSyncIssue(false);
  } else {
    setSyncIssue(true);
  }
  return { attempted: local.length, migrated, syncIssue: !success };
}

export async function createPriceAlertCloud(payload: {
  ticker: string;
  company: string;
  condition: "above" | "below";
  targetPrice: number;
  currentPrice: number;
  name: string;
  repeat: boolean;
  notifyBrowser: boolean;
  notifyInApp: boolean;
}): Promise<{ alert: PriceAlert; syncIssue: boolean }> {
  const fallback: PriceAlert = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ticker: payload.ticker,
    company: payload.company,
    condition: payload.condition,
    targetPrice: payload.targetPrice,
    currentPrice: payload.currentPrice,
    name: payload.name,
    createdAt: new Date().toISOString(),
    triggeredAt: null,
    status: "active",
    repeat: payload.repeat,
    notifyBrowser: payload.notifyBrowser,
    notifyInApp: payload.notifyInApp,
  };
  try {
    const res = await fetch("/api/price-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ticker: payload.ticker,
        company: payload.company,
        condition: payload.condition,
        target_price: payload.targetPrice,
        current_price: payload.currentPrice,
        name: payload.name,
        repeat: payload.repeat,
        notify_browser: payload.notifyBrowser,
        notify_in_app: payload.notifyInApp,
      }),
    });
    if (!res.ok) throw new Error("api failed");
    const data = (await res.json()) as { alert: PriceAlert };
    const alert = data.alert;
    const list = readLocalAlerts().filter((x) => x.id !== alert.id);
    writeLocalAlerts([alert, ...list]);
    setSyncIssue(false);
    return { alert, syncIssue: false };
  } catch {
    const list = readLocalAlerts();
    writeLocalAlerts([fallback, ...list]);
    setSyncIssue(true);
    scheduleRetry(async () => {
      await fetchPriceAlertsCloud();
    });
    return { alert: fallback, syncIssue: true };
  }
}

export async function updatePriceAlertCloud(
  id: string,
  patch: {
    status?: "active" | "triggered" | "paused";
    targetPrice?: number;
    currentPrice?: number;
    name?: string;
    repeat?: boolean;
    notifyBrowser?: boolean;
    notifyInApp?: boolean;
    triggeredAt?: string | null;
  }
): Promise<{ alert: PriceAlert | null; syncIssue: boolean }> {
  try {
    const res = await fetch("/api/price-alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id,
        status: patch.status,
        target_price: patch.targetPrice,
        current_price: patch.currentPrice,
        name: patch.name,
        repeat: patch.repeat,
        notify_browser: patch.notifyBrowser,
        notify_in_app: patch.notifyInApp,
        triggered_at: patch.triggeredAt,
      }),
    });
    if (!res.ok) throw new Error("api failed");
    const data = (await res.json()) as { alert: PriceAlert };
    const list = readLocalAlerts().map((a) => (a.id === id ? data.alert : a));
    writeLocalAlerts(list);
    setSyncIssue(false);
    return { alert: data.alert, syncIssue: false };
  } catch {
    const list = readLocalAlerts().map((a) =>
      a.id === id
        ? {
            ...a,
            status: patch.status ?? a.status,
            targetPrice: patch.targetPrice ?? a.targetPrice,
            currentPrice: patch.currentPrice ?? a.currentPrice,
            name: patch.name ?? a.name,
            repeat: patch.repeat ?? a.repeat,
            notifyBrowser: patch.notifyBrowser ?? a.notifyBrowser,
            notifyInApp: patch.notifyInApp ?? a.notifyInApp,
            triggeredAt: patch.triggeredAt ?? a.triggeredAt,
          }
        : a
    );
    writeLocalAlerts(list);
    setSyncIssue(true);
    scheduleRetry(async () => {
      await fetchPriceAlertsCloud();
    });
    return { alert: list.find((a) => a.id === id) ?? null, syncIssue: true };
  }
}

export async function deletePriceAlertCloud(id: string): Promise<{ syncIssue: boolean }> {
  try {
    const res = await fetch(`/api/price-alerts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("api failed");
    writeLocalAlerts(readLocalAlerts().filter((a) => a.id !== id));
    setSyncIssue(false);
    return { syncIssue: false };
  } catch {
    writeLocalAlerts(readLocalAlerts().filter((a) => a.id !== id));
    setSyncIssue(true);
    scheduleRetry(async () => {
      await fetchPriceAlertsCloud();
    });
    return { syncIssue: true };
  }
}

