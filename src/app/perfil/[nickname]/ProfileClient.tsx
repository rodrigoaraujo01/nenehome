"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "@/lib/supabase/queries";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/lib/supabase/client";
import type { ProfileStats, DbAchievement, NenecoinBalance } from "@/lib/types";

async function getProfileIdByNickname(nickname: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("profiles")
    .select("id")
    .ilike("nickname", nickname)
    .maybeSingle();
  return data?.id ?? null;
}

export function ProfileClient({ nickname }: { nickname: string }) {
  const { profile: currentUser } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [achievements, setAchievements] = useState<DbAchievement[]>([]);
  const [balance, setBalance] = useState<NenecoinBalance | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

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
  }, [member?.nickname]);

  useEffect(() => {
    if (!member) return;
    getProfileIdByNickname(member.nickname).then((id) => {
      setProfileId(id);
      if (id) getUserAchievements(id).then(setAchievements);
    });
  }, [member?.nickname]);

  // Load own balance when viewing own profile
  useEffect(() => {
    if (!currentUser || !member) return;
    if (currentUser.nickname.toLowerCase() === member.nickname.toLowerCase()) {
      getNenecoinBalance().then(setBalance);
    }
  }, [currentUser?.id, member?.nickname]);

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
                      href={`/perguntas/${a.question_id}`}
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

          {achievements.length > 0 && (
            <div className="w-full">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                Conquistas
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {achievements.map((a) => (
                  <div
                    key={a.key}
                    title={a.unlocked_at ? a.title : a.description}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                      a.unlocked_at
                        ? "border-accent/30 bg-accent/5"
                        : "border-border opacity-30"
                    }`}
                  >
                    <span className="text-2xl">{a.icon}</span>
                    <span className="text-[10px] text-center text-muted leading-tight">
                      {a.title}
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
                    href={`/perfil/${f.nickname.toLowerCase()}`}
                    className="flex flex-col items-center gap-1.5 hover:opacity-80 transition-opacity"
                  >
                    <Avatar spriteUrl={f.spriteUrl} nickname={f.nickname} size={48} />
                    <span className="text-xs text-muted">{f.nickname}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </section>
      </main>
    </>
  );
}
