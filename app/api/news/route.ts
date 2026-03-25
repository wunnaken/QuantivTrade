import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type MarketNewsArticle = {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  source: string;
  publishedAt: string;
};

const CATEGORY_QUERIES: Record<string, string> = {
  all: "",
  markets: "stock market OR equities OR wall street OR shares OR trading OR s&p OR nasdaq OR dow",
  crypto: "crypto OR cryptocurrency OR bitcoin OR ethereum OR blockchain OR defi OR nft OR solana OR binance OR digital asset",
  macro: "federal reserve OR inflation OR gdp OR interest rate OR economy OR recession OR treasury OR cpi OR jobs OR employment OR central bank OR monetary OR fiscal OR debt OR deficit OR growth",
  geopolitical: "geopolitical OR sanctions OR trade war OR war OR conflict OR military OR nato OR russia OR ukraine OR china OR tariff OR diplomacy OR tension OR missile OR attack OR treaty OR alliance",
  earnings: "earnings OR revenue OR profit OR quarterly OR fiscal OR guidance OR beat OR miss OR eps OR results OR outlook OR forecast OR margin OR sales",
};

/** Filter articles by category using keyword match on title/description (for RSS or when News API has no results). */
function filterArticlesByCategory(
  articles: MarketNewsArticle[],
  category: string
): MarketNewsArticle[] {
  if (category === "all" || !category) return articles;
  const query = CATEGORY_QUERIES[category];
  if (!query) return articles;
  const terms = query
    .split(/\s+OR\s+/i)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (terms.length === 0) return articles;
  return articles.filter((a) => {
    const text = `${a.title ?? ""} ${a.description ?? ""}`.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

const RSS_FEEDS = [
  "https://feeds.reuters.com/reuters/businessNews",
  "https://feeds.reuters.com/reuters/topNews",
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TldnU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en",
  "https://feeds.bbci.co.uk/news/business/rss.xml",
];

const CRYPTO_RSS_FEEDS = [
  "https://www.coindesk.com/arc/outboundfeeds/rss/",
  "https://cointelegraph.com/rss",
  "https://decrypt.co/feed",
];

const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<
  string,
  { data: MarketNewsArticle[]; fetchedAt: number }
>();

const NEWSDATA_BASE = "https://newsdata.io/api/1/news";

type NewsDataResult = {
  title?: string;
  description?: string;
  link?: string;
  source_name?: string;
  pubDate?: string;
  image_url?: string;
};

function normalizeNewsDataResult(r: NewsDataResult): MarketNewsArticle | null {
  const url = (r.link ?? "").trim();
  if (!r?.title || !url.startsWith("http")) return null;
  return {
    title: String(r.title),
    description: (r.description ?? "").trim() || null,
    url,
    urlToImage: (r.image_url ?? "").trim() || null,
    source: (r.source_name ?? "—").trim(),
    publishedAt: r.pubDate ?? new Date().toISOString(),
  };
}

async function fetchFromNewsData(
  apiKey: string,
  q: string,
  size: number
): Promise<MarketNewsArticle[]> {
  const params = new URLSearchParams({
    apikey: apiKey,
    q: q || "business OR markets OR stocks",
    language: "en",
    size: String(size),
  });
  const res = await fetch(`${NEWSDATA_BASE}?${params.toString()}`, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json()) as {
    status?: string;
    totalResults?: number;
    results?: NewsDataResult[];
  };
  if (!res.ok || data?.status !== "success") return [];
  const raw = Array.isArray(data?.results) ? data.results : [];
  return raw
    .map(normalizeNewsDataResult)
    .filter((a): a is MarketNewsArticle => a != null)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

function isValidUrl(url: string): boolean {
  return typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
}

function extractFirstUrl(block: string): string | null {
  const hrefMatch = /<link[^>]+href=["']([^"']+)["']/i.exec(block);
  if (hrefMatch) return hrefMatch[1].trim();
  const linkTag = /<link[^>]*>([^<]+)<\/link>/i.exec(block);
  if (linkTag && linkTag[1].trim().startsWith("http")) return linkTag[1].trim();
  const guidTag = /<guid[^>]*>([^<]+)<\/guid>/i.exec(block);
  if (guidTag && guidTag[1].trim().startsWith("http")) return guidTag[1].trim();
  const anyUrl = /https?:\/\/[^\s<"']+/i.exec(block);
  return anyUrl ? anyUrl[0].trim() : null;
}

function extractImageFromBlock(block: string): string | null {
  // <media:content url="..." /> or <media:thumbnail url="..." /> — allow multiline attributes
  const mediaContent = /(?:media:content|media:thumbnail)[\s\S]*?url=["']([^"']+)["']/i.exec(block);
  if (mediaContent) {
    const u = mediaContent[1].trim();
    if (u.startsWith("http")) return u;
  }
  // <enclosure url="..." type="image/..." /> — attribute order varies
  const encUrl = /<enclosure[\s\S]*?url=["']([^"']+)["'][\s\S]*?>/i.exec(block);
  if (encUrl) {
    const u = encUrl[1].trim();
    // Only use if it looks like an image (common extensions or no extension path)
    if (u.startsWith("http") && /\.(jpe?g|png|gif|webp|avif)/i.test(u)) return u;
  }
  // og:image inside any <meta> in description
  const ogImg = /og:image[^>]+content=["']([^"']+)["']/i.exec(block)
    ?? /content=["']([^"']+)["'][^>]+og:image/i.exec(block);
  if (ogImg) {
    const u = ogImg[1].trim();
    if (u.startsWith("http")) return u;
  }
  // <img src="..." inside CDATA description
  const imgSrc = /<img[\s\S]*?src=["']([^"']+)["']/i.exec(block);
  if (imgSrc) {
    const u = imgSrc[1].trim();
    if (u.startsWith("http")) return u;
  }
  return null;
}

function parseRssItem(xml: string, sourceName = "News"): MarketNewsArticle[] {
  const articles: MarketNewsArticle[] = [];
  const getTag = (blob: string, tag: string, stripHtml = false): string | null => {
    const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(blob);
    if (!m) return null;
    let val = m[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
    if (stripHtml) val = val.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
    return val || null;
  };

  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = getTag(block, "title");
    const link = getTag(block, "link") || getTag(block, "guid");
    const pubDate = getTag(block, "pubDate");
    const description = getTag(block, "description", true);
    const url = (link && link.trim().startsWith("http")) ? link.trim() : extractFirstUrl(block);
    if (title && url && (url.startsWith("http://") || url.startsWith("https://"))) {
      articles.push({
        title,
        description: description || null,
        url,
        urlToImage: extractImageFromBlock(block),
        source: sourceName,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      });
    }
  }

  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let em: RegExpExecArray | null;
  while ((em = entryRegex.exec(xml)) !== null) {
    const block = em[1];
    const title = getTag(block, "title");
    const pubDate = getTag(block, "published") || getTag(block, "updated");
    const url = extractFirstUrl(block);
    if (title && url) {
      articles.push({
        title,
        description: getTag(block, "summary", true) || null,
        url,
        urlToImage: extractImageFromBlock(block),
        source: sourceName,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      });
    }
  }

  return articles.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

const RSS_SOURCE_MAP: Record<string, string> = {
  "reuters.com": "Reuters",
  "google.com": "Google News",
  "bbci.co.uk": "BBC",
};

const CRYPTO_SOURCE_MAP: Record<string, string> = {
  "coindesk.com": "CoinDesk",
  "cointelegraph.com": "CoinTelegraph",
  "decrypt.co": "Decrypt",
};

/** Fetch all feeds in parallel, merge results, deduplicate by URL, sort newest first. */
async function fetchAllRssFeeds(feeds: string[], sourceMap: Record<string, string>): Promise<MarketNewsArticle[]> {
  const fetchOpts: RequestInit = {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; QuantivTradeNews/1.0; +https://quantivtrade.app)" },
  };

  const results = await Promise.allSettled(
    feeds.map(async (feedUrl) => {
      const res = await fetch(feedUrl, fetchOpts);
      if (!res.ok) return [] as MarketNewsArticle[];
      const xml = await res.text();
      const source = Object.keys(sourceMap).find((k) => feedUrl.includes(k));
      return parseRssItem(xml, source ? sourceMap[source] : "News");
    })
  );

  const seen = new Set<string>();
  const merged: MarketNewsArticle[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const a of r.value) {
      const key = a.url;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(a);
      }
    }
  }

  return merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

async function fetchRealHeadlinesFromRss(): Promise<MarketNewsArticle[]> {
  return fetchAllRssFeeds(RSS_FEEDS, RSS_SOURCE_MAP);
}

async function fetchCryptoFromRss(): Promise<MarketNewsArticle[]> {
  return fetchAllRssFeeds(CRYPTO_RSS_FEEDS, CRYPTO_SOURCE_MAP);
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.NEWSDATA_API_KEY?.trim();
  const category = (request.nextUrl.searchParams.get("category") ?? "all").toLowerCase();
  const query = CATEGORY_QUERIES[category] ?? "";
  const cacheKey = `news:${category}`;

  try {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
      return NextResponse.json({
        articles: cached.data,
        usingLiveFeed: true,
        fromCache: true,
      });
    }

    if (!apiKey) {
      // For crypto, use dedicated crypto RSS feeds first
      if (category === "crypto") {
        const cryptoArticles = await fetchCryptoFromRss();
        if (cryptoArticles.length > 0) {
          return NextResponse.json({ articles: cryptoArticles, usingLiveFeed: false, fromCache: false });
        }
      }
      const rssFirst = await fetchRealHeadlinesFromRss();
      if (rssFirst.length > 0) {
        const filtered = filterArticlesByCategory(rssFirst, category);
        return NextResponse.json({
          articles: filtered.length > 0 ? filtered : rssFirst.slice(0, 10),
          usingLiveFeed: false,
          fromCache: false,
        });
      }
      return NextResponse.json({ articles: [], usingLiveFeed: false, fromCache: false });
    }

    const searchQ = query && category !== "all" ? query : "business OR markets OR stocks";
    let articles = await fetchFromNewsData(apiKey, searchQ, 20);

    if (articles.length === 0 && (category === "all" || !query)) {
      articles = await fetchFromNewsData(apiKey, "business OR markets", 20);
    }

    if (articles.length === 0) {
      const rssFallback = category === "crypto"
        ? await fetchCryptoFromRss()
        : await fetchRealHeadlinesFromRss();
      articles = filterArticlesByCategory(rssFallback, category);
      if (articles.length === 0 && rssFallback.length > 0) articles = rssFallback.slice(0, 10);
    } else {
      articles = filterArticlesByCategory(articles, category);
      if (articles.length === 0 && cached?.data?.length) {
        articles = cached.data.slice(0, 10);
      }
      cache.set(cacheKey, { data: articles, fetchedAt: Date.now() });
    }

    return NextResponse.json({
      articles,
      usingLiveFeed: articles.length > 0,
      fromCache: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[news API]", message);
    const cached = cache.get(cacheKey);
    if (cached && cached.data.length > 0) {
      const filtered = filterArticlesByCategory(cached.data, category);
      return NextResponse.json({
        articles: filtered.length > 0 ? filtered : cached.data.slice(0, 10),
        usingLiveFeed: true,
        fromCache: true,
      });
    }
    try {
      const fallback = await fetchRealHeadlinesFromRss();
      if (fallback.length > 0) {
        const filtered = filterArticlesByCategory(fallback, category);
        return NextResponse.json({
          articles: filtered.length > 0 ? filtered : fallback.slice(0, 10),
          usingLiveFeed: false,
          fromCache: false,
        });
      }
    } catch {
      // ignore
    }
    return NextResponse.json(
      { articles: [] as MarketNewsArticle[], usingLiveFeed: false, error: message },
      { status: 500 }
    );
  }
}
