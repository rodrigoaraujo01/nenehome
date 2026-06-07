
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/Card";
import { CurrencyBadge } from "@/components/CurrencyBadge";
import { Button } from "@/components/ui/Button";
import { MEMBERS, COUPLES } from "@/lib/constants";
import {
  getProfileStats,
  getUserAchievements,
  getNenecoinBalance,
  giftNenecoins,
  getPointsLog,
  getNenecoinHistory,
} from "@/lib/supabase/queries";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase/client";
import type { ProfileStats, DbAchievement, NenecoinBalance, PointsLogEntry, NenecoinLedgerEntry } from "@/lib/types";

const REASON_META: Record<string, { label: string; icon: string; colorClass: string }> = {
  correct_answer:      { label: "Respostas corretas",   icon: "✓",  colorClass: "text-green" },
  question_created:    { label: "Perguntas criadas",    icon: "✏️", colorClass: "text-accent" },
  creator_penalty:     { label: "Penalidades",          icon: "✗",  colorClass: "text-red-400" },
  achievement:         { label: "Conquistas",           icon: "🏆", colorClass: "text-accent" },
  photo_approved:      { label: "Fotos aprovadas",      icon: "📸", colorClass: "text-purple" },
  challenge_completed: { label: "Desafios concluídos",  icon: "🏅", colorClass: "text-yellow" },
  nenecoin_conversion: { label: "Conversão em nenecoins", icon: "🪙", colorClass: "text-red-400" },
  wc_tournament_bonus: { label: "Bônus da Copa",        icon: "⚽", colorClass: "text-green" },
};

const TX_LABELS: Record<string, string> = {
  initial:              "Bônus inicial",
  weekly_bonus:         "Mesada semanal",
  points_conversion:    "Conversão de pontos",
  bet_placed:           "Aposta realizada",
  bet_won:              "Aposta ganha",
  bet_refund:           "Reembolso de aposta",
  gift_sent:            "Presente enviado",
  gift_received:        "Presente recebido",
  fire_conversion_out:  "Aposentadoria",
  fire_conversion_in:   "Firecoin recebido",
};

function NenecoinHistory({ entries }: { entries: NenecoinLedgerEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entries : entries.slice(0, 5);

  return (
    <div className="w-full">
      <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
        Histórico de nenecoins
      </h3>
      <Card>
        <div className="space-y-3">
          {visible.map((e) => {
            const isPositive = e.amount > 0;
            const coinIcon = e.coin_type === "firecoin" ? "🔥" : "🪙";
            const label = TX_LABELS[e.tx_type] ?? e.tx_type;
            const date = new Date(e.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "2-digit", year: "2-digit",
            });
            return (
              <div key={e.id} className="flex items-start gap-3">
                <span className="text-base shrink-0">{coinIcon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{label}</p>
                  {e.note && (
                    <p className="text-xs text-muted leading-tight mt-0.5 truncate">{e.note}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${isPositive ? "text-green" : "text-red-400"}`}>
                    {isPositive ? "+" : ""}{e.amount}
                  </p>
                  <p className="text-[10px] text-muted">{date}</p>
                </div>
              </div>
            );
          })}
        </div>
        {entries.length > 5 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 w-full text-xs text-muted hover:text-foreground transition-colors text-center pt-3 border-t border-border"
          >
            {expanded ? "Ver menos" : `Ver todos (${entries.length})`}
          </button>
        )}
      </Card>
    </div>
  );
}

function PointsBreakdown({ entries }: { entries: PointsLogEntry[] }) {
  const byReason = entries.reduce<Record<string, { total: number; count: number }>>(
    (acc, e) => {
      if (!acc[e.reason]) acc[e.reason] = { total: 0, count: 0 };
      acc[e.reason].total += e.amount;
      acc[e.reason].count += 1;
      return acc;
    },
    {}
  );

  const rows = Object.entries(byReason).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="w-full">
      <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
        Origem dos pontos
      </h3>
      <Card>
        <div className="space-y-3">
          {rows.map(([reason, { total, count }]) => {
            const meta = REASON_META[reason] ?? { label: reason, icon: "·", colorClass: "text-foreground" };
            return (
              <div key={reason} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-5 text-center shrink-0 ${meta.colorClass}`}>
                  {meta.icon}
                </span>
                <span className="text-sm flex-1">{meta.label}</span>
                <span className="text-xs text-muted shrink-0">{count}×</span>
                <span className={`text-sm font-bold tabular-nums shrink-0 ${total >= 0 ? "text-foreground" : "text-red-400"}`}>
                  {total >= 0 ? "+" : ""}{total} pts
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

async function getProfileIdByNickname(nickname: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("profiles")
    .select("id")
    .ilike("nickname", nickname)
    .maybeSingle();
  return data?.id ?? null;
}

export default function PerfilPage() {
  const { nickname = "" } = useParams<{ nickname: string }>();
  const { profile: currentUser, signOut } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [achievements, setAchievements] = useState<DbAchievement[]>([]);
  const [balance, setBalance] = useState<NenecoinBalance | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [pointsLog, setPointsLog] = useState<PointsLogEntry[]>([]);
  const [coinHistory, setCoinHistory] = useState<NenecoinLedgerEntry[]>([]);

  // Gift modal state
  const [showGift, setShowGift] = useState(false);
  const [giftAmount, setGiftAmount] = useState(10);
  const [giftNote, setGiftNote] = useState("");
  const [gifting, setGifting] = useState(false);
  const [giftMsg, setGiftMsg] = useState<string | null>(null);

  const member = MEMBERS.find(
    (m) => m.nickname.toLowerCase() === nickname.toLowerCase()
  );

  useEffect(() => {
    if (!member) return;
    getProfileStats(member.nickname).then((s) => {
      setStats(s);
      setLoadingStats(false);
    });
  }, [member]);

  useEffect(() => {
    if (!member) return;
    getProfileIdByNickname(member.nickname).then((id) => {
      setProfileId(id);
      if (id) {
        getUserAchievements(id).then(setAchievements);
        getPointsLog(id).then(setPointsLog);
        if (currentUser && currentUser.nickname.toLowerCase() === nickname.toLowerCase()) {
          getNenecoinHistory(id).then(setCoinHistory);
        }
      }
    });
  }, [member]);

  // Load own balance when viewing own profile
  useEffect(() => {
    if (!currentUser || !member) return;
    if (currentUser.nickname.toLowerCase() === member.nickname.toLowerCase()) {
      getNenecoinBalance().then(setBalance);
    }
  }, [currentUser, member]);

  if (!member) {
    return (
      <>
        <Header />
        <main className="flex-1 px-6 py-8">
          <p className="text-center text-muted mt-12">Membro não encontrado.</p>
        </main>
      </>
    );
  }

  const couple = COUPLES.find((c) => c.id === member.coupleGroup);
  const family = couple?.members.filter((m) => m.id !== member.id) ?? [];
  const isOwnProfile = currentUser?.nickname === member.nickname;
  const accuracy =
    stats && stats.answers_total > 0
      ? Math.round((stats.answers_correct / stats.answers_total) * 100)
      : null;

  async function handleGift(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId) return;
    setGifting(true);
    setGiftMsg(null);
    const result = await giftNenecoins(profileId, giftAmount, giftNote.trim() || undefined);
    setGifting(false);
    if (result.error) {
      setGiftMsg(`Erro: ${result.error}`);
    } else {
      setGiftMsg(`🎁 ${giftAmount} nenecoins enviadas para ${member!.nickname}!`);
      setGiftAmount(10);
      setGiftNote("");
      const bal = await getNenecoinBalance();
      if (bal) setBalance(bal);
      setTimeout(() => { setShowGift(false); setGiftMsg(null); }, 2000);
    }
  }

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <section className="max-w-md mx-auto flex flex-col items-center gap-6">
          <Link
            to="/"
            className="self-start flex items-center gap-3 text-muted hover:text-foreground transition-colors"
          >
            <span>‹</span>
            <span className="text-sm font-bold text-foreground">Início</span>
          </Link>
          <Avatar spriteUrl={member.spriteUrl} nickname={member.nickname} size={120} />
          <div className="text-center">
            <h2 className="text-3xl font-bold">{member.nickname}</h2>
            <p className="text-muted mt-1">{member.name}</p>
            {isOwnProfile && (
              <span className="text-xs text-accent font-semibold">você</span>
            )}
          </div>

          {/* currencies */}
          {loadingStats ? (
            <div className="flex gap-3 w-full">
              <div className="flex-1 h-16 bg-surface border border-border rounded-2xl animate-pulse" />
            </div>
          ) : (
            <div className="flex gap-3 w-full">
              <CurrencyBadge
                value={stats?.total_points ?? 0}
                label="pontos"
                icon="points"
              />
              {isOwnProfile && balance !== null && (
                <CurrencyBadge
                  value={balance.nenecoin_balance}
                  label="nenecoins"
                  icon="nenecoins"
                />
              )}
              {isOwnProfile && balance !== null && balance.firecoin_balance > 0 && (
                <CurrencyBadge
                  value={balance.firecoin_balance}
                  label="firecoins"
                  icon="firecoins"
                />
              )}
            </div>
          )}

          {/* Gift button (other profiles) */}
          {!isOwnProfile && profileId && (
            <div className="w-full">
              {!showGift ? (
                <button
                  onClick={() => setShowGift(true)}
                  className="w-full text-sm text-accent border border-accent/30 rounded-xl py-2.5 hover:bg-accent/5 transition-colors font-semibold"
                >
                  🎁 Dar nenecoins para {member.nickname}
                </button>
              ) : (
                <Card className="w-full">
                  <p className="font-semibold text-sm mb-3">🎁 Dar nenecoins</p>
                  <form onSubmit={handleGift} className="space-y-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Quantidade</label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setGiftAmount((a) => Math.max(1, a - 5))}
                          className="w-8 h-8 rounded-full border border-border text-muted text-lg font-bold"
                        >−</button>
                        <input
                          type="number"
                          min={1}
                          value={giftAmount}
                          onChange={(e) => setGiftAmount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="flex-1 text-center bg-surface border border-border rounded-xl px-3 py-1.5 font-bold focus:outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => setGiftAmount((a) => a + 5)}
                          className="w-8 h-8 rounded-full border border-border text-muted text-lg font-bold"
                        >+</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Mensagem (opcional)</label>
                      <input
                        type="text"
                        value={giftNote}
                        onChange={(e) => setGiftNote(e.target.value)}
                        placeholder="Presente pra você! 🎉"
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent"
                      />
                    </div>
                    {giftMsg && (
                      <p className={`text-sm ${giftMsg.startsWith("Erro") ? "text-red-400" : "text-green"}`}>
                        {giftMsg}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1" disabled={gifting}>
                        {gifting ? "Enviando..." : "Enviar"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => { setShowGift(false); setGiftMsg(null); }}
                        className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </Card>
              )}
            </div>
          )}

          {!loadingStats && stats && (
            <div className="grid grid-cols-3 gap-3 w-full">
              <Card className="flex flex-col items-center py-4 px-2">
                <span className="text-2xl font-bold">{stats.answers_total}</span>
                <span className="text-xs text-muted text-center mt-1">respondidas</span>
              </Card>
              <Card className="flex flex-col items-center py-4 px-2">
                <span className="text-2xl font-bold text-green">
                  {accuracy !== null ? `${accuracy}%` : "—"}
                </span>
                <span className="text-xs text-muted text-center mt-1">acertos</span>
              </Card>
              <Card className="flex flex-col items-center py-4 px-2">
                <span className="text-2xl font-bold">{stats.questions_created}</span>
                <span className="text-xs text-muted text-center mt-1">criadas</span>
              </Card>
            </div>
          )}

          {pointsLog.length > 0 && <PointsBreakdown entries={pointsLog} />}

          {isOwnProfile && coinHistory.length > 0 && (
            <NenecoinHistory entries={coinHistory} />
          )}

          {!loadingStats && stats && stats.recent_answers.length > 0 && (
            <div className="w-full">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                Últimas respostas
              </h3>
              <Card>
                <div className="space-y-3">
                  {stats.recent_answers.slice(0, 8).map((a, i) => (
                    <Link
                      key={i}
                      to={`/perguntas/${a.question_id}`}
                      className="flex items-start gap-3 hover:opacity-80 transition-opacity"
                    >
                      <span className={`mt-0.5 shrink-0 text-sm font-bold ${a.is_correct ? "text-green" : "text-red-400"}`}>
                        {a.is_correct ? "✓" : "✗"}
                      </span>
                      <p className="text-sm text-muted line-clamp-2">
                        {a.questions?.content ?? "Pergunta removida"}
                      </p>
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {achievements.filter((a) => a.unlocked_at).length > 0 && (
            <div className="w-full">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                Conquistas
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {achievements.filter((a) => a.unlocked_at).map((a) => (
                  <div
                    key={a.key}
                    className="flex flex-col items-center p-3 rounded-xl border border-accent/30 bg-accent/5"
                  >
                    <span className="text-2xl mb-1">{a.icon}</span>
                    <span className="text-[11px] text-center font-semibold leading-tight line-clamp-2 min-h-[2.5em]">
                      {a.title}
                    </span>
                    <span className="text-[10px] text-center text-muted leading-tight line-clamp-2 min-h-[2.5em] mt-1">
                      {a.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {couple && (
            <Card className="w-full">
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Família</p>
              <p className="text-lg font-bold">{couple.label}</p>
              <div className="flex gap-4 mt-4 flex-wrap">
                {family.map((f) => (
                  <Link
                    key={f.id}
                    to={`/perfil/${f.nickname.toLowerCase()}`}
                    className="flex flex-col items-center gap-1.5 hover:opacity-80 transition-opacity"
                  >
                    <Avatar spriteUrl={f.spriteUrl} nickname={f.nickname} size={48} />
                    <span className="text-xs text-muted">{f.nickname}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {isOwnProfile && (
            <button
              onClick={signOut}
              className="w-full bg-surface border border-border rounded-xl py-3 text-sm font-semibold text-red-400 hover:bg-red-400/10 hover:border-red-400/30 transition-colors"
            >
              Sair da conta
            </button>
          )}
        </section>
      </main>
    </>
  );
}
