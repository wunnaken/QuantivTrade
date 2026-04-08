"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../components/AuthContext";
import { QuantivTradeLogo } from "../../../components/XchangeLogo";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

export default function SignUpPage() {
  const { signUp, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  async function handleOAuth(provider: "google" | "apple") {
    setError(null);
    setOauthLoading(provider);
    try {
      if (provider === "google") await signInWithGoogle();
      else await signInWithApple();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("OAuth sign-in failed. Please try again.");
      setOauthLoading(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUp({ name, email, password });
      router.push("/auth/setup-profile");
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen app-page font-[&quot;Times_New_Roman&quot;,serif]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <header className="absolute left-6 top-6">
          <QuantivTradeLogo />
        </header>
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-zinc-50">
            Create your QuantivTrade account
          </h1>
          <p className="mt-2 text-xs text-zinc-400">
            Join communities, follow ideas, and save your own playbook.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-white/10 bg-[var(--app-card-alt)] p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)]"
        >
          <p className="mb-1 flex items-center gap-1.5 text-[10px] text-zinc-500">
            <svg className="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c-1.105 0-2 .895-2 2v2a2 2 0 104 0v-2c0-1.105-.895-2-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 11V9a6 6 0 1112 0v2m-1 8H7a2 2 0 01-2-2v-6a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2z" />
            </svg>
            <span>Your details stay private to this account. We never share your email.</span>
          </p>
          <div className="space-y-1 text-xs">
            <label className="block text-zinc-300" htmlFor="name">
              Display name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-[var(--accent-color)]/70"
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="block text-zinc-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-[var(--accent-color)]/70"
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="block text-zinc-300" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 pr-10 text-xs text-zinc-100 outline-none focus:border-[var(--accent-color)]/70"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]/50"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-amber-300" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !!oauthLoading}
            className="mt-2 w-full rounded-full px-4 py-2 text-xs font-semibold text-[#020308] shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          style={{ backgroundColor: "var(--accent-color)", boxShadow: "0 10px 15px -3px color-mix(in srgb, var(--accent-color) 40%, transparent)" }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] text-zinc-500">or</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={loading || !!oauthLoading}
              onClick={() => handleOAuth("google")}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleIcon />
              {oauthLoading === "google" ? "Redirecting..." : "Continue with Google"}
            </button>
          </div>

          <p className="mt-3 text-[11px] text-zinc-400">
            Already have an account?{" "}
            <Link
              href="/auth/sign-in"
              className="font-semibold transition hover:opacity-90"
              style={{ color: "var(--accent-color)" }}
            >
              Sign in
            </Link>
            .
          </p>
        </form>

      </div>
    </div>
  );
}

