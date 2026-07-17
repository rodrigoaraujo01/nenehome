
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { AchievementToast } from "@/components/AchievementToast";
import { useAuth } from "@/hooks/useAuth";
import {
  getQuestion,
  submitAnswer,
  getQuestionAnswers,
  deleteQuestion,
  settleQuestion,
  getPowerupInventory,
  getPowerups,
  buyPowerup,
  useEliminateOption,
  deploySabotage,
  getAdultProfiles,
  getNenecoinBalance,
  getMySabotage,
  getQuestionComments,
  createQuestionComment,
} from "@/lib/supabase/queries";
import { ADULTS } from "@/lib/constants";
import type { DbQuestion, AnswerResult, UnlockedAchievement, QuestionAnswer, QuestionComment, NenecoinBalance, MySabotage, Powerup } from "@/lib/types";

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

const DIFFICULTY: Record<
  string,
  { label: string; emoji: string; cls: string }
> = {
  easy: { label: "Fácil", emoji: "🟢", cls: "text-green" },
  medium: { label: "Médio", emoji: "🟡", cls: "text-yellow-400" },
  hard: { label: "Difícil", emoji: "🔴", cls: "text-red-400" },
  impossible: { label: "Impossível", emoji: "💀", cls: "text-muted" },
};

function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Prazo encerrado";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 1) return `${days} dias restantes`;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h restantes`;
  return `${Math.floor(diff / (1000 * 60))}min restantes`;
}

export default function PerguntaPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  const [question, setQuestion] = useState<DbQuestion | null>(null);
  const [fetching, setFetching] = useState(true);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [allAnswers, setAllAnswers] = useState<QuestionAnswer[]>([]);
  const [newAchievements, setNewAchievements] = useState<UnlockedAchievement[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // poderes (power-ups)
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [catalog, setCatalog] = useState<Record<string, Powerup>>({});
  const [eliminatedOptionId, setEliminatedOptionId] = useState<string | null>(null);
  const [useSecondChance, setUseSecondChance] = useState(false);
  const [secondChanceUsed, setSecondChanceUsed] = useState(false);
  const [powerupMsg, setPowerupMsg] = useState<string | null>(null);
  const [powerupBusy, setPowerupBusy] = useState(false);
  const [sabotageOpen, setSabotageOpen] = useState(false);
  // multi-alvo: 1 token de Sabotagem por alvo selecionado
  const [sabotageTargets, setSabotageTargets] = useState<string[]>([]);
  const [sabotageText, setSabotageText] = useState("");
  const [sabotageBusy, setSabotageBusy] = useState(false);
  const [sabotageError, setSabotageError] = useState<string | null>(null);
  const [adults, setAdults] = useState<
    { id: string; nickname: string; avatar_url: string | null }[]
  >([]);
  // aposta de coins na pergunta (estilo bolão)
  const [balance, setBalance] = useState<NenecoinBalance | null>(null);
  const [wager, setWager] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mySabotage, setMySabotage] = useState<MySabotage | null>(null);
  const [comments, setComments] = useState<QuestionComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (!profile || !id) return;
    // settle preguiçoso: idempotente e guardado por elegibilidade no RPC. Cobre
    // perguntas que já tinham todas as respostas antes do settle existir.
    settleQuestion(id)
      .catch(() => {})
      .finally(() => {
        getQuestion(id, profile.id).then(async (q) => {
          setQuestion(q);
          if (q?.my_answer) {
            // Respostas e conversa só são liberadas depois de responder.
            const [answers, loadedComments, sabotage] = await Promise.all([
              getQuestionAnswers(id),
              getQuestionComments(id),
              getMySabotage(id),
            ]);
            setAllAnswers(answers);
            setComments(loadedComments);
            setMySabotage(sabotage);
          } else if (q?.creator_id === profile.id) {
            // O criador não responde, mas acompanha tudo na pergunta dele.
            const [answers, loadedComments] = await Promise.all([
              getQuestionAnswers(id),
              getQuestionComments(id),
            ]);
            setAllAnswers(answers);
            setComments(loadedComments);
          }
          // power-ups + saldo: só importa em perguntas ativas
          if (q && q.status !== "closed") {
            const [inv, ppl, bal, cat] = await Promise.all([
              getPowerupInventory(),
              getAdultProfiles(),
              getNenecoinBalance(),
              getPowerups(),
            ]);
            setInventory(
              Object.fromEntries(inv.map((i) => [i.powerup_key, i.qty]))
            );
            setAdults(ppl);
            setBalance(bal);
            setCatalog(Object.fromEntries(cat.map((p) => [p.key, p])));
          }
          setFetching(false);
        });
      });
  }, [profile, id]);

  if (loading || fetching || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  if (!question) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted">Pergunta não encontrada.</p>
        </main>
      </>
    );
  }

  const isCreator = profile.id === question.creator_id;
  const alreadyAnswered = !!question.my_answer;
  const isCorrect = question.my_answer?.is_correct ?? result?.is_correct;
  // Quem caiu na Sabotagem tem selected_option_id null — a escolha real foi a
  // decoy (reinjetada nas options pós-resposta), então destacamos ela.
  const decoyOptionId = question.options?.find((o) => o.is_decoy)?.id ?? null;
  const displaySelectedOptionId = question.my_answer
    ? question.my_answer.selected_option_id ?? decoyOptionId
    : selectedOptionId;
  const displaySelectedSubjectId =
    question.my_answer?.subject_guess_id ?? selectedSubjectId;

  async function handleSubmit() {
    if (!question) return;
    // Se a opção escolhida for a decoy da sabotagem, manda como sabotage_option_id
    const picked = question.options?.find((o) => o.id === selectedOptionId);
    const isDecoyPick = !!picked?.is_decoy;
    setSubmitting(true);
    setSubmitError(null);
    const res = await submitAnswer({
      question_id: question.id,
      selected_option_id: isDecoyPick ? undefined : selectedOptionId ?? undefined,
      sabotage_option_id: isDecoyPick ? selectedOptionId ?? undefined : undefined,
      subject_guess_id: selectedSubjectId ?? undefined,
      use_second_chance: useSecondChance && !secondChanceUsed,
      coins_wagered: wager,
    });
    setSubmitting(false);
    if (!res) return;

    if (res.error) {
      setSubmitError(res.error);
      return;
    }

    // Segunda Chance: tentativa errada descartada → responde de novo
    if (res.retry_granted) {
      setSecondChanceUsed(true);
      setUseSecondChance(false);
      setSelectedOptionId(null);
      setSelectedSubjectId(null);
      setInventory((inv) => ({
        ...inv,
        second_chance: Math.max(0, (inv.second_chance ?? 1) - 1),
      }));
      setPowerupMsg("Errou! 🔁 A tentativa foi descartada — escolha de novo.");
      return;
    }

    setResult(res);
    if (res.achievements?.length) setNewAchievements(res.achievements);
    if (profile) {
      const [updated, answers, sab, loadedComments] = await Promise.all([
        getQuestion(question.id, profile.id),
        getQuestionAnswers(question.id),
        getMySabotage(question.id),
        getQuestionComments(question.id),
      ]);
      if (updated) setQuestion(updated);
      setAllAnswers(answers);
      setMySabotage(sab);
      setComments(loadedComments);
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question || !profile || !commentText.trim() || commenting) return;

    setCommenting(true);
    setCommentError(null);
    const response = await createQuestionComment(
      question.id,
      profile.id,
      commentText,
    );

    if (response.error) {
      setCommentError("Não foi possível enviar o comentário. Tente novamente.");
      setCommenting(false);
      return;
    }

    setCommentText("");
    setComments(await getQuestionComments(question.id));
    setCommenting(false);
  }

  // Garante que o usuário tem ao menos 1 do poder, comprando na hora se preciso.
  // Retorna uma mensagem de erro (ou null em caso de sucesso).
  // Compra o que faltar pra ter `qty` no inventário (Sabotagem gasta 1 por alvo).
  async function ensureOwned(key: string, qty = 1): Promise<string | null> {
    const missing = qty - (inventory[key] ?? 0);
    if (missing <= 0) return null;
    const res = await buyPowerup(key, missing);
    if (res.error) return res.error;
    setInventory((inv) => ({ ...inv, [key]: res.qty ?? (inv[key] ?? 0) + missing }));
    if (res.nenecoin_balance != null) {
      const bal = res.nenecoin_balance;
      setBalance((b) => (b ? { ...b, nenecoin_balance: bal } : b));
    }
    return null;
  }

  async function handleEliminate() {
    if (!question) return;
    setPowerupBusy(true);
    const buyErr = await ensureOwned("eliminate");
    if (buyErr) {
      setPowerupBusy(false);
      setPowerupMsg(buyErr);
      return;
    }
    const res = await useEliminateOption(question.id);
    setPowerupBusy(false);
    if (res.error) {
      setPowerupMsg(res.error);
      return;
    }
    if (res.option_id) {
      setEliminatedOptionId(res.option_id);
      if (selectedOptionId === res.option_id) setSelectedOptionId(null);
      setInventory((inv) => ({
        ...inv,
        eliminate: Math.max(0, (inv.eliminate ?? 1) - 1),
      }));
      setPowerupMsg("✂️ Uma alternativa errada foi removida.");
    }
  }

  async function toggleSecondChance() {
    if (useSecondChance) {
      setUseSecondChance(false);
      return;
    }
    const buyErr = await ensureOwned("second_chance");
    if (buyErr) {
      setPowerupMsg(buyErr);
      return;
    }
    setUseSecondChance(true);
  }

  async function handleSabotage() {
    if (!question || sabotageTargets.length === 0 || !sabotageText.trim()) return;
    const n = sabotageTargets.length;
    setSabotageBusy(true);
    setSabotageError(null);
    const buyErr = await ensureOwned("sabotage", n);
    if (buyErr) {
      setSabotageBusy(false);
      setSabotageError(buyErr);
      return;
    }
    const res = await deploySabotage({
      question_id: question.id,
      target_user_ids: sabotageTargets,
      decoy_text: sabotageText.trim(),
    });
    setSabotageBusy(false);
    if (res.error) {
      setSabotageError(res.error);
      return;
    }
    setInventory((inv) => ({
      ...inv,
      sabotage: res.qty ?? Math.max(0, (inv.sabotage ?? n) - n),
    }));
    setSabotageOpen(false);
    setSabotageTargets([]);
    setSabotageText("");
    setPowerupMsg(
      n === 1
        ? "😈 Sabotagem plantada! Só o alvo vai ver a alternativa falsa."
        : `😈 Sabotagem plantada pra ${n} alvos! Só eles vão ver a alternativa falsa.`,
    );
  }

  async function handleDelete() {
    if (!question) return;
    const hasAnswers = (question.answer_count ?? 0) > 0;
    const msg = hasAnswers
      ? "Excluir esta pergunta? As respostas serão apagadas e todos os pontos e conquistas relacionados serão desfeitos, como se a pergunta nunca tivesse existido."
      : "Excluir esta pergunta?";
    if (!confirm(msg)) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteQuestion(question.id);
    if (result.error) {
      setDeleteError(result.error);
      setDeleting(false);
    } else {
      navigate("/perguntas");
    }
  }

  const canSubmit =
    !isCreator &&
    !alreadyAnswered &&
    !result &&
    (question.type === "multiple_choice"
      ? !!selectedOptionId
      : !!selectedSubjectId);

  // for story: which member matches the subject_id (stored as nickname)
  const correctSubject =
    question.type === "story" && question.subject_id
      ? ADULTS.find((m) => m.nickname === question.subject_id)
      : null;

  const showReveal = isCreator || alreadyAnswered || !!result;

  const isSettled = question.status === "closed";
  const difficultyInfo = question.difficulty
    ? DIFFICULTY[question.difficulty]
    : null;
  // pontos que EU efetivamente ganhei (só existem após o settle)
  const myPoints =
    allAnswers.find((a) => a.user_id === profile.id)?.points_earned ?? 0;
  // acertei mas a pergunta ainda não foi liquidada → pontos pendentes
  const pointsPending = !!isCorrect && !isSettled;
  const familyOnlyImpossible =
    isSettled &&
    question.difficulty === "impossible" &&
    allAnswers.some((answer) => answer.is_correct);

  return (
    <>
      <AchievementToast achievements={newAchievements} />
      <Header />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <Link to="/perguntas" className="flex items-center gap-3 text-muted hover:text-foreground transition-colors">
            <span>‹</span>
            <span className="text-sm font-bold text-foreground">Perguntas</span>
          </Link>

          {/* creator */}
          {question.creator && (
            <div className="flex items-center gap-2">
              <Avatar
                spriteUrl={question.creator.avatar_url}
                nickname={question.creator.nickname}
                size={28}
              />
              <span className="text-sm text-muted">
                {question.creator.nickname} ·{" "}
                {question.answer_count}{" "}
                {question.answer_count === 1 ? "resposta" : "respostas"}
                {!isSettled && question.deadline && (
                  <> · ⏳ {timeLeft(question.deadline)}</>
                )}
              </span>
            </div>
          )}

          {/* question content */}
          <p className="text-lg leading-relaxed">{question.content}</p>

          {/* result banner */}
          {showReveal && !isCreator && (
            <div
              className={`rounded-2xl px-5 py-4 border ${
                isCorrect
                  ? "bg-green/10 border-green/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}
            >
              <p
                className={`font-bold text-lg ${
                  isCorrect ? "text-green" : "text-red-400"
                }`}
              >
                {isCorrect ? "✓ Acertou!" : "✗ Errou"}
              </p>
              {isSettled && isCorrect && myPoints > 0 && (
                <p className="text-sm text-muted mt-1">
                  +{myPoints} pontos
                  {difficultyInfo && (
                    <span className={difficultyInfo.cls}>
                      {" "}
                      · {difficultyInfo.label} {difficultyInfo.emoji}
                    </span>
                  )}
                </p>
              )}
              {pointsPending && (
                <p className="text-sm text-muted mt-1">
                  🕒 Os pontos saem quando todos responderem (ou no fim do prazo)
                  — quanto mais difícil a pergunta, mais vale.
                </p>
              )}
              {isCorrect && familyOnlyImpossible && (
                <p className="text-sm text-muted mt-1">
                  Só a família do criador acertou, então esta pergunta não vale pontos.
                </p>
              )}
              {(question.my_answer?.coins_wagered ?? 0) > 0 && (
                <p className="text-sm mt-1">
                  {isSettled ? (
                    (question.my_answer?.coins_won ?? 0) > 0 ? (
                      <span className="text-yellow-400">
                        🪙 Apostou {question.my_answer?.coins_wagered} · ganhou{" "}
                        {question.my_answer?.coins_won}
                      </span>
                    ) : (
                      <span className="text-muted">
                        🪙 Apostou {question.my_answer?.coins_wagered} · perdeu a aposta
                      </span>
                    )
                  ) : (
                    <span className="text-muted">
                      🪙 Apostou {question.my_answer?.coins_wagered} (já debitado) — ganhos saem no fechamento
                    </span>
                  )}
                </p>
              )}
              {question.type === "story" && correctSubject && (
                <div className="flex items-center gap-2 mt-3">
                  <Avatar
                    spriteUrl={correctSubject.spriteUrl}
                    nickname={correctSubject.nickname}
                    size={32}
                  />
                  <span className="text-sm font-semibold">
                    Era {correctSubject.nickname}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* contra-golpe: fui sabotado nesta pergunta */}
          {mySabotage && (
            <div className="rounded-2xl px-5 py-4 border border-accent/30 bg-accent/10">
              <p className="font-bold text-accent">
                😈 {mySabotage.saboteur} te sabotou!
              </p>
              <p className="text-sm text-muted mt-1">
                {mySabotage.hit
                  ? "Você caiu na alternativa falsa. "
                  : "Você escapou da alternativa falsa. "}
                Revanche: compre uma <Link to="/loja" className="text-accent font-semibold">Sabotagem com 50% de desconto</Link>.
              </p>
            </div>
          )}

          {/* creator notice */}
          {isCreator && (
            <div className="rounded-2xl px-5 py-4 border border-border bg-surface text-center">
              <p className="text-sm text-muted">Você criou esta pergunta e não pode respondê-la.</p>
              {isSettled && question.difficulty === "impossible" && (
                <p className="text-sm text-muted mt-2">
                  {familyOnlyImpossible
                    ? "💀 Só sua família acertou — a pergunta não vale pontos."
                    : "💀 Ninguém acertou — o bônus de criação foi devolvido."}
                </p>
              )}
              {isSettled && question.difficulty === "hard" && (
                <p className="text-sm text-green mt-2">
                  🔴 Pergunta difícil na medida! +10 pontos de bônus.
                </p>
              )}
            </div>
          )}

          {/* multiple choice options */}
          {!isCreator && question.type === "multiple_choice" && question.options && (
            <div className="space-y-2">
              {question.options.filter((o) => o.id !== eliminatedOptionId).map((opt, i) => {
                const isSelected = displaySelectedOptionId === opt.id;
                const isCorrectOpt = showReveal && opt.is_correct;
                const isWrongSelected =
                  showReveal && isSelected && !opt.is_correct;

                return (
                  <button
                    key={opt.id}
                    onClick={() =>
                      !alreadyAnswered && !result && setSelectedOptionId(opt.id)
                    }
                    disabled={alreadyAnswered || !!result}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-colors ${
                      isCorrectOpt
                        ? "border-green bg-green/10 text-green"
                        : isWrongSelected
                        ? "border-red-500 bg-red-500/10 text-red-400"
                        : isSelected
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/40"
                    } disabled:cursor-default`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 ${
                        isCorrectOpt
                          ? "border-green text-green"
                          : isWrongSelected
                          ? "border-red-500 text-red-400"
                          : isSelected
                          ? "border-accent text-accent"
                          : "border-muted/40 text-muted"
                      }`}
                    >
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="text-sm">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* story: member picker */}
          {!isCreator && question.type === "story" && (
            <div>
              {!showReveal && (
                <p className="text-sm text-muted mb-3">
                  Quem você acha que é?
                </p>
              )}
              <div className="grid grid-cols-4 gap-3">
                {ADULTS.map(
                  (m) => {
                    const isSelected = displaySelectedSubjectId === m.nickname;
                    const isCorrectMember =
                      showReveal && m.nickname === question.subject_id;
                    const isWrongMember =
                      showReveal && isSelected && m.nickname !== question.subject_id;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          !alreadyAnswered &&
                          !result &&
                          setSelectedSubjectId(m.nickname)
                        }
                        disabled={alreadyAnswered || !!result}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors disabled:cursor-default ${
                          isCorrectMember
                            ? "border-green bg-green/10"
                            : isWrongMember
                            ? "border-red-500 bg-red-500/10"
                            : isSelected
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-accent/40"
                        }`}
                      >
                        <Avatar
                          spriteUrl={m.spriteUrl}
                          nickname={m.nickname}
                          size={44}
                        />
                        <span className="text-xs">{m.nickname}</span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* all answers (visible after user has answered) */}
          {showReveal && allAnswers.length === 0 && (
            <p className="text-xs text-muted text-center">Nenhuma resposta carregada</p>
          )}

          {showReveal && allAnswers.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-muted uppercase tracking-wider">
                  O que o grupo achou ({allAnswers.length})
                </p>
                {isSettled && difficultyInfo && (
                  <span
                    className={`text-xs font-bold ${difficultyInfo.cls}`}
                    title="Dificuldade da pergunta (definida pelo % de acertos)"
                  >
                    {difficultyInfo.emoji} {difficultyInfo.label}
                  </span>
                )}
              </div>
              {allAnswers.map((ans) => {
                const member = ADULTS.find((m) => m.nickname === ans.nickname);
                const selectedOption = question.type === "multiple_choice"
                  ? question.options?.find((o) => o.id === ans.selected_option_id)
                  : null;
                const guessedMember = question.type === "story"
                  ? ADULTS.find((m) => m.nickname === ans.subject_guess_id)
                  : null;

                return (
                  <div
                    key={ans.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      ans.is_correct ? "border-green/30 bg-green/5" : "border-border"
                    }`}
                  >
                    <Avatar
                      spriteUrl={member?.spriteUrl ?? ans.avatar_url ?? null}
                      nickname={ans.nickname}
                      size={28}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold">{ans.nickname}</span>
                      {ans.sabotage_decoy_text && (
                        <span className="block text-[10px] text-red-400 truncate">
                          🎯 sabotado por {ans.saboteur_nickname}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted text-right max-w-[45%] truncate">
                      {question.type === "multiple_choice"
                        ? selectedOption
                          ? selectedOption.text
                          : ans.sabotage_decoy_text ?? "—"
                        : guessedMember
                        ? guessedMember.nickname
                        : "—"}
                    </span>
                    {isSettled && ans.is_correct && ans.points_earned > 0 && (
                      <span className="text-xs font-semibold text-green">
                        +{ans.points_earned}
                      </span>
                    )}
                    <span className={`text-sm font-bold ${ans.is_correct ? "text-green" : "text-red-400"}`}>
                      {ans.is_correct ? "✓" : "✗"}
                    </span>
                  </div>
                );
              })}
            </section>
          )}

          {/* Conversa liberada pra quem respondeu + o criador. RLS também garante
              isso no servidor. */}
          {(alreadyAnswered || !!result || isCreator) && (
            <section className="space-y-3 border-t border-border pt-5">
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider">
                  Comentários ({comments.length})
                </p>
                <p className="text-[11px] text-muted mt-1">
                  {isCreator
                    ? "Você criou esta pergunta, então acompanha a conversa. Só quem já respondeu vê isto aqui."
                    : "Só quem respondeu esta pergunta consegue ver e comentar."}
                </p>
              </div>

              {comments.length > 0 && (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3">
                      <Avatar
                        spriteUrl={comment.author.avatar_url}
                        nickname={comment.author.nickname}
                        size={28}
                      />
                      <div className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-bold">
                            {comment.author.nickname}
                          </span>
                          <time className="text-[10px] text-muted shrink-0">
                            {new Date(comment.created_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleCommentSubmit} className="space-y-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value.slice(0, 500))}
                  placeholder="Deixe um comentário..."
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-accent/50"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] text-muted">
                    {commentText.length}/500
                  </span>
                  <Button
                    type="submit"
                    disabled={!commentText.trim() || commenting}
                  >
                    {commenting ? "Enviando..." : "Comentar"}
                  </Button>
                </div>
                {commentError && (
                  <p className="text-xs text-red-400">{commentError}</p>
                )}
              </form>
            </section>
          )}

          {/* poderes (compra-e-usa direto da pergunta) */}
          {!isSettled && (() => {
            const canAnswer = !isCreator && !alreadyAnswered && !result;
            const isMC = question.type === "multiple_choice";
            // só 1 poder por pergunta: usar um esconde o outro
            const usedEliminate = !!eliminatedOptionId;
            const showEliminate = canAnswer && isMC && !usedEliminate && !useSecondChance && !secondChanceUsed;
            const showSecondChance = canAnswer && !secondChanceUsed && !usedEliminate;
            const showSabotage = isMC && !isCreator;
            if (!showEliminate && !showSecondChance && !showSabotage && !powerupMsg)
              return null;

            // rótulo do botão: "Usar (n)" se já tem; senão o preço pra comprar agora
            const actionLabel = (key: string) => {
              const owned = inventory[key] ?? 0;
              if (owned > 0) return `Usar (${owned})`;
              const price = catalog[key]?.price;
              return price != null ? `${price} 🪙` : "Comprar";
            };
            // sem saldo pra comprar (só trava poderes de compra-imediata)
            const tooPoor = (key: string) => {
              if ((inventory[key] ?? 0) > 0) return false;
              const price = catalog[key]?.price ?? Infinity;
              return price > (balance?.nenecoin_balance ?? 0);
            };

            return (
              <div className="space-y-2.5 rounded-2xl border border-purple/20 bg-purple/5 px-4 py-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple">
                  Poderes
                </p>
                {powerupMsg && (
                  <p className="text-xs text-muted">{powerupMsg}</p>
                )}
                <div className="space-y-2">
                  {showEliminate && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">✂️ Eliminar alternativa</p>
                        <p className="text-[11px] text-muted leading-snug">Remove uma opção errada.</p>
                      </div>
                      <button
                        onClick={handleEliminate}
                        disabled={powerupBusy || tooPoor("eliminate")}
                        className="shrink-0 text-xs font-semibold px-3 py-2 rounded-xl border border-border bg-surface hover:border-purple/40 transition-colors disabled:opacity-50"
                      >
                        {actionLabel("eliminate")}
                      </button>
                    </div>
                  )}
                  {showSecondChance && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">🔁 Segunda chance</p>
                        <p className="text-[11px] text-muted leading-snug">Se errar, ganha uma nova tentativa.</p>
                      </div>
                      <button
                        onClick={toggleSecondChance}
                        disabled={tooPoor("second_chance")}
                        className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors disabled:opacity-50 ${
                          useSecondChance
                            ? "border-purple bg-purple/15 text-purple"
                            : "border-border bg-surface hover:border-purple/40"
                        }`}
                      >
                        {useSecondChance ? "Ativo ✓" : actionLabel("second_chance")}
                      </button>
                    </div>
                  )}
                  {showSabotage && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">😈 Sabotar alguém</p>
                        <p className="text-[11px] text-muted leading-snug">Plante uma alternativa falsa pra quem ainda não respondeu.</p>
                      </div>
                      <button
                        onClick={() => { setSabotageError(null); setSabotageOpen(true); }}
                        className="shrink-0 text-xs font-semibold px-3 py-2 rounded-xl border border-border bg-surface hover:border-purple/40 transition-colors"
                      >
                        {actionLabel("sabotage")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* aposta de coins (estilo bolão) */}
          {!isCreator && !alreadyAnswered && !result && balance && (
            <div className="space-y-2.5 rounded-2xl border border-yellow/20 bg-yellow/5 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                  Apostar nenecoins (opcional)
                </p>
                <span className="text-xs text-muted">Saldo: {balance.nenecoin_balance}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setWager((c) => Math.max(0, c - 5))}
                  className="w-9 h-9 rounded-full border border-border text-muted hover:border-yellow/40 text-lg font-bold"
                >−</button>
                <input
                  type="number"
                  min={0}
                  max={balance.nenecoin_balance}
                  value={wager}
                  onChange={(e) =>
                    setWager(Math.max(0, Math.min(balance.nenecoin_balance, parseInt(e.target.value) || 0)))
                  }
                  className="flex-1 text-center bg-surface border border-border rounded-xl px-4 py-2 text-lg font-bold focus:outline-none focus:border-yellow/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setWager((c) => Math.min(balance.nenecoin_balance, c + 5))}
                  className="w-9 h-9 rounded-full border border-border text-muted hover:border-yellow/40 text-lg font-bold"
                >+</button>
              </div>
              <p className="text-[11px] text-muted leading-snug">
                A aposta é debitada na hora que você confirma. Acertou: ganha conforme
                a dificuldade — Fácil 1.5× · Médio 2× · Difícil 3× (os ganhos saem no
                fechamento). Errou: perde a aposta. (Impossível não paga.)
              </p>
            </div>
          )}

          {submitError && (
            <p className="text-sm text-red-400 text-center">{submitError}</p>
          )}

          {/* action buttons */}
          {!isCreator && !alreadyAnswered && !result && (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full"
            >
              {submitting
                ? "Enviando..."
                : wager > 0
                ? `Confirmar e apostar ${wager} 🪙`
                : "Confirmar resposta"}
            </Button>
          )}

          {showReveal && (
            <Link
              to="/perguntas"
              className="block text-center text-sm text-accent hover:text-accent-hover transition-colors"
            >
              ‹ Voltar para perguntas
            </Link>
          )}

          {isCreator && (
            <div className="border-t border-border pt-5 space-y-3">
              {(question.answer_count ?? 0) > 0 && (
                <p className="text-sm text-muted">
                  Excluir apaga as respostas e desfaz todos os pontos e
                  conquistas relacionados, como se a pergunta nunca tivesse
                  existido.
                </p>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-red-400 hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {deleting ? "Excluindo..." : "Excluir pergunta"}
              </button>
              {deleteError && (
                <p className="text-xs text-red-400">{deleteError}</p>
              )}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {sabotageOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 py-6"
            onClick={() => setSabotageOpen(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-surface border border-border rounded-3xl p-6 space-y-4"
            >
              <div>
                <h3 className="text-lg font-bold">😈 Sabotar alguém</h3>
                <p className="text-xs text-muted mt-1">
                  Plante uma alternativa falsa, escrita por você. Ela entra numa
                  posição aleatória e só os alvos a verão — e só quem ainda não
                  respondeu. Cada alvo custa uma Sabotagem.
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Alvos {sabotageTargets.length > 0 && `(${sabotageTargets.length})`}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {adults
                    .filter(
                      (a) => a.id !== profile.id && a.id !== question.creator_id
                    )
                    .map((a) => {
                      const selected = sabotageTargets.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() =>
                            setSabotageTargets((prev) =>
                              prev.includes(a.id)
                                ? prev.filter((t) => t !== a.id)
                                : [...prev, a.id],
                            )
                          }
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                            selected
                              ? "border-purple bg-purple/10"
                              : "border-border hover:border-purple/40"
                          }`}
                        >
                          <Avatar
                            spriteUrl={a.avatar_url}
                            nickname={a.nickname}
                            size={40}
                          />
                          <span className="text-[11px]">{a.nickname}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Alternativa falsa
                </p>
                <textarea
                  value={sabotageText}
                  onChange={(e) => setSabotageText(e.target.value.slice(0, 120))}
                  placeholder="Ex: O Joca de madrugada 🤫"
                  rows={2}
                  className="w-full rounded-xl border border-border bg-surface-light px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-purple/50"
                />
              </div>

              {(() => {
                // 1 token por alvo: o que faltar no inventário é comprado na hora
                const n = sabotageTargets.length;
                const owned = inventory.sabotage ?? 0;
                const price = catalog.sabotage?.price;
                const missing = Math.max(0, n - owned);
                const cost = price != null ? missing * price : null;
                const coins = balance?.nenecoin_balance ?? 0;
                const tooPoor = cost != null && cost > coins;
                if (n === 0) return null;
                return (
                  <div className="rounded-xl border border-border bg-surface-light px-3 py-2.5 space-y-1">
                    <p className="text-xs">
                      {n} {n === 1 ? "alvo" : "alvos"} · custa {n}{" "}
                      {n === 1 ? "Sabotagem" : "Sabotagens"} · você tem {owned}
                    </p>
                    {missing > 0 && cost != null && (
                      <p className={`text-xs ${tooPoor ? "text-red-400" : "text-muted"}`}>
                        Comprar {missing} × {price} = <strong>{cost} 🪙</strong>{" "}
                        {tooPoor
                          ? `· saldo insuficiente (${coins})`
                          : `· saldo ${coins} → ${coins - cost}`}
                      </p>
                    )}
                    {missing === 0 && (
                      <p className="text-xs text-muted">
                        Sai do inventário, sem gastar nenecoins.
                      </p>
                    )}
                  </div>
                );
              })()}

              {sabotageError && (
                <p className="text-xs text-red-400">{sabotageError}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setSabotageOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                {(() => {
                  const n = sabotageTargets.length;
                  const price = catalog.sabotage?.price;
                  const missing = Math.max(0, n - (inventory.sabotage ?? 0));
                  const cost = price != null ? missing * price : null;
                  const tooPoor =
                    cost != null && cost > (balance?.nenecoin_balance ?? 0);
                  return (
                    <Button
                      onClick={handleSabotage}
                      disabled={
                        n === 0 || !sabotageText.trim() || sabotageBusy || tooPoor
                      }
                      className="flex-1"
                    >
                      {sabotageBusy
                        ? "..."
                        : cost != null && cost > 0
                        ? `Plantar 😈 · ${cost} 🪙`
                        : "Plantar 😈"}
                    </Button>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
