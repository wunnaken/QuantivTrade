"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BrokerCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Give a moment then redirect to brokers page
    const t = setTimeout(() => router.replace("/brokers"), 2000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#14B8A6]/20 text-2xl">
        ✓
      </div>
      <h1 className="text-lg font-semibold text-zinc-100">Brokerage connected!</h1>
      <p className="text-sm text-zinc-500">Redirecting you to your broker dashboard…</p>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#14B8A6]" />
    </div>
  );
}
