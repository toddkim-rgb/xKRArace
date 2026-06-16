import Link from "next/link";
import {
  supabase,
  type Prediction,
  type Race,
  type RaceResult,
} from "@/lib/supabase";
import { aggregate, scoreRace, type RankPick } from "@/lib/scoring";

export const dynamic = "force-dynamic";

function formatDate(d: string) {
  const date = new Date(d + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`;
}

function pct(x: number) {
  return `${(x * 100).toFixed(0)}%`;
}

export default async function StatsPage() {
  const [{ data: raceData }, { data: predData }, { data: resultData, error }] =
    await Promise.all([
      supabase.from("races").select("*").order("race_date").order("race_no"),
      supabase.from("predictions").select("race_id, gate_no, rank"),
      supabase.from("results").select("*"),
    ]);

  const resultsMissing =
    !!error &&
    (error.code === "42P01" ||
      error.code === "PGRST205" ||
      (error.message ?? "").includes("schema cache"));
  const races = (raceData ?? []) as Race[];
  const preds = (predData ?? []) as Pick<
    Prediction,
    "race_id" | "gate_no" | "rank"
  >[];
  const results = (resultData ?? []) as RaceResult[];

  const predByRace = new Map<string, RankPick[]>();
  for (const p of preds) {
    if (p.rank == null) continue;
    const list = predByRace.get(p.race_id) ?? [];
    list.push({ gate_no: p.gate_no, rank: p.rank });
    predByRace.set(p.race_id, list);
  }
  const finishByRace = new Map<string, Map<number, number>>();
  for (const r of results) {
    const m = finishByRace.get(r.race_id) ?? new Map<number, number>();
    m.set(r.gate_no, r.finish_position);
    finishByRace.set(r.race_id, m);
  }

  const perRace = races
    .map((r) => ({
      race: r,
      score: scoreRace(
        predByRace.get(r.id) ?? [],
        finishByRace.get(r.id) ?? new Map(),
      ),
    }))
    .filter((x) => x.score.evaluated);

  const agg = aggregate(perRace.map((x) => x.score));

  const cards = [
    { label: "단승 적중", sub: "◎ 1순위가 1착", value: agg.winRate },
    { label: "◎ 복연승", sub: "◎ 1순위가 3착 이내", value: agg.placeRate },
    {
      label: "삼복승 정확",
      sub: "예측 top3 = 실제 1·2·3착 순서",
      value: agg.trifectaRate,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <nav className="mb-6 flex flex-wrap gap-x-4 text-sm">
        <Link
          href="/"
          className="font-medium text-brandteal hover:underline"
        >
          ← 전체 경주
        </Link>
        <Link
          href="/predictions"
          className="font-medium text-zinc-500 hover:underline"
        >
          예상 우승마
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-navy dark:text-white">적중률 통계</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          실제 결과가 입력된 경주만 집계합니다. 결과는 각 경주 상세 페이지에서
          입력할 수 있습니다.
        </p>
      </header>

      {resultsMissing && (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          results 테이블이 아직 없습니다. Supabase SQL Editor에서{" "}
          <code className="font-mono">supabase/results.sql</code>을 실행해
          주세요.
        </div>
      )}

      {!resultsMissing && agg.total === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          아직 입력된 경주 결과가 없습니다. 경주 상세 페이지에서 실제 착순을
          입력하면 이곳에 적중률이 집계됩니다.
        </div>
      )}

      {agg.total > 0 && (
        <>
          <p className="mb-4 text-sm text-zinc-500">
            집계 대상:{" "}
            <span className="font-bold text-zinc-700 dark:text-zinc-300">
              {agg.total}개 경주
            </span>{" "}
            · 예측 top3 평균 적중{" "}
            <span className="font-bold text-zinc-700 dark:text-zinc-300">
              {agg.avgOverlap.toFixed(2)}/3
            </span>
          </p>

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {cards.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="text-sm font-semibold text-zinc-500">
                  {c.label}
                </div>
                <div className="mt-1 text-4xl font-extrabold text-brandteal">
                  {pct(c.value)}
                </div>
                <div className="mt-1 text-xs text-zinc-400">{c.sub}</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-brandteal"
                    style={{ width: `${c.value * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <h2 className="mb-3 text-lg font-bold text-navy dark:text-white">경주별 적중 내역</h2>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <th className="px-3 py-2.5">경주</th>
                  <th className="px-3 py-2.5 text-center">단승</th>
                  <th className="px-3 py-2.5 text-center">◎ 3착내</th>
                  <th className="px-3 py-2.5 text-center">top3 적중</th>
                  <th className="px-3 py-2.5 text-center">삼복승</th>
                </tr>
              </thead>
              <tbody>
                {perRace.map(({ race, score }) => (
                  <tr
                    key={race.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/race/${race.id}`}
                        className="font-medium text-brandteal hover:underline"
                      >
                        {formatDate(race.race_date)} {race.race_no}R
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {score.win ? "✓" : "·"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {score.place ? "✓" : "·"}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">
                      {score.top3Overlap}/3
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {score.trifectaExact ? "✓" : "·"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-6 text-xs text-zinc-400">
        통계는 예측 모델의 사후 검증용 참고 지표이며, 표본이 적을 때는 변동이
        큽니다.
      </p>
    </main>
  );
}
