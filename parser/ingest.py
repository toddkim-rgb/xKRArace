# -*- coding: utf-8 -*-
"""주차별 출마표 PDF를 파싱·예측해 Supabase에 '추가(upsert)'한다.

기존 setup.sql(전체 DROP 후 재생성)과 달리 race_id 단위로만 갱신하므로
지난 주 경주·예측, 그리고 입력된 실제 결과(results)는 그대로 보존된다.

매주 워크플로우:
  1) 그 주 PDF를 pdfs/YYYY-MM-DD/ 폴더에 내려받는다
  2) python parser/ingest.py pdfs/2026-06-13        # 한 경기일만 추가
     python parser/ingest.py pdfs                    # 전체(하위 폴더 재귀)

모드:
  (기본)        Supabase REST 로 직접 upsert  ← parser/.env 의 service_role 키 필요
  --sql         SQL Editor 에 붙여넣을 추가 upsert SQL 파일만 생성 (키 불필요)
  --dry-run     DB/SQL 미반영, 파싱·예측 결과만 출력 (검증용)

환경변수 (parser/.env 또는 셸 환경):
  SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=...   # Dashboard → Settings → API → service_role (비공개!)
"""
import glob
import json
import os
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from parse_pdfs import parse_pdf  # noqa: E402
from predict import predict_race  # noqa: E402
from gen_sql import RACE_COLS, ENTRY_COLS, PRED_COLS, sql_val  # noqa: E402


def load_env():
    path = os.path.join(HERE, ".env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""


# ── 행 변환 ────────────────────────────────────────────────
def race_row(race):
    return {c: race.get(c) for c in RACE_COLS}


def entry_rows(race):
    rid = race["id"]
    return [
        {**{c: e.get(c) for c in ENTRY_COLS}, "race_id": rid}
        for e in race["entries"]
    ]


def pred_rows(race):
    return [{c: p.get(c) for c in PRED_COLS} for p in predict_race(race)]


# ── REST 모드 ──────────────────────────────────────────────
def api(method, path, body=None, prefer="return=minimal"):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", SERVICE_KEY)
    req.add_header("Authorization", f"Bearer {SERVICE_KEY}")
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")


def upsert_rest(race):
    rid = race["id"]
    # 1) race: id 충돌 시 갱신 (삭제하지 않아 results 로의 영향 없음)
    st, body = api("POST", "races?on_conflict=id", [race_row(race)],
                   "resolution=merge-duplicates,return=minimal")
    if st >= 300:
        raise RuntimeError(f"race upsert 실패 {st}: {body[:200]}")
    # 2) entries: 해당 race_id 만 교체
    api("DELETE", f"entries?race_id=eq.{rid}")
    st, body = api("POST", "entries", entry_rows(race))
    if st >= 300:
        raise RuntimeError(f"entries 삽입 실패 {st}: {body[:200]}")
    # 3) predictions: 해당 race_id 만 교체
    api("DELETE", f"predictions?race_id=eq.{rid}")
    st, body = api("POST", "predictions", pred_rows(race))
    if st >= 300:
        raise RuntimeError(f"predictions 삽입 실패 {st}: {body[:200]}")


# ── SQL 모드 ───────────────────────────────────────────────
def _values(cols, row):
    return "(" + ", ".join(sql_val(row.get(c)) for c in cols) + ")"


def sql_for_race(race):
    rid = race["id"]
    out = [f"\n-- {rid} {race.get('venue','')} {race.get('race_no','')}R {race.get('grade','')}"]

    set_cols = [c for c in RACE_COLS if c != "id"]
    set_clause = ", ".join(f"{c}=excluded.{c}" for c in set_cols)
    out.append(
        f"insert into public.races ({', '.join(RACE_COLS)}) values\n"
        f"  {_values(RACE_COLS, race_row(race))}\n"
        f"on conflict (id) do update set {set_clause};"
    )

    out.append(f"delete from public.entries where race_id = '{rid}';")
    ev = ",\n  ".join(_values(ENTRY_COLS, r) for r in entry_rows(race))
    out.append(f"insert into public.entries ({', '.join(ENTRY_COLS)}) values\n  {ev};")

    out.append(f"delete from public.predictions where race_id = '{rid}';")
    pv = ",\n  ".join(_values(PRED_COLS, r) for r in pred_rows(race))
    out.append(f"insert into public.predictions ({', '.join(PRED_COLS)}) values\n  {pv};")
    return "\n".join(out)


# ── 메인 ───────────────────────────────────────────────────
def find_pdfs(target):
    rec = sorted(glob.glob(os.path.join(target, "**", "s_run_hr_*.pdf"), recursive=True))
    flat = sorted(glob.glob(os.path.join(target, "s_run_hr_*.pdf")))
    return sorted(set(rec) | set(flat))


def main():
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in flags
    as_sql = "--sql" in flags
    target = args[0] if args else os.path.join(BASE, "pdfs")

    pdfs = find_pdfs(target)
    if not pdfs:
        print(f"PDF 없음: {target}")
        return
    if not dry and not as_sql and (not SUPABASE_URL or not SERVICE_KEY):
        print("REST 모드에는 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 "
              "(parser/.env).\n→ 키 없이 가려면 --sql 또는 --dry-run 을 쓰세요.")
        return

    mode = "DRY-RUN" if dry else ("SQL 생성" if as_sql else "REST upsert")
    print(f"[{mode}] 대상 {len(pdfs)}개 PDF\n")

    races = [parse_pdf(p) for p in pdfs]
    races.sort(key=lambda r: r["id"])
    sql_chunks = []
    te = tp = 0
    for r in races:
        ne, npr = len(r["entries"]), len(pred_rows(r))
        te += ne
        tp += npr
        try:
            if not dry and not as_sql:
                upsert_rest(r)
            if as_sql:
                sql_chunks.append(sql_for_race(r))
            tag = {"DRY-RUN": "(dry)", "SQL 생성": "(sql)", "REST upsert": "upsert✓"}[mode]
            print(f"  {r['id']} {r.get('race_no')}R {r.get('grade','?'):<8} 출전 {ne}두 예측 {npr}건 {tag}")
        except Exception as ex:  # noqa: BLE001
            print(f"  {r['id']} ✗ {ex}")

    print(f"\n[{mode}] 경주 {len(races)} · entries {te} · predictions {tp}")

    if as_sql:
        name = os.path.basename(os.path.normpath(target)) or "all"
        dst = os.path.join(BASE, "supabase", f"ingest_{name}.sql")
        header = (
            "-- 추가(upsert) 적재 SQL (자동 생성, parser/ingest.py --sql)\n"
            "-- setup.sql 과 달리 DROP 하지 않습니다. 해당 race_id 만 갱신하며\n"
            "-- 다른 경주와 results(실제 착순)는 보존됩니다. SQL Editor 에 붙여넣어 실행하세요.\n"
        )
        with open(dst, "w", encoding="utf-8") as f:
            f.write(header + "\n".join(sql_chunks) + "\n")
        print(f"→ SQL 작성: {dst}")
    elif not dry:
        print("results(실제 착순)는 건드리지 않았습니다 — 보존됨.")


if __name__ == "__main__":
    main()
