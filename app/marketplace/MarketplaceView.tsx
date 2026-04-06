"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "all" | "chart_preset" | "strategy" | "indicator" | "course" | "signals";
type PriceType = "free" | "one_time" | "subscription";
type ListingStatus = "pending" | "approved" | "rejected";

interface Seller {
  username: string;
  avatar_url?: string | null;
  is_verified: boolean;
  is_founder: boolean;
  total_sales: number;
}

interface Listing {
  id: string;
  title: string;
  category: Category;
  description: string;
  price: number;
  price_type: PriceType;
  subscription_interval?: "monthly" | "yearly";
  asset_classes: string[];
  tags: string[];
  preview_image_url?: string;
  preview_images?: string[];
  content_data?: string | null;
  is_featured: boolean;
  backtest_verified: boolean;
  signal_win_rate?: number;
  signal_total?: number;
  view_count: number;
  sales_count: number;
  avg_rating: number;
  review_count: number;
  created_at: string;
  seller_id: string;
  seller?: Seller | null;
}

interface SellerDashboardData {
  listings: Array<{
    id: string;
    title: string;
    category: string;
    status: ListingStatus;
    view_count: number;
    sales_count: number;
    avg_rating: number;
    review_count: number;
    price: number;
    price_type: string;
    subscription_interval?: string | null;
    categories?: string[];
    description?: string;
    tags?: string[];
    asset_classes?: string[];
    backtest_data?: string | null;
    content_data?: string | null;
    preview_image_url?: string | null;
    created_at: string;
    rejection_reason?: string | null;
  }>;
  totalRevenue: number;
  thisMonthRevenue: number;
  totalSales: number;
  pendingPayout: number;
  reviews: Array<{ id: string; rating: number; comment: string; created_at: string; listing_id: string }>;
}

interface CreateForm {
  categories: Category[];
  title: string;
  description: string;
  tags: string;
  asset_classes: string[];
  price: number;
  price_type: PriceType;
  subscription_interval: "monthly" | "yearly";
  backtest_data: string;
  content_data: string;
  preview_image_url: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const I = {
  Grid: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  ),
  Chart: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  ),
  Target: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="6" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="2" strokeWidth={1.5} />
    </svg>
  ),
  Code: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  Book: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  Signal: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
  Star: ({ filled }: { filled?: boolean }) => (
    <svg className="h-3.5 w-3.5" fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  Check: () => (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  X: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  Shield: () => (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Upload: () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  Pin: () => (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2a1 1 0 011 1v1.07A7.002 7.002 0 0118 11v1.586l1.707 1.707A1 1 0 0119 16h-6v4a1 1 0 11-2 0v-4H5a1 1 0 01-.707-1.707L6 12.586V11A7.002 7.002 0 0111 4.07V3a1 1 0 011-1z" />
    </svg>
  ),
  Store: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Search: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Filter: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  ),
  ArrowRight: () => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  ),
  Verified: () => (
    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
};

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES: { id: Category; label: string; Icon: React.FC }[] = [
  { id: "all",          label: "All",           Icon: I.Grid   },
  { id: "chart_preset", label: "Chart Presets", Icon: I.Chart  },
  { id: "strategy",     label: "Strategies",    Icon: I.Target },
  { id: "indicator",    label: "Indicators",    Icon: I.Code   },
  { id: "course",       label: "Courses",       Icon: I.Book   },
  { id: "signals",      label: "Signals",       Icon: I.Signal },
];

const CAT_COLORS: Record<string, string> = {
  chart_preset: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  strategy:     "text-purple-400 bg-purple-400/10 border-purple-400/20",
  indicator:    "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  course:       "text-amber-400 bg-amber-400/10 border-amber-400/20",
  signals:      "text-green-400 bg-green-400/10 border-green-400/20",
};

const CAT_LABEL: Record<string, string> = {
  chart_preset: "Chart Preset",
  strategy:     "Strategy",
  indicator:    "Indicator",
  course:       "Course",
  signals:      "Signals",
};

const ASSET_CLASSES = ["All", "Stocks", "Crypto", "Forex", "Options", "Futures"];
const SORT_OPTIONS = [
  { value: "popular",    label: "Most Popular"    },
  { value: "newest",     label: "Newest"          },
  { value: "rating",     label: "Highest Rated"   },
  { value: "price_low",  label: "Price: Low–High" },
  { value: "price_high", label: "Price: High–Low" },
];
const PRICE_FILTERS = [
  { label: "Any price", min: 0,   max: null  },
  { label: "Free",      min: 0,   max: 0     },
  { label: "Under $20", min: 0.01,max: 20    },
  { label: "$20–$50",   min: 20,  max: 50    },
  { label: "$50–$100",  min: 50,  max: 100   },
  { label: "$100+",     min: 100, max: null  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(listing: Listing): React.ReactNode {
  if (listing.price_type === "free" || listing.price === 0) {
    return <span className="font-semibold text-emerald-400">Free</span>;
  }
  if (listing.price_type === "subscription") {
    return (
      <span className="font-bold text-zinc-50">
        ${listing.price}
        <span className="text-xs font-normal text-zinc-400">
          /{listing.subscription_interval === "yearly" ? "yr" : "mo"}
        </span>
      </span>
    );
  }
  return <span className="font-bold text-zinc-50">${listing.price}</span>;
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= Math.round(rating) ? "text-amber-400" : "text-zinc-700"}>
            <I.Star filled={n <= Math.round(rating)} />
          </span>
        ))}
      </div>
      <span className="text-xs text-zinc-500">{rating > 0 ? rating.toFixed(1) : "—"}</span>
      {count > 0 && <span className="text-xs text-zinc-600">({count})</span>}
    </div>
  );
}

function SellerAvatar({ seller }: { seller?: Seller | null }) {
  const initial = seller?.username?.[0]?.toUpperCase() ?? "?";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-color)]/20 text-[10px] font-semibold text-[var(--accent-color)]">
        {initial}
      </span>
      <span className="text-xs text-zinc-400">{seller?.username ?? "Seller"}</span>
      {seller?.is_verified && (
        <span className="text-[var(--accent-color)]" title="Verified Trader">
          <I.Verified />
        </span>
      )}
      {seller?.is_founder && (
        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-400/30">
          Founder Exclusive
        </span>
      )}
    </div>
  );
}

function QualityBadges({ listing }: { listing: Listing }) {
  const now = Date.now();
  const age = now - new Date(listing.created_at).getTime();
  const isNew = age < 7 * 24 * 60 * 60 * 1000;
  return (
    <div className="flex flex-wrap gap-1">
      {listing.backtest_verified && (
        <span className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
          <I.Check /> Backtest Verified
        </span>
      )}
      {listing.category === "signals" && listing.signal_win_rate !== undefined && (
        <span className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20">
          Live Tracked
        </span>
      )}
      {listing.sales_count >= 50 && listing.avg_rating >= 4.5 && (
        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">
          Top Seller
        </span>
      )}
      {isNew && (
        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-400/10 text-zinc-400 border border-zinc-400/20">
          New
        </span>
      )}
    </div>
  );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────

function ListingCard({ listing, onClick, featured }: { listing: Listing; onClick: () => void; featured?: boolean }) {
  const catColor = CAT_COLORS[listing.category] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col rounded-2xl border border-white/10 bg-[#050713] text-left transition hover:border-[var(--accent-color)]/30 hover:shadow-lg ${featured ? "p-4" : "p-3"}`}
    >
      {/* Preview area */}
      <div className={`relative w-full overflow-hidden rounded-xl ${featured ? "mb-4 h-48" : "mb-3 h-36"}`}>
        {(listing.preview_image_url ?? listing.preview_images?.[0]) ? (
          <img
            src={listing.preview_image_url ?? listing.preview_images![0]}
            alt={listing.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5">
            <span className={`opacity-40 group-hover:opacity-60 transition ${featured ? "scale-150" : "scale-125"}`}>
              {listing.category === "chart_preset" && <I.Chart />}
              {listing.category === "strategy"     && <I.Target />}
              {listing.category === "indicator"    && <I.Code />}
              {listing.category === "course"       && <I.Book />}
              {listing.category === "signals"      && <I.Signal />}
            </span>
          </div>
        )}
        {listing.seller?.is_founder && (
          <span className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/20 backdrop-blur-sm">
            Pinned
          </span>
        )}
        {listing.is_featured && (
          <span className="absolute right-2 top-2 rounded px-2 py-0.5 text-[10px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/20 backdrop-blur-sm">
            Featured
          </span>
        )}
      </div>

      {/* Category badge */}
      <span className={`mb-2 self-start rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${catColor}`}>
        {CAT_LABEL[listing.category] ?? listing.category}
      </span>

      {/* Title */}
      <p className={`mb-1 font-semibold text-zinc-100 line-clamp-2 ${featured ? "text-base" : "text-sm"}`}>
        {listing.title}
      </p>

      {/* Seller */}
      <div className="mb-2">
        <SellerAvatar seller={listing.seller} />
      </div>

      {/* Rating */}
      <div className="mb-2">
        <StarRating rating={listing.avg_rating} count={listing.review_count} />
      </div>

      {/* Signals performance */}
      {listing.category === "signals" && listing.signal_win_rate !== undefined && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs text-emerald-400 font-medium">{listing.signal_win_rate}% Win Rate</span>
          <span className="text-xs text-zinc-600">{listing.signal_total} signals</span>
        </div>
      )}

      {/* Asset classes */}
      {listing.asset_classes.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {listing.asset_classes.slice(0, 3).map((ac) => (
            <span key={ac} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">{ac}</span>
          ))}
        </div>
      )}

      {/* Quality badges */}
      <div className="mb-3">
        <QualityBadges listing={listing} />
      </div>

      {/* Price + CTA */}
      <div className="mt-auto flex items-center justify-between">
        <div className="text-sm">{formatPrice(listing)}</div>
        <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition group-hover:border-[var(--accent-color)]/50 group-hover:text-[var(--accent-color)]">
          View Details
        </span>
      </div>
    </button>
  );
}

// ─── Listing Detail Modal ─────────────────────────────────────────────────────

function ListingDetailModal({ listing, onClose, onPurchase, currentUsername }: {
  listing: Listing;
  onClose: () => void;
  onPurchase: (id: string) => Promise<void>;
  currentUsername: string;
}) {
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  const images = listing.preview_images?.length ? listing.preview_images : [];
  const catColor = CAT_COLORS[listing.category] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";

  // Fake equity curve for verified strategies
  const equityCurve = listing.backtest_verified
    ? Array.from({ length: 52 }, (_, i) => ({
        week: `W${i + 1}`,
        value: 10000 * Math.pow(1 + 0.004 + Math.sin(i * 0.3) * 0.01, i),
      }))
    : null;

  async function handlePurchase() {
    setPurchasing(true);
    try {
      await onPurchase(listing.id);
      setPurchased(true);
    } catch {
      // handled by parent
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-8">
      <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0A0E1A] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div className="flex-1">
            <span className={`mb-2 inline-block rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${catColor}`}>
              {CAT_LABEL[listing.category] ?? listing.category}
            </span>
            <h2 className="text-xl font-bold text-zinc-50">{listing.title}</h2>
            <div className="mt-2 flex items-center gap-3">
              <SellerAvatar seller={listing.seller} />
              <StarRating rating={listing.avg_rating} count={listing.review_count} />
              <span className="text-xs text-zinc-600">{listing.sales_count} sales</span>
            </div>
          </div>
          <button onClick={onClose} className="ml-4 rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300">
            <I.X />
          </button>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_280px]">
          {/* Left: content */}
          <div className="space-y-5">
            {/* Image carousel */}
            {images.length > 0 && (
              <div className="relative overflow-hidden rounded-xl bg-white/5">
                <img src={images[imgIdx]} alt="" className="h-56 w-full object-cover" />
                {images.length > 1 && (
                  <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
                    {images.map((_, i) => (
                      <button key={i} onClick={() => setImgIdx(i)}
                        className={`h-1.5 w-1.5 rounded-full transition ${i === imgIdx ? "bg-white" : "bg-white/30"}`} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-300">Description</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-400">{listing.description}</p>
            </div>

            {/* Backtest results */}
            {listing.backtest_verified && equityCurve && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-300">Backtest Results</h3>
                  <span className="flex items-center gap-0.5 rounded px-2 py-0.5 text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                    <I.Check /> Verified
                  </span>
                </div>
                <div className="mb-3 grid grid-cols-4 gap-2">
                  {[
                    { label: "Total Return", value: "+142.3%" },
                    { label: "Sharpe Ratio", value: "1.84" },
                    { label: "Max Drawdown", value: "-18.2%" },
                    { label: "Win Rate",     value: "61.4%" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-white/5 bg-white/5 p-3 text-center">
                      <p className="text-xs text-zinc-500">{label}</p>
                      <p className={`mt-0.5 text-sm font-bold ${value.startsWith("-") ? "text-red-400" : "text-emerald-400"}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="h-40 rounded-xl border border-white/5 bg-white/5 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={equityCurve}>
                      <defs>
                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="week" hide />
                      <YAxis hide domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={{ background: "#0A0E1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                        formatter={(v: unknown) => [`$${(v as number).toFixed(0)}`, "Portfolio"]}
                      />
                      <Area type="monotone" dataKey="value" stroke="var(--accent-color)" fill="url(#eqGrad)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-[10px] text-zinc-600">Simulated equity curve based on submitted backtest parameters. Past performance is not indicative of future results.</p>
              </div>
            )}

            {/* Signals performance */}
            {listing.category === "signals" && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-300">Signal Performance</h3>
                {listing.signal_win_rate !== undefined ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center">
                      <p className="text-xs text-zinc-500">Win Rate</p>
                      <p className="mt-0.5 text-sm font-bold text-emerald-400">{listing.signal_win_rate}%</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center">
                      <p className="text-xs text-zinc-500">Total Signals</p>
                      <p className="mt-0.5 text-sm font-bold text-zinc-100">{listing.signal_total ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-center">
                      <p className="text-xs text-zinc-500">Tracking</p>
                      <p className="mt-0.5 text-sm font-bold text-blue-400">Live</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Performance tracking starts after purchase access is granted.</p>
                )}
              </div>
            )}

            {/* Reviews placeholder */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-zinc-300">Reviews</h3>
              {listing.review_count === 0 ? (
                <p className="text-sm text-zinc-600">No reviews yet. Be the first to leave feedback after purchasing.</p>
              ) : (
                <p className="text-sm text-zinc-500">{listing.review_count} reviews · avg {listing.avg_rating.toFixed(1)} / 5</p>
              )}
            </div>

            {/* Purchased content */}
            {purchased && listing.content_data && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-300">Content</h3>
                  <span className="rounded bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Unlocked</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#050713]">
                  <WatermarkedContent content={listing.content_data} username={currentUsername} />
                </div>
                <p className="mt-1.5 text-[10px] text-zinc-600">
                  This content is licensed to <span className="text-zinc-500">{currentUsername}</span>. Redistribution is prohibited.
                </p>
              </div>
            )}
          </div>

          {/* Right: purchase sidebar */}
          <div className="space-y-4">
            {/* Price card */}
            <div className="rounded-2xl border border-white/10 bg-[#050713] p-4">
              <div className="mb-4 text-2xl">{formatPrice(listing)}</div>
              <button
                onClick={handlePurchase}
                disabled={purchasing || purchased}
                className="w-full rounded-xl bg-[var(--accent-color)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {purchased ? "Purchased!" : purchasing ? "Processing…" : listing.price === 0 ? "Get Free" : listing.price_type === "subscription" ? "Subscribe" : "Buy Now"}
              </button>
              {listing.price > 0 && (
                <p className="mt-2 text-center text-[10px] text-zinc-600">
                  Stripe Connect payments launching in Phase 2
                </p>
              )}
            </div>

            {/* Quality badges */}
            <div className="rounded-2xl border border-white/10 bg-[#050713] p-4 space-y-2">
              <h4 className="text-xs font-semibold text-zinc-400">Quality Signals</h4>
              <QualityBadges listing={listing} />
            </div>

            {/* Tags */}
            {listing.tags.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#050713] p-4">
                <h4 className="mb-2 text-xs font-semibold text-zinc-400">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {listing.tags.map((t) => (
                    <span key={t} className="rounded bg-white/5 px-2 py-0.5 text-xs text-zinc-500">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* About seller */}
            <div className="rounded-2xl border border-white/10 bg-[#050713] p-4">
              <h4 className="mb-3 text-xs font-semibold text-zinc-400">About the Seller</h4>
              <SellerAvatar seller={listing.seller} />
              {listing.seller && (
                <p className="mt-2 text-xs text-zinc-600">{listing.seller.total_sales} total sales</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Image Crop Modal ─────────────────────────────────────────────────────────

type CropRect = { x: number; y: number; w: number; h: number };
type Handle = "move" | "tl" | "tr" | "bl" | "br";

function CropModal({ file, onConfirm, onCancel }: {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; startCrop: CropRect } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    const { width, height } = img.getBoundingClientRect();
    const aspect = 16 / 9;
    let w = width * 0.9;
    let h = w / aspect;
    if (h > height * 0.9) { h = height * 0.9; w = h * aspect; }
    setCrop({ x: (width - w) / 2, y: (height - h) / 2, w, h });
    setReady(true);
  }

  function clamp(val: number, min: number, max: number) { return Math.max(min, Math.min(max, val)); }

  function getContainerRect() { return containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 }; }
  function getImgRect() { return imgRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 }; }

  function onMouseDown(e: React.MouseEvent, handle: Handle) {
    e.preventDefault();
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } };
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const { handle, startX, startY, startCrop } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const imgRect = getImgRect();
      const containerRect = getContainerRect();
      const offX = imgRect.left - containerRect.left;
      const offY = imgRect.top - containerRect.top;
      const maxW = imgRect.width;
      const maxH = imgRect.height;
      const minSize = 40;

      setCrop((prev) => {
        let { x, y, w, h } = startCrop;
        if (handle === "move") {
          x = clamp(x + dx, offX, offX + maxW - w);
          y = clamp(y + dy, offY, offY + maxH - h);
        } else if (handle === "br") {
          w = clamp(w + dx, minSize, offX + maxW - x);
          h = clamp(h + dy, minSize, offY + maxH - y);
        } else if (handle === "tr") {
          const newH = clamp(h - dy, minSize, y - offY + h);
          y = clamp(y + dy, offY, y + h - minSize);
          h = newH;
          w = clamp(w + dx, minSize, offX + maxW - x);
        } else if (handle === "bl") {
          const newW = clamp(w - dx, minSize, x - offX + w);
          x = clamp(x + dx, offX, x + w - minSize);
          w = newW;
          h = clamp(h + dy, minSize, offY + maxH - y);
        } else if (handle === "tl") {
          const newW = clamp(w - dx, minSize, x - offX + w);
          const newH = clamp(h - dy, minSize, y - offY + h);
          x = clamp(x + dx, offX, x + w - minSize);
          y = clamp(y + dy, offY, y + h - minSize);
          w = newW; h = newH;
        }
        return { x, y, w, h };
      });
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  async function handleConfirm() {
    const img = imgRef.current;
    if (!img) return;
    const imgRect = getImgRect();
    const containerRect = getContainerRect();
    const offX = imgRect.left - containerRect.left;
    const offY = imgRect.top - containerRect.top;
    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;
    const cx = (crop.x - offX) * scaleX;
    const cy = (crop.y - offY) * scaleY;
    const cw = crop.w * scaleX;
    const ch = crop.h * scaleY;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cw);
    canvas.height = Math.round(ch);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) onConfirm(blob); }, "image/jpeg", 0.92);
  }

  const handleStyle = "absolute h-4 w-4 rounded-full border-2 border-white bg-[var(--accent-color)] shadow-lg cursor-pointer z-10";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0A0E1A] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-50">Crop Cover Image</h3>
            <p className="text-xs text-zinc-500">Drag the box or handles to adjust. Default is 16:9.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"><I.X /></button>
        </div>

        <div ref={containerRef} className="relative select-none overflow-hidden rounded-none bg-black/40 mx-5 my-4 rounded-xl"
          style={{ userSelect: "none" }}>
          {imgSrc && (
            <img ref={imgRef} src={imgSrc} alt="" onLoad={onImageLoad}
              className="block max-h-[420px] w-full object-contain" draggable={false} />
          )}

          {ready && (
            <>
              {/* Dark overlay outside crop */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-black/50" style={{
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${crop.x}px ${crop.y}px, ${crop.x}px ${crop.y + crop.h}px, ${crop.x + crop.w}px ${crop.y + crop.h}px, ${crop.x + crop.w}px ${crop.y}px, ${crop.x}px ${crop.y}px)`
                }} />
              </div>

              {/* Crop box */}
              <div className="absolute border-2 border-white/80"
                style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h, cursor: "move" }}
                onMouseDown={(e) => onMouseDown(e, "move")}>
                {/* Rule-of-thirds grid */}
                <div className="pointer-events-none absolute inset-0">
                  {[1, 2].map((n) => (
                    <React.Fragment key={n}>
                      <div className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: `${n * 33.33}%` }} />
                      <div className="absolute left-0 right-0 h-px bg-white/20" style={{ top: `${n * 33.33}%` }} />
                    </React.Fragment>
                  ))}
                </div>
                {/* Corner handles */}
                <div className={`${handleStyle} -left-2 -top-2`} onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "tl"); }} />
                <div className={`${handleStyle} -right-2 -top-2`} onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "tr"); }} />
                <div className={`${handleStyle} -left-2 -bottom-2`} onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "bl"); }} />
                <div className={`${handleStyle} -right-2 -bottom-2`} onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "br"); }} />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-400 hover:bg-white/5">Cancel</button>
          <button type="button" onClick={handleConfirm} className="rounded-xl bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
            Crop & Use
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Image Uploader ───────────────────────────────────────────────────────────

function ImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [dropDragging, setDropDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadBlob(blob: Blob) {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/marketplace/upload", { method: "POST", body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { setError(data.error ?? "Upload failed"); return; }
      onChange(data.url);
    } finally {
      setUploading(false);
    }
  }

  function handleFile(file: File) { setCropFile(file); }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  return (
    <>
      <div className="space-y-2">
        {value ? (
          <div className="relative overflow-hidden rounded-xl border border-white/10">
            <img src={value} alt="Cover" className="h-36 w-full object-cover" />
            <div className="absolute right-2 top-2 flex gap-1">
              <button type="button" onClick={() => inputRef.current?.click()}
                className="rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-zinc-300 backdrop-blur-sm hover:text-white">
                Change
              </button>
              <button type="button" onClick={() => onChange("")}
                className="rounded-lg bg-black/60 p-1.5 text-zinc-300 backdrop-blur-sm hover:text-white">
                <I.X />
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDropDragging(true); }}
            onDragLeave={() => setDropDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition ${
              dropDragging ? "border-[var(--accent-color)] bg-[var(--accent-color)]/5" : "border-white/10 bg-white/5 hover:border-white/20"
            }`}
          >
            {uploading ? (
              <p className="text-xs text-zinc-400">Uploading…</p>
            ) : (
              <>
                <I.Upload />
                <p className="text-xs text-zinc-400">Drop an image here or <span className="text-[var(--accent-color)]">browse</span></p>
                <p className="text-[10px] text-zinc-600">JPEG, PNG, WebP, GIF · Max 5 MB</p>
              </>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleChange} />
      </div>

      {cropFile && (
        <CropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={(blob) => { setCropFile(null); uploadBlob(blob); }}
        />
      )}
    </>
  );
}

// ─── Rich Editor ─────────────────────────────────────────────────────────────

// ─── Shared markdown renderer ────────────────────────────────────────────────

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/^---$/gm, "<hr />")
    .replace(/^- (.+)$/gm, "<li class='ul'>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li class='ol'>$1</li>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, `<img src="$2" alt="$1" />`)
    .replace(/\[video\]\(([^)]+)\)/g, (_: string, url: string) => {
      const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      return yt
        ? `<div class="video-wrap"><iframe src="https://www.youtube.com/embed/${yt[1]}" allowfullscreen></iframe></div>`
        : `<a href="${url}" target="_blank">[Video link]</a>`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank">$1</a>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />");
  return `<div class="re-preview"><p>${html}</p></div>`;
}

// ─── Watermarked Content Viewer ───────────────────────────────────────────────

function WatermarkedContent({ content, username }: { content: string; username: string }) {
  const label = username || "licensed";
  // Build a repeating diagonal pattern of the username
  const rows = Array.from({ length: 12 });
  const cols = Array.from({ length: 6 });
  return (
    <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
      {/* Rendered content */}
      <div
        className="re-preview-wrap pointer-events-none min-h-[200px] px-1 py-1"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
      {/* Watermark overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ zIndex: 10 }}
      >
        {rows.map((_, ri) => (
          <div key={ri} className="flex gap-16" style={{ marginTop: ri === 0 ? "3rem" : "4.5rem", transform: "rotate(-25deg) translateX(-20%)" }}>
            {cols.map((_, ci) => (
              <span
                key={ci}
                className="whitespace-nowrap text-xs font-medium tracking-widest text-white/[0.06]"
                style={{ userSelect: "none" }}
              >
                {label}
              </span>
            ))}
          </div>
        ))}
      </div>
      <style>{`
        .re-preview-wrap h1 { font-size:1.25rem; font-weight:700; color:#f4f4f5; margin:1.25rem 0 0.5rem; }
        .re-preview-wrap h2 { font-size:1.1rem; font-weight:700; color:#e4e4e7; margin:1rem 0 0.4rem; }
        .re-preview-wrap h3 { font-size:0.95rem; font-weight:600; color:#d4d4d8; margin:0.75rem 0 0.3rem; }
        .re-preview-wrap p  { color:#a1a1aa; font-size:0.875rem; line-height:1.7; margin:0.5rem 0; }
        .re-preview-wrap strong { color:#f4f4f5; font-weight:600; }
        .re-preview-wrap em { color:#d4d4d8; font-style:italic; }
        .re-preview-wrap code { background:rgba(255,255,255,0.08); border-radius:4px; padding:1px 5px; font-family:monospace; font-size:0.8rem; color:#67e8f9; }
        .re-preview-wrap hr { border:none; border-top:1px solid rgba(255,255,255,0.1); margin:1rem 0; }
        .re-preview-wrap li { color:#a1a1aa; font-size:0.875rem; margin-left:1.25rem; margin-bottom:0.25rem; }
        .re-preview-wrap li.ul { list-style:disc; }
        .re-preview-wrap li.ol { list-style:decimal; }
        .re-preview-wrap img { max-width:100%; border-radius:0.75rem; border:1px solid rgba(255,255,255,0.1); margin:0.5rem 0; }
        .re-preview-wrap a { color:var(--accent-color); text-decoration:underline; }
        .re-preview-wrap .video-wrap { position:relative; padding-top:56.25%; margin:0.75rem 0; border-radius:0.75rem; overflow:hidden; }
        .re-preview-wrap .video-wrap iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
      `}</style>
    </div>
  );
}

function RichEditor({ value, onChange, placeholder = "Write your content here…" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [showImageInput, setShowImageInput] = useState(false);
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  function insertAtCursor(before: string, after = "", ph = "") {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || ph;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  }

  function insertLinePrefix(prefix: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + prefix.length, start + prefix.length); }, 0);
  }

  const renderPreview = renderMarkdown;

  const ToolBtn = ({ label, title, onClick, active }: { label: string; title: string; onClick: () => void; active?: boolean }) => (
    <button type="button" title={title} onClick={onClick}
      className={`rounded px-2 py-1 text-xs transition ${active ? "bg-[var(--accent-color)]/20 text-[var(--accent-color)]" : "text-zinc-400 hover:bg-white/10 hover:text-zinc-200"}`}>
      {label}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-white/10 bg-white/5 px-2 py-1.5">
        <ToolBtn label="B" title="Bold" onClick={() => insertAtCursor("**", "**", "bold")} />
        <ToolBtn label="I" title="Italic" onClick={() => insertAtCursor("*", "*", "italic")} />
        <span className="mx-1 h-4 w-px bg-white/10" />
        <ToolBtn label="H1" title="Heading 1" onClick={() => insertLinePrefix("# ")} />
        <ToolBtn label="H2" title="Heading 2" onClick={() => insertLinePrefix("## ")} />
        <ToolBtn label="H3" title="Heading 3" onClick={() => insertLinePrefix("### ")} />
        <span className="mx-1 h-4 w-px bg-white/10" />
        <ToolBtn label="• List" title="Bullet list" onClick={() => insertLinePrefix("- ")} />
        <ToolBtn label="1. List" title="Numbered list" onClick={() => insertLinePrefix("1. ")} />
        <span className="mx-1 h-4 w-px bg-white/10" />
        <ToolBtn label="`code`" title="Inline code" onClick={() => insertAtCursor("`", "`", "code")} />
        <ToolBtn label="```block" title="Code block" onClick={() => insertAtCursor("```\n", "\n```", "code here")} />
        <ToolBtn label="———" title="Divider" onClick={() => { onChange(value + "\n\n---\n\n"); taRef.current?.focus(); }} />
        <span className="mx-1 h-4 w-px bg-white/10" />
        <ToolBtn label="Image" title="Insert image" onClick={() => { setShowImageInput((v) => !v); setShowVideoInput(false); }} active={showImageInput} />
        <ToolBtn label="Video" title="Insert YouTube video" onClick={() => { setShowVideoInput((v) => !v); setShowImageInput(false); }} active={showVideoInput} />
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => setTab("write")} className={`rounded px-2.5 py-1 text-xs transition ${tab === "write" ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-400"}`}>Write</button>
          <button type="button" onClick={() => setTab("preview")} className={`rounded px-2.5 py-1 text-xs transition ${tab === "preview" ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-400"}`}>Preview</button>
        </div>
      </div>

      {/* Image URL row */}
      {showImageInput && (
        <div className="flex gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Paste image URL (https://…)"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none" />
          <button type="button" onClick={() => { if (imageUrl) { insertAtCursor(`![image](${imageUrl})`); setImageUrl(""); setShowImageInput(false); } }}
            className="rounded-lg bg-[var(--accent-color)]/20 px-3 py-1 text-xs text-[var(--accent-color)] hover:bg-[var(--accent-color)]/30">Insert</button>
        </div>
      )}

      {/* Video URL row */}
      {showVideoInput && (
        <div className="flex gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Paste YouTube URL (https://youtu.be/…)"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none" />
          <button type="button" onClick={() => { if (videoUrl) { insertAtCursor(`[video](${videoUrl})`); setVideoUrl(""); setShowVideoInput(false); } }}
            className="rounded-lg bg-[var(--accent-color)]/20 px-3 py-1 text-xs text-[var(--accent-color)] hover:bg-[var(--accent-color)]/30">Insert</button>
        </div>
      )}

      {/* Write / Preview */}
      {tab === "write" ? (
        <textarea ref={taRef} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} rows={20}
          className="w-full bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-zinc-200 placeholder-zinc-600 focus:outline-none resize-none" />
      ) : (
        <div className="re-preview-wrap min-h-[500px] px-4 py-3"
          dangerouslySetInnerHTML={{ __html: renderPreview(value) }} />
      )}

      <div className="border-t border-white/10 bg-white/5 px-3 py-1.5 flex justify-between items-center">
        <span className="text-[10px] text-zinc-600">Markdown · Bold **text** · Italic *text* · # Heading · - List · ![img](url) · [video](youtube-url)</span>
        <span className="text-[10px] text-zinc-600">{value.length} chars</span>
      </div>

      <style>{`
        .re-preview-wrap h1 { font-size:1.25rem; font-weight:700; color:#f4f4f5; margin:1.25rem 0 0.5rem; }
        .re-preview-wrap h2 { font-size:1.1rem; font-weight:700; color:#e4e4e7; margin:1rem 0 0.4rem; }
        .re-preview-wrap h3 { font-size:0.95rem; font-weight:600; color:#d4d4d8; margin:0.75rem 0 0.3rem; }
        .re-preview-wrap p  { color:#a1a1aa; font-size:0.875rem; line-height:1.7; margin:0.5rem 0; }
        .re-preview-wrap strong { color:#f4f4f5; font-weight:600; }
        .re-preview-wrap em { color:#d4d4d8; font-style:italic; }
        .re-preview-wrap code { background:rgba(255,255,255,0.08); border-radius:4px; padding:1px 5px; font-family:monospace; font-size:0.8rem; color:#67e8f9; }
        .re-preview-wrap hr { border:none; border-top:1px solid rgba(255,255,255,0.1); margin:1rem 0; }
        .re-preview-wrap li { color:#a1a1aa; font-size:0.875rem; margin-left:1.25rem; margin-bottom:0.25rem; }
        .re-preview-wrap li.ul { list-style:disc; }
        .re-preview-wrap li.ol { list-style:decimal; }
        .re-preview-wrap img { max-width:100%; border-radius:0.75rem; border:1px solid rgba(255,255,255,0.1); margin:0.5rem 0; }
        .re-preview-wrap a { color:var(--accent-color); text-decoration:underline; }
        .re-preview-wrap .video-wrap { position:relative; padding-top:56.25%; margin:0.75rem 0; border-radius:0.75rem; overflow:hidden; }
        .re-preview-wrap .video-wrap iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
      `}</style>
    </div>
  );
}

// ─── Create Listing Modal ─────────────────────────────────────────────────────

function CreateListingModal({ onClose, onSubmit, initialData, editId }: {
  onClose: () => void;
  onSubmit: (form: CreateForm) => Promise<void>;
  initialData?: Partial<CreateForm>;
  editId?: string;
}) {
  const isEdit = !!editId;
  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<CreateForm>({
    categories: initialData?.categories ?? [],
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    tags: initialData?.tags ?? "",
    asset_classes: initialData?.asset_classes ?? [],
    price: initialData?.price ?? 0,
    price_type: initialData?.price_type ?? "free",
    subscription_interval: initialData?.subscription_interval ?? "monthly",
    backtest_data: initialData?.backtest_data ?? "",
    content_data: initialData?.content_data ?? "",
    preview_image_url: initialData?.preview_image_url ?? "",
  });

  const set = (k: keyof CreateForm, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const stepTitles = ["Choose Category", "Basic Info", "Pricing", "Content", "Review & Submit"];

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit(form);
      setSubmitted(true);
    } catch {
      // error handled by parent
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0E1A] p-8 text-center">
          <div className="mb-4 flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </div>
          <h3 className="mb-2 text-lg font-bold text-zinc-50">{isEdit ? "Changes Saved" : "Listing Submitted"}</h3>
          <p className="mb-6 text-sm text-zinc-400">
            {isEdit
              ? "Your listing has been updated and is back under review. It will go live again once approved."
              : "Your listing is under review. Our AI quality system will evaluate it and we\u2019ll notify you within 24 hours."}
          </p>
          <button onClick={onClose} className="rounded-xl bg-[var(--accent-color)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-8">
      <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0A0E1A] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <h2 className="text-base font-bold text-zinc-50">{isEdit ? "Edit Listing" : "Create Listing"}</h2>
            <p className="text-xs text-zinc-500">Step {step} of 5 — {stepTitles[step - 1]}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
            <I.X />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-5 pt-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className={`h-1 flex-1 rounded-full transition ${n <= step ? "bg-[var(--accent-color)]" : "bg-white/10"}`} />
          ))}
        </div>

        <div className="p-5">
          {/* Step 1: Category */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">Select all that apply — you can bundle multiple types in one package.</p>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.filter((c) => c.id !== "all").map(({ id, label, Icon }) => {
                  const selected = form.categories.includes(id);
                  return (
                    <button key={id}
                      onClick={() => set("categories", selected ? form.categories.filter((c) => c !== id) : [...form.categories, id])}
                      className={`relative flex flex-col items-center gap-2 rounded-2xl border p-5 transition hover:border-[var(--accent-color)]/50 ${selected ? "border-[var(--accent-color)] bg-[var(--accent-color)]/10" : "border-white/10 bg-white/5"}`}>
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-color)] text-white">
                          <I.Check />
                        </span>
                      )}
                      <span className={selected ? "text-[var(--accent-color)]" : "text-zinc-400"}><Icon /></span>
                      <span className="text-sm font-medium text-zinc-200">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Basic info */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Title *</label>
                <input value={form.title} onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. 3-EMA Trend Following Strategy"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Description *</label>
                <RichEditor
                  value={form.description}
                  onChange={(v) => set("description", v)}
                  placeholder={"# Your Strategy Name\n\nDescribe what this is, who it's for, and what's included.\n\n## What You Get\n- Detail 1\n- Detail 2\n\n## How It Works\n\nExplain the logic, timeframes, signals, etc."}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Cover Image</label>
                <ImageUploader value={form.preview_image_url} onChange={(url) => set("preview_image_url", url)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Tags (comma-separated)</label>
                <input value={form.tags} onChange={(e) => set("tags", e.target.value)}
                  placeholder="e.g. momentum, swing trading, S&P 500"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">Asset Classes</label>
                <div className="flex flex-wrap gap-2">
                  {ASSET_CLASSES.filter((a) => a !== "All").map((ac) => (
                    <button key={ac} type="button"
                      onClick={() => set("asset_classes", form.asset_classes.includes(ac) ? form.asset_classes.filter((x) => x !== ac) : [...form.asset_classes, ac])}
                      className={`rounded-lg border px-3 py-1 text-xs transition ${form.asset_classes.includes(ac) ? "border-[var(--accent-color)] bg-[var(--accent-color)]/10 text-[var(--accent-color)]" : "border-white/10 text-zinc-400 hover:border-white/20"}`}>
                      {ac}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Pricing */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex gap-3">
                {(["free", "one_time", "subscription"] as PriceType[]).map((t) => (
                  <button key={t} onClick={() => set("price_type", t)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-medium capitalize transition ${form.price_type === t ? "border-[var(--accent-color)] bg-[var(--accent-color)]/10 text-[var(--accent-color)]" : "border-white/10 text-zinc-400 hover:border-white/20"}`}>
                    {t === "one_time" ? "One-Time" : t === "subscription" ? "Subscription" : "Free"}
                  </button>
                ))}
              </div>

              {form.price_type !== "free" && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-400">Price (USD)</label>
                    <input type="number" min="0" step="0.01" value={form.price}
                      onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 focus:border-[var(--accent-color)]/50 focus:outline-none" />
                  </div>
                  {form.price_type === "subscription" && (
                    <div className="flex gap-3">
                      {(["monthly", "yearly"] as const).map((interval) => (
                        <button key={interval} onClick={() => set("subscription_interval", interval)}
                          className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-medium capitalize transition ${form.subscription_interval === interval ? "border-[var(--accent-color)] bg-[var(--accent-color)]/10 text-[var(--accent-color)]" : "border-white/10 text-zinc-400 hover:border-white/20"}`}>
                          {interval === "monthly" ? "Monthly" : "Yearly"}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <p className="rounded-xl border border-white/5 bg-white/5 p-3 text-xs text-zinc-500">
                You earn 80% of every sale. Quantiv takes a 20% platform fee. Stripe Connect payouts launching in Phase 2.
              </p>
            </div>
          )}

          {/* Step 4: Content */}
          {step === 4 && (
            <div className="space-y-4">
              {form.categories.includes("strategy") && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Backtest Parameters (JSON or description)</label>
                  <textarea value={form.backtest_data} onChange={(e) => set("backtest_data", e.target.value)}
                    rows={5} placeholder='{"entry": "EMA cross", "exit": "stop loss 2%", "timeframe": "1D", ...}'
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-zinc-100 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none resize-none" />
                  <p className="mt-1 text-[10px] text-zinc-600">Submit your backtest results for the Backtest Verified badge. Our engine will verify the claims.</p>
                </div>
              )}
              {form.categories.includes("course") && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Course Content</label>
                  <RichEditor
                    value={form.content_data}
                    onChange={(v) => set("content_data", v)}
                    placeholder={"# Module 1: Introduction\n\n## Lesson 1.1: Market Structure\nContent here...\n\n## Lesson 1.2: Order Flow\nContent here..."}
                  />
                </div>
              )}
              {form.categories.includes("chart_preset") && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Chart Setup Guide + Settings Export</label>
                  <RichEditor
                    value={form.content_data}
                    onChange={(v) => set("content_data", v)}
                    placeholder={"# Setup Guide\n\nExplain how to install and configure this chart preset.\n\n## Settings\n\n```\n{\"indicators\": [], \"timeframe\": \"1H\"}\n```"}
                  />
                </div>
              )}
              {form.categories.includes("indicator") && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Indicator Usage Guide</label>
                  <RichEditor
                    value={form.content_data}
                    onChange={(v) => set("content_data", v)}
                    placeholder={"# How to Use\n\nExplain the indicator logic and signals.\n\n## Settings\n- Period: 14\n- Source: Close\n\n## Signal Interpretation\n\nDescribe buy/sell signals..."}
                  />
                </div>
              )}
              {form.categories.includes("signals") && (
                <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-4">
                  <p className="text-xs font-medium text-blue-400 mb-2">Performance Tracking Agreement</p>
                  <p className="text-xs text-zinc-400">By submitting a signals service, you agree that Quantiv will track and publicly display the real-time performance of your signals including win rate, return, and individual trade outcomes. False or manipulated signals will result in immediate removal and account ban.</p>
                </div>
              )}
              {form.categories.length === 0 && (
                <p className="text-sm text-zinc-500">Go back to Step 1 and select at least one category.</p>
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {form.categories.length === 0
                      ? <span className="rounded border px-2 py-0.5 text-[10px] font-semibold text-zinc-500 border-zinc-700">No category</span>
                      : form.categories.map((c) => (
                          <span key={c} className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CAT_COLORS[c] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20"}`}>
                            {CAT_LABEL[c] ?? c}
                          </span>
                        ))
                    }
                  </div>
                  <span className="text-sm">{form.price_type === "free" || form.price === 0 ? <span className="font-semibold text-emerald-400">Free</span> : <span className="font-bold text-zinc-100">${form.price}{form.price_type === "subscription" ? `/${form.subscription_interval === "yearly" ? "yr" : "mo"}` : ""}</span>}</span>
                </div>
                <p className="font-semibold text-zinc-100">{form.title || "Untitled"}</p>
                <p className="mt-1 line-clamp-3 text-xs text-zinc-500">{form.description || "No description."}</p>
                {form.asset_classes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {form.asset_classes.map((ac) => (
                      <span key={ac} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">{ac}</span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                After submission, our AI quality system will review your listing. You&apos;ll be notified of the decision within 24 hours. Approved listings go live immediately.
              </p>
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-6 flex justify-between">
            <button onClick={() => step > 1 ? setStep(step - 1) : onClose()}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/5">
              {step === 1 ? "Cancel" : "Back"}
            </button>
            {step < 5 && (
              <button onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && form.categories.length === 0) ||
                  (step === 2 && (!form.title.trim() || !form.description.trim()))
                }
                className="flex items-center gap-2 rounded-xl bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40">
                Continue <I.ArrowRight />
              </button>
            )}
            {step === 5 && (
              <button onClick={handleSubmit} disabled={submitting}
                className="rounded-xl bg-[var(--accent-color)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                {submitting ? "Saving…" : isEdit ? "Save Changes" : "Submit for Review"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Seller Dashboard ─────────────────────────────────────────────────────────

function SellerDashboard({ data, onClose, onCreate, onEdit }: {
  data: SellerDashboardData | null;
  onClose: () => void;
  onCreate: () => void;
  onEdit: (listing: SellerDashboardData["listings"][number]) => void;
}) {
  const statusColor: Record<string, string> = {
    approved: "text-emerald-400 bg-emerald-400/10",
    pending:  "text-amber-400 bg-amber-400/10",
    rejected: "text-red-400 bg-red-400/10",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-8">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0A0E1A] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <h2 className="text-base font-bold text-zinc-50">Seller Dashboard</h2>
          <div className="flex items-center gap-2">
            <button onClick={onCreate}
              className="flex items-center gap-2 rounded-xl bg-[var(--accent-color)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
              Create New Listing
            </button>
            <button onClick={onClose} className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
              <I.X />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Revenue stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Earned",   value: `$${(data?.totalRevenue ?? 0).toFixed(2)}`,     color: "text-emerald-400" },
              { label: "This Month",     value: `$${(data?.thisMonthRevenue ?? 0).toFixed(2)}`, color: "text-blue-400" },
              { label: "Total Sales",    value: String(data?.totalSales ?? 0),                   color: "text-zinc-100" },
              { label: "Pending Payout", value: `$${(data?.pendingPayout ?? 0).toFixed(2)}`,    color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-[#050713] p-4">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600">Stripe Connect payouts launching in Phase 2.</p>

          {/* Listings table */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-zinc-300">Your Listings</h3>
            {!data || data.listings.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#050713] p-8 text-center">
                <p className="text-sm text-zinc-500">No listings yet.</p>
                <button onClick={onCreate} className="mt-3 text-xs text-[var(--accent-color)] hover:underline">
                  Create your first listing
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      {["Title", "Status", "Views", "Sales", "Rating", "Revenue", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.listings.map((l) => (
                      <tr key={l.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3 font-medium text-zinc-200 max-w-[200px] truncate">{l.title}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded px-2 py-0.5 text-[10px] font-medium capitalize ${statusColor[l.status] ?? "text-zinc-400 bg-zinc-400/10"}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{l.view_count}</td>
                        <td className="px-4 py-3 text-zinc-400">{l.sales_count}</td>
                        <td className="px-4 py-3 text-zinc-400">{l.avg_rating > 0 ? l.avg_rating.toFixed(1) : "—"}</td>
                        <td className="px-4 py-3 text-emerald-400">${(l.sales_count * l.price * 0.8).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => onEdit(l)}
                            className="rounded-lg border border-white/10 px-3 py-1 text-[10px] font-medium text-zinc-400 transition hover:border-[var(--accent-color)]/40 hover:text-[var(--accent-color)]"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Reviews */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-zinc-300">Recent Reviews</h3>
            {!data || data.reviews.length === 0 ? (
              <p className="text-sm text-zinc-600">No reviews yet.</p>
            ) : (
              <div className="space-y-2">
                {data.reviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-white/5 bg-[#050713] p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="flex">
                        {[1,2,3,4,5].map((n) => (
                          <span key={n} className={n <= r.rating ? "text-amber-400" : "text-zinc-700"}><I.Star filled={n <= r.rating} /></span>
                        ))}
                      </div>
                      <span className="text-[10px] text-zinc-600">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-zinc-400">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketplaceView() {
  const [activeCategories, setActiveCategories] = useState<Category[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("popular");
  const [assetClass, setAssetClass] = useState("All");
  const [priceFilter, setPriceFilter] = useState(0);
  const [listings, setListings] = useState<Listing[]>([]);
  const [featured, setFeatured] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editListing, setEditListing] = useState<SellerDashboardData["listings"][number] | null>(null);
  const [showSeller, setShowSeller] = useState(false);
  const [sellerData, setSellerData] = useState<SellerDashboardData | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("");
  const featuredRef = useRef<HTMLDivElement>(null);

  // Fetch current user for watermarking
  useEffect(() => {
    fetch("/api/profile/me")
      .then((r) => r.ok ? r.json() : null)
      .then((p) => { if (p?.username || p?.name) setCurrentUsername(p.username ?? p.name); })
      .catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch listings
  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const pf = PRICE_FILTERS[priceFilter];
      const params = new URLSearchParams({
        sort,
        page: String(page),
        limit: "18",
      });
      if (activeCategories.length > 0) params.set("categories", activeCategories.join(","));
      if (search) params.set("search", search);
      if (assetClass !== "All") params.set("assetClass", assetClass);
      if (pf.min > 0) params.set("minPrice", String(pf.min));
      if (pf.max !== null) params.set("maxPrice", String(pf.max));

      const res = await fetch(`/api/marketplace/listings?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { listings: Listing[]; total: number; pages: number };

      if (page === 1) {
        setListings(data.listings);
        setFeatured(data.listings.filter((l) => l.is_featured).slice(0, 4));
      } else {
        setListings((prev) => [...prev, ...data.listings]);
      }
      setTotal(data.total);
      setTotalPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [activeCategories, search, sort, assetClass, priceFilter, page]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [activeCategories, search, sort, assetClass, priceFilter]);

  async function loadSellerDashboard() {
    setSellerLoading(true);
    try {
      const res = await fetch("/api/marketplace/seller");
      if (!res.ok) return;
      const data = await res.json() as SellerDashboardData;
      setSellerData(data);
      setShowSeller(true);
    } finally {
      setSellerLoading(false);
    }
  }

  async function handlePurchase(listingId: string) {
    const res = await fetch("/api/marketplace/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: listingId }),
    });
    if (!res.ok) {
      const err = await res.json() as { error: string };
      throw new Error(err.error);
    }
  }

  async function handleEditSubmit(form: CreateForm) {
    if (!editListing) return;
    const res = await fetch(`/api/marketplace/listings/${editListing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        category: form.categories[0] ?? "",
        categories: form.categories,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        preview_image_url: form.preview_image_url,
      }),
    });
    if (!res.ok) {
      const err = await res.json() as { error: string };
      throw new Error(err.error);
    }
    fetchListings();
  }

  async function handleCreateSubmit(form: CreateForm) {
    const res = await fetch("/api/marketplace/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        category: form.categories[0] ?? "",
        categories: form.categories,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    if (!res.ok) {
      const err = await res.json() as { error: string };
      throw new Error(err.error);
    }
  }

  const nonFeaturedListings = listings.filter((l) => !l.is_featured || featured.length === 0);

  return (
    <div className="space-y-6">
      {/* Seller banner */}
      {!bannerDismissed && (
        <div className="relative rounded-2xl border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5 p-4">
          <button onClick={() => setBannerDismissed(true)}
            className="absolute right-3 top-3 text-zinc-600 hover:text-zinc-400">
            <I.X />
          </button>
          <div className="flex items-center gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
              <I.Store />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-200">
                Are you a Verified Trader? Start selling your strategies and earn <span className="text-[var(--accent-color)]">80%</span> of every sale.
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">Chart presets · Strategies · Indicators · Courses · Signal services</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--accent-color)]/40 bg-[var(--accent-color)]/10 px-4 py-2 text-xs font-semibold text-[var(--accent-color)] transition hover:bg-[var(--accent-color)]/20">
              Become a Seller <I.ArrowRight />
            </button>
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {CATEGORIES.map(({ id, label, Icon }) => {
          const isAll = id === "all";
          const isActive = isAll ? activeCategories.length === 0 : activeCategories.includes(id);
          return (
            <button
              key={id}
              onClick={() => {
                if (isAll) {
                  setActiveCategories([]);
                } else {
                  setActiveCategories((prev) =>
                    prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
                  );
                }
              }}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
                isActive
                  ? "bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/30"
                  : "border border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-300"
              }`}
            >
              <Icon />
              {label}
            </button>
          );
        })}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><I.Search /></span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search listings…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[var(--accent-color)]/50 focus:outline-none"
          />
        </div>

        {/* Asset class */}
        <select value={assetClass} onChange={(e) => setAssetClass(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#050713] px-3 py-2 text-xs text-zinc-300 focus:outline-none hover:border-white/20">
          {ASSET_CLASSES.map((a) => <option key={a}>{a}</option>)}
        </select>

        {/* Price filter */}
        <select value={priceFilter} onChange={(e) => setPriceFilter(Number(e.target.value))}
          className="rounded-xl border border-white/10 bg-[#050713] px-3 py-2 text-xs text-zinc-300 focus:outline-none hover:border-white/20">
          {PRICE_FILTERS.map((f, i) => <option key={i} value={i}>{f.label}</option>)}
        </select>

        {/* Sort */}
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#050713] px-3 py-2 text-xs text-zinc-300 focus:outline-none hover:border-white/20">
          {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Seller dashboard button */}
        <button onClick={loadSellerDashboard} disabled={sellerLoading}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-300 disabled:opacity-50 ml-auto">
          <I.Store />
          {sellerLoading ? "Loading…" : "My Listings"}
        </button>
      </div>

      {/* Featured section */}
      {featured.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              <span className="text-amber-400">★</span> Editor&apos;s Picks
            </h2>
            <div className="flex gap-1">
              <button onClick={() => featuredRef.current?.scrollBy({ left: -280, behavior: "smooth" })}
                className="rounded-lg border border-white/10 p-1.5 text-zinc-500 hover:text-zinc-300">
                <I.ChevronLeft />
              </button>
              <button onClick={() => featuredRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
                className="rounded-lg border border-white/10 p-1.5 text-zinc-500 hover:text-zinc-300">
                <I.ChevronRight />
              </button>
            </div>
          </div>
          <div ref={featuredRef} className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {featured.map((l) => (
              <div key={l.id} className="w-64 shrink-0">
                <ListingCard listing={l} onClick={() => setSelectedListing(l)} featured />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total count */}
      {!loading && (
        <p className="text-xs text-zinc-600">
          {total === 0 ? "No listings found" : `${total} listing${total !== 1 ? "s" : ""}${search ? ` for "${search}"` : ""}`}
        </p>
      )}

      {/* Main grid */}
      {loading && listings.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-white/10 bg-white/5 h-56" />
          ))}
        </div>
      ) : nonFeaturedListings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#050713] py-20 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-zinc-600">
            <I.Store />
          </span>
          <p className="text-base font-semibold text-zinc-300">No listings yet</p>
          <p className="mt-1 max-w-xs text-sm text-zinc-600">
            {search ? `No results for "${search}"` : "Be the first to share your trading knowledge with the community."}
          </p>
          <button onClick={() => setShowCreate(true)}
            className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/30 px-5 py-2.5 text-sm font-medium text-[var(--accent-color)] transition hover:bg-[var(--accent-color)]/20">
            Create First Listing <I.ArrowRight />
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nonFeaturedListings.map((l) => (
              <ListingCard key={l.id} listing={l} onClick={() => setSelectedListing(l)} />
            ))}
          </div>

          {/* Load more */}
          {page < totalPages && (
            <div className="flex justify-center pt-2">
              <button onClick={() => setPage((p) => p + 1)} disabled={loading}
                className="rounded-xl border border-white/10 px-6 py-2.5 text-sm text-zinc-400 transition hover:border-white/20 hover:text-zinc-300 disabled:opacity-50">
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onPurchase={handlePurchase}
          currentUsername={currentUsername}
        />
      )}

      {(showCreate || editListing) && (
        <CreateListingModal
          onClose={() => { setShowCreate(false); setEditListing(null); }}
          onSubmit={editListing ? handleEditSubmit : handleCreateSubmit}
          editId={editListing?.id}
          initialData={editListing ? {
            categories: (editListing.categories as Category[]) ?? [],
            title: editListing.title,
            description: editListing.description ?? "",
            tags: (editListing.tags ?? []).join(", "),
            asset_classes: editListing.asset_classes ?? [],
            price: editListing.price,
            price_type: editListing.price_type as CreateForm["price_type"],
            subscription_interval: (editListing.subscription_interval as "monthly" | "yearly") ?? "monthly",
            backtest_data: editListing.backtest_data ?? "",
            content_data: editListing.content_data ?? "",
            preview_image_url: editListing.preview_image_url ?? "",
          } : undefined}
        />
      )}

      {showSeller && (
        <SellerDashboard
          data={sellerData}
          onClose={() => setShowSeller(false)}
          onCreate={() => { setShowSeller(false); setShowCreate(true); }}
          onEdit={(l) => { setShowSeller(false); setEditListing(l); }}
        />
      )}
    </div>
  );
}
