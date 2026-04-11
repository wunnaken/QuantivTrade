/** Returns true only if the string looks like a real market ticker symbol. */
export function isLikelyTicker(raw: string): boolean {
  const s = raw.trim().toUpperCase();
  if (!s) return false;
  // Covers: AAPL · BRK.A · BTC-USD · ES=F · ^GSPC · EUR/USD · EURUSD
  return /^\^?[A-Z]{1,6}([.\-=/][A-Z0-9]{1,4})?$/.test(s);
}
