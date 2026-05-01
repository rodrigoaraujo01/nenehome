// ─── App-level member types (hardcoded in constants.ts) ───────────────────────

export interface Member {
  id: string;
  name: string;
  nickname: string;
  email: string | null;
  spriteUrl: string | null;
  coupleGroup: number;
  role: "adult" | "child";
}

export interface Couple {
  id: number;
  label: string;
  members: Member[];
}

// ─── Database types (mirror of Supabase tables) ───────────────────────────────

export interface DbProfile {
  id: string;
  nickname: string;
  name: string;
  couple_group: number;
  role: "adult" | "child";
  avatar_url: string | null;
  created_at: string;
}

export interface DbQuestionOption {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  position: number;
}

export interface DbAnswer {
  id: string;
  question_id: string;
  user_id: string;
  selected_option_id: string | null;
  subject_guess_id: string | null;
  is_correct: boolean;
  created_at: string;
}

export interface DbQuestion {
  id: string;
  creator_id: string;
  type: "story" | "multiple_choice";
  content: string;
  subject_id: string | null;
  status: "active" | "closed";
  points_creator: number;
  points_correct: number;
  closed_at: string | null;
  created_at: string;
  // joined
  creator?: DbProfile;
  options?: DbQuestionOption[];
  answer_count?: number;
  my_answer?: DbAnswer | null;
}

export interface LeaderboardEntry {
  user_id: string;
  nickname: string;
  name: string;
  avatar_url: string | null;
  couple_group: number;
  total_points: number;
}

export interface AnswerResult {
  is_correct: boolean;
  points_earned: number;
}
