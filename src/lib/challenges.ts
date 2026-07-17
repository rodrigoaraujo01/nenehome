import type { DbPhotoChallenge } from "./types";

const BEST_VOTE_WINDOW_MS = 48 * 60 * 60 * 1000;

// Momento em que a votação de melhor foto fecha (deadline + 48h).
export function bestVoteClosesAt(challenge: DbPhotoChallenge): Date {
  return new Date(new Date(challenge.deadline).getTime() + BEST_VOTE_WINDOW_MS);
}

// A votação de melhor foto está aberta agora? Precisa: prazo do desafio vencido,
// ainda dentro da janela de 48h, não apurada e com disputa (2+ fotos aprovadas).
export function isBestVoteOpen(challenge: DbPhotoChallenge): boolean {
  if (challenge.best_settled_at) return false;
  if ((challenge.approved_count ?? 0) < 2) return false;
  const now = Date.now();
  const deadline = new Date(challenge.deadline).getTime();
  return now >= deadline && now < deadline + BEST_VOTE_WINDOW_MS;
}
