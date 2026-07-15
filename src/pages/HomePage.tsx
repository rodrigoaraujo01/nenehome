
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/Card";
import { CurrencyBadge } from "@/components/CurrencyBadge";
import { PushBanner } from "@/components/PushBanner";
import { useAuth } from "@/hooks/useAuth";
import { useCosmetics, nameStyleCss } from "@/hooks/useCosmetics";
import { useNudges } from "@/hooks/useNudges";
import { getLeaderboard, getNenecoinBalance, getGiftMessages, settleExpiredQuestions, settleExpiredChallengeBests } from "@/lib/supabase/queries";
import { ADULTS } from "@/lib/constants";
import type { LeaderboardEntry, NenecoinBalance, GiftMessage } from "@/lib/types";

const DISMISSED_KEY = "dismissed_gift_messages";

export default function Home() {
  const { profile, loading } = useAuth();
  const { frameFor, nameStyleFor } = useCosmetics();
  const { nudges, loading: nudgesLoading } = useNudges(profile?.id);
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [balance, setBalance] = useState<NenecoinBalance | null>(null);
  const [giftMessages, setGiftMessages] = useState<GiftMessage[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (!profile) return;
    // Liquida perguntas e votações de melhor foto vencidas antes de ler o
    // ranking, senão os pontos do settle só apareceriam no próximo load.
    Promise.all([settleExpiredQuestions(), settleExpiredChallengeBests()]).then(
      () => getLeaderboard().then(setLeaderboard),
    );
    getNenecoinBalance().then(setBalance);
    getGiftMessages(profile.id).then(setGiftMessages);
  }, [profile]);

  if (loading || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  const currentMember = ADULTS.find((m) => m.nickname === profile.nickname);
  const userRank =
    leaderboard.findIndex((r) => r.user_id === profile.id) + 1 || null;
  const userPoints =
    leaderboard.find((r) => r.user_id === profile.id)?.total_points ?? 0;

  function dismissGift(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next])); } catch {}
  }

  const visibleGifts = giftMessages.filter((m) => !dismissed.has(m.id));

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">

          {/* greeting */}
          <div className="flex items-center gap-4">
            <Avatar
              spriteUrl={currentMember?.spriteUrl ?? profile.avatar_url}
              nickname={profile.nickname}
              size={64}
              frame={frameFor(profile.nickname)}
            />
            <div>
              <p className="text-muted text-sm">Olá,</p>
              <p className="text-2xl font-bold" style={nameStyleCss(nameStyleFor(profile.nickname))}>
                {profile.nickname}
              </p>
              {userRank && (
                <p className="text-muted text-xs">#{userRank} no ranking</p>
              )}
            </div>
          </div>

          {/* currencies */}
          <div className="flex gap-3">
            <CurrencyBadge
              value={userPoints}
              label="pontos"
              icon="points"
            />
            {balance && (
              <CurrencyBadge
                value={balance.nenecoin_balance}
                label="nenecoins"
                icon="nenecoins"
              />
            )}
            {balance && balance.firecoin_balance > 0 && (
              <CurrencyBadge
                value={balance.firecoin_balance}
                label="firecoins"
                icon="firecoins"
              />
            )}
          </div>

          {/* push opt-in */}
          <PushBanner userId={profile.id} />

          {/* gift messages */}
          {visibleGifts.length > 0 && (
            <div className="space-y-2">
              {visibleGifts.map((msg) => {
                const isCustomNote = msg.note && !msg.note.startsWith("Presente de ");
                return (
                  <div
                    key={msg.id}
                    className="bg-green/10 border border-green/30 rounded-2xl px-4 py-3 flex items-start gap-3"
                  >
                    <span className="text-xl shrink-0">🎁</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {msg.sender_nickname
                          ? `${msg.sender_nickname} te enviou +${msg.amount} nenecoins`
                          : `+${msg.amount} nenecoins`}
                      </p>
                      {isCustomNote && (
                        <p className="text-xs text-muted mt-0.5 italic">"{msg.note}"</p>
                      )}
                      {!isCustomNote && msg.note && (
                        <p className="text-xs text-muted mt-0.5">{msg.note}</p>
                      )}
                    </div>
                    <button
                      onClick={() => dismissGift(msg.id)}
                      className="text-muted hover:text-foreground transition-colors shrink-0 text-lg leading-none"
                      aria-label="Dispensar"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Copa 2026 banner */}
          <Link to="/copa" className="block">
            <div className="bg-gradient-to-r from-green/20 via-yellow-500/20 to-blue-500/20 border border-green/30 rounded-2xl p-4 hover:border-green/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-lg">Copa 2026</p>
                  <p className="text-xs text-muted mt-0.5">Faca seus palpites e aposte nenecoins</p>
                </div>
                <span className="text-3xl">&#9917;</span>
              </div>
            </div>
          </Link>

          {/* quick access */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/perguntas"
              className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-2xl px-4 py-4 hover:bg-accent/20 transition-colors"
            >
              <div>
                <p className="font-bold">Perguntas</p>
                <p className="text-xs text-muted mt-0.5">Responda e pontue</p>
              </div>
              <span className="text-accent text-lg">›</span>
            </Link>
            <Link
              to="/fotos"
              className="flex items-center justify-between bg-purple/10 border border-purple/30 rounded-2xl px-4 py-4 hover:bg-purple/20 transition-colors"
            >
              <div>
                <p className="font-bold">Fotos</p>
                <p className="text-xs text-muted mt-0.5">Vote e envie</p>
              </div>
              <span className="text-purple text-lg">›</span>
            </Link>
          </div>

          {/* nudges */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-3">
              Missões ativas
            </h2>
            {nudgesLoading ? (
              <Card>
                <div className="h-5 bg-surface-light rounded animate-pulse" />
              </Card>
            ) : nudges.length === 0 ? (
              <Card>
                <p className="text-sm text-muted text-center py-2">
                  Tudo em dia!
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {nudges.map((nudge) => (
                  <Link key={nudge.to} to={nudge.to} className="block">
                    <Card className="hover:border-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{nudge.emoji}</span>
                        <p className="font-semibold flex-1">{nudge.text}</p>
                        <span className="text-muted text-lg">›</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* leaderboard */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-3">
              Ranking
            </h2>
            <Card>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">
                  Nenhum ponto ainda — seja o primeiro!
                </p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((r, i) => {
                    const member = ADULTS.find(
                      (a) => a.nickname === r.nickname
                    );
                    const isUser = r.user_id === profile.id;
                    return (
                      <Link
                        key={r.user_id}
                        to={`/perfil/${r.nickname.toLowerCase()}`}
                        className={`flex items-center gap-3 py-1.5 rounded-lg transition-colors hover:bg-surface-light px-2 -mx-2 ${
                          isUser ? "bg-surface-light" : ""
                        }`}
                      >
                        <span
                          className={`text-sm font-bold w-6 ${
                            i < 3 ? "text-accent" : "text-muted"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <Avatar
                          spriteUrl={member?.spriteUrl ?? r.avatar_url}
                          nickname={r.nickname}
                          size={44}
                          frame={frameFor(r.nickname)}
                        />
                        <span
                          className={`font-semibold flex-1 ${
                            isUser ? "text-accent" : ""
                          }`}
                        >
                          <span style={nameStyleCss(nameStyleFor(r.nickname))}>
                            {r.nickname}
                          </span>
                        </span>
                        <span className="text-right leading-tight">
                          <span className="block text-sm text-white">
                            {r.total_points}pts
                          </span>
                          <span className="block text-xs text-muted">
                            {r.nenecoin_balance} nc
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </section>

          {/* group */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-3">
              O grupo
            </h2>
            <div className="grid grid-cols-4 gap-4">
              {ADULTS.map((m) => (
                <Link
                  key={m.id}
                  to={`/perfil/${m.nickname.toLowerCase()}`}
                  className="flex flex-col items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <Avatar
                    spriteUrl={m.spriteUrl}
                    nickname={m.nickname}
                    size={48}
                  />
                  <span className="text-xs text-muted">{m.nickname}</span>
                </Link>
              ))}
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
