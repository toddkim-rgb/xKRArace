import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export type Race = {
  id: string;
  race_date: string;
  venue: string;
  race_no: number;
  grade: string | null;
  age_cond: string | null;
  sex_cond: string | null;
  weight_type: string | null;
  rating_range: string | null;
  race_kind: string | null;
  distance_m: number | null;
  start_time: string | null;
  total_prize: number | null;
  prize_1: number | null;
  prize_2: number | null;
  prize_3: number | null;
  prize_4: number | null;
  prize_5: number | null;
};

export type RaceResult = {
  id: number;
  race_id: string;
  gate_no: number;
  finish_position: number;
  updated_at: string;
};

export type Prediction = {
  id: number;
  race_id: string;
  gate_no: number;
  horse_name: string;
  score: number | null;
  win_prob: number | null;
  rank: number | null;
  basis: string | null;
  factors: Record<string, number> | null;
};

export type Entry = {
  id: number;
  race_id: string;
  gate_no: number;
  horse_name: string;
  region_tag: string | null;
  weight: number | null;
  weight_delta: number | null;
  weight_marker: boolean;
  jockey: string | null;
  jockey_allowance: string | null;
  jockey_stats: string | null;
  jockey_horse_record: string | null;
  age: number | null;
  sex: string | null;
  birth: string | null;
  color: string | null;
  country: string | null;
  rating: number | null;
  sire: string | null;
  dam: string | null;
  owner: string | null;
  owner_wins: number | null;
  breeder: string | null;
  trainer: string | null;
  trainer_team: number | null;
  trainer_stats: string | null;
  career_starts: number | null;
  career_record: string | null;
  career_prize: number | null;
  best_time: string | null;
  avg_time: string | null;
  recent_races_raw: string | null;
  track_records: Record<string, number[]> | null;
  gate_train_date: string | null;
  gate_train_result: string | null;
  medical_recent: { date: string; name: string; count: number }[] | null;
  layoff_weeks: number | null;
  training_sessions: number | null;
  training_minutes: number | null;
  training_gallop: number | null;
  training_swim: number | null;
  weight_last: number | null;
  weight_last_delta: number | null;
};
