import { useEffect, useState } from "react";
import {
  getNudgeCounts,
  getRobinHoodState,
  type NudgeCounts,
} from "@/lib/supabase/queries";
import type { RobinHoodState } from "@/lib/types";

export interface Nudge {
  emoji: string;
  text: string;
  to: string;
}

const MAX_NUDGES = 3;

function buildNudges(counts: NudgeCounts, rh: RobinHoodState | null): Nudge[] {
  const nudges: Nudge[] = [];

  // Revanche Robin Hood: janela curta (24h) e rara — mostra na frente enquanto
  // houver lobby aberto que o membro ainda não entrou.
  if (rh?.raid && !rh.raid.i_joined) {
    nudges.push({
      emoji: "🏹",
      text: `Revanche Robin Hood aberta (${rh.raid.count}/${rh.quorum})`,
      to: "/loja",
    });
  }

  if (counts.unansweredQuestions > 0) {
    const n = counts.unansweredQuestions;
    nudges.push({
      emoji: "❓",
      text: `${n} pergunta${n > 1 ? "s" : ""} para responder`,
      to: "/perguntas",
    });
  }

  if (counts.pendingPhotoVotes > 0) {
    const n = counts.pendingPhotoVotes;
    nudges.push({
      emoji: "📸",
      text: `${n} foto${n > 1 ? "s" : ""} para votar`,
      to: "/fotos",
    });
  }

  // janela curta (48h) e some sozinha: fica na frente dos desafios abertos
  if (counts.openBestVotes > 0) {
    const n = counts.openBestVotes;
    nudges.push({
      emoji: "🏅",
      text: `${n} ${n > 1 ? "melhores fotos" : "melhor foto"} para eleger`,
      to: "/fotos/desafios",
    });
  }

  if (counts.activeChallenges > 0) {
    const n = counts.activeChallenges;
    nudges.push({
      emoji: "🏆",
      text: `${n} desafio${n > 1 ? "s" : ""} aberto${n > 1 ? "s" : ""}`,
      to: "/fotos/desafios",
    });
  }

  if (counts.unpredictedMatches > 0) {
    const n = counts.unpredictedMatches;
    nudges.push({
      emoji: "⚽",
      text: `${n} jogo${n > 1 ? "s" : ""} sem palpite`,
      to: "/copa",
    });
  }

  if (counts.questionsCreated === 0) {
    nudges.push({
      emoji: "✏️",
      text: "Crie sua primeira pergunta!",
      to: "/perguntas/nova",
    });
  }

  return nudges.slice(0, MAX_NUDGES);
}

export function useNudges(userId: string | undefined) {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    Promise.all([getNudgeCounts(userId), getRobinHoodState()])
      .then(([counts, rh]) => setNudges(buildNudges(counts, rh)))
      .finally(() => setLoading(false));
  }, [userId]);

  return { nudges, loading };
}
