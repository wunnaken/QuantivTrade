"use client";
import dynamic from "next/dynamic";

const JournalView = dynamic(() => import("./JournalView"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4 p-6">
      <div className="skeleton h-10 w-48 rounded-lg" />
      <div className="grid grid-cols-3 gap-4">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
      </div>
      <div className="skeleton h-64 rounded-2xl" />
      <div className="skeleton h-48 rounded-2xl" />
    </div>
  ),
});

export default function JournalPage() {
  return <JournalView />;
}
