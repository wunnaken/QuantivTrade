"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { XchangeLogo } from "@/components/XchangeLogo";
import { createClient } from "@/lib/supabase/client";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function SetupProfilePage() {
  const { user, updateProfile } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "taken" | "available">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect to sign-in if not logged in
  useEffect(() => {
    if (user === null) return; // still loading
    // If already has username, skip setup
    if (user?.username) router.replace("/feed");
  }, [user, router]);

  // Debounced username availability check
  useEffect(() => {
    const raw = username.trim().toLowerCase();
    if (!USERNAME_RE.test(raw)) { setUsernameStatus("idle"); return; }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", raw)
        .maybeSingle();
      setUsernameStatus(data && data.user_id !== user?.id ? "taken" : "available");
    }, 400);
    return () => clearTimeout(t);
  }, [username, user?.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const name = displayName.trim();
    const handle = username.trim().toLowerCase();

    if (!name) { setError("Display name is required."); return; }
    if (!USERNAME_RE.test(handle)) {
      setError("Username must be 3–20 characters: letters, numbers, and underscores only.");
      return;
    }
    if (usernameStatus === "taken") { setError("That username is already taken."); return; }

    setLoading(true);
    try {
      await updateProfile({ name, username: handle });
      router.push("/feed");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen app-page">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <header className="absolute left-6 top-6">
          <XchangeLogo />
        </header>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-zinc-50">Set up your profile</h1>
          <p className="mt-2 text-xs text-zinc-400">Choose how others will see you on Xchange.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-white/10 bg-[#050713] p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)]"
        >
          {/* Display name */}
          <div className="space-y-1 text-xs">
            <label className="block text-zinc-300" htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              type="text"
              required
              autoFocus
              placeholder="e.g. John Smith"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-[#00C896]/70"
            />
          </div>

          {/* Username */}
          <div className="space-y-1 text-xs">
            <label className="block text-zinc-300" htmlFor="username">Username</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">@</span>
              <input
                id="username"
                type="text"
                required
                placeholder="yourhandle"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                maxLength={20}
                className="w-full rounded-md border border-white/10 bg-black/40 py-2 pl-7 pr-3 text-xs text-zinc-100 outline-none focus:border-[#00C896]/70"
              />
            </div>
            {usernameStatus === "checking" && (
              <p className="text-zinc-500">Checking availability…</p>
            )}
            {usernameStatus === "taken" && (
              <p className="text-amber-400">Username is already taken.</p>
            )}
            {usernameStatus === "available" && (
              <p className="text-emerald-400">Available!</p>
            )}
            <p className="text-zinc-600">3–20 characters. Letters, numbers, and underscores.</p>
          </div>

          {error && <p className="text-[11px] text-amber-300" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={loading || usernameStatus === "taken" || usernameStatus === "checking"}
            className="mt-2 w-full rounded-full px-4 py-2 text-xs font-semibold text-[#020308] shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            style={{ backgroundColor: "#00C896", boxShadow: "0 10px 15px -3px rgba(0,200,150,0.4)" }}
          >
            {loading ? "Saving…" : "Continue to Xchange"}
          </button>
        </form>
      </div>
    </div>
  );
}
