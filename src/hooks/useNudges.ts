import { useEffect, useState } from "react";
import { getNudgeCounts, type NudgeCounts } from "@/lib/supabase/queries";

export interface Nudge {
  emoji: string;
  text: string;
  to: string;
}

const MAX_NUDGES = 3;

function buildNudges(counts: NudgeCounts): Nudge[] {
  const nudges: Nudge[] = [];

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
    getNudgeCounts(userId)
      .then((counts) => setNudges(buildNudges(counts)))
      .finally(() => setLoading(false));
  }, [userId]);

  return { nudges, loading };
}
