import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { CurrencyBadge } from "@/components/CurrencyBadge";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useCosmetics, nameStyleCss } from "@/hooks/useCosmetics";
import {
  getPowerups,
  getPowerupInventory,
  buyPowerup,
  getNenecoinBalance,
  getSabotageRevenge,
  getCosmetics,
  getCosmeticInventory,
  buyCosmetic,
  equipCosmetic,
  unequipSlot,
  getRobinHoodState,
  commitRobinHoodRaid,
} from "@/lib/supabase/queries";
import type {
  Powerup,
  NenecoinBalance,
  Cosmetic,
  CosmeticSlot,
  RobinHoodState,
  RobinHoodResult,
} from "@/lib/types";

type Tab = "poderes" | "cosmeticos";

const SLOT_LABEL: Record<CosmeticSlot, string> = {
  avatar_frame: "Molduras de avatar",
  name_style: "Estilos de nome",
  question_flair: "Enfeites de pergunta",
};

const RARITY_STYLE: Record<Cosmetic["rarity"], string> = {
  comum: "bg-surface-light text-muted",
  raro: "bg-blue-500/15 text-blue-400",
  lendario: "bg-amber-500/15 text-amber-400",
};

const RARITY_LABEL: Record<Cosmetic["rarity"], string> = {
  comum: "Comum",
  raro: "Raro",
  lendario: "Lendário",
};

export default function LojaPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const cosmeticsCtx = useCosmetics();

  const [tab, setTab] = useState<Tab>("poderes");

  const [powerups, setPowerups] = useState<Powerup[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [balance, setBalance] = useState<NenecoinBalance | null>(null);
  const [revengeCredits, setRevengeCredits] = useState(0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [rhState, setRhState] = useState<RobinHoodState | null>(null);

  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [owned, setOwned] = useState<Record<string, boolean>>({});
  const [equipped, setEquipped] = useState<Record<string, boolean>>({});

  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  async function refresh() {
    const [pw, inv, bal, rev, cos, cinv, rh] = await Promise.all([
      getPowerups(),
      getPowerupInventory(),
      getNenecoinBalance(),
      getSabotageRevenge(),
      getCosmetics(),
      getCosmeticInventory(),
      getRobinHoodState(),
    ]);
    setPowerups(pw);
    setInventory(Object.fromEntries(inv.map((i) => [i.powerup_key, i.qty])));
    setBalance(bal);
    setRevengeCredits(rev.credits);
    setRhState(rh);
    setCosmetics(cos);
    setOwned(Object.fromEntries(cinv.map((i) => [i.cosmetic_key, true])));
    setEquipped(
      Object.fromEntries(cinv.filter((i) => i.equipped).map((i) => [i.cosmetic_key, true])),
    );
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

  async function handleRobinHood() {
    setBusy("robin_hood_raid");
    const res = await commitRobinHoodRaid();
    setBusy(null);
    if (res.error) {
      setToast({ msg: res.error, ok: false });
      return;
    }
    if (res.fired) {
      setToast({ msg: `Revanche disparou! ${res.result?.pool ?? 0} 🪙 redistribuídos 🏹`, ok: true });
    } else if (res.opened) {
      setToast({ msg: "Revanche aberta — chame a galera! 🏹", ok: true });
    } else {
      const faltam = (res.quorum ?? 4) - (res.count ?? 0);
      setToast({ msg: `Você entrou! Faltam ${faltam} 🏹`, ok: true });
    }
    await refresh();
  }

  async function handleBuyCosmetic(c: Cosmetic) {
    setBusy(c.key);
    const res = await buyCosmetic(c.key);
    setBusy(null);
    if (res.error) {
      setToast({ msg: res.error, ok: false });
      return;
    }
    setToast({ msg: `Comprou ${c.title} ✨`, ok: true });
    await refresh();
  }

  async function handleEquip(c: Cosmetic) {
    setBusy(c.key);
    const isEquipped = equipped[c.key];
    const res = isEquipped
      ? await unequipSlot(c.slot)
      : await equipCosmetic(c.key);
    setBusy(null);
    if (res.error) {
      setToast({ msg: res.error, ok: false });
      return;
    }
    setToast({ msg: isEquipped ? "Desequipado" : `${c.title} equipado ✨`, ok: true });
    await Promise.all([refresh(), cosmeticsCtx.refresh()]);
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

  const cosmeticSlots: CosmeticSlot[] = ["avatar_frame", "name_style", "question_flair"];

  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="max-w-lg mx-auto px-6 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Loja</h2>
          <p className="text-sm text-muted mt-1">
            Gaste suas nenecoins em poderes e cosméticos.
          </p>
        </div>

        <div className="flex gap-3">
          <CurrencyBadge value={nene} label="Nenecoins" icon="nenecoins" />
          {balance && balance.firecoin_balance > 0 && (
            <CurrencyBadge value={balance.firecoin_balance} label="Firecoins" icon="firecoins" />
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-surface rounded-xl border border-border">
          {(["poderes", "cosmeticos"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t ? "bg-accent text-black" : "text-muted hover:text-foreground"
              }`}
            >
              {t === "poderes" ? "⚡ Poderes" : "✨ Cosméticos"}
            </button>
          ))}
        </div>

        {tab === "poderes" && (
          <div className="space-y-3">
            {rhState && (
              <RobinHoodPanel
                state={rhState}
                busy={busy === "robin_hood_raid"}
                onCommit={handleRobinHood}
              />
            )}
            {powerups.map((pw) => {
              const owned = inventory[pw.key] ?? 0;
              const n = qty[pw.key] ?? 1;
              const discUnits =
                pw.key === "sabotage" ? Math.min(n, revengeCredits) : 0;
              const cost =
                pw.price * (n - discUnits) + Math.floor(pw.price / 2) * discUnits;
              const tooPoor = cost > nene;
              return (
                <div
                  key={pw.key}
                  className="bg-surface border border-border rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl leading-none">{pw.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{pw.title}</p>
                        {owned > 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green/15 text-green">
                            {owned} no inventário
                          </span>
                        )}
                        {pw.key === "sabotage" && revengeCredits > 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                            ⚡ Revanche 50% ×{revengeCredits}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-1 leading-snug">{pw.description}</p>
                      {pw.key === "sabotage" && revengeCredits > 0 && (
                        <p className="text-[11px] text-accent mt-1">
                          Você foi sabotado — contra-golpe com 50% de desconto!
                        </p>
                      )}
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
        )}

        {tab === "cosmeticos" && (
          <div className="space-y-6">
            {cosmeticSlots.map((slot) => {
              const items = cosmetics.filter((c) => c.slot === slot);
              if (items.length === 0) return null;
              return (
                <div key={slot} className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
                    {SLOT_LABEL[slot]}
                  </h3>
                  {items.map((c) => {
                    const isOwned = owned[c.key] ?? false;
                    const isEquipped = equipped[c.key] ?? false;
                    const tooPoor = c.price > nene;
                    return (
                      <div
                        key={c.key}
                        className={`bg-surface border rounded-2xl p-4 space-y-3 ${
                          isEquipped ? "border-accent" : "border-border"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <CosmeticPreview cosmetic={c} nickname={profile?.nickname ?? "?"} spriteUrl={profile?.avatar_url ?? null} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">{c.title}</p>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${RARITY_STYLE[c.rarity]}`}>
                                {RARITY_LABEL[c.rarity]}
                              </span>
                              {c.season && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green/15 text-green">
                                  ⏳ Limitado
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted mt-1 leading-snug">{c.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          {isOwned ? (
                            <Button
                              onClick={() => handleEquip(c)}
                              disabled={busy === c.key}
                              className={isEquipped ? "bg-surface-light text-foreground" : ""}
                            >
                              {busy === c.key ? "…" : isEquipped ? "Desequipar" : "Equipar"}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleBuyCosmetic(c)}
                              disabled={tooPoor || busy === c.key}
                              className={tooPoor ? "opacity-50 cursor-not-allowed" : ""}
                            >
                              {busy === c.key ? "…" : `Comprar · ${c.price} 🪙`}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
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

function hoursUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expirando…";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ""}` : `${m}min`;
}

function RobinHoodResultCard({ result }: { result: RobinHoodResult }) {
  return (
    <div className="rounded-xl bg-black/20 border border-border p-3 space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">
        Última revanche · média {result.avg} 🪙 · {result.pool} 🪙 redistribuídos
      </p>
      {result.taxed.length > 0 && (
        <div className="text-xs">
          <span className="text-red-400 font-semibold">Tirou dos ricos:</span>{" "}
          {result.taxed.map((t) => `${t.nick} −${t.amount}`).join(" · ")}
        </div>
      )}
      {result.paid.length > 0 && (
        <div className="text-xs">
          <span className="text-green font-semibold">Deu aos pobres:</span>{" "}
          {result.paid.map((t) => `${t.nick} +${t.amount}`).join(" · ")}
        </div>
      )}
    </div>
  );
}

function RobinHoodPanel({
  state,
  busy,
  onCommit,
}: {
  state: RobinHoodState;
  busy: boolean;
  onCommit: () => void;
}) {
  const { raid, quorum, my_tokens, week_locked, last_result } = state;
  const count = raid?.count ?? 0;
  const faltam = Math.max(0, quorum - count);

  // Pode agir? Precisa de token e ou não entrou no raid, ou não existe raid.
  const canJoin = my_tokens >= 1 && (!raid || !raid.i_joined);
  const blockedNewByWeek = !raid && week_locked;

  return (
    <div className="rounded-2xl p-4 space-y-3 border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-green/5">
      <div className="flex items-start gap-3">
        <div className="text-3xl leading-none">🏹</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">Robin Hood — Revanche</p>
            {my_tokens > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green/15 text-green">
                {my_tokens} token{my_tokens > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-1 leading-snug">
            Junte {quorum} membros e tire 25% da fortuna de quem está acima da média
            do grupo pra dividir com quem está abaixo. 1 token por participante ·
            1 revanche por semana.
          </p>
        </div>
      </div>

      {raid && (
        <div className="rounded-xl bg-black/20 border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">
              {count}/{quorum} na revanche
            </span>
            <span className="text-xs text-muted">expira em {hoursUntil(raid.expires_at)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {raid.participants.map((nick) => (
              <span
                key={nick}
                className="text-xs px-2 py-0.5 rounded-full bg-surface-light text-foreground"
              >
                {nick}
              </span>
            ))}
            {Array.from({ length: faltam }).map((_, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full border border-dashed border-border text-muted"
              >
                ?
              </span>
            ))}
          </div>
          {raid.i_joined && faltam > 0 && (
            <p className="text-xs text-accent">
              Você já está dentro — chame mais {faltam} pra disparar!
            </p>
          )}
        </div>
      )}

      {!raid && last_result && <RobinHoodResultCard result={last_result} />}

      {blockedNewByWeek ? (
        <p className="text-xs text-muted text-center py-1">
          Já rolou uma revanche esta semana. Semana que vem tem mais. 🏹
        </p>
      ) : (
        <Button
          onClick={onCommit}
          disabled={!canJoin || busy}
          className={`w-full ${!canJoin ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {busy
            ? "…"
            : my_tokens < 1
              ? "Compre um token 🏹 abaixo"
              : raid
                ? raid.i_joined
                  ? "Você já está na revanche"
                  : "Entrar na revanche · 1 🏹"
                : "Abrir revanche · 1 🏹"}
        </Button>
      )}
    </div>
  );
}

function CosmeticPreview({
  cosmetic,
  nickname,
  spriteUrl,
}: {
  cosmetic: Cosmetic;
  nickname: string;
  spriteUrl: string | null;
}) {
  if (cosmetic.slot === "avatar_frame") {
    return (
      <Avatar spriteUrl={spriteUrl} nickname={nickname} size={48} frame={cosmetic.payload} />
    );
  }
  if (cosmetic.slot === "name_style") {
    return (
      <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center">
        <span className="font-bold text-lg" style={nameStyleCss(cosmetic.payload)}>
          Aa
        </span>
      </div>
    );
  }
  return <div className="text-3xl leading-none">✨</div>;
}
