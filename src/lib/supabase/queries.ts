import { getSupabase } from "./client";
import type {
  DbProfile,
  DbQuestion,
  LeaderboardEntry,
  AnswerResult,
  ProfileStats,
  DbPhotoSubmission,
  VoteResult,
} from "@/lib/types";
import { MEMBERS } from "@/lib/constants";

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

  const member = MEMBERS.find((m) => m.email === email);
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

export async function getQuestions(userId: string): Promise<DbQuestion[]> {
  const sb = getSupabase();

  const { data: questions, error } = await sb
    .from("questions")
    .select(`
      *,
      creator:profiles!creator_id(id, nickname, avatar_url),
      options:question_options(id, text, is_correct, position)
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error || !questions) return [];

  const { data: myAnswers } = await sb
    .from("answers")
    .select("question_id, is_correct")
    .eq("user_id", userId);

  const answeredMap = new Map(myAnswers?.map((a) => [a.question_id, a]));

  const { data: counts } = await sb
    .from("answers")
    .select("question_id")
    .in("question_id", questions.map((q) => q.id));

  const countMap = new Map<string, number>();
  counts?.forEach((r) => {
    countMap.set(r.question_id, (countMap.get(r.question_id) ?? 0) + 1);
  });

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

  const { data: counts } = await sb
    .from("answers")
    .select("question_id")
    .eq("question_id", id);

  return {
    ...question,
    options: question.options?.sort(
      (a: { position: number }, b: { position: number }) =>
        a.position - b.position
    ),
    answer_count: counts?.length ?? 0,
    my_answer: myAnswer ?? null,
  } as DbQuestion;
}

// ─── Create question (via RPC) ────────────────────────────────────────────────

export async function createQuestion(params: {
  type: "story" | "multiple_choice";
  content: string;
  subject_id?: string;
  options?: { text: string; is_correct: boolean }[];
}): Promise<string | null> {
  const { data, error } = await getSupabase().rpc("create_question", {
    p_type: params.type,
    p_content: params.content,
    p_subject_id: params.subject_id ?? null,
    p_options: params.options ? JSON.stringify(params.options) : null,
  });

  if (error) {
    console.error("Error creating question:", error);
    return null;
  }
  return data as string;
}

// ─── Submit answer (via RPC) ──────────────────────────────────────────────────

export async function submitAnswer(params: {
  question_id: string;
  selected_option_id?: string;
  subject_guess_id?: string;
}): Promise<AnswerResult | null> {
  const { data, error } = await getSupabase().rpc("submit_answer", {
    p_question_id: params.question_id,
    p_selected_option_id: params.selected_option_id ?? null,
    p_subject_guess_id: params.subject_guess_id ?? null,
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
    .eq("nickname", nickname)
    .maybeSingle();

  if (!profileRow) return null;

  const [pointsRes, answersRes, questionsRes] = await Promise.all([
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
    recent_answers: answers as ProfileStats["recent_answers"],
  };
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
      votes:photo_votes(id, voter_id, approved)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((s) => {
    const votes = (s.votes ?? []) as { voter_id: string; approved: boolean }[];
    const myVoteObj = votes.find((v) => v.voter_id === userId);
    return {
      ...s,
      approve_count: votes.filter((v) => v.approved).length,
      reject_count: votes.filter((v) => !v.approved).length,
      my_vote: myVoteObj ? myVoteObj.approved : null,
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
      votes:photo_votes(id, voter_id, approved, profiles(nickname, avatar_url))
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const votes = (data.votes ?? []) as { voter_id: string; approved: boolean }[];
  const myVoteObj = votes.find((v) => v.voter_id === userId);

  return {
    ...data,
    approve_count: votes.filter((v) => v.approved).length,
    reject_count: votes.filter((v) => !v.approved).length,
    my_vote: myVoteObj ? myVoteObj.approved : null,
  } as DbPhotoSubmission;
}

export async function createPhotoSubmission(params: {
  file: File;
  caption: string;
  userId: string;
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
  return data as VoteResult;
}
