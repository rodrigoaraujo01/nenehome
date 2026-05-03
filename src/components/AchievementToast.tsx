"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { UnlockedAchievement } from "@/lib/types";

interface AchievementToastProps {
  achievements: UnlockedAchievement[];
}

export function AchievementToast({ achievements }: AchievementToastProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const current = currentIndex < achievements.length
    ? achievements[currentIndex]
    : null;

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setCurrentIndex((index) => index + 1), 3200);
    return () => clearTimeout(t);
  }, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.key}
          initial={{ y: -72, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -72, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-surface border border-accent/50 rounded-2xl px-5 py-3 shadow-xl"
        >
          <span className="text-3xl">{current.icon}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
              Conquista desbloqueada!
            </p>
            <p className="font-bold text-sm">{current.title}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
