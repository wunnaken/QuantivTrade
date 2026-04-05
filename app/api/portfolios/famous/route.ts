import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SEC_HEADERS = {
  "User-Agent": "Quantiv research@quantiv.trade",
  Accept: "application/json, text/html, text/xml, application/xml",
};

const FAMOUS_INVESTORS = [
  { id: "buffett", name: "Warren Buffett", fund: "Berkshire Hathaway", cik: "0001067983", style: "Value" },
  { id: "burry", name: "Michael Burry", fund: "Scion Asset Management", cik: "0001517175", style: "Contrarian" },
  { id: "wood", name: "Cathie Wood", fund: "ARK Invest", cik: "0001579982", style: "Growth" },
  { id: "ackman", name: "Bill Ackman", fund: "Pershing Square", cik: "0001336528", style: "Activist" },
  { id: "tepper", name: "David Tepper", fund: "Appaloosa Management", cik: "0001656690", style: "Distressed" },
  { id: "druckenmiller", name: "Stanley Druckenmiller", fund: "Duquesne Family Office", cik: "0001536411", style: "Macro" },
  { id: "dalio", name: "Ray Dalio", fund: "Bridgewater Associates", cik: "0001350694", style: "Macro" },
  { id: "soros", name: "George Soros", fund: "Soros Fund Management", cik: "0000801166", style: "Macro" },
];

// CUSIP → ticker for common large-cap positions
const CUSIP_TICKER: Record<string, string> = {
  "037833100": "AAPL", "594918104": "MSFT", "02079K305": "GOOGL", "02079K107": "GOOGL",
  "67066G104": "NVDA", "30303M102": "META", "88160R101": "TSLA", "46090E103": "JPM",
  "922908363": "V", "57636Q104": "MA", "023135106": "AMZN", "032654105": "AMZN",
  "14040H105": "COF", "902973304": "UNH", "25278X109": "DIS", "459200101": "IBM",
  "191216100": "KO", "713448108": "PEP", "808513105": "SCHW", "531172104": "LLY",
  "38141G104": "GS", "060505104": "BAC", "172967424": "C", "94974BFL5": "WFC",
  "655844108": "NOC", "526057104": "LMT", "74005P104": "RTX", "36467W109": "GE",
  "67103H107": "OXY", "049561105": "AXP", "458140100": "INTC", "070858104": "BERK",
  "09247X101": "BLK", "69343P105": "PNC", "05278C107": "ATVI", "756502106": "RCL",
  "742718109": "PG", "78462F103": "SPY", "921937878": "VTI", "743315103": "PYPL",
  "30231G102": "XOM", "166764100": "CVX", "832696405": "SNOW", "59156R108": "META",
  "46625H100": "JPM", "617446448": "MS", "984121103": "WFC", "74144T108": "PLTR",
  "G7945E107": "RIO", "17275R102": "CRWD", "89417E109": "TSM", "26210C104": "DJT",
  "G5315J109": "INFY", "29786A106": "ETSY", "01609W102": "ALGN", "005935881": "AMZN",
  "Y20291105": "JD", "87612G101": "TGT", "G7496N104": "NFLX", "023586100": "AMZN",
};

// Company name keywords → ticker fallback
const NAME_TICKER: Record<string, string> = {
  "apple": "AAPL", "microsoft": "MSFT", "alphabet": "GOOGL", "amazon": "AMZN",
  "nvidia": "NVDA", "meta platform": "META", "tesla": "TSLA", "jpmorgan": "JPM",
  "visa inc": "V", "mastercard": "MA", "unitedhealth": "UNH", "coca-cola": "KO",
  "berkshire": "BRK.B", "eli lilly": "LLY", "johnson & johnson": "JNJ",
  "procter": "PG", "goldman sachs": "GS", "citigroup": "C", "bank of america": "BAC",
  "union pacific": "UNP", "northrop": "NOC", "lockheed": "LMT", "raytheon": "RTX",
  "walmart": "WMT", "target corp": "TGT", "nike": "NKE", "occidental": "OXY",
  "american express": "AXP", "intel corp": "INTC", "pfizer": "PFE", "moderna": "MRNA",
  "abbvie": "ABBV", "netflix": "NFLX", "paypal": "PYPL", "salesforce": "CRM",
  "adobe": "ADBE", "home depot": "HD", "chevron": "CVX", "exxon": "XOM",
  "snowflake": "SNOW", "palantir": "PLTR", "taiwan semiconductor": "TSM",
  "alibaba": "BABA", "blackrock": "BLK", "wells fargo": "WFC", "morgan stanley": "MS",
  "charles schwab": "SCHW", "crowdstrike": "CRWD", "palo alto": "PANW",
  "amazon.com": "AMZN", "alphabet inc": "GOOGL", "meta platforms": "META",
  "unitedhealth group": "UNH", "lilly": "LLY", "broadcom": "AVGO",
  "capital one": "COF", "citigroup inc": "C", "jpmorgan chase": "JPM",
  "hertz": "HTZ", "gamestop": "GME", "amc": "AMC",
};

function guessTickerFromName(name: string): string {
  const lower = name.toLowerCase().trim();
  for (const [kw, tk] of Object.entries(NAME_TICKER)) {
    if (lower.includes(kw)) return tk;
  }
  // Last resort: first word uppercased, truncated to 5 chars
  return lower.split(/\s+/)[0]?.slice(0, 5).toUpperCase() ?? "";
}

interface Holding {
  rank: number;
  ticker: string;
  companyName: string;
  value: number;
  shares: number;
  portfolioPct: number;
  change: "NEW" | "INCREASED" | "DECREASED" | "CLOSED" | "UNCHANGED";
  changePct: number | null;
}

interface InvestorData {
  id: string;
  name: string;
  fund: string;
  style: string;
  cik: string;
  filingDate: string | null;
  filingPeriod: string | null;
  nextFilingEst: string | null;
  totalValue: number;
  holdingsCount: number;
  holdings: Holding[];
  changes: { newPositions: number; increased: number; decreased: number; closed: number };
}

function parseInfotableXML(xml: string): Array<{ name: string; cusip: string; value: number; shares: number }> {
  const results: Array<{ name: string; cusip: string; value: number; shares: number }> = [];
  // Try both uppercase and lowercase tag names (different filers use different casing)
  const tableRx = /<(?:infoTable|InfoTable|infotable)>([\s\S]*?)<\/(?:infoTable|InfoTable|infotable)>/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRx.exec(xml)) !== null) {
    const b = m[1];
    const name = (b.match(/<(?:nameOfIssuer|NameOfIssuer|nameofissuer)>(.*?)<\/(?:nameOfIssuer|NameOfIssuer|nameofissuer)>/i)?.[1] ?? "").trim();
    const cusip = (b.match(/<cusip>(.*?)<\/cusip>/i)?.[1] ?? "").trim();
    const valueStr = (b.match(/<value>(.*?)<\/value>/i)?.[1] ?? "0").replace(/,/g, "");
    const sharesStr = (b.match(/<sshPrnamt>(.*?)<\/sshPrnamt>/i)?.[1] ?? "0").replace(/,/g, "");
    const value = parseInt(valueStr, 10) || 0;
    const shares = parseInt(sharesStr, 10) || 0;
    if (name && value > 0) results.push({ name, cusip, value, shares });
  }
  return results.sort((a, b) => b.value - a.value);
}

async function getSubmission(cik: string): Promise<{
  accession: string;
  filingDate: string;
  period: string;
} | null> {
  try {
    const padded = cik.replace(/^0+/, "").padStart(10, "0");
    const res = await fetch(`https://data.sec.gov/submissions/CIK${padded}.json`, {
      headers: { "User-Agent": "Quantiv research@quantiv.trade", Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      filings: { recent: { form: string[]; accessionNumber: string[]; filingDate: string[]; reportDate: string[] } };
    };
    const forms = data.filings.recent.form;
    const idx = forms.findIndex((f) => f === "13F-HR");
    if (idx === -1) return null;
    return {
      accession: data.filings.recent.accessionNumber[idx],
      filingDate: data.filings.recent.filingDate[idx],
      period: data.filings.recent.reportDate[idx] ?? "",
    };
  } catch {
    return null;
  }
}

async function fetchXML(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Quantiv research@quantiv.trade", Accept: "text/xml, application/xml, */*" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Must contain infoTable / InfoTable markers to be the right document
    if (!/<(?:infoTable|InfoTable|informationTable|InformationTable)/i.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

async function fetchInfotableXML(numericCik: string, accessionDashed: string): Promise<string | null> {
  const accNoDashes = accessionDashed.replace(/-/g, "");
  const base = `https://www.sec.gov/Archives/edgar/data/${numericCik}/${accNoDashes}`;

  // Strategy 1: parse the filing index HTML to find XML document links
  try {
    const indexRes = await fetch(`${base}/${accessionDashed}-index.htm`, {
      headers: { "User-Agent": "Quantiv research@quantiv.trade", Accept: "text/html" },
      next: { revalidate: 86400 },
    });
    if (indexRes.ok) {
      const html = await indexRes.text();
      // Extract all .xml hrefs from the index table
      const xmlLinks: string[] = [];
      const rx = /href="([^"]+\.xml)"/gi;
      let mm: RegExpExecArray | null;
      while ((mm = rx.exec(html)) !== null) {
        const href = mm[1];
        // Skip the index document itself
        if (href.includes("index")) continue;
        xmlLinks.push(href.startsWith("/") ? `https://www.sec.gov${href}` : `${base}/${href}`);
      }
      // Try each XML link, return first one with infotable data
      for (const link of xmlLinks) {
        const xml = await fetchXML(link);
        if (xml) return xml;
      }
    }
  } catch { /* continue */ }

  // Strategy 2: Try common infotable file naming conventions
  const candidates = [
    `${base}/infotable.xml`,
    `${base}/${accessionDashed}-0003.xml`,
    `${base}/${accessionDashed}-0002.xml`,
    `${base}/${accessionDashed}-0004.xml`,
    `${base}/xslForm13F_X01.xml`,
    `${base}/primary_doc.xml`,
    `${base}/form.xml`,
  ];
  for (const url of candidates) {
    const xml = await fetchXML(url);
    if (xml) return xml;
  }

  // Strategy 3: directory listing as fallback
  try {
    const dirRes = await fetch(`${base}/`, {
      headers: { "User-Agent": "Quantiv research@quantiv.trade", Accept: "text/html" },
      next: { revalidate: 86400 },
    });
    if (dirRes.ok) {
      const html = await dirRes.text();
      const xmlLinks: string[] = [];
      const rx = /href="([^"]+\.xml)"/gi;
      let mm: RegExpExecArray | null;
      while ((mm = rx.exec(html)) !== null) {
        const href = mm[1];
        if (!href.includes("index")) {
          xmlLinks.push(href.startsWith("/") ? `https://www.sec.gov${href}` : `${base}/${href}`);
        }
      }
      for (const link of xmlLinks) {
        const xml = await fetchXML(link);
        if (xml) return xml;
      }
    }
  } catch { /* continue */ }

  return null;
}

function estimateNextFiling(filingDate: string): string {
  const d = new Date(filingDate);
  d.setDate(d.getDate() + 135);
  return d.toISOString().slice(0, 10);
}

async function fetchFinnhubQuote(
  ticker: string,
  apiKey: string
): Promise<{ price: number | null; changePercent: number | null; change: number | null }> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return { price: null, changePercent: null, change: null };
    const d = (await res.json()) as { c?: number; d?: number; dp?: number };
    if (!d.c || d.c === 0) return { price: null, changePercent: null, change: null };
    return { price: d.c, changePercent: d.dp ?? 0, change: d.d ?? 0 };
  } catch {
    return { price: null, changePercent: null, change: null };
  }
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;

  const results: InvestorData[] = await Promise.all(
    FAMOUS_INVESTORS.map(async (investor): Promise<InvestorData> => {
      const base: InvestorData = {
        id: investor.id,
        name: investor.name,
        fund: investor.fund,
        style: investor.style,
        cik: investor.cik,
        filingDate: null,
        filingPeriod: null,
        nextFilingEst: null,
        totalValue: 0,
        holdingsCount: 0,
        holdings: [],
        changes: { newPositions: 0, increased: 0, decreased: 0, closed: 0 },
      };

      try {
        const sub = await getSubmission(investor.cik);
        if (!sub) return base;

        base.filingDate = sub.filingDate;
        base.filingPeriod = sub.period;
        base.nextFilingEst = estimateNextFiling(sub.filingDate);

        const numericCik = investor.cik.replace(/^0+/, "");
        const xml = await fetchInfotableXML(numericCik, sub.accession);
        if (!xml) return base;

        const rawHoldings = parseInfotableXML(xml);
        if (!rawHoldings.length) return base;

        const totalValue = rawHoldings.reduce((s, h) => s + h.value, 0);
        base.totalValue = totalValue;
        base.holdingsCount = rawHoldings.length;

        // Map holdings, resolve tickers
        const mappedHoldings = rawHoldings.slice(0, 15).map((h, i) => {
          const tickerFromCusip = CUSIP_TICKER[h.cusip];
          const ticker = tickerFromCusip ?? guessTickerFromName(h.name);
          return {
            rank: i + 1,
            ticker: ticker || h.name.slice(0, 6).toUpperCase().replace(/\s/g, ""),
            companyName: h.name,
            value: h.value,
            shares: h.shares,
            portfolioPct: totalValue > 0 ? Math.round((h.value / totalValue) * 1000) / 10 : 0,
            change: "UNCHANGED" as const,
            changePct: null,
            price: null as number | null,
            changePercent: null as number | null,
            dayChange: null as number | null,
          };
        });

        // Fetch live prices for top 10 holdings (that have valid tickers)
        if (apiKey) {
          const validTickers = mappedHoldings
            .slice(0, 10)
            .filter((h) => h.ticker && h.ticker.length <= 5 && /^[A-Z.]+$/.test(h.ticker));

          const quotes = await Promise.all(
            validTickers.map((h) => fetchFinnhubQuote(h.ticker, apiKey))
          );

          const quoteMap = new Map<string, { price: number | null; changePercent: number | null; change: number | null }>();
          validTickers.forEach((h, i) => quoteMap.set(h.ticker, quotes[i]));

          for (const h of mappedHoldings) {
            const q = quoteMap.get(h.ticker);
            if (q) {
              h.price = q.price;
              h.changePercent = q.changePercent;
              h.dayChange = q.change;
            }
          }
        }

        base.holdings = mappedHoldings;

        return base;
      } catch {
        return base;
      }
    })
  );

  return NextResponse.json({ investors: results, fetchedAt: new Date().toISOString() });
}
