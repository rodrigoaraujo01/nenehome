"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { AchievementToast } from "@/components/AchievementToast";
import { useAuth } from "@/hooks/useAuth";
import { getPhotoSubmission, voteOnSubmission } from "@/lib/supabase/queries";
import { ADULTS } from "@/lib/constants";
import type { DbPhotoSubmission, VoteResult, UnlockedAchievement } from "@/lib/types";

export default function FotoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, loading } = useAuth();
  const router = useRouter();

  const [submission, setSubmission] = useState<DbPhotoSubmission | null>(null);
  const [fetching, setFetching] = useState(true);
  const [voting, setVoting] = useState(false);
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null);
  const [newAchievements, setNewAchievements] = useState<UnlockedAchievement[]>([]);

  useEffect(() => {
    if (!loading && !profile) router.push("/login");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile || !id) return;
    getPhotoSubmission(id, profile.id).then((s) => {
      setSubmission(s);
      setFetching(false);
    });
  }, [profile, id]);

  if (loading || fetching || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  if (!submission) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted">Foto não encontrada.</p>
        </main>
      </>
    );
  }

  const isOwn = submission.submitter_id === profile.id;
  const voted =
    voteResult !== null ||
    (submission.my_vote !== null && submission.my_vote !== undefined);
  const canVote = submission.status === "pending" && !isOwn && !voted;

  const currentStatus = voteResult?.status ?? submission.status;
  const approveCount = voteResult?.approve_count ?? submission.approve_count ?? 0;
  const rejectCount = voteResult?.reject_count ?? submission.reject_count ?? 0;
  const threshold = submission.votes_to_approve;
  const progress = Math.min((approveCount / threshold) * 100, 100);

  async function handleVote(approved: boolean) {
    if (!submission) return;
    setVoting(true);
    const result = await voteOnSubmission({
      submission_id: submission.id,
      approved,
    });
    setVoting(false);
    if (result) {
      setVoteResult(result);
      if (result.achievements?.length) setNewAchievements(result.achievements);
    }
  }

  // build voter list from raw votes (joined data)
  const rawVotes = (submission.votes ?? []) as Array<{
    voter_id: string;
    approved: boolean;
    profiles?: { nickname: string; avatar_url: string | null };
  }>;

  const approvers = rawVotes.filter((v) => v.approved);
  const rejecters = rawVotes.filter((v) => !v.approved);

  return (
    <>
      <AchievementToast achievements={newAchievements} />
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-5">
          <Link href="/fotos" className="flex items-center gap-3 text-muted hover:text-foreground transition-colors">
            <span>‹</span>
            <span className="text-sm font-bold text-foreground">Fotos</span>
          </Link>

          {/* photo */}
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-surface-light">
            <Image
              src={submission.photo_url}
              alt={submission.caption ?? "Foto"}
              fill
              className="object-cover"
              unoptimized
            />
          </div>

          {/* challenge badge */}
          {submission.challenge && (
            <Link
              href={`/fotos/desafios/${submission.challenge.id}`}
              className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-xl px-3 py-2 hover:bg-accent/15 transition-colors"
            >
              <span className="text-sm">🎯</span>
              <span className="text-sm font-semibold text-accent">
                {submission.challenge.title}
              </span>
            </Link>
          )}

          {/* submitter + caption */}
          <div className="flex items-start gap-3">
            {submission.submitter && (
              <Avatar
                spriteUrl={submission.submitter.avatar_url}
                nickname={submission.submitter.nickname}
                size={36}
              />
            )}
            <div>
              <p className="font-semibold">{submission.submitter?.nickname}</p>
              {submission.caption && (
                <p className="text-sm text-muted mt-0.5">{submission.caption}</p>
              )}
            </div>
          </div>

          {/* vote progress */}
          {currentStatus === "pending" && (
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">Aprovações</span>
                <span className="text-muted">
                  {approveCount} de {threshold} necessárias
                  {rejectCount > 0 ? ` · ${rejectCount} rejeição(ões)` : ""}
                </span>
              </div>
              <div className="h-2 bg-surface-light rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* vote buttons */}
              {canVote && (
                <div className="flex gap-3 pt-1">
                  <Button
                    onClick={() => handleVote(true)}
                    disabled={voting}
                    className="flex-1"
                  >
                    {voting ? "..." : "👍 Aprovar"}
                  </Button>
                  <Button
                    onClick={() => handleVote(false)}
                    variant="ghost"
                    disabled={voting}
                    className="flex-1"
                  >
                    {voting ? "..." : "👎 Rejeitar"}
                  </Button>
                </div>
              )}

              {voted && !canVote && (
                <p className="text-sm text-muted text-center pt-1">
                  {isOwn
                    ? "Você não pode votar na própria foto"
                    : `Você ${
                        (voteResult ? voteResult.approve_count > (submission.approve_count ?? 0) : submission.my_vote)
                          ? "aprovou"
                          : "rejeitou"
                      } esta foto`}
                </p>
              )}
            </div>
          )}

          {currentStatus === "approved" && (
            <div className="bg-green/10 border border-green/30 rounded-2xl p-4">
              <p className="text-green font-bold">
                ✓ Aprovada pelo grupo!
              </p>
              <p className="text-sm text-muted mt-1">
                {submission.submitter?.nickname} ganhou +{submission.points_reward} pts
              </p>
            </div>
          )}

          {/* who voted */}
          {rawVotes.length > 0 && (
            <div className="space-y-3">
              {approvers.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Aprovaram ({approvers.length})
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {approvers.map((v) => {
                      const m = ADULTS.find((a) => a.id === v.voter_id);
                      const nick = v.profiles?.nickname ?? m?.nickname ?? "?";
                      const avatar = v.profiles?.avatar_url ?? m?.spriteUrl ?? null;
                      return (
                        <div key={v.voter_id} className="flex flex-col items-center gap-1">
                          <Avatar spriteUrl={avatar} nickname={nick} size={32} />
                          <span className="text-xs text-muted">{nick}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {rejecters.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Rejeitaram ({rejecters.length})
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {rejecters.map((v) => {
                      const m = ADULTS.find((a) => a.id === v.voter_id);
                      const nick = v.profiles?.nickname ?? m?.nickname ?? "?";
                      const avatar = v.profiles?.avatar_url ?? m?.spriteUrl ?? null;
                      return (
                        <div key={v.voter_id} className="flex flex-col items-center gap-1">
                          <Avatar spriteUrl={avatar} nickname={nick} size={32} />
                          <span className="text-xs text-muted">{nick}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
