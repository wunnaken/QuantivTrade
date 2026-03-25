/**
 * Connect Broker — UI placeholder. No real broker connection yet.
 * State stored in localStorage for demo.
 */

const STORAGE_KEY = "quantivtrade-broker-connection";
const NOTIFY_KEY = "quantivtrade-broker-notify-emails";

export type BrokerConnection = {
  connected: boolean;
  brokerName?: string;
  connectedAt?: string; // ISO date
  /** Placeholder stats when connected */
  totalTrades?: number;
  winRate?: number;
  avgReturn?: number;
};

const DEFAULT: BrokerConnection = { connected: false };

export function getBrokerConnection(): BrokerConnection {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as BrokerConnection;
    return { ...DEFAULT, ...parsed };
  } catch {
    return { ...DEFAULT };
  }
}

export function setBrokerConnection(data: BrokerConnection): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("storage"));
  } catch {
    // ignore
  }
}

export function connectBroker(brokerName: string): void {
  setBrokerConnection({
    connected: true,
    brokerName,
    connectedAt: new Date().toISOString(),
    totalTrades: 0,
    winRate: 0,
    avgReturn: 0,
  });
}

export function disconnectBroker(): void {
  setBrokerConnection({ connected: false });
}

export function addBrokerNotifyEmail(broker: string, email: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(NOTIFY_KEY);
    const data: Record<string, string> = raw ? JSON.parse(raw) : {};
    data[broker] = email;
    window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function getBrokerNotifyEmails(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(NOTIFY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const BROKER_TEAL = "#14B8A6";
