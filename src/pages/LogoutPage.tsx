
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabase } from "@/lib/supabase/client";

export default function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    getSupabase()
      .auth.signOut()
      .then(() => navigate("/login", { replace: true }));
  }, [navigate]);

  return null;
}
