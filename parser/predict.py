# -*- coding: utf-8 -*-
"""출마표 데이터 기반 우승마 예측 점수 산출.

data/races.json → data/predictions.json

방식: 경주 내에서 항목별 min-max 정규화 → 가중합 점수 → softmax 우승확률.
결측값(신마 등)은 경주 평균(0.5)으로 중립 처리해 과대/과소평가를 막는다.
"""
import json
import math
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "data", "races.json")
DST = os.path.join(BASE, "data", "predictions.json")

# 가중치 (합 1.0) — 항목명은 UI 근거 표시에 그대로 사용
WEIGHTS = {
    "레이팅": 0.28,
    "승률": 0.18,
    "복승률": 0.12,
    "최고기록": 0.16,
    "기수승률": 0.10,
    "조교사승률": 0.06,
    "상금효율": 0.06,
    "중량증감": 0.04,
}
SOFTMAX_K = 6.0  # 점수차 → 확률차 민감도


def time_to_sec(t):
    if not t:
        return None
    m = re.match(r"(\d+):(\d\d\.\d)", t)
    return int(m.group(1)) * 60 + float(m.group(2)) if m else None


def pct(stats):
    """'282승(9.8%)/66승' / '640승(9.6%)' → 9.8"""
    if not stats:
        return None
    m = re.search(r"\(([\d.]+)%\)", stats)
    return float(m.group(1)) if m else None


def raw_features(e):
    f = {}
    f["레이팅"] = e.get("rating")

    starts = e.get("career_starts") or 0
    rec = e.get("career_record")
    if starts > 0 and rec:
        nums = [0 if p in ("-", "") else int(p) for p in rec.split("/")]
        f["승률"] = nums[0] / starts
        f["복승률"] = sum(nums[:3]) / starts
        f["상금효율"] = (e.get("career_prize") or 0) / starts
    else:
        f["승률"] = f["복승률"] = f["상금효율"] = None

    sec = time_to_sec(e.get("best_time"))
    f["최고기록"] = -sec if sec else None  # 빠를수록 높게
    f["기수승률"] = pct(e.get("jockey_stats"))
    f["조교사승률"] = pct(e.get("trainer_stats"))
    wd = e.get("weight_delta")
    f["중량증감"] = -wd if wd is not None else None  # 증량은 감점
    return f


def normalize(values):
    """경주 내 min-max 정규화. 결측은 0.5(중립)."""
    present = [v for v in values if v is not None]
    if len(present) < 2 or max(present) == min(present):
        return [0.5] * len(values)
    lo, hi = min(present), max(present)
    return [0.5 if v is None else (v - lo) / (hi - lo) for v in values]


def predict_race(race):
    entries = race["entries"]
    feats = [raw_features(e) for e in entries]

    norm = {}
    for key in WEIGHTS:
        norm[key] = normalize([f[key] for f in feats])

    scores = []
    for i in range(len(entries)):
        s = sum(WEIGHTS[k] * norm[k][i] for k in WEIGHTS)
        scores.append(s)

    mx = max(scores)
    exps = [math.exp(SOFTMAX_K * (s - mx)) for s in scores]
    total = sum(exps)
    probs = [x / total for x in exps]

    order = sorted(range(len(entries)), key=lambda i: (-scores[i], entries[i]["gate_no"]))
    ranks = {}
    for pos, i in enumerate(order, start=1):
        ranks[i] = pos

    out = []
    for i, e in enumerate(entries):
        factors = {k: round(norm[k][i], 2) for k in WEIGHTS}
        # 근거: 기여도(가중치×정규값) 상위 2개 항목
        contrib = sorted(WEIGHTS, key=lambda k: -(WEIGHTS[k] * norm[k][i]))
        basis = "·".join(contrib[:2]) + " 우위" if ranks[i] <= 3 else None
        out.append({
            "race_id": race["id"],
            "gate_no": e["gate_no"],
            "horse_name": e["horse_name"],
            "score": round(scores[i], 3),
            "win_prob": round(probs[i], 3),
            "rank": ranks[i],
            "basis": basis,
            "factors": factors,
        })
    return out


def main():
    races = json.load(open(SRC, encoding="utf-8"))
    preds = []
    for r in races:
        preds.extend(predict_race(r))
    with open(DST, "w", encoding="utf-8") as f:
        json.dump(preds, f, ensure_ascii=False, indent=1)

    print(f"predictions: {len(preds)}건")
    for r in races:
        top = sorted(
            (p for p in preds if p["race_id"] == r["id"]),
            key=lambda p: p["rank"],
        )[:3]
        names = " > ".join(
            f"{p['gate_no']}{p['horse_name']}({p['win_prob']*100:.0f}%)" for p in top
        )
        print(f"  {r['id']} {r.get('race_no')}R: {names}")


if __name__ == "__main__":
    main()
