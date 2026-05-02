"use client";

import Link from "next/link";
import Image from "next/image";
import { Avatar } from "./Avatar";
import type { DbPhotoSubmission } from "@/lib/types";

interface PhotoCardProps {
  submission: DbPhotoSubmission;
  currentUserId: string;
}

const STATUS_LABEL = {
  pending: "Votação aberta",
  approved: "Aprovada",
  rejected: "Rejeitada",
} as const;

const STATUS_STYLE = {
  pending: "bg-yellow-500/15 text-yellow-400",
  approved: "bg-green/15 text-green",
  rejected: "bg-red-500/15 text-red-400",
} as const;

export function PhotoCard({ submission, currentUserId }: PhotoCardProps) {
  const isOwn = submission.submitter_id === currentUserId;
  const voted = submission.my_vote !== null && submission.my_vote !== undefined;
  const canVote = submission.status === "pending" && !isOwn && !voted;

  const approveCount = submission.approve_count ?? 0;
  const threshold = submission.votes_to_approve;
  const progress = Math.min((approveCount / threshold) * 100, 100);

  return (
    <Link href={`/fotos/${submission.id}`} className="block">
      <div className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-accent/40 transition-colors">
        {/* photo */}
        <div className="relative aspect-square w-full bg-surface-light">
          <Image
            src={submission.photo_url}
            alt={submission.caption ?? "Foto"}
            fill
            className="object-cover"
            unoptimized
          />
          <span
            className={`absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-full ${
              STATUS_STYLE[submission.status]
            }`}
          >
            {STATUS_LABEL[submission.status]}
          </span>
        </div>

        <div className="p-4 space-y-3">
          {/* submitter + caption */}
          <div className="flex items-start gap-2">
            {submission.submitter && (
              <Avatar
                spriteUrl={submission.submitter.avatar_url}
                nickname={submission.submitter.nickname}
                size={28}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted">
                {submission.submitter?.nickname}
              </p>
              {submission.caption && (
                <p className="text-sm mt-0.5 line-clamp-2">{submission.caption}</p>
              )}
            </div>
          </div>

          {/* vote progress */}
          {submission.status === "pending" && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">
                {canVote
                  ? "Seu voto faz diferença"
                  : voted
                  ? `Você ${submission.my_vote ? "aprovou" : "rejeitou"}`
                  : isOwn
                  ? "Aguardando votos"
                  : ""}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-surface-light rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted shrink-0">
                  {approveCount}/{threshold}
                </span>
              </div>
            </div>
          )}

          {submission.status === "approved" && (
            <p className="text-xs text-green font-semibold">
              +{submission.points_reward} pts para {submission.submitter?.nickname}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
