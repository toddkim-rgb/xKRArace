# -*- coding: utf-8 -*-
"""KRA 서울 경마 상세출마표 PDF 파서.

pdfs/s_run_hr_YYMMDD_NN.pdf 20개를 읽어 경주(races)·출전마(entries)
구조화 데이터를 data/races.json 으로 출력한다.
"""
import glob
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

import pdfplumber

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(BASE, "pdfs")
OUT_PATH = os.path.join(BASE, "data", "races.json")

# 출전마 블록 시작: "1 재 즈 퍼 플 58.0( +5.5) ..." / "10원더그레이스 53.0( 0.0) ..."
# 타지역 소속마는 "[부]레지나빈치트"처럼 접두 표기가 붙는다.
ENTRY_RE = re.compile(
    r"^(\d{1,2})\s*(\[[가-힣]+\])?\s*((?:[가-힣]\s)*[가-힣]+(?:\s[가-힣])*)\s*(\*?)(\d{2}\.\d)\(\s*([+-]?\d+(?:\.\d)?)\)"
)
HORSE_INFO_RE = re.compile(
    r"^(\d{1,2})(수|암|거)\((\d{6})\)(\S+?)\s+(한국|미국|호주|일본|뉴질랜드|캐나다|아일랜드|영국|프랑스)"
)
RATING_RE = re.compile(r"\bR(\d+)\b")
SIRE_DAM_RE = re.compile(
    r"^(.+?)\s+-\s+(.+?)\s+([\d,]+승\([\d.]+%\)/[\d,]+승)\s+(\d+전\(\d+/\d+/\d+\))"
)
# 마주(승수) / 생산자 (N조)조교사 통산승(승률) — 생산자와 (N조)가 붙거나
# PDF 추출시 글자가 겹치는 변형이 있어 앞/뒤를 나눠 잡는다.
OWNER_RE = re.compile(r"^(.+?)\((\d+)승\)\s*/\s*(.+)$")
TRAINER_TAIL_RE = re.compile(r"([가-힣A-Za-z]+)\s+([\d,]+)승\(([\d.]+)%\)\s*$")
TEAM_RE = re.compile(r"\((\d+)조\)")
CAREER_RE = re.compile(
    r"^(\d+)전\(\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)\)\s+([\d,]+)천원"
)
JOCKEY_RE = re.compile(r"^(-\d(?:\.\d)?)?([가-힣]{2,6})$")
BEST_RE = re.compile(r"^최\s*-?\s*(\d:\d\d\.\d|없음)")
AVG_RE = re.compile(r"^평\s*-?\s*(\d:\d\d\.\d|없음)")

# ── 당일 보정용 신호 ──────────────────────────────────────────
# 주로 상태별(건조/양호/다습/포화/불량) 1·2·3착 기록
TRACK_REC_RE = re.compile(
    r"건\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)"
    r"\s+양\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)"
    r"\s+다\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)"
    r"\s+포\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)"
    r"\s+불\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)"
)
GATE_TRAIN_RE = re.compile(r"출발조교:(?:(\d{6})\(([^)]*)\))?")
MEDICAL_RE = re.compile(
    r"(2\d{5})\s*((?:좌|우|양|마|구|정|식|운|진|피|비|발|제|안|두|경|산|척|결)[가-힣()\s]{0,16}?)\s*(\d{1,2})회"
)
LAYOFF_RE = re.compile(r"(?:^|\s)[\d*]+\s+(\d{1,2})주\s")
TRAINING_RE = re.compile(r"(\d+)회(\d+)분\([^)]*\)/구(\d+)습(\d+)")
SWIM_RE = re.compile(r"수영\s*:\s*(\d+)회\s*(\d+)바퀴")
WEIGHT_TREND_RE = re.compile(r"(\d{3})([+-]\d{1,2})복")


def _int0(s):
    return 0 if s in ("-", "") else int(s)


def parse_condition_signals(block_text, e):
    """출전마 블록에서 당일 보정용 신호를 추출해 e 에 추가한다."""
    tm = TRACK_REC_RE.search(block_text)
    if tm:
        g = [_int0(x) for x in tm.groups()]
        rec = {}
        for i, key in enumerate(["건조", "양호", "다습", "포화", "불량"]):
            w, s, t = g[i * 3 : i * 3 + 3]
            if w or s or t:
                rec[key] = [w, s, t]
        if rec:
            e["track_records"] = rec

    gm = GATE_TRAIN_RE.search(block_text)
    if gm and gm.group(1):
        e["gate_train_date"] = f"20{gm.group(1)[:2]}-{gm.group(1)[2:4]}-{gm.group(1)[4:6]}"
        parts = [p for p in gm.group(2).split(",") if p]
        if parts:
            e["gate_train_result"] = parts[-1]

    meds = []
    for d, name, cnt in MEDICAL_RE.findall(block_text):
        meds.append({
            "date": f"20{d[:2]}-{d[2:4]}-{d[4:6]}",
            "name": re.sub(r"\s+", " ", name).strip(),
            "count": int(cnt),
        })
    if meds:
        meds.sort(key=lambda m: m["date"], reverse=True)
        e["medical_recent"] = meds[:6]

    lm = LAYOFF_RE.search(block_text)
    if lm:
        e["layoff_weeks"] = int(lm.group(1))

    tn = TRAINING_RE.search(block_text)
    if tn:
        e["training_sessions"] = int(tn.group(1))
        e["training_minutes"] = int(tn.group(2))
        e["training_gallop"] = int(tn.group(3))
    sw = SWIM_RE.search(block_text)
    if sw:
        e["training_swim"] = int(sw.group(1))

    wm = WEIGHT_TREND_RE.search(block_text)
    if wm:
        e["weight_last"] = int(wm.group(1))
        e["weight_last_delta"] = int(wm.group(2))


def parse_header(lines, race):
    """경주 헤더(첫 출전마 라인 이전)에서 조건·상금·시각을 뽑는다."""
    header_text = "\n".join(lines)

    # 1행: "서울 5경주 혼4등급 연령오픈 성별오픈 핸디캡 R0~50"
    m = re.match(
        r"^(\S+)\s+(\d+)경주\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(R\S+))?",
        lines[0],
    )
    if m:
        race["venue"] = m.group(1)
        race["race_no"] = int(m.group(2))
        race["grade"] = m.group(3)
        race["age_cond"] = m.group(4)
        race["sex_cond"] = m.group(5)
        race["weight_type"] = m.group(6)
        race["rating_range"] = m.group(7)
    if len(lines) > 1:
        race["race_kind"] = lines[1].strip()

    times = re.findall(r"(\d{1,2})시(\d{2})분", header_text)
    if times:
        race["start_time"] = f"{int(times[0][0]):02d}:{times[0][1]}"

    total = re.search(r"^([\d,]+)천원\s*$", header_text, re.M)
    if total:
        race["total_prize"] = int(total.group(1).replace(",", ""))
    for rank in range(1, 6):
        m = re.search(rf"{rank}위\s+([\d,]+)천원", header_text)
        if m:
            race[f"prize_{rank}"] = int(m.group(1).replace(",", ""))


def parse_entry(block):
    """한 출전마 블록(여러 줄)을 dict 로 변환."""
    first = block[0]
    m = ENTRY_RE.match(first)
    e = {
        "gate_no": int(m.group(1)),
        "horse_name": m.group(3).replace(" ", ""),
        "weight_marker": m.group(4) == "*",
        "weight": float(m.group(5)),
        "weight_delta": float(m.group(6)),
    }
    if m.group(2):
        e["region_tag"] = m.group(2).strip("[]")
    # 직전 출주 4건 요약(블록 첫 줄 우측): "260509서8R혼4 1400핸맑5%(41) ..."
    rest = first[m.end():].strip()
    if rest:
        e["recent_races_raw"] = rest

    for i, line in enumerate(block[1:], start=1):
        line = line.strip()
        if "jockey" not in e:
            jm = JOCKEY_RE.match(line)
            if jm:
                e["jockey"] = jm.group(2)
                if jm.group(1):
                    e["jockey_allowance"] = jm.group(1)
                continue
        hm = HORSE_INFO_RE.match(line)
        if hm and "age" not in e:
            e["age"] = int(hm.group(1))
            e["sex"] = hm.group(2)
            b = hm.group(3)
            century = "19" if int(b[:2]) > 50 else "20"
            e["birth"] = f"{century}{b[:2]}-{b[2:4]}-{b[4:6]}"
            e["color"] = hm.group(4)
            e["country"] = hm.group(5)
            rm = RATING_RE.search(line[: hm.end() + 12])
            if rm:
                e["rating"] = int(rm.group(1))
            continue
        sm = SIRE_DAM_RE.match(line)
        if sm and "sire" not in e:
            e["sire"] = sm.group(1).strip()
            e["dam"] = sm.group(2).strip()
            e["jockey_stats"] = sm.group(3)
            e["jockey_horse_record"] = sm.group(4)
            continue
        # 글리프 겹침으로 모마명과 기수 통산승수가 섞인 경우의 복원 폴백
        if (
            "sire" not in e
            and " - " in line
            and re.search(r"\([\d.]+%\)", line)
            and re.search(r"\d+전\(\d+/\d+/\d+\)", line)
        ):
            left, _, right = line.partition(" - ")
            rec = re.search(r"(\d+전\(\d+/\d+/\d+\))", right)
            dam_part = right[: rec.start()].strip() if rec else right.strip()
            dam_clean = re.sub(r"[\d.,승()%/]", "", dam_part)
            e["sire"] = left.strip()
            e["dam"] = re.sub(r"\s+", " ", dam_clean).strip()
            e["jockey_horse_record"] = rec.group(1) if rec else None
            continue
        om = OWNER_RE.match(line)
        if om and "owner" not in e:
            rest = om.group(3)
            tm = TRAINER_TAIL_RE.search(rest)
            if tm:
                e["owner"] = om.group(1).strip()
                e["owner_wins"] = int(om.group(2))
                e["trainer"] = tm.group(1)
                e["trainer_stats"] = f"{tm.group(2)}승({tm.group(3)}%)"
                mid = rest[: tm.start()].strip()
                team = TEAM_RE.search(mid)
                if team:
                    e["trainer_team"] = int(team.group(1))
                    mid = (mid[: team.start()] + mid[team.end():]).strip()
                if mid:
                    e["breeder"] = mid
            else:
                # 조교사 꼬리가 겹침 손상된 경우: 마주만 확정, 나머지는 원문 보존
                e["owner"] = om.group(1).strip()
                e["owner_wins"] = int(om.group(2))
                e["breeder"] = rest
            continue
        cm = CAREER_RE.match(line)
        if cm and "career_starts" not in e:
            e["career_starts"] = int(cm.group(1))
            places = [cm.group(k) for k in range(2, 7)]
            e["career_record"] = "/".join(p.strip() for p in places)
            e["career_prize"] = int(cm.group(7).replace(",", ""))
            continue
        bm = BEST_RE.match(line)
        if bm:
            e["best_time"] = None if bm.group(1) == "없음" else bm.group(1)
            continue
        am = AVG_RE.match(line)
        if am:
            e["avg_time"] = None if am.group(1) == "없음" else am.group(1)
            continue

    parse_condition_signals("\n".join(block), e)
    return e


def parse_pdf(path):
    name = os.path.basename(path)
    m = re.match(r"s_run_hr_(\d{6})_(\d{2})\.pdf", name)
    ymd, _no = m.group(1), int(m.group(2))
    race = {
        "id": f"{ymd}-{int(_no):02d}",
        "race_date": f"20{ymd[:2]}-{ymd[2:4]}-{ymd[4:6]}",
        "source_file": name,
    }

    with pdfplumber.open(path) as pdf:
        lines = []
        for page in pdf.pages:
            lines.extend((page.extract_text() or "").splitlines())

    # 거리: 페이지2 통계 헤더 "1400m 승률"
    dm = re.search(r"(\d{3,4})m\s*승률", "\n".join(lines))
    if dm:
        race["distance_m"] = int(dm.group(1))

    # 출전마 블록 경계 탐색 (통계 섹션 "레이팅 승률" 이후는 제외)
    entry_starts = []
    stats_at = None
    expected = 1
    for i, line in enumerate(lines):
        if re.match(r"^레이팅\s+승률", line):
            stats_at = i
            break
        em = ENTRY_RE.match(line)
        if em and int(em.group(1)) == expected:
            entry_starts.append(i)
            expected += 1
    end = stats_at if stats_at is not None else len(lines)

    parse_header(lines[: entry_starts[0]] if entry_starts else lines, race)

    entries = []
    for k, start in enumerate(entry_starts):
        stop = entry_starts[k + 1] if k + 1 < len(entry_starts) else end
        block = [
            l for l in lines[start:stop]
            if not re.match(r"^\S+\s+\d+경주\[\d{4}\.\d{2}\.\d{2}\]", l)
        ]
        entries.append(parse_entry(block))
    race["entries"] = entries
    return race


def main():
    # 평면(pdfs/*.pdf)·주차폴더(pdfs/YYYY-MM-DD/*.pdf) 모두 지원
    paths = set(glob.glob(os.path.join(PDF_DIR, "s_run_hr_*.pdf")))
    paths |= set(glob.glob(os.path.join(PDF_DIR, "**", "s_run_hr_*.pdf"), recursive=True))
    races = [parse_pdf(p) for p in sorted(paths)]
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(races, f, ensure_ascii=False, indent=1)

    # 파싱 품질 리포트
    print(f"races: {len(races)}")
    sig = {k: 0 for k in ["track_records", "gate_train_result", "medical_recent", "layoff_weeks", "training_sessions", "weight_last"]}
    total = 0
    for r in races:
        for e in r["entries"]:
            total += 1
            for k in sig:
                if k in e:
                    sig[k] += 1
    print("보정 신호 커버리지:", ", ".join(f"{k} {v}/{total}" for k, v in sig.items()))
    core = ("jockey", "age", "sire", "owner", "career_starts")
    for r in races:
        n = len(r["entries"])
        problems = []
        for e in r["entries"]:
            miss = [f for f in core if f not in e]
            if miss:
                problems.append(f"{e['gate_no']}{e['horse_name']}:{','.join(miss)}")
        dist = r.get("distance_m", "?")
        print(
            f"  {r['id']} {r.get('venue','?')} {r.get('race_no','?')}R "
            f"{r.get('grade','?'):<8} {dist}m 출전 {n}두"
            + (f"  ⚠ {'; '.join(problems)}" if problems else "")
        )


if __name__ == "__main__":
    main()
