"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfilesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/growth#choose-profile");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-zinc-400">Redirecting to Growth…</p>
    </div>
  );
}
