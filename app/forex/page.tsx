"use client";
import dynamic from "next/dynamic";

const ForexView = dynamic(() => import("./ForexView"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-20 rounded-2xl bg-white/5" />
      <div className="h-36 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div className="h-64 rounded-2xl bg-white/5" />
          <div className="h-96 rounded-2xl bg-white/5" />
        </div>
        <div className="space-y-4">
          <div className="h-48 rounded-2xl bg-white/5" />
          <div className="h-48 rounded-2xl bg-white/5" />
        </div>
      </div>
    </div>
  ),
});

export default function ForexPage() {
  return <ForexView />;
}
