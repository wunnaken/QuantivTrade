/** Shared types used across app, API routes, and components. */

export type RiskProfileKey = "passive" | "moderate" | "aggressive";

export type User = {
  id: string;
  name: string;
  email: string;
  username?: string;
  bio?: string;
  profilePicture?: string | null;
  bannerImage?: string | null;
  joinedAt?: string;
  riskProfile?: RiskProfileKey;
};

export type NewsItem = {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
};

export type MarketSnapshot = {
  indexName: string;
  price: number;
  change: number;
  changePercent: number;
} | null;

export type GdpGrowthPoint = { year: string; value: number | null };

export type ProjectionsData = {
  gdpGrowth: {
    latestYear: string;
    latestValue: number | null;
    history: GdpGrowthPoint[];
  } | null;
  source: string;
  disclaimer: string;
};

export type CountryData = {
  country: string;
  iso?: string;
  market: MarketSnapshot;
  news: NewsItem[];
  elections?: NewsItem[];
  political?: NewsItem[];
  projections?: ProjectionsData;
};
