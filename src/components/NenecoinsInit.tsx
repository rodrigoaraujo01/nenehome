"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  claimWeeklyBonuses,
  checkFirecoinConversion,
  getNenecoinBalance,
  markFirecoinPopupShown,
} from "@/lib/supabase/queries";
import { FirecoinPopup } from "./FirecoinPopup";

export function NenecoinsInit() {
  const { profile } = useAuth();
  const profileId = profile?.id;
  const [showFirecoin, setShowFirecoin] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState(0);

  useEffect(() => {
    if (!profileId) return;

    const key = `nc_init_${profileId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    (async () => {
      await claimWeeklyBonuses();
      const fire = await checkFirecoinConversion();
      if (fire?.show_popup) {
        setConvertedAmount(fire.converted);
        setShowFirecoin(true);
        return;
      }
      // Also show popup if user has firecoins and hasn't dismissed yet
      const balance = await getNenecoinBalance();
      if (balance && balance.firecoin_balance > 0 && !balance.firecoin_popup_shown) {
        setConvertedAmount(0);
        setShowFirecoin(true);
      }
    })();
  }, [profileId]);

  async function handleDismiss() {
    setShowFirecoin(false);
    await markFirecoinPopupShown();
  }

  return (
    <AnimatePresence>
      {showFirecoin && (
        <FirecoinPopup convertedAmount={convertedAmount} onDismiss={handleDismiss} />
      )}
    </AnimatePresence>
  );
}
