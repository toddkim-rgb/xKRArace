# -*- coding: utf-8 -*-
"""data/races.json → supabase/setup.sql (스키마 + RLS + 시드 데이터).

생성된 파일을 Supabase SQL Editor에 붙여넣어 1회 실행하면 끝.
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "data", "races.json")
PRED_SRC = os.path.join(BASE, "data", "predictions.json")
DST = os.path.join(BASE, "supabase", "setup.sql")

RACE_COLS = [
    "id", "race_date", "venue", "race_no", "grade", "age_cond", "sex_cond",
    "weight_type", "rating_range", "race_kind", "distance_m", "start_time",
    "total_prize", "prize_1", "prize_2", "prize_3", "prize_4", "prize_5",
]
ENTRY_COLS = [
    "race_id", "gate_no", "horse_name", "region_tag", "weight", "weight_delta",
    "weight_marker", "jockey", "jockey_allowance", "jockey_stats",
    "jockey_horse_record", "age", "sex", "birth", "color", "country", "rating",
    "sire", "dam", "owner", "owner_wins", "breeder", "trainer", "trainer_team",
    "trainer_stats", "career_starts", "career_record", "career_prize",
    "best_time", "avg_time", "recent_races_raw",
    "track_records", "gate_train_date", "gate_train_result", "medical_recent",
    "layoff_weeks", "training_sessions", "training_minutes", "training_gallop",
    "training_swim", "weight_last", "weight_last_delta",
]

SCHEMA = """\
-- xHRrace: KRA 서울 출마표 데이터베이스 (자동 생성 파일, parser/gen_sql.py)
-- Supabase Dashboard → SQL Editor에 전체를 붙여넣고 Run 하세요.

drop table if exists public.predictions;
drop table if exists public.entries;
drop table if exists public.races;

create table public.races (
  id           text primary key,          -- '260613-05'
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

create table public.entries (
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
  gate_train_result   text,               -- 양호/출자불/출발불 등
  medical_recent      jsonb,              -- 최근 진료 [{date,name,count}]
  layoff_weeks        int,
  training_sessions   int,
  training_minutes    int,
  training_gallop     int,
  training_swim       int,
  weight_last         int,                -- 최근 출주시 마체중(kg)
  weight_last_delta   int,                -- 직전 대비 증감
  unique (race_id, gate_no)
);

create index entries_race_idx on public.entries (race_id);

create table public.predictions (
  id         bigint generated always as identity primary key,
  race_id    text not null references public.races(id) on delete cascade,
  gate_no    int  not null,
  horse_name text not null,
  score      numeric(5,3),               -- 가중합 점수 (0~1)
  win_prob   numeric(5,3),               -- softmax 우승확률 (경주 내 합 1)
  rank       int,
  basis      text,                       -- 상위권 근거 요약
  factors    jsonb,                      -- 항목별 정규화 점수
  unique (race_id, gate_no)
);

create index predictions_race_idx on public.predictions (race_id);

alter table public.races       enable row level security;
alter table public.entries     enable row level security;
alter table public.predictions enable row level security;

create policy "public read races"       on public.races       for select using (true);
create policy "public read entries"     on public.entries     for select using (true);
create policy "public read predictions" on public.predictions for select using (true);
"""

PRED_COLS = ["race_id", "gate_no", "horse_name", "score", "win_prob", "rank", "basis", "factors"]


def sql_val(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'"
    return "'" + str(v).replace("'", "''") + "'"


def main():
    races = json.load(open(SRC, encoding="utf-8"))
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    out = [SCHEMA]

    out.append(f"\n-- races: {len(races)}건")
    out.append(f"insert into public.races ({', '.join(RACE_COLS)}) values")
    rows = [
        "  (" + ", ".join(sql_val(r.get(c)) for c in RACE_COLS) + ")"
        for r in races
    ]
    out.append(",\n".join(rows) + ";")

    n_entries = sum(len(r["entries"]) for r in races)
    out.append(f"\n-- entries: {n_entries}건")
    out.append(f"insert into public.entries ({', '.join(ENTRY_COLS)}) values")
    rows = []
    for r in races:
        for e in r["entries"]:
            vals = {**e, "race_id": r["id"]}
            rows.append("  (" + ", ".join(sql_val(vals.get(c)) for c in ENTRY_COLS) + ")")
    out.append(",\n".join(rows) + ";")

    n_preds = 0
    if os.path.exists(PRED_SRC):
        preds = json.load(open(PRED_SRC, encoding="utf-8"))
        n_preds = len(preds)
        out.append(f"\n-- predictions: {n_preds}건")
        out.append(f"insert into public.predictions ({', '.join(PRED_COLS)}) values")
        rows = [
            "  (" + ", ".join(sql_val(p.get(c)) for c in PRED_COLS) + ")"
            for p in preds
        ]
        out.append(",\n".join(rows) + ";")

    with open(DST, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"written {DST}: races {len(races)}, entries {n_entries}, predictions {n_preds}")


if __name__ == "__main__":
    main()
