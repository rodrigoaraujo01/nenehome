
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { AchievementToast } from "@/components/AchievementToast";
import { useAuth } from "@/hooks/useAuth";
import { getQuestion, submitAnswer, getQuestionAnswers, deleteQuestion } from "@/lib/supabase/queries";
import { ADULTS } from "@/lib/constants";
import type { DbQuestion, AnswerResult, UnlockedAchievement, QuestionAnswer } from "@/lib/types";

const OPTION_LABELS = ["A", "B", "C", "D"];

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

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (!profile || !id) return;
    getQuestion(id, profile.id).then(async (q) => {
      setQuestion(q);
      if (q?.my_answer || q?.creator_id === profile.id) {
        const answers = await getQuestionAnswers(id);
        setAllAnswers(answers);
      }
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
  const displaySelectedOptionId =
    question.my_answer?.selected_option_id ?? selectedOptionId;
  const displaySelectedSubjectId =
    question.my_answer?.subject_guess_id ?? selectedSubjectId;

  async function handleSubmit() {
    if (!question) return;
    setSubmitting(true);
    const res = await submitAnswer({
      question_id: question.id,
      selected_option_id: selectedOptionId ?? undefined,
      subject_guess_id: selectedSubjectId ?? undefined,
    });
    setSubmitting(false);
    if (res) {
      setResult(res);
      if (res.achievements?.length) setNewAchievements(res.achievements);
      // refresh question to get my_answer and fetch all answers
      if (profile) {
        const [updated, answers] = await Promise.all([
          getQuestion(question.id, profile.id),
          getQuestionAnswers(question.id),
        ]);
        if (updated) setQuestion(updated);
        setAllAnswers(answers);
      }
    }
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
              {result && result.points_earned > 0 && (
                <p className="text-sm text-muted mt-1">
                  +{result.points_earned} pontos
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

          {/* creator notice */}
          {isCreator && (
            <div className="rounded-2xl px-5 py-4 border border-border bg-surface text-center">
              <p className="text-sm text-muted">Você criou esta pergunta e não pode respondê-la.</p>
            </div>
          )}

          {/* multiple choice options */}
          {!isCreator && question.type === "multiple_choice" && question.options && (
            <div className="space-y-2">
              {question.options.map((opt, i) => {
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
              <p className="text-xs font-bold text-muted uppercase tracking-wider">
                O que o grupo achou ({allAnswers.length})
              </p>
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
                    <span className="text-sm font-semibold flex-1">{ans.nickname}</span>
                    <span className="text-xs text-muted">
                      {question.type === "multiple_choice" && selectedOption
                        ? selectedOption.text
                        : guessedMember
                        ? guessedMember.nickname
                        : "—"}
                    </span>
                    <span className={`text-sm font-bold ${ans.is_correct ? "text-green" : "text-red-400"}`}>
                      {ans.is_correct ? "✓" : "✗"}
                    </span>
                  </div>
                );
              })}
            </section>
          )}

          {/* action buttons */}
          {!isCreator && !alreadyAnswered && !result && (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full"
            >
              {submitting ? "Enviando..." : "Confirmar resposta"}
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
    </>
  );
}
