import Link from "next/link";
import { notFound } from "next/navigation";
import {
  supabase,
  type Entry,
  type Prediction,
  type Race,
} from "@/lib/supabase";
import AdjustPanel from "./AdjustPanel";
import PredictionResultCard from "./PredictionResultCard";
import type { AdjustEntry, AdjustPred } from "@/lib/adjust";
import { scoreRace, type RankPick } from "@/lib/scoring";
import type { RaceResult } from "@/lib/supabase";

// 차트 막대(BAR_COLOR)와 동일한 1·2·3 색 언어
const FINISH_BADGE: Record<number, string> = {
  1: "bg-emerald-500 text-white shadow-sm",
  2: "bg-sky-500 text-white shadow-sm",
  3: "bg-amber-500 text-amber-950 shadow-sm",
};

export const dynamic = "force-dynamic";

const PRED_MARKS: Record<number, { mark: string; cls: string }> = {
  1: { mark: "◎", cls: "text-emerald-600 dark:text-emerald-400" },
  2: { mark: "○", cls: "text-sky-600 dark:text-sky-400" },
  3: { mark: "▲", cls: "text-amber-600 dark:text-amber-400" },
};

function formatDate(d: string) {
  const date = new Date(d + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} (${days[date.getDay()]})`;
}

function won(thousandWon: number | null | undefined) {
  if (thousandWon == null) return "-";
  return `${thousandWon.toLocaleString()}천원`;
}

const SEX_STYLE: Record<string, string> = {
  암: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  수: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  거: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default async function RacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { id } = await params;
  const { sort } = await searchParams;
  const sortByGate = sort === "gate";

  const [
    { data: race },
    { data: entries },
    { data: siblings },
    { data: predData },
    { data: resultData },
  ] = await Promise.all([
      supabase.from("races").select("*").eq("id", id).single(),
      supabase.from("entries").select("*").eq("race_id", id).order("gate_no"),
      supabase
        .from("races")
        .select("id, race_no, race_date")
        .order("race_date")
        .order("race_no"),
      supabase.from("predictions").select("*").eq("race_id", id),
      supabase.from("results").select("*").eq("race_id", id),
    ]);

  if (!race) notFound();
  const r = race as Race;
  const list = (entries ?? []) as Entry[];
  const preds = new Map(
    ((predData ?? []) as Prediction[]).map((p) => [p.gate_no, p]),
  );
  const resultRows = (resultData ?? []) as RaceResult[];
  const finishes = new Map(resultRows.map((x) => [x.gate_no, x.finish_position]));
  const finishInit = Object.fromEntries(
    resultRows.map((x) => [x.gate_no, x.finish_position]),
  );
  const predPicks: RankPick[] = [...preds.values()]
    .filter((p) => p.rank != null)
    .map((p) => ({ gate_no: p.gate_no, rank: p.rank as number }));
  const score = scoreRace(predPicks, finishes);

  const sameDay = ((siblings ?? []) as Pick<Race, "id" | "race_no" | "race_date">[]).filter(
    (s) => s.race_date === r.race_date,
  );


  const rankOf = (e: Entry) => preds.get(e.gate_no)?.rank ?? 99;
  const ranked = [...list].sort(
    (a, b) => rankOf(a) - rankOf(b) || a.gate_no - b.gate_no,
  );
  const sorted = sortByGate ? list : ranked;

  const adjustEntries: AdjustEntry[] = list.map((e) => ({
    gate_no: e.gate_no,
    horse_name: e.horse_name,
    career_starts: e.career_starts ?? null,
    track_records: e.track_records ?? null,
    gate_train_result: e.gate_train_result ?? null,
    medical_recent: e.medical_recent ?? null,
    layoff_weeks: e.layoff_weeks ?? null,
    training_minutes: e.training_minutes ?? null,
    weight_last_delta: e.weight_last_delta ?? null,
  }));
  const adjustPreds: AdjustPred[] = [...preds.values()]
    .filter((p) => p.score != null && p.win_prob != null && p.rank != null)
    .map((p) => ({
      gate_no: p.gate_no,
      score: Number(p.score),
      win_prob: Number(p.win_prob),
      rank: p.rank as number,
    }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/"
          className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          ← 전체 경주
        </Link>
        <span className="text-zinc-400">|</span>
        <div className="flex flex-wrap gap-1">
          {sameDay.map((s) => (
            <Link
              key={s.id}
              href={`/race/${s.id}`}
              className={
                "rounded-md px-2 py-0.5 " +
                (s.id === r.id
                  ? "bg-emerald-600 font-bold text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700")
              }
            >
              {s.race_no}
            </Link>
          ))}
        </div>
      </nav>

      <header className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-extrabold">
            {r.venue} {r.race_no}경주
          </h1>
          <span className="text-sm text-zinc-500">
            {formatDate(r.race_date)} · 출발 {r.start_time}
          </span>
        </div>
        {r.race_kind && r.race_kind !== "일반경주" && (
          <div className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
            {r.race_kind}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {[r.grade, `${r.distance_m}m`, r.age_cond, r.sex_cond, r.weight_type, r.rating_range]
            .filter(Boolean)
            .map((tag, i) => (
              <span
                key={i}
                className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium dark:bg-zinc-800"
              >
                {tag}
              </span>
            ))}
        </div>
      </header>

      <PredictionResultCard
        entries={list}
        preds={(predData ?? []) as Prediction[]}
        initial={finishInit}
        raceId={r.id}
      />

      <AdjustPanel
        entries={adjustEntries}
        preds={adjustPreds}
        raceDate={r.race_date}
      />

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
          출전마 상세
        </h2>
        <div className="flex gap-1 text-xs">
          <Link
            href={`/race/${id}`}
            className={
              "rounded-md px-2.5 py-1 font-medium " +
              (!sortByGate
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300")
            }
          >
            예측순
          </Link>
          <Link
            href={`/race/${id}?sort=gate`}
            className={
              "rounded-md px-2.5 py-1 font-medium " +
              (sortByGate
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300")
            }
          >
            마번순
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50">
              <th className="px-3 py-2.5 text-center">예측</th>
              {score.evaluated && (
                <th className="px-3 py-2.5 text-center">실착</th>
              )}
              <th className="px-3 py-2.5 text-center">마번</th>
              <th className="px-3 py-2.5">마명</th>
              <th className="px-3 py-2.5 text-center">성별·연령</th>
              <th className="px-3 py-2.5 text-center">레이팅</th>
              <th className="px-3 py-2.5 text-center">부담중량</th>
              <th className="px-3 py-2.5">기수</th>
              <th className="px-3 py-2.5">조교사</th>
              <th className="px-3 py-2.5 text-center">통산전적</th>
              <th className="px-3 py-2.5 text-right">수득상금</th>
              <th className="px-3 py-2.5 text-center">최고기록</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => {
              const p = preds.get(e.gate_no);
              const mark = p?.rank != null ? PRED_MARKS[p.rank] : undefined;
              return (
              <tr
                key={e.id}
                className={
                  "border-b border-zinc-100 last:border-0 hover:bg-emerald-50/40 dark:border-zinc-800/60 dark:hover:bg-emerald-950/20" +
                  (p?.rank === 1 ? " bg-emerald-50/60 dark:bg-emerald-950/30" : "")
                }
              >
                <td className="px-3 py-3 text-center">
                  {p && (
                    <div title={p.basis ?? undefined}>
                      {mark ? (
                        <span className={`text-lg font-bold ${mark.cls}`}>
                          {mark.mark}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">
                          {p.rank}위
                        </span>
                      )}
                      {p.win_prob != null && (
                        <div className="text-[10px] text-zinc-500">
                          {Math.round(p.win_prob * 100)}%
                        </div>
                      )}
                    </div>
                  )}
                </td>
                {score.evaluated && (
                  <td className="px-3 py-3 text-center">
                    {finishes.has(e.gate_no) ? (
                      <span
                        className={
                          "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-bold " +
                          (FINISH_BADGE[finishes.get(e.gate_no)!] ??
                            "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300")
                        }
                      >
                        {finishes.get(e.gate_no)}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-3 text-center">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                    {e.gate_no}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="font-bold">
                    {e.horse_name}
                    {e.region_tag && (
                      <span className="ml-1 rounded bg-indigo-100 px-1 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {e.region_tag}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {e.sire} × {e.dam}
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${SEX_STYLE[e.sex ?? ""] ?? "bg-zinc-100 dark:bg-zinc-800"}`}
                  >
                    {e.sex}
                  </span>
                  <span className="ml-1 text-xs text-zinc-500">{e.age}세</span>
                </td>
                <td className="px-3 py-3 text-center font-mono">
                  {e.rating ?? "-"}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="font-semibold">
                    {e.weight_marker ? "*" : ""}
                    {e.weight}
                  </span>
                  {e.weight_delta != null && e.weight_delta !== 0 && (
                    <span
                      className={`ml-1 text-xs ${e.weight_delta > 0 ? "text-red-500" : "text-blue-500"}`}
                    >
                      ({e.weight_delta > 0 ? "+" : ""}
                      {e.weight_delta})
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium">
                    {e.jockey_allowance && (
                      <span className="mr-0.5 text-xs text-amber-600">
                        {e.jockey_allowance}
                      </span>
                    )}
                    {e.jockey}
                  </div>
                  {e.jockey_stats && (
                    <div className="text-xs text-zinc-500">{e.jockey_stats}</div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium">{e.trainer}</div>
                  {e.trainer_stats && (
                    <div className="text-xs text-zinc-500">
                      {e.trainer_team != null ? `${e.trainer_team}조 · ` : ""}
                      {e.trainer_stats}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="font-semibold">{e.career_starts ?? 0}전</div>
                  <div className="font-mono text-xs text-zinc-500">
                    {e.career_record ?? "-"}
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-mono text-xs">
                  {won(e.career_prize)}
                </td>
                <td className="px-3 py-3 text-center font-mono">
                  {e.best_time ?? "-"}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        예측(◎○▲)은 출마표 데이터 기반 통계 산출로 적중을 보장하지 않습니다 ·
        * 표시는 부담중량 감량 적용 · 통산전적은 1~5착 횟수 · 출마표 PDF에서
        자동 추출된 데이터입니다.
      </p>
    </main>
  );
}
