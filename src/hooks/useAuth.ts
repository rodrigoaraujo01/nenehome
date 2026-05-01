"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { getOrCreateProfile } from "@/lib/supabase/queries";
import type { DbProfile } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function syncProfile(u: User | null) {
    if (!u) {
      setProfile(null);
      return;
    }
    const p = await getOrCreateProfile(u.id, u.email ?? "");
    setProfile(p);
  }

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(async ({ data: { session } }) => {
        const u = session?.user ?? null;
        setUser(u);
        await syncProfile(u);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      syncProfile(u);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout: servidor não respondeu")), 10000)
      );
      const { error } = await Promise.race([
        getSupabase().auth.signInWithPassword({ email, password }),
        timeout,
      ]);
      return error;
    } catch (err) {
      return err instanceof Error ? err : new Error("Erro desconhecido ao fazer login");
    }
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const updatePassword = async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    return error;
  };

  return { user, profile, loading, signIn, signOut, updatePassword };
}
