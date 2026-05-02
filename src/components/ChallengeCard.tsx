"use client";

import Link from "next/link";
import { Avatar } from "./Avatar";
import type { DbPhotoChallenge } from "@/lib/types";

interface ChallengeCardProps {
  challenge: DbPhotoChallenge;
  currentUserId: string;
}

function formatDeadline(deadline: string): string {
  const d = new Date(deadline);
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}

function getTimeLeft(deadline: string): string {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return "Expirado";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 1) return `${days} dias restantes`;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h restantes`;
  const mins = Math.floor(diff / (1000 * 60));
  return `${mins}min restantes`;
}

export function ChallengeCard({ challenge, currentUserId }: ChallengeCardProps) {
  const isExpired = new Date(challenge.deadline) < new Date();
  const isCompleted = !!challenge.my_completion;
  const completionCount = challenge.completion_count ?? 0;

  return (
    <Link href={`/fotos/desafios/${challenge.id}`} className="block">
      <div className="bg-surface border border-border rounded-2xl p-5 hover:border-accent/40 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-bold text-sm leading-snug line-clamp-2 flex-1">
            {challenge.title}
          </h3>
          {isExpired ? (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-500/15 text-red-400 shrink-0">
              Expirado
            </span>
          ) : isCompleted ? (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-green/15 text-green shrink-0">
              Completo
            </span>
          ) : (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 shrink-0">
              Ativo
            </span>
          )}
        </div>

        {challenge.description && (
          <p className="text-sm text-muted line-clamp-2 mb-3">
            {challenge.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-2">
            {challenge.creator && (
              <>
                <Avatar
                  spriteUrl={challenge.creator.avatar_url}
                  nickname={challenge.creator.nickname}
                  size={20}
                />
                <span>{challenge.creator.nickname}</span>
              </>
            )}
          </div>
          <span className="text-accent font-semibold">
            +{challenge.points_reward} pts
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>📅</span>
            <span>
              {isExpired ? `Encerrou ${formatDeadline(challenge.deadline)}` : getTimeLeft(challenge.deadline)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {completionCount > 0 && challenge.completions && (
              <div className="flex -space-x-1.5">
                {challenge.completions.slice(0, 4).map((c) => (
                  <div key={c.id} className="ring-2 ring-surface rounded-full">
                    <Avatar
                      spriteUrl={c.user?.avatar_url ?? null}
                      nickname={c.user?.nickname ?? "?"}
                      size={18}
                    />
                  </div>
                ))}
              </div>
            )}
            <span className="text-xs text-muted">
              {completionCount}/8
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
