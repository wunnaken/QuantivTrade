import { Snaptrade } from "snaptrade-typescript-sdk";

let _client: Snaptrade | null = null;

export function getSnaptradeClient(): Snaptrade {
  if (!_client) {
    const clientId = process.env.SNAPTRADE_CLIENT_ID;
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
    if (!clientId || !consumerKey) throw new Error("Missing SNAPTRADE_CLIENT_ID or SNAPTRADE_CONSUMER_KEY");
    _client = new Snaptrade({ clientId, consumerKey });
  }
  return _client;
}
