# -*- coding: utf-8 -*-
"""경마 당일 보정에 쓸 수 있는 데이터가 PDF에 얼마나 있는지 전수 스캔."""
import glob
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
import pdfplumber

PDF_DIR = r"C:\Users\toddk\xHRrace\pdfs"

# 후보 신호 패턴
TRACK_REC = re.compile(r"건\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)\s+양\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)\s+다\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)\s+포\s*([\d-]+)/\s*([\d-]+)/\s*([\d-]+)\s+불")
GATE_TRAIN = re.compile(r"출발조교:(\d{6})?\(?([가-힣]*),?([가-힣]*)\)?")
MEDICAL = re.compile(r"(2\d{5})((?:좌|우|양|마|구|정|식|운|진|피)[가-힣\s]{1,14}?)(\d{1,2})회")
LAYOFF = re.compile(r"([\d*]+|\d)\s+(\d{1,2})주\s")
TRAINING = re.compile(r"(\d+)회(\d+)분\([^)]*\)/구(\d+)습(\d+)")
SWIM = re.compile(r"수영\s*:\s*(\d+)회\s*(\d+)바퀴")
PAST_MOIST = re.compile(r"\d{6}[서부제]\d{1,2}R\S*\s+\d{3,4}\S*?(맑|흐|비|강|눈)(\d{1,2})%")
WEIGHT_TREND = re.compile(r"(\d{3})([+-]\d{1,2})복")

stats = {k: 0 for k in ["entries", "track_rec", "track_rec_nonzero", "gate_train", "gate_good", "gate_bad", "medical", "medical_recent", "layoff", "training", "swim", "past_moist", "weight_trend"]}
examples = {}

for path in sorted(glob.glob(os.path.join(PDF_DIR, "s_run_hr_*.pdf"))):
    with pdfplumber.open(path) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages)

    # 출전마 수 = 건양다포불 라인 수로 근사 (모든 마필 블록에 1개씩 존재 가정 검증)
    n_entry = len(re.findall(r"^\d{1,2}\s*(?:\[[가-힣]+\])?\s*(?:[가-힣]\s)*[가-힣]+(?:\s[가-힣])*\s*\*?\d{2}\.\d\(", text, re.M))
    stats["entries"] += n_entry

    m = TRACK_REC.findall(text)
    stats["track_rec"] += len(m)
    nz = [t for t in m if any(x not in ("-", "") and x != "0" for x in t)]
    stats["track_rec_nonzero"] += len(nz)
    if nz and "track" not in examples:
        examples["track"] = nz[0]

    g = GATE_TRAIN.findall(text)
    stats["gate_train"] += len(g)
    stats["gate_good"] += sum(1 for x in g if "양호" in x[2] or "양호" in x[1])
    stats["gate_bad"] += sum(1 for x in g if ("불" in x[1] or "불" in x[2]) and "양호" not in x[1] + x[2])

    md = MEDICAL.findall(text)
    stats["medical"] += len(md)
    recent = [x for x in md if x[0] >= "260530"]  # 경주 2주 이내
    stats["medical_recent"] += len(recent)
    if recent and "medical" not in examples:
        examples["medical"] = recent[:3]

    stats["layoff"] += len(LAYOFF.findall(text))
    stats["training"] += len(TRAINING.findall(text))
    stats["swim"] += len(SWIM.findall(text))
    stats["past_moist"] += len(PAST_MOIST.findall(text))
    stats["weight_trend"] += len(WEIGHT_TREND.findall(text))
    if "moist" not in examples:
        pm = PAST_MOIST.findall(text)
        if pm:
            examples["moist"] = pm[:4]
    if "wt" not in examples:
        wt = WEIGHT_TREND.findall(text)
        if wt:
            examples["wt"] = wt[:4]

print(f"총 출전마(추정): {stats['entries']}두\n")
print(f"[주로 상태별 성적] 건/양/다/포/불 라인: {stats['track_rec']}건 (성적 보유 {stats['track_rec_nonzero']}건)")
print(f"  예시: 건{examples.get('track', ('?',)*12)[0:3]} 양{examples.get('track', ('?',)*12)[3:6]} ...")
print(f"[과거 출주시 주로 함수율] 패턴: {stats['past_moist']}건  예시: {examples.get('moist')}")
print(f"[출발조교 평가] {stats['gate_train']}건 (양호 {stats['gate_good']} / 불량계 {stats['gate_bad']})")
print(f"[진료 이력] 총 {stats['medical']}건, 경주 2주 이내 최근 진료 {stats['medical_recent']}건")
print(f"  최근 예시: {examples.get('medical')}")
print(f"[휴양 주수] 패턴: {stats['layoff']}건")
print(f"[조교 강도] N회N분/구N습N: {stats['training']}건, 수영: {stats['swim']}건")
print(f"[마체중 추세] NNN±N복 패턴: {stats['weight_trend']}건  예시: {examples.get('wt')}")
