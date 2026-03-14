import { NextRequest, NextResponse } from "next/server";
import { countryToIsoLoose } from "../../../lib/country-mapping";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type NewsArticle = { title: string; source: string; url: string; publishedAt: string };

async function fetchNewsSearch(query: string, apiKey: string, limit: number): Promise<NewsArticle[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      sortBy: "publishedAt",
      pageSize: String(limit),
      language: "en",
      apiKey,
    });
    const res = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`, { next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles?: Array<{ title?: string; source?: { name?: string }; url?: string; publishedAt?: string }> };
    const raw = data?.articles ?? [];
    return raw
      .filter((a) => a?.title)
      .map((a) => ({
        title: a.title ?? "",
        source: a.source?.name ?? "—",
        url: a.url ?? "#",
        publishedAt: a.publishedAt ?? "",
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
  const iso = countryToIsoLoose(country);
  const apiKey = process.env.NEWS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ articles: [] as NewsArticle[] });
  }
  let articles: NewsArticle[] = [];
  if (iso) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/top-headlines?country=${iso}&pageSize=5&apiKey=${apiKey}`,
        { next: { revalidate: 0 } }
      );
      if (res.ok) {
        const data = (await res.json()) as { articles?: Array<{ title?: string; source?: { name?: string }; url?: string; publishedAt?: string }> };
        const raw = data?.articles ?? [];
        articles = raw
          .filter((a) => a?.title)
          .map((a) => ({
            title: a.title ?? "",
            source: a.source?.name ?? "—",
            url: a.url ?? "#",
            publishedAt: a.publishedAt ?? "",
          }))
          .slice(0, 4);
      }
    } catch {
      // fall through to search
    }
  }
  if (articles.length === 0) {
    articles = await fetchNewsSearch(country, apiKey, 4);
  }
  if (articles.length === 0 && country) {
    articles = await fetchNewsSearch(`${country} news`, apiKey, 4);
  }
  return NextResponse.json({ articles });
}
