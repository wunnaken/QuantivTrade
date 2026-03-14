import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen app-page flex flex-col items-center justify-center px-6 font-[&quot;Times_New_Roman&quot;,serif]">
      <h1 className="text-2xl font-semibold text-zinc-50">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-400 text-center max-w-sm">
        This page doesn&apos;t exist or the link may be wrong. In this demo, accounts only exist in the browser where you signed up — use the same browser and tab to sign in.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-[#11c60f] px-6 py-2.5 text-sm font-semibold text-[#020308] hover:bg-[#13e211]"
      >
        Go to home
      </Link>
    </div>
  );
}
