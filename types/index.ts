/** Shared types used across app, API routes, and components. */

export type User = {
  id: string;
  name: string;
  email: string;
  username?: string;
  bio?: string;
  profilePicture?: string | null;
  bannerImage?: string | null;
  joinedAt?: string;
  isVerified?: boolean;
  isFounder?: boolean;
  /** If false, trading stats (performance card) are hidden on profile. Default true. */
  showTradingStats?: boolean;
  subscription_tier?: "free" | "verified" | "starter" | "pro" | "elite";
  subscription_status?: string;
  stripe_customer_id?: string;
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
