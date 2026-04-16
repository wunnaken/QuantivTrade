"use client";

import { WhatsNewTimeline } from "@/components/WhatsNewTimeline";

export default function WhatsNewPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">What&apos;s New</h1>
        <p className="mt-1.5 text-sm text-zinc-500">A running log of every update, improvement, and fix.</p>
      </div>
      <WhatsNewTimeline />
    </div>
  );
}
