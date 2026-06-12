import { useState } from "react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

const DISMISSED_KEY = "dismissed_push_banner";

export function PushBanner({ userId }: { userId: string }) {
  const { supported, blocked, enabled, loading, busy, enable } =
    usePushSubscription(userId);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (loading || !supported || blocked || enabled || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="bg-accent/10 border border-accent/30 rounded-2xl px-4 py-3 flex items-start gap-3">
      <span className="text-xl shrink-0">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Ative as notificações</p>
        <p className="text-xs text-muted mt-0.5">
          Saiba na hora quando alguém criar uma pergunta, desafio ou foto.
        </p>
        <button
          onClick={enable}
          disabled={busy}
          className="mt-2 rounded-xl bg-accent px-4 py-1.5 text-xs font-semibold text-background hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {busy ? "..." : "Ativar"}
        </button>
      </div>
      <button
        onClick={dismiss}
        className="text-muted hover:text-foreground transition-colors shrink-0 text-lg leading-none"
        aria-label="Dispensar"
      >
        ×
      </button>
    </div>
  );
}
