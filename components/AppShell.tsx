"use client";

import { usePathname } from "next/navigation";
import { Layout } from "./Layout";
import { LandingNavbar } from "./LandingNavbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isIdlePage = pathname === "/idle";
  const isFullPage = pathname.startsWith("/auth") || pathname === "/onboarding" || pathname === "/plans";

  if (isIdlePage) {
    return <>{children}</>;
  }

  if (isLanding) {
    return (
      <div className="min-h-screen app-page font-[&quot;Times_New_Roman&quot;,serif]">
        <LandingNavbar />
        {children}
      </div>
    );
  }

  if (isFullPage) {
    return <>{children}</>;
  }

  return <Layout>{children}</Layout>;
}
