"use client";
import dynamic from "next/dynamic";

const TaxesView = dynamic(() => import("./TaxesView"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-48 rounded bg-white/5" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-white/5" />
      <div className="h-64 rounded-xl bg-white/5" />
    </div>
  ),
});

export default function TaxesPage() {
  return <TaxesView />;
}
