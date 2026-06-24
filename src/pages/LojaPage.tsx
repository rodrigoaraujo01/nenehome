import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { CurrencyBadge } from "@/components/CurrencyBadge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import {
  getPowerups,
  getPowerupInventory,
  buyPowerup,
  getNenecoinBalance,
} from "@/lib/supabase/queries";
import type { Powerup, NenecoinBalance } from "@/lib/types";

export default function LojaPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  const [powerups, setPowerups] = useState<Powerup[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [balance, setBalance] = useState<NenecoinBalance | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  async function refresh() {
    const [pw, inv, bal] = await Promise.all([
      getPowerups(),
      getPowerupInventory(),
      getNenecoinBalance(),
    ]);
    setPowerups(pw);
    setInventory(Object.fromEntries(inv.map((i) => [i.powerup_key, i.qty])));
    setBalance(bal);
    setFetching(false);
  }

  useEffect(() => {
    if (!profile) return;
    refresh();
  }, [profile]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  function setItemQty(key: string, n: number) {
    setQty((q) => ({ ...q, [key]: Math.max(1, Math.min(9, n)) }));
  }

  async function handleBuy(pw: Powerup) {
    const n = qty[pw.key] ?? 1;
    setBusy(pw.key);
    const res = await buyPowerup(pw.key, n);
    setBusy(null);
    if (res.error) {
      setToast({ msg: res.error, ok: false });
      return;
    }
    setToast({ msg: `Comprou ${n}× ${pw.title} ${pw.icon}`, ok: true });
    setItemQty(pw.key, 1);
    await refresh();
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen pb-24">
        <Header />
        <main className="max-w-lg mx-auto px-6 py-8 text-muted">Carregando…</main>
      </div>
    );
  }

  const nene = balance?.nenecoin_balance ?? 0;

  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="max-w-lg mx-auto px-6 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Loja</h2>
          <p className="text-sm text-muted mt-1">
            Gaste suas nenecoins em power-ups pra mandar bem nas perguntas e na Copa.
          </p>
        </div>

        <div className="flex gap-3">
          <CurrencyBadge value={nene} label="Nenecoins" icon="nenecoins" />
          {balance && balance.firecoin_balance > 0 && (
            <CurrencyBadge value={balance.firecoin_balance} label="Firecoins" icon="firecoins" />
          )}
        </div>

        <div className="space-y-3">
          {powerups.map((pw) => {
            const owned = inventory[pw.key] ?? 0;
            const n = qty[pw.key] ?? 1;
            const cost = pw.price * n;
            const tooPoor = cost > nene;
            return (
              <div
                key={pw.key}
                className="bg-surface border border-border rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl leading-none">{pw.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{pw.title}</p>
                      {owned > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green/15 text-green">
                          {owned} no inventário
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1 leading-snug">{pw.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setItemQty(pw.key, n - 1)}
                      className="w-8 h-8 rounded-lg bg-surface-light text-foreground font-bold hover:bg-border transition-colors"
                      aria-label="menos"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-semibold">{n}</span>
                    <button
                      onClick={() => setItemQty(pw.key, n + 1)}
                      className="w-8 h-8 rounded-lg bg-surface-light text-foreground font-bold hover:bg-border transition-colors"
                      aria-label="mais"
                    >
                      +
                    </button>
                  </div>

                  <Button
                    onClick={() => handleBuy(pw)}
                    disabled={tooPoor || busy === pw.key}
                    className={tooPoor ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    {busy === pw.key ? "…" : `Comprar · ${cost} 🪙`}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg"
            style={{
              background: toast.ok ? "var(--green)" : "#ef4444",
              color: "#0A0A0B",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
