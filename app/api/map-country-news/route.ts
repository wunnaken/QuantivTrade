import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type NewsArticle = { title: string; source: string; url: string; publishedAt: string; image_url?: string | null };

const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { data: NewsArticle[]; fetchedAt: number }>();

const NEWSDATA_BASE = "https://newsdata.io/api/1/news";

async function fetchNewsSearch(
  query: string,
  apiKey: string,
  limit: number
): Promise<NewsArticle[]> {
  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      q: query.slice(0, 200),
      language: "en",
      size: String(limit),
    });
    const res = await fetch(`${NEWSDATA_BASE}?${params.toString()}`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      status?: string;
      results?: { title?: string; link?: string; source_name?: string; pubDate?: string; image_url?: string }[];
    };
    const raw = data?.status === "success" ? (data?.results ?? []) : [];
    return raw
      .filter((r) => r?.title && r?.link)
      .map((r) => ({
        title: r.title ?? "",
        source: (r as { source_name?: string }).source_name ?? "—",
        url: r.link ?? "#",
        publishedAt: r.pubDate ?? "",
        image_url: (r.image_url ?? "").trim() || null,
      }))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country")?.trim();
  if (!country) {
    return NextResponse.json({ error: "Missing country" }, { status: 400 });
  }
  const apiKey = process.env.NEWSDATA_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ articles: [] as NewsArticle[] });
  }

  const cacheKey = country.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    return NextResponse.json({ articles: cached.data });
  }

  let articles: NewsArticle[] = [];
  // Use country name with economic context for relevant results
  articles = await fetchNewsSearch(`${country} economy OR ${country} market OR ${country} GDP OR ${country} government`, apiKey, 5);
  if (articles.length === 0) {
    articles = await fetchNewsSearch(`${country} news`, apiKey, 4);
  }
  // Filter out articles that don't actually mention the country in the title
  const countryLower = country.toLowerCase();
  const relevant = articles.filter((a) => a.title.toLowerCase().includes(countryLower));
  if (relevant.length >= 2) {
    articles = relevant;
  }

  cache.set(cacheKey, { data: articles, fetchedAt: Date.now() });
  return NextResponse.json({ articles });
}
