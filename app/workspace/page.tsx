"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getWorkspaceRedirectPath } from "../../lib/workspace-tab";

export default function WorkspaceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const path = getWorkspaceRedirectPath();
    router.replace(path);
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-[#0A0E1A]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-color)] border-t-transparent" aria-hidden />
      <span className="sr-only">Loading workspace…</span>
    </div>
  );
}
