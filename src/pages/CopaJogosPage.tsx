
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { getWcMatches } from "@/lib/supabase/queries";
import type { WcMatch } from "@/lib/types";

const STAGE_LABELS: Record<string, string> = {
  group: "Fase de Grupos",
  round_of_32: "32 avos de final",
  round_of_16: "Oitavas de final",
  quarter: "Quartas de final",
  semi: "Semifinais",
  third_place: "Disputa de 3o lugar",
  final: "Final",
};

function MatchCard({ match }: { match: WcMatch }) {
  const kickoff = new Date(match.date);
  const isPast = match.status === "finished";
  const isLive = match.status === "live";
  const hasPrediction = !!match.my_prediction;

  return (
    <Link to={`/copa/jogo/${match.id}`} className="block">
      <div
        className={`bg-surface border rounded-2xl p-4 transition-colors hover:border-accent/40 ${
          isLive ? "border-green" : "border-border"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted">
            {kickoff.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            {" "}
            {kickoff.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {isLive && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-green bg-green/15 px-2 py-0.5 rounded-full">
              Ao Vivo
            </span>
          )}
          {isPast && match.home_score !== null && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted bg-surface-light px-2 py-0.5 rounded-full">
              Encerrado
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 text-right">
            <p className="font-semibold text-sm">{match.home_team}</p>
            <p className="text-lg">{match.home_flag}</p>
          </div>

          <div className="text-center min-w-[60px]">
            {match.home_score !== null && match.away_score !== null ? (
              <p className="text-2xl font-bold">
                {match.home_score} <span className="text-muted">x</span> {match.away_score}
              </p>
            ) : (
              <p className="text-sm text-muted">vs</p>
            )}
          </div>

          <div className="flex-1">
            <p className="font-semibold text-sm">{match.away_team}</p>
            <p className="text-lg">{match.away_flag}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          {hasPrediction ? (
            <span className="text-xs text-accent font-semibold">
              Palpite: {match.my_prediction!.home_score} x {match.my_prediction!.away_score}
              {match.my_prediction!.coins_wagered > 0 && (
                <span className="text-yellow-400 ml-1">
                  ({match.my_prediction!.coins_wagered} coins)
                </span>
              )}
            </span>
          ) : isPast ? (
            <span className="text-xs text-muted">Sem palpite</span>
          ) : (
            <span className="text-xs text-muted">Fazer palpite &#8250;</span>
          )}
          {match.my_prediction?.points_earned != null && (
            <span className={`text-sm font-bold ${match.my_prediction.points_earned > 0 ? "text-green" : "text-red-400"}`}>
              +{match.my_prediction.points_earned}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function CopaJogosPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<WcMatch[]>([]);
  const [fetching, setFetching] = useState(true);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const didScrollRef = useRef(false);

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (!profile) return;
    getWcMatches(profile.id).then((m) => {
      setMatches(m);
      setFetching(false);
    });
  }, [profile]);

  // Group by date (computed before the early return so the scroll effect can use it)
  const grouped = matches.reduce<Record<string, WcMatch[]>>((acc, m) => {
    const dateKey = new Date(m.date).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(m);
    return acc;
  }, {});

  // First day group that is today or in the future (auto-scroll target)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const scrollTargetKey = Object.entries(grouped).find(([, dayMatches]) =>
    dayMatches.some((m) => new Date(m.date) >= startOfToday),
  )?.[0];

  useEffect(() => {
    if (fetching || didScrollRef.current || !scrollTargetKey) return;
    const el = sectionRefs.current[scrollTargetKey];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      didScrollRef.current = true;
    }
  }, [fetching, scrollTargetKey]);

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
              <h1 className="text-xl font-bold text-foreground">Jogos</h1>
            </Link>
          </div>

          {Object.entries(grouped).map(([dateLabel, dayMatches]) => (
            <section
              key={dateLabel}
              ref={(el) => {
                sectionRefs.current[dateLabel] = el;
              }}
              className="space-y-3 scroll-mt-24"
            >
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                {dateLabel}
              </h3>
              {dayMatches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </section>
          ))}

          {matches.length === 0 && (
            <div className="text-center py-16 text-muted">
              <p className="text-4xl mb-3">&#9917;</p>
              <p className="font-semibold">Nenhum jogo cadastrado ainda</p>
              <p className="text-sm mt-1">Os jogos serao adicionados em breve!</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
