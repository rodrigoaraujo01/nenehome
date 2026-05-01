"use client";

import { motion } from "framer-motion";

interface FirecoinPopupProps {
  convertedAmount: number;
  onDismiss: () => void;
}

export function FirecoinPopup({ convertedAmount, onDismiss }: FirecoinPopupProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 30 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="bg-surface border border-border rounded-3xl p-8 max-w-sm w-full text-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-6xl">🔥</div>
        <div>
          <h2 className="text-xl font-bold">Suas nenecoins foram para a aposentadoria!</h2>
          <p className="text-muted text-sm mt-2 leading-relaxed">
            {convertedAmount > 0
              ? `${convertedAmount} nenecoins ficaram guardadas por mais de 3 meses e viraram 🔥 firecoins.`
              : "Você tem firecoins guardadas."}{" "}
            Elas estão descansando por agora — mas um dia serão liberadas para algo especial.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="w-full bg-accent text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          Entendi!
        </button>
      </motion.div>
    </motion.div>
  );
}
