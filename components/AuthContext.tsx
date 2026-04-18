"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setEarlyMember, loadInviteFromDB } from "../lib/engagement/invite";
import { loadXPFromDB } from "../lib/engagement/xp";
import { loadStreaksFromDB } from "../lib/engagement/streaks";
import { loadBubbleIdsFromDB } from "../lib/profile-bubbles";
import { loadBoardsFromDB } from "../lib/whiteboard-storage";
import { loadPredictFromDB } from "../lib/predict";
import { loadDashboardsFromDB } from "../lib/dashboard";
import { loadAIChatFromDB } from "../lib/ai-chat-storage";
import type { User } from "../types";

export type { User };

export type SignInResult =
  | { mfaRequired: true; factorId: string }
  | { mfaRequired: false };

type AuthContextValue = {
  user: User | null;
  authLoading: boolean;
  signUp: (params: { name: string; email: string; password: string }) => Promise<void>;
  signIn: (params: { email: string; password: string }) => Promise<SignInResult>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<User, "name" | "username" | "bio" | "profilePicture" | "bannerImage">>) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type ProfileRow = {
  name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string | null;
  is_verified: boolean | null;
  is_founder: boolean | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
};

function buildUser(authId: string, email: string, row: ProfileRow | null): User {
  return {
    id: authId,
    email,
    name: row?.name ?? "Trader",
    username: row?.username ?? undefined,
    bio: row?.bio ?? undefined,
    profilePicture: row?.avatar_url ?? undefined,
    joinedAt: row?.created_at ?? new Date().toISOString(),
    isVerified: row?.is_verified ?? false,
    isFounder: row?.is_founder ?? false,
    subscription_tier: (row?.subscription_tier as User["subscription_tier"]) ?? "free",
    subscription_status: row?.subscription_status ?? "free",
    stripe_customer_id: row?.stripe_customer_id ?? undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Use server-side /api/auth/me to initialize user — browser Supabase client
    // calls can hang, so we read the session from cookies via the server.
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then(({ user: serverUser }) => {
        if (serverUser) {
          const u = serverUser as User;
          setUser(u);
          // Auto-upgrade to elite if user unlocked via access code
          try {
            if (typeof window !== "undefined" && localStorage.getItem("quantivtrade-access-elite") === "1" && u.subscription_tier !== "elite") {
              fetch("/api/access/upgrade", { method: "POST" }).then(r => {
                if (r.ok) {
                  localStorage.removeItem("quantivtrade-access-elite");
                  setUser(prev => prev ? { ...prev, subscription_tier: "elite", isVerified: true } : prev);
                }
              }).catch(() => {});
            }
          } catch {}
          Promise.all([
            loadXPFromDB(),
            loadStreaksFromDB(),
            loadInviteFromDB(),
            loadBubbleIdsFromDB(),
            loadBoardsFromDB(),
            loadPredictFromDB(),
            loadDashboardsFromDB(),
            loadAIChatFromDB(),
          ]).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));

    // Still listen for sign-out events from the browser client
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => { subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authLoading,

      async signUp({ name, email, password }) {
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedName = name.trim() || "Trader";

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { name: trimmedName } },
        });
        if (error) throw new Error(error.message);

        const userId = data.user?.id;
        if (!userId) throw new Error("Sign up failed. Please try again.");

        await supabase.from("profiles").upsert(
          {
            user_id: userId,
            email: trimmedEmail,
            name: trimmedName,
          },
          { onConflict: "user_id" }
        );

        setEarlyMember();
      },

      async signIn({ email, password }): Promise<SignInResult> {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw new Error(error.message);

        // Check whether the account has an active TOTP factor requiring aal2
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const totp = factors?.totp?.find((f) => f.status === "verified");
          if (totp) return { mfaRequired: true, factorId: totp.id };
        }
        return { mfaRequired: false };
      },

      async signInWithGoogle() {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            queryParams: { prompt: "select_account" },
          },
        });
        if (error) throw new Error(error.message);
      },

      async signInWithApple() {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "apple",
          options: { redirectTo },
        });
        if (error) throw new Error(error.message);
      },

      async signOut() {
        try { await supabase.auth.signOut(); } catch { /* ignore network errors */ }
        setUser(null);
      },

      async deleteAccount() {
        await fetch("/api/account/delete", { method: "DELETE" });
        await supabase.auth.signOut();
        setUser(null);
      },

      async updateProfile(updates) {
        if (!user) return;
        const body: Record<string, unknown> = {};
        if (updates.name !== undefined) body.name = updates.name;
        if (updates.username !== undefined) body.username = updates.username;
        if ("bio" in updates) body.bio = updates.bio ?? null;
        if (updates.profilePicture !== undefined) body.avatar_url = updates.profilePicture;

        if (Object.keys(body).length > 0) {
          await fetch("/api/profile/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
        setUser((prev) => (prev ? { ...prev, ...updates } : prev));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, authLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
