
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { getWcLeaderboard } from "@/lib/supabase/queries";
import { ADULTS } from "@/lib/constants";
import type { WcLeaderboardEntry } from "@/lib/types";

const MEDAL = ["", "", ""];

export default function CopaRankingPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<WcLeaderboardEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (!profile) return;
    getWcLeaderboard().then((lb) => {
      setLeaderboard(lb);
      setFetching(false);
    });
  }, [profile]);

  if (loading || fetching || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link
              to="/copa"
              className="flex items-center gap-3 text-muted hover:text-foreground transition-colors"
            >
              <span>&#8249;</span>
              <h1 className="text-xl font-bold text-foreground">
                Ranking do Bolao
              </h1>
            </Link>
          </div>

          {/* Podium */}
          {leaderboard.length >= 3 && (
            <div className="flex items-end justify-center gap-4 py-4">
              {[1, 0, 2].map((rank) => {
                const entry = leaderboard[rank];
                if (!entry) return null;
                const member = ADULTS.find((a) => a.nickname === entry.nickname);
                const height = rank === 0 ? "h-24" : rank === 1 ? "h-20" : "h-16";
                return (
                  <div key={entry.user_id} className="flex flex-col items-center">
                    <p className="text-2xl mb-1">{MEDAL[rank]}</p>
                    <Avatar
                      spriteUrl={member?.spriteUrl ?? entry.avatar_url}
                      nickname={entry.nickname}
                      size={rank === 0 ? 56 : 44}
                    />
                    <p className="text-xs font-bold mt-1">{entry.nickname}</p>
                    <p className="text-sm font-bold text-accent">{entry.total_points}</p>
                    <div className={`w-20 ${height} bg-accent/10 border-t-2 border-accent rounded-t-lg mt-2`} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Full table */}
          <Card>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">
                Nenhum palpite computado ainda
              </p>
            ) : (
              <div className="space-y-1">
                {/* Header */}
                <div className="flex items-center gap-3 text-[10px] font-bold text-muted uppercase tracking-wider pb-2 border-b border-border mb-2 px-2">
                  <span className="w-6">#</span>
                  <span className="flex-1">Jogador</span>
                  <span className="w-12 text-center">Jogos</span>
                  <span className="w-12 text-center">Exatos</span>
                  <span className="w-14 text-right">Pontos</span>
                </div>

                {leaderboard.map((entry, i) => {
                  const member = ADULTS.find((a) => a.nickname === entry.nickname);
                  const isUser = entry.user_id === profile.id;
                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-3 py-2 rounded-lg px-2 ${
                        isUser ? "bg-surface-light" : ""
                      }`}
                    >
                      <span className={`text-sm font-bold w-6 ${i < 3 ? "text-accent" : "text-muted"}`}>
                        {i + 1}
                      </span>
                      <Avatar
                        spriteUrl={member?.spriteUrl ?? entry.avatar_url}
                        nickname={entry.nickname}
                        size={28}
                      />
                      <span className={`font-semibold flex-1 text-sm ${isUser ? "text-accent" : ""}`}>
                        {entry.nickname}
                      </span>
                      <span className="w-12 text-center text-sm text-muted">
                        {entry.predictions_count}
                      </span>
                      <span className="w-12 text-center text-sm text-muted">
                        {entry.exact_scores}
                      </span>
                      <span className="w-14 text-right text-sm font-bold">
                        {entry.total_points}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
