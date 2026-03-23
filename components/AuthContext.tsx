"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

type ProfileRow = {
  name: string | null;
  username: string | null;
  bio: string | null;
  profile_picture_url: string | null;
  banner_image_url: string | null;
  risk_profile: string | null;
  joined_at: string | null;
  created_at: string | null;
  is_verified: boolean | null;
  is_founder: boolean | null;
};

function buildUser(authId: string, email: string, row: ProfileRow | null): User {
  return {
    id: authId,
    email,
    name: row?.name ?? "Trader",
    username: row?.username ?? undefined,
    bio: row?.bio ?? undefined,
    profilePicture: row?.profile_picture_url ?? undefined,
    bannerImage: row?.banner_image_url ?? undefined,
    riskProfile: (row?.risk_profile as RiskProfileKey) ?? undefined,
    joinedAt: row?.joined_at ?? row?.created_at ?? new Date().toISOString(),
    isVerified: row?.is_verified ?? false,
    isFounder: row?.is_founder ?? false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Hydrate from current session on mount
    void supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, username, bio, profile_picture_url, banner_image_url, risk_profile, joined_at, created_at, is_verified, is_founder")
        .eq("user_id", authUser.id)
        .single();
      setUser(buildUser(authUser.id, authUser.email ?? "", profile as ProfileRow | null));
    });

    // Keep in sync with auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) { setUser(null); return; }
      const authUser = session.user;
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, username, bio, profile_picture_url, banner_image_url, risk_profile, joined_at, created_at, is_verified, is_founder")
        .eq("user_id", authUser.id)
        .single();
      setUser(buildUser(authUser.id, authUser.email ?? "", profile as ProfileRow | null));
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,

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

        // Pick up any onboarding risk profile
        let riskProfile: RiskProfileKey | undefined;
        if (typeof window !== "undefined") {
          const pendingRaw = window.localStorage.getItem("xchange-onboarding-pending");
          if (pendingRaw) {
            try {
              const pending = JSON.parse(pendingRaw) as { riskProfile?: RiskProfileKey };
              riskProfile = pending.riskProfile;
              window.localStorage.removeItem("xchange-onboarding-pending");
            } catch { /* ignore */ }
          }
        }

        await supabase.from("profiles").upsert(
          {
            user_id: userId,
            email: trimmedEmail,
            name: trimmedName,
            ...(riskProfile ? { risk_profile: riskProfile } : {}),
          },
          { onConflict: "user_id" }
        );

        setEarlyMember();
      },

      async signIn({ email, password }) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw new Error(error.message);
      },

      async signOut() {
        await supabase.auth.signOut();
        setUser(null);
      },

      async deleteAccount() {
        await fetch("/api/account/delete", { method: "DELETE" });
        await supabase.auth.signOut();
        setUser(null);
      },

      async updateProfile(updates) {
        if (!user) return;
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.username !== undefined) dbUpdates.username = updates.username;
        if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
        if (updates.profilePicture !== undefined) dbUpdates.profile_picture_url = updates.profilePicture;
        if (updates.bannerImage !== undefined) dbUpdates.banner_image_url = updates.bannerImage;
        if (updates.riskProfile !== undefined) dbUpdates.risk_profile = updates.riskProfile;

        await supabase.from("profiles").update(dbUpdates).eq("user_id", user.id);
        setUser((prev) => (prev ? { ...prev, ...updates } : prev));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
