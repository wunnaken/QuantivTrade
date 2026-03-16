"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setAuthCookie, clearAuthCookie } from "../lib/auth-cookie";
import { setEarlyMember } from "../lib/engagement/invite";
import type { RiskProfileKey, User } from "../types";

export type { RiskProfileKey, User };

type AuthContextValue = {
  user: User | null;
  signUp: (params: { name: string; email: string; password: string }) => Promise<void>;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signOut: () => void;
  deleteAccount: () => void;
  updateProfile: (updates: Partial<Pick<User, "name" | "username" | "bio" | "profilePicture" | "bannerImage" | "riskProfile">>) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "xchange-demo-user";
const JUST_SIGNED_IN_KEY = "xchange-just-signed-in";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as User & { password?: string };
        const { password: _pw, ...safeUser } = parsed;
        void _pw;
        setUser(safeUser);
        setAuthCookie({ email: safeUser.email, name: safeUser.name || "Trader" });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async signUp({ name, email, password }) {
        const trimmedEmail = email.trim().toLowerCase();
        const newUser: User = {
          id: trimmedEmail,
          name: name.trim() || "Trader",
          email: trimmedEmail,
          joinedAt: new Date().toISOString(),
        };
        if (typeof window !== "undefined") {
          const pendingRaw = window.localStorage.getItem("xchange-onboarding-pending");
          if (pendingRaw) {
            try {
              const pending = JSON.parse(pendingRaw) as { riskProfile?: "passive" | "moderate" | "aggressive" };
              if (pending.riskProfile) newUser.riskProfile = pending.riskProfile;
              window.localStorage.removeItem("xchange-onboarding-pending");
            } catch {
              // ignore
            }
          }
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...newUser, password })
          );
          setAuthCookie({ email: newUser.email, name: newUser.name || "Trader" });
          setEarlyMember();
        }
        setUser(newUser);
      },
      async signIn({ email, password }) {
        if (typeof window === "undefined") return;
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          throw new Error("No account found in this browser. Sign up first — this demo stores your account only in this browser.");
        }
        try {
          const parsed = JSON.parse(stored) as User & { password?: string };
          if (
            parsed.email.toLowerCase() !== email.trim().toLowerCase() ||
            parsed.password !== password
          ) {
            throw new Error("Incorrect email or password.");
          }
          const { password: _pw, ...safeUser } = parsed;
          void _pw;
          window.sessionStorage.setItem(JUST_SIGNED_IN_KEY, "1");
          setAuthCookie({ email: safeUser.email, name: safeUser.name || "Trader" });
          setUser(safeUser);
        } catch (err) {
          if (err instanceof Error) throw err;
          throw new Error("Unable to sign in. Please try again.");
        }
      },
      signOut() {
        clearAuthCookie();
        setUser(null);
      },
      deleteAccount() {
        if (typeof window === "undefined") return;
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(JUST_SIGNED_IN_KEY);
        window.localStorage.removeItem("xchange-welcomed");
        window.localStorage.removeItem("xchange-briefing-date");
        window.localStorage.removeItem("xchange-briefing-cache");
        clearAuthCookie();
        setUser(null);
      },
      updateProfile(updates) {
        if (typeof window === "undefined" || !user) return;
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        try {
          const parsed = JSON.parse(stored) as User & { password?: string };
          const updated = { ...parsed, ...updates };
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          const { password: _pw, ...safeUser } = updated;
          void _pw;
          setUser(safeUser);
        } catch {
          // ignore
        }
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

