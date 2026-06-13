// 예측 적중 판정 공용 로직 — 경주 상세와 통계 페이지가 공유.

export type RankPick = { gate_no: number; rank: number };
export type FinishMap = Map<number, number>; // gate_no → finish_position

export type RaceScore = {
  evaluated: boolean;
  win: boolean; // 예측 1위(◎)가 실제 1착
  place: boolean; // 예측 1위가 실제 3착 이내
  top3Overlap: number; // 예측 top3 ∩ 실제 top3 개수 (0~3)
  trifectaExact: boolean; // 예측 top3 순서 = 실제 1·2·3착 순서
};

/** 한 경주의 예측 vs 실제 결과를 채점 */
export function scoreRace(
  preds: RankPick[],
  finishes: FinishMap,
): RaceScore {
  const empty: RaceScore = {
    evaluated: false,
    win: false,
    place: false,
    top3Overlap: 0,
    trifectaExact: false,
  };
  if (finishes.size === 0) return empty;

  const predTop = [1, 2, 3]
    .map((r) => preds.find((p) => p.rank === r)?.gate_no)
    .filter((g): g is number => g != null);
  if (predTop.length === 0) return empty;

  const actualTop = [...finishes.entries()]
    .filter(([, pos]) => pos >= 1 && pos <= 3)
    .sort((a, b) => a[1] - b[1])
    .map(([gate]) => gate);

  const champ = [...finishes.entries()].find(([, pos]) => pos === 1)?.[0];
  const predWinner = predTop[0];

  const overlap = predTop.filter((g) => actualTop.includes(g)).length;
  const trifectaExact =
    predTop.length === 3 &&
    actualTop.length === 3 &&
    predTop.every((g, i) => g === actualTop[i]);

  return {
    evaluated: true,
    win: champ != null && predWinner === champ,
    place: champ == null ? false : predTopPlaced(predWinner, finishes),
    top3Overlap: overlap,
    trifectaExact,
  };
}

function predTopPlaced(gate: number, finishes: FinishMap): boolean {
  const pos = finishes.get(gate);
  return pos != null && pos >= 1 && pos <= 3;
}

export type AggStats = {
  total: number;
  winRate: number;
  placeRate: number;
  avgOverlap: number;
  trifectaRate: number;
};

/** 여러 경주 점수를 누적 집계 */
export function aggregate(scores: RaceScore[]): AggStats {
  const evald = scores.filter((s) => s.evaluated);
  const n = evald.length;
  if (n === 0)
    return { total: 0, winRate: 0, placeRate: 0, avgOverlap: 0, trifectaRate: 0 };
  return {
    total: n,
    winRate: evald.filter((s) => s.win).length / n,
    placeRate: evald.filter((s) => s.place).length / n,
    avgOverlap: evald.reduce((a, s) => a + s.top3Overlap, 0) / n,
    trifectaRate: evald.filter((s) => s.trifectaExact).length / n,
  };
}
