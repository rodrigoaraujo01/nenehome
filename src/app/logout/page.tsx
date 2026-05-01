"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    getSupabase()
      .auth.signOut()
      .then(() => router.replace("/login"));
  }, [router]);

  return null;
}
