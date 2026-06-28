import { getSupabase } from "./client";
import type {
  DbProfile,
  DbQuestion,
  LeaderboardEntry,
  AnswerResult,
  ProfileStats,
  PointsLogEntry,
  DbPhotoSubmission,
  DbPhotoChallenge,
  VoteResult,
  DbAchievement,
  UnlockedAchievement,
  NenecoinBalance,
  WeeklyBonusResult,
  ConvertResult,
  GiftResult,
  NenecoinLedgerEntry,
  GiftMessage,
  DbBet,
  PlaceBetResult,
  ResolveBetResult,
  WcMatch,
  WcPrediction,
  WcLeaderboardEntry,
  WcPredictionResult,
  WcScoreResult,
  QuestionAnswer,
  Powerup,
  PowerupInventoryItem,
  BuyPowerupResult,
  EliminateResult,
  SabotageResult,
  WcRevealResult,
  WcDistribution,
  SabotageRevenge,
  MySabotage,
  QuestionComment,
} from "@/lib/types";
import { MEMBERS } from "@/lib/constants";

// ─── Util: seeded shuffle ─────────────────────────────────────────────────────
// Embaralha de forma determinística a partir de uma seed string (Fisher–Yates +
// mulberry32). Mesma seed → mesma ordem, então a ordem fica estável entre reloads.
function shuffleSeeded<T>(arr: T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function getOrCreateProfile(
  userId: string,
  email: string
): Promise<DbProfile | null> {
  const sb = getSupabase();

  const { data: existing } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (existing) return existing as DbProfile;

  const member = MEMBERS.find(
    (m) => m.email?.toLowerCase() === email.toLowerCase()
  );
  if (!member) return null;

  const { data, error } = await sb
    .from("profiles")
    .insert({
      id: userId,
      nickname: member.nickname,
      name: member.name,
      couple_group: member.coupleGroup,
      role: member.role,
      avatar_url: member.spriteUrl,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating profile:", error);
    return null;
  }
  return data as DbProfile;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await getSupabase()
    .from("member_points")
    .select("*");

  if (error || !data) return [];
  return data as LeaderboardEntry[];
}

// ─── Questions ────────────────────────────────────────────────────────────────

async function getQuestionAnswerCounts(
  questionIds: string[]
): Promise<Map<string, number>> {
  if (questionIds.length === 0) return new Map();

  const { data, error } = await getSupabase().rpc("get_question_answer_counts", {
    p_question_ids: questionIds,
  });

  if (error || !data) return new Map();

  return new Map(
    (data as { question_id: string; answer_count: number }[]).map((row) => [
      row.question_id,
      row.answer_count,
    ])
  );
}

export async function getQuestions(userId: string): Promise<DbQuestion[]> {
  const sb = getSupabase();

  // Inclui ativas E liquidadas (closed): perguntas liquidadas precisam continuar
  // visíveis para mostrar o resultado/pontos. Uma pergunta liquidada implica que
  // todos os adultos não-criadores já responderam, então nunca cai em "para
  // responder".
  const { data: questions, error } = await sb
    .from("questions")
    .select(`
      *,
      creator:profiles!creator_id(id, nickname, avatar_url),
      options:question_options(id, text, is_correct, position)
    `)
    .order("created_at", { ascending: false });

  if (error || !questions) return [];

  const { data: myAnswers } = await sb
    .from("answers")
    .select("question_id, is_correct")
    .eq("user_id", userId);

  const answeredMap = new Map(myAnswers?.map((a) => [a.question_id, a]));

  const countMap = await getQuestionAnswerCounts(questions.map((q) => q.id));

  return questions.map((q) => ({
    ...q,
    options: q.options?.sort(
      (a: { position: number }, b: { position: number }) =>
        a.position - b.position
    ),
    answer_count: countMap.get(q.id) ?? 0,
    my_answer: answeredMap.get(q.id) ?? null,
  })) as DbQuestion[];
}

export async function getQuestion(
  id: string,
  userId: string
): Promise<DbQuestion | null> {
  const sb = getSupabase();

  const { data: question, error } = await sb
    .from("questions")
    .select(`
      *,
      creator:profiles!creator_id(id, nickname, avatar_url),
      options:question_options(id, text, is_correct, position)
    `)
    .eq("id", id)
    .single();

  if (error || !question) return null;

  const { data: myAnswer } = await sb
    .from("answers")
    .select("*")
    .eq("question_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  const countMap = await getQuestionAnswerCounts([id]);

  let options = (question.options ?? []).sort(
    (a: { position: number }, b: { position: number }) => a.position - b.position
  );

  // Sabotagem: injeta a 5ª alternativa-decoy se houver uma mirando este usuário
  // (entregue via RPC pra não vazar que é falsa; só aparece antes de responder).
  if (question.type === "multiple_choice" && !myAnswer) {
    const { data: sab } = await sb.rpc("get_question_sabotage", {
      p_question_id: id,
    });
    if (sab && sab.id) {
      options = [
        ...options,
        {
          id: sab.id as string,
          question_id: id,
          text: sab.text as string,
          is_correct: false,
          position: 99,
          is_decoy: true,
        },
      ];
    }
  }

  // Embaralha as alternativas de MC de forma estável por usuário+pergunta, para
  // que a decoy da Sabotagem não fique sempre na última posição. A correção é
  // rastreada por is_correct / is_decoy (nunca por posição), então é seguro.
  // Seed sem decoy garante mesma ordem na resposta e no reveal pós-resposta.
  if (question.type === "multiple_choice") {
    options = shuffleSeeded(options, `${id}:${userId}`);
  }

  return {
    ...question,
    options,
    answer_count: countMap.get(id) ?? 0,
    my_answer: myAnswer ?? null,
  } as DbQuestion;
}

// ─── Create question (via RPC) ────────────────────────────────────────────────

export async function createQuestion(params: {
  type: "story" | "multiple_choice";
  content: string;
  subject_id?: string;
  options?: { text: string; is_correct: boolean }[];
}): Promise<{
  id: string;
  points_creator: number;
  is_premium: boolean;
  achievements: UnlockedAchievement[];
} | null> {
  const { data, error } = await getSupabase().rpc("create_question", {
    p_type: params.type,
    p_content: params.content,
    p_subject_id: params.subject_id ?? null,
    p_options: params.options ?? null,
  });

  if (error) {
    console.error("Error creating question:", error);
    return null;
  }
  const result = data as {
    id: string;
    points_creator: number;
    is_premium: boolean;
    achievements: UnlockedAchievement[];
  };
  return {
    id: result.id,
    points_creator: result.points_creator,
    is_premium: result.is_premium,
    achievements: result.achievements ?? [],
  };
}

// ─── Whether the user still has their premium (+20) question today ───────────
// "Hoje" no fuso America/Sao_Paulo, igual ao RPC create_question.
export async function hasPremiumQuestionToday(userId: string): Promise<boolean> {
  const now = new Date();
  const spDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  // start of the SP day expressed as an instant
  const startSP = new Date(`${spDate}T00:00:00-03:00`);

  const { count, error } = await getSupabase()
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", userId)
    .gte("created_at", startSP.toISOString());

  if (error) {
    console.error("hasPremiumQuestionToday error:", error);
    return true; // fail open: don't discourage creating
  }
  return (count ?? 0) === 0;
}

// ─── Settle a question once everyone has answered (idempotent, lazy) ─────────
// Safe to call anytime: settle_question only acts when all eligible (non-creator
// adults) have answered. Covers questions that filled up before settle existed.
export async function settleQuestion(
  questionId: string,
): Promise<{ settled: boolean; difficulty?: string }> {
  const { data, error } = await getSupabase().rpc("settle_question", {
    p_question_id: questionId,
  });
  if (error) {
    console.error("settleQuestion error:", error);
    return { settled: false };
  }
  return data as { settled: boolean; difficulty?: string };
}

// ─── Settle a photo challenge after its deadline (idempotent, lazy) ──────────
export async function settleChallenge(
  challengeId: string,
): Promise<{ settled: boolean; reward?: number; submitters?: number }> {
  const { data, error } = await getSupabase().rpc("settle_challenge", {
    p_challenge_id: challengeId,
  });
  if (error) {
    console.error("settleChallenge error:", error);
    return { settled: false };
  }
  return data as { settled: boolean; reward?: number; submitters?: number };
}

// ─── Delete a question (creator-only, full wipe) ─────────────────────────────

export async function deleteQuestion(
  questionId: string,
): Promise<{ error?: string }> {
  const { data, error } = await getSupabase().rpc("delete_question", {
    p_question_id: questionId,
  });
  if (error) return { error: error.message };
  return data as { error?: string };
}

// ─── Get all answers for a question (only if current user has answered) ──────

export async function getQuestionAnswers(questionId: string): Promise<QuestionAnswer[]> {
  const { data, error } = await getSupabase().rpc("get_question_answers", {
    p_question_id: questionId,
  });
  if (error) { console.error("getQuestionAnswers error:", error); return []; }
  if (!data) { console.warn("getQuestionAnswers: no data returned"); return []; }
  console.log("getQuestionAnswers:", data);
  return data as QuestionAnswer[];
}

// ─── Question comments (visible only after answering; enforced by RLS) ───────

export async function getQuestionComments(
  questionId: string,
): Promise<QuestionComment[]> {
  const { data, error } = await getSupabase()
    .from("question_comments")
    .select(`
      id, question_id, user_id, content, created_at,
      author:profiles!user_id(id, nickname, avatar_url)
    `)
    .eq("question_id", questionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getQuestionComments error:", error);
    return [];
  }
  return (data ?? []) as unknown as QuestionComment[];
}

export async function createQuestionComment(
  questionId: string,
  userId: string,
  content: string,
): Promise<{ error?: string }> {
  const { error } = await getSupabase().from("question_comments").insert({
    question_id: questionId,
    user_id: userId,
    content: content.trim(),
  });
  return error ? { error: error.message } : {};
}

// ─── Submit answer (via RPC) ──────────────────────────────────────────────────

export async function submitAnswer(params: {
  question_id: string;
  selected_option_id?: string;
  subject_guess_id?: string;
  use_second_chance?: boolean;
  coins_wagered?: number;
  sabotage_option_id?: string;
}): Promise<AnswerResult | null> {
  const { data, error } = await getSupabase().rpc("submit_answer", {
    p_question_id: params.question_id,
    p_selected_option_id: params.selected_option_id ?? null,
    p_subject_guess_id: params.subject_guess_id ?? null,
    p_use_second_chance: params.use_second_chance ?? false,
    p_coins_wagered: params.coins_wagered ?? 0,
    p_sabotage_option_id: params.sabotage_option_id ?? null,
  });

  if (error) {
    console.error("Error submitting answer:", error);
    return null;
  }
  return data as AnswerResult;
}

// ─── Profile stats ────────────────────────────────────────────────────────────

export async function getProfileStats(nickname: string): Promise<ProfileStats | null> {
  const sb = getSupabase();

  const { data: profileRow } = await sb
    .from("profiles")
    .select("id")
    .ilike("nickname", nickname)
    .maybeSingle();

  if (!profileRow) return null;

  const [pointsRes, answersRes, questionsRes, impossibleQuestionsRes] = await Promise.all([
    sb
      .from("member_points")
      .select("total_points")
      .eq("user_id", profileRow.id)
      .maybeSingle(),
    sb
      .from("answers")
      .select("is_correct, question_id, questions(type, content, created_at)")
      .eq("user_id", profileRow.id)
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", profileRow.id),
    sb
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", profileRow.id)
      .eq("difficulty", "impossible"),
  ]);

  const total_points = (pointsRes.data?.total_points as number) ?? 0;
  const answers = answersRes.data ?? [];
  const correct = answers.filter((a) => a.is_correct).length;
  const questions_created = questionsRes.count ?? 0;

  return {
    total_points,
    answers_total: answers.length,
    answers_correct: correct,
    questions_created,
    impossible_questions: impossibleQuestionsRes.count ?? 0,
    recent_answers: answers as unknown as ProfileStats["recent_answers"],
  };
}

export async function getPointsLog(userId: string): Promise<PointsLogEntry[]> {
  const { data } = await getSupabase()
    .from("points_log")
    .select("id, amount, reason, ref_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PointsLogEntry[];
}

// ─── Photo challenges ─────────────────────────────────────────────────────────

export async function getChallenges(
  userId: string
): Promise<DbPhotoChallenge[]> {
  const sb = getSupabase();

  const { data, error } = await sb
    .from("photo_challenges")
    .select(`
      *,
      creator:profiles!creator_id(id, nickname, avatar_url),
      completions:photo_challenge_completions(id, user_id, completed_at, user:profiles!user_id(id, nickname, avatar_url))
    `)
    .order("deadline", { ascending: true });

  if (error || !data) return [];

  return data.map((c) => {
    const completions = (c.completions ?? []) as DbPhotoChallenge["completions"];
    const myCompletion = completions?.find((comp) => comp.user_id === userId) ?? null;
    return {
      ...c,
      completions,
      completion_count: completions?.length ?? 0,
      my_completion: myCompletion,
    };
  }) as DbPhotoChallenge[];
}

export async function getChallenge(
  id: string,
  userId: string
): Promise<DbPhotoChallenge | null> {
  const sb = getSupabase();

  const { data, error } = await sb
    .from("photo_challenges")
    .select(`
      *,
      creator:profiles!creator_id(id, nickname, avatar_url),
      completions:photo_challenge_completions(id, user_id, submission_id, completed_at, user:profiles!user_id(id, nickname, avatar_url))
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const completions = (data.completions ?? []) as DbPhotoChallenge["completions"];
  const myCompletion = completions?.find((comp) => comp.user_id === userId) ?? null;

  // fetch submissions linked to this challenge
  const { data: subs } = await sb
    .from("photo_submissions")
    .select(`
      *,
      submitter:profiles!submitter_id(id, nickname, avatar_url),
      votes:photo_votes(id, voter_id, approved)
    `)
    .eq("challenge_id", id)
    .order("created_at", { ascending: false });

  // which of these submissions actually granted photo_approved points
  const subIds = (subs ?? []).map((s) => s.id);
  const { data: awardRows } = subIds.length
    ? await sb
        .from("points_log")
        .select("ref_id")
        .eq("reason", "photo_approved")
        .in("ref_id", subIds)
    : { data: [] as { ref_id: string }[] };
  const awardedIds = new Set((awardRows ?? []).map((r) => r.ref_id));

  const submissions = (subs ?? []).map((s) => {
    const votes = (s.votes ?? []) as { voter_id: string; approved: boolean }[];
    const myVoteObj = votes.find((v) => v.voter_id === userId);
    return {
      ...s,
      approve_count: votes.filter((v) => v.approved).length,
      reject_count: votes.filter((v) => !v.approved).length,
      my_vote: myVoteObj ? myVoteObj.approved : null,
      awarded_points: awardedIds.has(s.id),
    };
  }) as DbPhotoSubmission[];

  return {
    ...data,
    completions,
    completion_count: completions?.length ?? 0,
    my_completion: myCompletion,
    submissions,
  } as DbPhotoChallenge;
}

export async function createPhotoChallenge(params: {
  title: string;
  description?: string;
  pointsReward?: number;
  deadline: string;
  creatorId: string;
}): Promise<{ id: string } | null> {
  const { data, error } = await getSupabase()
    .from("photo_challenges")
    .insert({
      creator_id: params.creatorId,
      title: params.title,
      description: params.description || null,
      points_reward: params.pointsReward ?? 30,
      deadline: params.deadline,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating challenge:", error);
    return null;
  }
  return data as { id: string };
}

export async function deletePhotoChallenge(
  challengeId: string,
): Promise<{ error?: string }> {
  const { data, error } = await getSupabase().rpc("delete_photo_challenge", {
    p_challenge_id: challengeId,
  });
  if (error) return { error: error.message };
  return data as { error?: string };
}

// ─── Photo submissions ────────────────────────────────────────────────────────

export async function getPhotoSubmissions(
  userId: string
): Promise<DbPhotoSubmission[]> {
  const sb = getSupabase();

  const { data, error } = await sb
    .from("photo_submissions")
    .select(`
      *,
      submitter:profiles!submitter_id(id, nickname, avatar_url),
      votes:photo_votes(id, voter_id, approved),
      challenge:photo_challenges!challenge_id(id, title)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const subIds = data.map((s) => s.id);
  const { data: awardRows } = subIds.length
    ? await sb
        .from("points_log")
        .select("ref_id")
        .eq("reason", "photo_approved")
        .in("ref_id", subIds)
    : { data: [] as { ref_id: string }[] };
  const awardedIds = new Set((awardRows ?? []).map((r) => r.ref_id));

  return data.map((s) => {
    const votes = (s.votes ?? []) as { voter_id: string; approved: boolean }[];
    const myVoteObj = votes.find((v) => v.voter_id === userId);
    return {
      ...s,
      approve_count: votes.filter((v) => v.approved).length,
      reject_count: votes.filter((v) => !v.approved).length,
      my_vote: myVoteObj ? myVoteObj.approved : null,
      awarded_points: awardedIds.has(s.id),
    };
  }) as DbPhotoSubmission[];
}

export async function getPhotoSubmission(
  id: string,
  userId: string
): Promise<DbPhotoSubmission | null> {
  const { data, error } = await getSupabase()
    .from("photo_submissions")
    .select(`
      *,
      submitter:profiles!submitter_id(id, nickname, avatar_url),
      votes:photo_votes(id, voter_id, approved, profiles(nickname, avatar_url)),
      challenge:photo_challenges!challenge_id(id, title)
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const votes = (data.votes ?? []) as { voter_id: string; approved: boolean }[];
  const myVoteObj = votes.find((v) => v.voter_id === userId);

  const { data: awardRows } = await getSupabase()
    .from("points_log")
    .select("ref_id")
    .eq("reason", "photo_approved")
    .eq("ref_id", id);

  return {
    ...data,
    approve_count: votes.filter((v) => v.approved).length,
    reject_count: votes.filter((v) => !v.approved).length,
    my_vote: myVoteObj ? myVoteObj.approved : null,
    awarded_points: (awardRows ?? []).length > 0,
  } as DbPhotoSubmission;
}

export async function createPhotoSubmission(params: {
  file: File;
  caption: string;
  userId: string;
  challengeId: string;
}): Promise<string | null> {
  const sb = getSupabase();
  const ext = params.file.name.split(".").pop() ?? "jpg";
  const path = `${params.userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await sb.storage
    .from("photo-submissions")
    .upload(path, params.file, { contentType: params.file.type });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return null;
  }

  const { data: { publicUrl } } = sb.storage
    .from("photo-submissions")
    .getPublicUrl(path);

  const { data, error } = await sb
    .from("photo_submissions")
    .insert({
      submitter_id: params.userId,
      caption: params.caption.trim() || null,
      photo_url: publicUrl,
      storage_path: path,
      challenge_id: params.challengeId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating submission:", error);
    return null;
  }
  return data.id as string;
}

export async function voteOnSubmission(params: {
  submission_id: string;
  approved: boolean;
}): Promise<VoteResult | null> {
  const { data, error } = await getSupabase().rpc("vote_on_submission", {
    p_submission_id: params.submission_id,
    p_approved: params.approved,
  });

  if (error) {
    console.error("Error voting:", error);
    return null;
  }
  const result = data as VoteResult;
  return { ...result, achievements: result.achievements ?? [] };
}

export async function unvoteOnSubmission(
  submissionId: string,
): Promise<VoteResult | null> {
  const { data, error } = await getSupabase().rpc("unvote_on_submission", {
    p_submission_id: submissionId,
  });
  if (error) {
    console.error("Error unvoting:", error);
    return null;
  }
  return data as VoteResult;
}

// ─── Delete a photo submission (submitter-only, full wipe) ───────────────────

export async function deletePhotoSubmission(
  submissionId: string,
): Promise<{ error?: string }> {
  const { data, error } = await getSupabase().rpc("delete_photo_submission", {
    p_submission_id: submissionId,
  });
  if (error) return { error: error.message };
  return data as { error?: string };
}

// ─── Achievements ─────────────────────────────────────────────────────────────

export async function getUserAchievements(
  userId: string
): Promise<DbAchievement[]> {
  const sb = getSupabase();

  const [allRes, unlockedRes] = await Promise.all([
    sb.from("achievements").select("*").order("sort_order"),
    sb
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", userId),
  ]);

  const unlocked = new Map(
    (unlockedRes.data ?? []).map((u) => [u.achievement_id, u.unlocked_at])
  );

  return (allRes.data ?? []).map((a) => ({
    ...a,
    unlocked_at: unlocked.get(a.id) ?? null,
  })) as DbAchievement[];
}

// ─── Nenecoins ────────────────────────────────────────────────────────────────

export async function getNenecoinBalance(): Promise<NenecoinBalance | null> {
  const { data, error } = await getSupabase().rpc("get_nenecoin_balance");
  if (error) { console.error("getNenecoinBalance:", error); return null; }
  return data as NenecoinBalance;
}

export async function getPublicNenecoinBalance(
  userId: string,
): Promise<NenecoinBalance> {
  const { data, error } = await getSupabase()
    .from("nenecoin_balances")
    .select("nenecoin_balance, firecoin_balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getPublicNenecoinBalance:", error);
  }
  return {
    nenecoin_balance: Number(data?.nenecoin_balance ?? 0),
    firecoin_balance: Number(data?.firecoin_balance ?? 0),
    firecoin_popup_shown: true,
  };
}

export async function claimWeeklyBonuses(): Promise<WeeklyBonusResult | null> {
  const { data, error } = await getSupabase().rpc("claim_weekly_bonuses");
  if (error) { console.error("claimWeeklyBonuses:", error); return null; }
  return data as WeeklyBonusResult;
}

export async function checkFirecoinConversion(): Promise<{ converted: number; show_popup: boolean } | null> {
  const { data, error } = await getSupabase().rpc("check_firecoin_conversion");
  if (error) { console.error("checkFirecoinConversion:", error); return null; }
  return data as { converted: number; show_popup: boolean };
}

export async function markFirecoinPopupShown(): Promise<void> {
  await getSupabase().rpc("mark_firecoin_popup_shown");
}

export async function convertPointsToNenecoins(points: number): Promise<ConvertResult> {
  const { data, error } = await getSupabase().rpc("convert_points_to_nenecoins", {
    p_points: points,
  });
  if (error) return { error: error.message };
  return data as ConvertResult;
}

export async function giftNenecoins(
  toUserId: string,
  amount: number,
  note?: string
): Promise<GiftResult> {
  const { data, error } = await getSupabase().rpc("gift_nenecoins", {
    p_to_user_id: toUserId,
    p_amount: amount,
    p_note: note ?? null,
  });
  if (error) return { error: error.message };
  return data as GiftResult;
}

export async function getNenecoinHistory(userId: string): Promise<NenecoinLedgerEntry[]> {
  const { data, error } = await getSupabase()
    .from("nenecoins_ledger")
    .select("id, amount, coin_type, tx_type, note, ref_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) { console.error("getNenecoinHistory:", error); return []; }
  return (data ?? []) as NenecoinLedgerEntry[];
}

export async function getGiftMessages(userId: string): Promise<GiftMessage[]> {
  const { data, error } = await getSupabase()
    .from("nenecoins_ledger")
    .select("id, amount, note, created_at, ref_id")
    .eq("user_id", userId)
    .eq("tx_type", "gift_received")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return [];

  const senderIds = [...new Set(data.map((e) => e.ref_id).filter(Boolean) as string[])];
  let profileMap = new Map<string, string>();

  if (senderIds.length > 0) {
    const { data: profiles } = await getSupabase()
      .from("profiles")
      .select("id, nickname")
      .in("id", senderIds);
    profileMap = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));
  }

  return data.map((e) => ({
    id: e.id,
    amount: e.amount,
    note: e.note,
    sender_nickname: e.ref_id ? (profileMap.get(e.ref_id) ?? null) : null,
    created_at: e.created_at,
  }));
}

// ─── Bets ─────────────────────────────────────────────────────────────────────

export async function getBets(userId: string): Promise<DbBet[]> {
  const { data, error } = await getSupabase()
    .from("bets")
    .select(`
      *,
      creator:profiles!creator_id(nickname, avatar_url),
      options:bet_options(id, label, position),
      entries:bet_entries(id, user_id, coins_wagered, is_winner)
    `)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((b) => {
    const entries = (b.entries ?? []) as { user_id: string; coins_wagered: number; is_winner: boolean | null }[];
    return {
      ...b,
      total_pot: entries.reduce((s, e) => s + e.coins_wagered, 0),
      entries_count: entries.length,
      my_entry: entries.find((e) => e.user_id === userId) ?? null,
      entries: undefined,
    };
  }) as DbBet[];
}

export async function getBet(id: string, userId: string): Promise<DbBet | null> {
  const { data, error } = await getSupabase()
    .from("bets")
    .select(`
      *,
      creator:profiles!creator_id(nickname, avatar_url),
      options:bet_options(id, label, position),
      entries:bet_entries(
        id, user_id, option_id, guess_value,
        coins_wagered, is_winner, coins_won, created_at,
        profiles(nickname, avatar_url)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const entries = (data.entries ?? []) as DbBet["entries"];
  const total_pot = entries?.reduce((s, e) => s + e.coins_wagered, 0) ?? 0;
  return {
    ...data,
    options: (data.options ?? []).sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position
    ),
    entries,
    total_pot,
    entries_count: entries?.length ?? 0,
    my_entry: entries?.find((e) => e.user_id === userId) ?? null,
  } as DbBet;
}

export async function createBet(params: {
  title: string;
  description?: string;
  type: "pool" | "closest_guess";
  guess_kind?: "date" | "number";
  unit?: string;
  deadline: string;
  options?: { label: string }[];
  creator_can_bet?: boolean;
}): Promise<{ id: string } | null> {
  const { data, error } = await getSupabase().rpc("create_bet", {
    p_title:           params.title,
    p_description:     params.description ?? null,
    p_type:            params.type,
    p_guess_kind:      params.guess_kind ?? null,
    p_unit:            params.unit ?? null,
    p_deadline:        params.deadline,
    p_options:         params.options ?? null,
    p_creator_can_bet: params.creator_can_bet ?? true,
  });
  if (error) { console.error("createBet:", error); return null; }
  return data as { id: string };
}

export async function placeBet(params: {
  bet_id: string;
  coins: number;
  option_id?: string;
  guess_value?: string;
}): Promise<PlaceBetResult> {
  const { data, error } = await getSupabase().rpc("place_bet", {
    p_bet_id:      params.bet_id,
    p_coins:       params.coins,
    p_option_id:   params.option_id ?? null,
    p_guess_value: params.guess_value ?? null,
  });
  if (error) return { error: error.message };
  const result = data as PlaceBetResult;
  return { ...result, achievements: result.achievements ?? [] };
}

export async function resolveBet(
  betId: string,
  resultValue: string
): Promise<ResolveBetResult> {
  const { data, error } = await getSupabase().rpc("resolve_bet", {
    p_bet_id:       betId,
    p_result_value: resultValue,
  });
  if (error) return { error: error.message };
  return data as ResolveBetResult;
}

export async function deleteBet(betId: string): Promise<{ error?: string }> {
  const { data, error } = await getSupabase().rpc("delete_bet", { p_bet_id: betId });
  if (error) return { error: error.message };
  return data as { error?: string };
}

// ─── World Cup Bolao ─────────────────────────────────────────────────────────

export async function getWcMatches(userId: string): Promise<WcMatch[]> {
  const sb = getSupabase();

  const [matchRes, predRes] = await Promise.all([
    sb.from("wc_matches").select("*").order("date").order("match_number"),
    sb.from("wc_predictions").select("*").eq("user_id", userId),
  ]);

  if (matchRes.error || !matchRes.data) return [];

  const predMap = new Map(
    (predRes.data ?? []).map((p) => [p.match_id, p as WcPrediction])
  );

  return matchRes.data.map((m) => ({
    ...m,
    my_prediction: predMap.get(m.id) ?? null,
  })) as WcMatch[];
}

export async function getWcMatch(
  matchId: string,
  userId: string
): Promise<{ match: WcMatch; predictions: WcPrediction[] } | null> {
  const sb = getSupabase();

  const [matchRes, predRes] = await Promise.all([
    sb.from("wc_matches").select("*").eq("id", matchId).single(),
    sb.from("wc_predictions")
      .select("*, profiles(nickname, avatar_url)")
      .eq("match_id", matchId),
  ]);

  if (matchRes.error || !matchRes.data) return null;

  const predictions = (predRes.data ?? []) as WcPrediction[];
  const myPred = predictions.find((p) => p.user_id === userId) ?? null;

  return {
    match: { ...matchRes.data, my_prediction: myPred } as WcMatch,
    predictions,
  };
}

export async function getWcLeaderboard(): Promise<WcLeaderboardEntry[]> {
  const { data, error } = await getSupabase()
    .from("wc_leaderboard")
    .select("*")
    .order("total_points", { ascending: false });

  if (error || !data) return [];
  return data as WcLeaderboardEntry[];
}

export async function placeWcPrediction(params: {
  match_id: string;
  home_score: number;
  away_score: number;
  coins: number;
}): Promise<WcPredictionResult> {
  const { data, error } = await getSupabase().rpc("place_wc_prediction", {
    p_match_id: params.match_id,
    p_home_score: params.home_score,
    p_away_score: params.away_score,
    p_coins: params.coins,
  });
  if (error) return { error: error.message };
  const result = data as WcPredictionResult;
  return { ...result, achievements: result.achievements ?? [] };
}

export async function scoreWcMatch(params: {
  match_id: string;
  home_score: number;
  away_score: number;
  status?: string;
}): Promise<WcScoreResult> {
  const { data, error } = await getSupabase().rpc("score_wc_match", {
    p_match_id: params.match_id,
    p_home_score: params.home_score,
    p_away_score: params.away_score,
    p_status: params.status ?? "finished",
  });
  if (error) return { error: error.message };
  return data as WcScoreResult;
}

export async function revertWcMatch(matchId: string): Promise<WcScoreResult> {
  const { data, error } = await getSupabase().rpc("revert_wc_match", {
    p_match_id: matchId,
  });
  if (error) return { error: error.message };
  return data as WcScoreResult;
}

// ─── Nudges ──────────────────────────────────────────────────────────────────

export interface NudgeCounts {
  unansweredQuestions: number;
  pendingPhotoVotes: number;
  activeChallenges: number;
  unpredictedMatches: number;
  questionsCreated: number;
}

export async function getNudgeCounts(userId: string): Promise<NudgeCounts> {
  const sb = getSupabase();
  const now = new Date().toISOString();

  const [
    activeQuestionsRes,
    userAnswersRes,
    pendingSubmissionsRes,
    userVotesRes,
    challengesRes,
    userCompletionsRes,
    scheduledMatchesRes,
    userPredictionsRes,
    questionsCreatedRes,
  ] = await Promise.all([
    sb.from("questions").select("id, creator_id").eq("status", "active"),
    sb.from("answers").select("question_id").eq("user_id", userId),
    sb
      .from("photo_submissions")
      .select("id, submitter_id")
      .eq("status", "pending"),
    sb.from("photo_votes").select("submission_id").eq("voter_id", userId),
    sb
      .from("photo_challenges")
      .select("id, starts_at, deadline")
      .lte("starts_at", now)
      .gt("deadline", now),
    sb
      .from("photo_challenge_completions")
      .select("challenge_id")
      .eq("user_id", userId),
    sb.from("wc_matches").select("id").eq("status", "scheduled"),
    sb.from("wc_predictions").select("match_id").eq("user_id", userId),
    sb
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", userId),
  ]);

  const answeredIds = new Set(
    (userAnswersRes.data ?? []).map((a) => a.question_id),
  );
  const unansweredQuestions = (activeQuestionsRes.data ?? []).filter(
    (q) => q.creator_id !== userId && !answeredIds.has(q.id),
  ).length;

  const votedIds = new Set(
    (userVotesRes.data ?? []).map((v) => v.submission_id),
  );
  const pendingPhotoVotes = (pendingSubmissionsRes.data ?? []).filter(
    (s) => s.submitter_id !== userId && !votedIds.has(s.id),
  ).length;

  const completedChallengeIds = new Set(
    (userCompletionsRes.data ?? []).map((c) => c.challenge_id),
  );
  const activeChallenges = (challengesRes.data ?? []).filter(
    (c) => !completedChallengeIds.has(c.id),
  ).length;

  const predictedMatchIds = new Set(
    (userPredictionsRes.data ?? []).map((p) => p.match_id),
  );
  const unpredictedMatches = (scheduledMatchesRes.data ?? []).filter(
    (m) => !predictedMatchIds.has(m.id),
  ).length;

  return {
    unansweredQuestions,
    pendingPhotoVotes,
    activeChallenges,
    unpredictedMatches,
    questionsCreated: questionsCreatedRes.count ?? 0,
  };
}

// ─── Push subscriptions ─────────────────────────────────────────────────────────

export async function savePushSubscription(
  userId: string,
  sub: PushSubscription,
): Promise<void> {
  const json = sub.toJSON();
  const { error } = await getSupabase()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      },
      { onConflict: "endpoint" },
    );
  if (error) throw error;
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await getSupabase()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
}

// ─── Notification preferences ───────────────────────────────────────────────────

export interface NotificationPrefs {
  new_question: boolean;
  new_challenge: boolean;
  new_photo: boolean;
  question_completed: boolean;
  photo_rejected: boolean;
  question_comment: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  new_question: true,
  new_challenge: true,
  new_photo: true,
  question_completed: true,
  photo_rejected: true,
  question_comment: true,
};

export async function getNotificationPrefs(
  userId: string,
): Promise<NotificationPrefs> {
  const { data } = await getSupabase()
    .from("notification_prefs")
    .select(
      "new_question, new_challenge, new_photo, question_completed, photo_rejected, question_comment",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(data ?? {}) };
}

export async function saveNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
): Promise<void> {
  const { error } = await getSupabase()
    .from("notification_prefs")
    .upsert(
      { user_id: userId, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

// ─── Power-ups / Loja ──────────────────────────────────────────────────────────

export async function getPowerups(): Promise<Powerup[]> {
  const { data, error } = await getSupabase()
    .from("powerups")
    .select("*")
    .eq("active", true)
    .order("sort");
  if (error || !data) return [];
  return data as Powerup[];
}

export async function getPowerupInventory(): Promise<PowerupInventoryItem[]> {
  const { data, error } = await getSupabase().rpc("get_powerup_inventory");
  if (error || !data) return [];
  return data as PowerupInventoryItem[];
}

export async function buyPowerup(
  key: string,
  qty: number,
): Promise<BuyPowerupResult> {
  const { data, error } = await getSupabase().rpc("buy_powerup", {
    p_key: key,
    p_qty: qty,
  });
  if (error) return { error: error.message };
  return data as BuyPowerupResult;
}

export async function useEliminateOption(
  questionId: string,
): Promise<EliminateResult> {
  const { data, error } = await getSupabase().rpc("use_eliminate_option", {
    p_question_id: questionId,
  });
  if (error) return { error: error.message };
  return data as EliminateResult;
}

export async function deploySabotage(params: {
  question_id: string;
  target_user_id: string;
  decoy_text: string;
}): Promise<SabotageResult> {
  const { data, error } = await getSupabase().rpc("deploy_sabotage", {
    p_question_id: params.question_id,
    p_target_user_id: params.target_user_id,
    p_decoy_text: params.decoy_text,
  });
  if (error) return { error: error.message };
  return data as SabotageResult;
}

export async function getSabotageRevenge(): Promise<SabotageRevenge> {
  const { data, error } = await getSupabase().rpc("get_sabotage_revenge");
  if (error || !data) return { credits: 0, saboteurs: [] };
  return data as SabotageRevenge;
}

export async function getMySabotage(
  questionId: string,
): Promise<MySabotage | null> {
  const { data, error } = await getSupabase().rpc("get_my_sabotage", {
    p_question_id: questionId,
  });
  if (error || !data) return null;
  return data as MySabotage;
}

export async function revealWcDistribution(
  matchId: string,
): Promise<WcRevealResult> {
  const { data, error } = await getSupabase().rpc("reveal_wc_distribution", {
    p_match_id: matchId,
  });
  if (error) return { error: error.message };
  return data as WcRevealResult;
}

export async function getWcDistribution(
  matchId: string,
): Promise<WcDistribution | null> {
  const { data, error } = await getSupabase().rpc("get_wc_distribution", {
    p_match_id: matchId,
  });
  if (error || !data) return null;
  return data as WcDistribution;
}

export async function getAdultProfiles(): Promise<
  { id: string; nickname: string; avatar_url: string | null }[]
> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, nickname, avatar_url")
    .eq("role", "adult")
    .order("nickname");
  if (error || !data) return [];
  return data as { id: string; nickname: string; avatar_url: string | null }[];
}
