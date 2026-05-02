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
  achievements?: UnlockedAchievement[];
}

export interface UnlockedAchievement {
  key: string;
  title: string;
  icon: string;
}

export interface DbAchievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  points_reward: number;
  sort_order: number;
  unlocked_at?: string | null;
}

export interface ProfileStats {
  total_points: number;
  answers_total: number;
  answers_correct: number;
  questions_created: number;
  recent_answers: {
    is_correct: boolean;
    question_id: string;
    questions: {
      type: string;
      content: string;
      created_at: string;
    } | null;
  }[];
}

// ─── Photo challenges ──────────────────────────────────────────────────────────

export interface DbPhotoChallengeCompletion {
  id: string;
  challenge_id: string;
  user_id: string;
  submission_id: string;
  completed_at: string;
  user?: DbProfile;
}

export interface DbPhotoChallenge {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  points_reward: number;
  starts_at: string;
  deadline: string;
  created_at: string;
  creator?: DbProfile;
  completions?: DbPhotoChallengeCompletion[];
  submissions?: DbPhotoSubmission[];
  completion_count?: number;
  my_completion?: DbPhotoChallengeCompletion | null;
}

// ─── Photo submissions ─────────────────────────────────────────────────────────

export interface DbPhotoVote {
  id: string;
  submission_id: string;
  voter_id: string;
  approved: boolean;
  created_at: string;
}

export interface DbPhotoSubmission {
  id: string;
  submitter_id: string;
  caption: string | null;
  photo_url: string;
  storage_path: string;
  status: "pending" | "approved" | "rejected";
  points_reward: number;
  votes_to_approve: number;
  challenge_id: string | null;
  created_at: string;
  // joined
  submitter?: DbProfile;
  votes?: DbPhotoVote[];
  approve_count?: number;
  reject_count?: number;
  my_vote?: boolean | null;
  challenge?: DbPhotoChallenge | null;
}

export interface VoteResult {
  approve_count: number;
  reject_count: number;
  status: "pending" | "approved" | "rejected";
  achievements?: UnlockedAchievement[];
}

// ─── Nenecoins ────────────────────────────────────────────────────────────────

export interface NenecoinBalance {
  nenecoin_balance: number;
  firecoin_balance: number;
  firecoin_popup_shown: boolean;
}

export interface WeeklyBonusResult {
  bonus_received: number;
  weeks: number;
}

export interface ConvertResult {
  nenecoins_received?: number;
  points_spent?: number;
  error?: string;
}

export interface GiftResult {
  success?: boolean;
  amount?: number;
  to?: string;
  error?: string;
}

// ─── Bets ─────────────────────────────────────────────────────────────────────

export interface BetOption {
  id: string;
  bet_id: string;
  label: string;
  position: number;
}

export interface BetEntry {
  id: string;
  bet_id: string;
  user_id: string;
  option_id: string | null;
  guess_value: string | null;
  coins_wagered: number;
  is_winner: boolean | null;
  coins_won: number;
  created_at: string;
  profiles?: { nickname: string; avatar_url: string | null };
}

export interface DbBet {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  type: "pool" | "closest_guess";
  guess_kind: "date" | "number" | null;
  unit: string | null;
  deadline: string;
  creator_can_bet: boolean;
  status: "open" | "resolved";
  result_value: string | null;
  resolved_at: string | null;
  created_at: string;
  // joined
  creator?: { nickname: string; avatar_url: string | null };
  options?: BetOption[];
  entries?: BetEntry[];
  // computed
  total_pot?: number;
  entries_count?: number;
  my_entry?: BetEntry | null;
}

export interface PlaceBetResult {
  entry_id?: string;
  achievements?: UnlockedAchievement[];
  error?: string;
}

export interface ResolveBetResult {
  winners?: number;
  pot?: number;
  refunded?: boolean;
  error?: string;
}
