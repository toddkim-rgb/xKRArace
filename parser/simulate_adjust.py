# -*- coding: utf-8 -*-
"""web/lib/adjust.ts 와 동일 로직으로 보정 효과를 시뮬레이션 (검증용)."""
import json
import math
import sys
from datetime import date

sys.stdout.reconfigure(encoding="utf-8")

races = json.load(open(r"C:\Users\toddk\xHRrace\data\races.json", encoding="utf-8"))
preds = json.load(open(r"C:\Users\toddk\xHRrace\data\predictions.json", encoding="utf-8"))
pred_by = {(p["race_id"], p["gate_no"]): p for p in preds}


def days_before(d, race_d):
    y, m, dd = int(d[:4]), int(d[5:7]), int(d[8:10])
    ry, rm, rd = int(race_d[:4]), int(race_d[5:7]), int(race_d[8:10])
    return (date(ry, rm, rd) - date(y, m, dd)).days


def cond_deltas(e, race_date):
    out = []
    meds = [m for m in e.get("medical_recent", []) if 0 <= days_before(m["date"], race_date) <= 14]
    if meds:
        out.append((f"진료{len(meds)}건", -min(0.04 * len(meds), 0.08)))
    g = e.get("gate_train_result")
    if g and "불" in g:
        out.append((f"출발조교{g}", -0.05))
    lw = e.get("layoff_weeks")
    if lw is not None:
        if lw >= 24:
            out.append((f"휴양{lw}주", -0.07))
        elif lw >= 12:
            out.append((f"휴양{lw}주", -0.04))
    tm = e.get("training_minutes")
    if tm is not None and tm < 60:
        out.append(("조교부족", -0.02))
    wd = e.get("weight_last_delta")
    if wd is not None and abs(wd) >= 15:
        out.append((f"체중{wd:+d}", -0.03))
    return out


stats = {"진료": 0, "출발조교": 0, "휴양": 0, "조교부족": 0, "체중": 0}
affected = 0
total = 0
rank_changes = 0

for r in races:
    rows = []
    for e in r["entries"]:
        total += 1
        p = pred_by[(r["id"], e["gate_no"])]
        ds = cond_deltas(e, r["race_date"])
        if ds:
            affected += 1
            for label, _ in ds:
                for k in stats:
                    if label.startswith(k) or k in label:
                        stats[k] += 1
        rows.append((e["gate_no"], p["score"] + sum(v for _, v in ds), p["rank"]))
    mx = max(s for _, s, _ in rows)
    exps = [(g, math.exp(6.0 * (s - mx)), br) for g, s, br in rows]
    t = sum(x for _, x, _ in exps)
    order = sorted(exps, key=lambda x: -x[1])
    new_top = order[0][0]
    old_top = next(g for g, _, br in rows if br == 1)
    if new_top != old_top:
        rank_changes += 1
        print(f"  {r['id']} {r['race_no']}R: 자동보정으로 1위 변경 {old_top}번 → {new_top}번")

print(f"\n자동 컨디션 보정 적용: {affected}/{total}두")
print(f"신호별: {stats}")
print(f"1위가 바뀌는 경주: {rank_changes}/20")
