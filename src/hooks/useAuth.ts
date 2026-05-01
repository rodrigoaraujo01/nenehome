"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { MEMBERS } from "@/lib/constants";
import type { Member } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        setMember(MEMBERS.find((m) => m.email === u.email) ?? null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setMember(u ? MEMBERS.find((m) => m.email === u.email) ?? null : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    return error;
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    setUser(null);
    setMember(null);
  };

  return { user, member, loading, signIn, signOut };
}
