
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from "framer-motion";
import { Avatar } from "@/components/Avatar";
import { AchievementToast } from "@/components/AchievementToast";
import { useAuth } from "@/hooks/useAuth";
import { getPhotoSubmissions, voteOnSubmission } from "@/lib/supabase/queries";
import type { DbPhotoSubmission, UnlockedAchievement } from "@/lib/types";

const SWIPE_THRESHOLD = 120;

export default function VotarFotosPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  const [cards, setCards] = useState<DbPhotoSubmission[]>([]);
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newAchievements, setNewAchievements] = useState<UnlockedAchievement[]>([]);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-16, 16]);
  const approveOpacity = useTransform(x, [40, 140], [0, 1]);
  const rejectOpacity = useTransform(x, [-140, -40], [1, 0]);

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (!profile) return;
    getPhotoSubmissions(profile.id).then((subs) => {
      setCards(
        subs.filter(
          (s) =>
            s.status === "pending" &&
            s.submitter_id !== profile.id &&
            (s.my_vote === null || s.my_vote === undefined)
        )
      );
      setFetching(false);
    });
  }, [profile]);

  function decide(approved: boolean) {
    const top = cards[0];
    if (!top || busy) return;
    setBusy(true);

    // fire-and-forget vote — keep the gesture fluid
    voteOnSubmission({ submission_id: top.id, approved }).then((r) => {
      if (r?.achievements?.length) setNewAchievements(r.achievements);
    });

    animate(x, approved ? 500 : -500, {
      duration: 0.3,
      onComplete: () => {
        setCards((prev) => prev.slice(1));
        x.set(0);
        setBusy(false);
      },
    });
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (busy) return;
    if (info.offset.x > SWIPE_THRESHOLD) decide(true);
    else if (info.offset.x < -SWIPE_THRESHOLD) decide(false);
  }

  if (loading || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  const top = cards[0];
  const stack = cards.slice(0, 3);

  return (
    <>
      <AchievementToast achievements={newAchievements} />
      <main className="fixed inset-0 flex flex-col bg-background z-40">
        {/* top bar */}
        <div className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3">
          <h2 className="font-bold">Votar nas fotos</h2>
          <Link
            to="/fotos"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface border border-border text-muted hover:text-foreground transition-colors"
            aria-label="Fechar"
          >
            ✕
          </Link>
        </div>

        {fetching ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted">Carregando...</p>
          </div>
        ) : !top ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
            <p className="text-5xl">🎉</p>
            <p className="text-lg font-bold">Tudo votado!</p>
            <p className="text-sm text-muted">
              Você já votou em todas as fotos pendentes.
            </p>
            <Link
              to="/fotos"
              className="mt-4 bg-accent hover:bg-accent-hover text-white font-bold px-6 py-3 rounded-xl transition-colors"
            >
              Voltar para Fotos
            </Link>
          </div>
        ) : (
          <>
            {/* deck */}
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="relative w-full max-w-md aspect-square">
              {stack.map((sub, i) => {
                const isTop = i === 0;
                return (
                  <motion.div
                    key={sub.id}
                    className="absolute inset-0 rounded-3xl overflow-hidden bg-surface-light border border-border shadow-xl"
                    style={
                      isTop
                        ? { x, rotate, zIndex: 10 }
                        : { zIndex: 10 - i }
                    }
                    initial={false}
                    animate={
                      isTop
                        ? { scale: 1, y: 0 }
                        : { scale: 1 - i * 0.04, y: i * 14 }
                    }
                    drag={isTop && !busy ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragSnapToOrigin
                    dragElastic={0.6}
                    onDragEnd={isTop ? onDragEnd : undefined}
                  >
                    <img
                      src={sub.photo_url}
                      alt={sub.caption ?? "Foto"}
                      className="w-full h-full object-cover pointer-events-none"
                      draggable={false}
                    />

                    {/* gradient + info overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                      {sub.challenge && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-accent/30 text-white backdrop-blur-sm mb-2">
                          🎯 {sub.challenge.title}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        {sub.submitter && (
                          <Avatar
                            spriteUrl={sub.submitter.avatar_url}
                            nickname={sub.submitter.nickname}
                            size={32}
                          />
                        )}
                        <p className="font-bold text-white">
                          {sub.submitter?.nickname}
                        </p>
                      </div>
                      {sub.caption && (
                        <p className="text-sm text-white/90 mt-1.5">
                          {sub.caption}
                        </p>
                      )}
                    </div>

                    {/* swipe direction overlays */}
                    {isTop && (
                      <>
                        <motion.div
                          style={{ opacity: approveOpacity }}
                          className="absolute top-6 left-6 px-4 py-2 rounded-xl border-4 border-green text-green font-black text-2xl tracking-wider rotate-[-12deg]"
                        >
                          APROVAR
                        </motion.div>
                        <motion.div
                          style={{ opacity: rejectOpacity }}
                          className="absolute top-6 right-6 px-4 py-2 rounded-xl border-4 border-red-500 text-red-500 font-black text-2xl tracking-wider rotate-[12deg]"
                        >
                          REJEITAR
                        </motion.div>
                      </>
                    )}
                  </motion.div>
                );
              })}
              </div>
            </div>

            {/* action buttons */}
            <div className="flex items-center justify-center gap-6 px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4">
              <button
                type="button"
                onClick={() => decide(false)}
                disabled={busy}
                aria-label="Rejeitar"
                className="w-16 h-16 flex items-center justify-center rounded-full bg-surface border-2 border-red-500/40 text-3xl hover:border-red-500 transition-colors disabled:opacity-50"
              >
                👎
              </button>
              <button
                type="button"
                onClick={() => decide(true)}
                disabled={busy}
                aria-label="Aprovar"
                className="w-16 h-16 flex items-center justify-center rounded-full bg-surface border-2 border-green/40 text-3xl hover:border-green transition-colors disabled:opacity-50"
              >
                👍
              </button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
