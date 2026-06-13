// 당일 조건 보정 계산 — 서버/클라이언트 공용 순수 함수.
// 자동 컨디션 보정(진료·출발조교·휴양·조교량·체중)과
// 당일 주로 상태 보정(건/양/다/포/불 실적 기반)을 점수 델타로 산출한다.

export type TrackCond = "선택 안함" | "건조" | "양호" | "다습" | "포화" | "불량";
export const TRACK_OPTIONS: TrackCond[] = [
  "선택 안함",
  "건조",
  "양호",
  "다습",
  "포화",
  "불량",
];

export type AdjustEntry = {
  gate_no: number;
  horse_name: string;
  career_starts: number | null;
  track_records: Record<string, number[]> | null;
  gate_train_result: string | null;
  medical_recent: { date: string; name: string; count: number }[] | null;
  layoff_weeks: number | null;
  training_minutes: number | null;
  weight_last_delta: number | null;
};

export type AdjustPred = {
  gate_no: number;
  score: number;
  win_prob: number;
  rank: number;
};

export type Delta = { label: string; value: number };

const SOFTMAX_K = 6.0; // parser/predict.py 와 동일

function daysBefore(dateStr: string, raceDate: string): number {
  const d = new Date(dateStr + "T00:00:00").getTime();
  const r = new Date(raceDate + "T00:00:00").getTime();
  return Math.round((r - d) / 86400000);
}

/** 자동 컨디션 보정: PDF에 이미 있는 신호만으로 산출 (입력 불필요) */
export function conditionDeltas(e: AdjustEntry, raceDate: string): Delta[] {
  const out: Delta[] = [];

  const meds = (e.medical_recent ?? []).filter((m) => {
    const d = daysBefore(m.date, raceDate);
    return d >= 0 && d <= 14;
  });
  if (meds.length > 0) {
    out.push({
      label: `2주내 진료 ${meds.length}건 (${meds[0].name.trim()})`,
      value: -Math.min(0.04 * meds.length, 0.08),
    });
  }

  if (e.gate_train_result && e.gate_train_result.includes("불")) {
    out.push({ label: `출발조교 ${e.gate_train_result}`, value: -0.05 });
  }

  if (e.layoff_weeks != null) {
    if (e.layoff_weeks >= 24)
      out.push({ label: `장기휴양 복귀 ${e.layoff_weeks}주`, value: -0.07 });
    else if (e.layoff_weeks >= 12)
      out.push({ label: `휴양 ${e.layoff_weeks}주`, value: -0.04 });
  }

  if (e.training_minutes != null && e.training_minutes < 60) {
    out.push({ label: `조교량 적음 ${e.training_minutes}분`, value: -0.02 });
  }

  if (e.weight_last_delta != null && Math.abs(e.weight_last_delta) >= 15) {
    out.push({
      label: `직전 체중 ${e.weight_last_delta > 0 ? "+" : ""}${e.weight_last_delta}kg 급변`,
      value: -0.03,
    });
  }

  return out;
}

/** 당일 주로 상태 보정: 해당 조건에서의 입상 실적 기반 (입증된 가점만 부여) */
export function trackDelta(e: AdjustEntry, cond: TrackCond): Delta | null {
  if (cond === "선택 안함" || !e.track_records) return null;
  const rec = e.track_records[cond];
  if (!rec) return null;
  const [w = 0, s = 0, t = 0] = rec;
  if (w + s + t === 0) return null;
  const value = Math.min(w * 0.03 + s * 0.015 + t * 0.008, 0.09);
  return { label: `${cond} 주로 ${w}승 ${s + t}입상`, value };
}

export type Adjusted = {
  gate_no: number;
  horse_name: string;
  baseProb: number;
  baseRank: number;
  adjProb: number;
  adjRank: number;
  deltas: Delta[];
};

/** 전체 보정 적용: 점수 델타 합산 → 동일 softmax 재계산 */
export function applyAdjustments(
  entries: AdjustEntry[],
  preds: AdjustPred[],
  cond: TrackCond,
  raceDate: string,
): Adjusted[] {
  const predBy = new Map(preds.map((p) => [p.gate_no, p]));
  const rows = entries
    .filter((e) => predBy.has(e.gate_no))
    .map((e) => {
      const p = predBy.get(e.gate_no)!;
      const deltas = [...conditionDeltas(e, raceDate)];
      const td = trackDelta(e, cond);
      if (td) deltas.push(td);
      const adjScore = p.score + deltas.reduce((s, d) => s + d.value, 0);
      return { e, p, deltas, adjScore };
    });

  const mx = Math.max(...rows.map((r) => r.adjScore));
  const exps = rows.map((r) => Math.exp(SOFTMAX_K * (r.adjScore - mx)));
  const total = exps.reduce((a, b) => a + b, 0);

  const out: Adjusted[] = rows.map((r, i) => ({
    gate_no: r.e.gate_no,
    horse_name: r.e.horse_name,
    baseProb: r.p.win_prob,
    baseRank: r.p.rank,
    adjProb: exps[i] / total,
    adjRank: 0,
    deltas: r.deltas,
  }));

  [...out]
    .sort((a, b) => b.adjProb - a.adjProb || a.gate_no - b.gate_no)
    .forEach((row, i) => {
      row.adjRank = i + 1;
    });

  return out.sort((a, b) => a.adjRank - b.adjRank);
}
