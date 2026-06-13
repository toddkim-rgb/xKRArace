-- xHRrace 스키마 (멱등) — 신규 설치/문서용
-- ⚠ DROP 하지 않습니다. 여러 번 실행해도 기존 테이블·데이터가 보존됩니다.
--   데이터 적재는 이 파일이 아니라 parser/ingest.py (추가/upsert)로 합니다.
--   실제 착순(results)은 supabase/results.sql 로 별도 1회 생성하세요.
--   (legacy supabase/setup.sql 은 전체 DROP+재생성이므로 주간 누적에는 쓰지 마세요)

create table if not exists public.races (
  id           text primary key,          -- '260613-05' (YYMMDD-경주번호)
  race_date    date not null,
  venue        text not null,
  race_no      int  not null,
  grade        text,
  age_cond     text,
  sex_cond     text,
  weight_type  text,
  rating_range text,
  race_kind    text,
  distance_m   int,
  start_time   text,
  total_prize  int,                       -- 천원 단위
  prize_1 int, prize_2 int, prize_3 int, prize_4 int, prize_5 int,
  unique (race_date, venue, race_no)
);

create table if not exists public.entries (
  id                  bigint generated always as identity primary key,
  race_id             text not null references public.races(id) on delete cascade,
  gate_no             int  not null,
  horse_name          text not null,
  region_tag          text,
  weight              numeric(4,1),
  weight_delta        numeric(4,1),
  weight_marker       boolean default false,
  jockey              text,
  jockey_allowance    text,
  jockey_stats        text,
  jockey_horse_record text,
  age                 int,
  sex                 text,
  birth               date,
  color               text,
  country             text,
  rating              int,
  sire                text,
  dam                 text,
  owner               text,
  owner_wins          int,
  breeder             text,
  trainer             text,
  trainer_team        int,
  trainer_stats       text,
  career_starts       int,
  career_record       text,
  career_prize        int,                -- 천원 단위
  best_time           text,
  avg_time            text,
  recent_races_raw    text,
  track_records       jsonb,              -- 주로상태별 [1착,2착,3착] {건조,양호,다습,포화,불량}
  gate_train_date     date,
  gate_train_result   text,
  medical_recent      jsonb,              -- 최근 진료 [{date,name,count}]
  layoff_weeks        int,
  training_sessions   int,
  training_minutes    int,
  training_gallop     int,
  training_swim       int,
  weight_last         int,
  weight_last_delta   int,
  unique (race_id, gate_no)
);

create index if not exists entries_race_idx on public.entries (race_id);

create table if not exists public.predictions (
  id         bigint generated always as identity primary key,
  race_id    text not null references public.races(id) on delete cascade,
  gate_no    int  not null,
  horse_name text not null,
  score      numeric(5,3),
  win_prob   numeric(5,3),
  rank       int,
  basis      text,
  factors    jsonb,
  unique (race_id, gate_no)
);

create index if not exists predictions_race_idx on public.predictions (race_id);

alter table public.races       enable row level security;
alter table public.entries     enable row level security;
alter table public.predictions enable row level security;

-- 읽기 공개. 쓰기는 service_role(ingest.py) 만 — anon 쓰기는 열지 않음.
drop policy if exists "public read races"       on public.races;
drop policy if exists "public read entries"     on public.entries;
drop policy if exists "public read predictions" on public.predictions;
create policy "public read races"       on public.races       for select using (true);
create policy "public read entries"     on public.entries     for select using (true);
create policy "public read predictions" on public.predictions for select using (true);
