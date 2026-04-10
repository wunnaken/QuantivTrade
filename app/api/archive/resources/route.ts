import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600; // cache 1 hour per term

export interface ArchiveBook {
  title: string;
  authors: string[];
  description: string;
  thumbnail: string | null;
  previewLink: string;
  publishedDate: string;
}

export interface ArchiveVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  url: string;
}

async function fetchBooks(term: string): Promise<ArchiveBook[]> {
  try {
    const q = encodeURIComponent(`${term} trading investing finance`);
    const key = process.env.GOOGLE_BOOKS_API_KEY;
    const base = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=4&printType=books&orderBy=relevance`;
    const url = key ? `${base}&key=${key}` : base;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{
        volumeInfo: {
          title?: string;
          authors?: string[];
          description?: string;
          imageLinks?: { thumbnail?: string };
          previewLink?: string;
          infoLink?: string;
          publishedDate?: string;
        };
      }>;
    };
    return (data.items ?? [])
      .filter((item) => item.volumeInfo.title)
      .map((item) => ({
        title: item.volumeInfo.title!,
        authors: item.volumeInfo.authors ?? [],
        description: (item.volumeInfo.description ?? "").slice(0, 180),
        thumbnail: item.volumeInfo.imageLinks?.thumbnail?.replace("http:", "https:") ?? null,
        previewLink: item.volumeInfo.previewLink ?? item.volumeInfo.infoLink ?? "#",
        publishedDate: (item.volumeInfo.publishedDate ?? "").slice(0, 4),
      }));
  } catch {
    return [];
  }
}

async function fetchVideos(term: string): Promise<ArchiveVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) return [];
  try {
    const q = encodeURIComponent(`${term} trading explained tutorial`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=4&relevanceLanguage=en&key=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{
        id: { videoId?: string };
        snippet: {
          title?: string;
          channelTitle?: string;
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        };
      }>;
    };
    return (data.items ?? [])
      .filter((item) => item.id.videoId)
      .map((item) => ({
        id: item.id.videoId!,
        title: item.snippet.title ?? "",
        channelTitle: item.snippet.channelTitle ?? "",
        thumbnail:
          item.snippet.thumbnails?.medium?.url ??
          item.snippet.thumbnails?.default?.url ??
          "",
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const term = req.nextUrl.searchParams.get("term")?.trim() ?? "";
  if (!term) return NextResponse.json({ books: [], videos: [], youtubeSearch: "" });

  const [books, videos] = await Promise.all([fetchBooks(term), fetchVideos(term)]);

  const youtubeSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(term + " trading tutorial")}`;
  return NextResponse.json({ books, videos, youtubeSearch });
}
