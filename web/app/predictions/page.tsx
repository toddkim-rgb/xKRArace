import Link from "next/link";
import { supabase, type Prediction, type Race } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MARKS = ["◎", "○", "▲"];
const MARK_STYLE = [
  "text-emerald-600 dark:text-emerald-400",
  "text-sky-600 dark:text-sky-400",
  "text-amber-600 dark:text-amber-400",
];

function formatDate(d: string) {
  const date = new Date(d + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

export default async function PredictionsPage() {
  const [{ data: raceData, error }, { data: predData }] = await Promise.all([
    supabase.from("races").select("*").order("race_date").order("race_no"),
    supabase
      .from("predictions")
      .select("*")
      .lte("rank", 3)
      .order("race_id")
      .order("rank"),
  ]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 text-center">
        <h1 className="text-xl font-bold">데이터를 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-zinc-500">{error.message}</p>
      </main>
    );
  }

  const races = (raceData ?? []) as Race[];
  const preds = (predData ?? []) as Prediction[];
  const byRace = new Map<string, Prediction[]>();
  for (const p of preds) {
    const list = byRace.get(p.race_id) ?? [];
    list.push(p);
    byRace.set(p.race_id, list);
  }
  const byDate = new Map<string, Race[]>();
  for (const r of races) {
    const list = byDate.get(r.race_date) ?? [];
    list.push(r);
    byDate.set(r.race_date, list);
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <nav className="mb-6 flex flex-wrap gap-x-4 text-sm">
        <Link
          href="/"
          className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          ← 전체 경주
        </Link>
        <Link
          href="/stats"
          className="font-medium text-zinc-500 hover:underline"
        >
          적중률 통계
        </Link>
      </nav>
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">예상 우승마</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          레이팅 · 전적 · 기수/조교사 승률 · 최고기록 · 부담중량 증감을 경주
          내에서 정규화해 산출한 우승 확률입니다. ◎ 1순위 ○ 2순위 ▲ 3순위
        </p>
      </header>

      {[...byDate.entries()].map(([date, list]) => (
        <section key={date} className="mb-10">
          <h2 className="mb-4 border-b border-zinc-200 pb-2 text-lg font-bold dark:border-zinc-800">
            {formatDate(date)}
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <th className="px-3 py-2.5">경주</th>
                  <th className="px-3 py-2.5">조건</th>
                  {MARKS.map((m, i) => (
                    <th key={m} className="px-3 py-2.5">
                      <span className={MARK_STYLE[i]}>{m}</span>{" "}
                      {["1순위", "2순위", "3순위"][i]}
                    </th>
                  ))}
                  <th className="px-3 py-2.5">1순위 근거</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const top3 = byRace.get(r.id) ?? [];
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-zinc-100 last:border-0 hover:bg-emerald-50/40 dark:border-zinc-800/60 dark:hover:bg-emerald-950/20"
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link
                          href={`/race/${r.id}`}
                          className="font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                          {r.race_no}경주
                        </Link>
                        <div className="text-xs text-zinc-500">
                          {r.start_time}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-500 whitespace-nowrap">
                        {r.grade} · {r.distance_m}m
                        {r.race_kind && r.race_kind !== "일반경주" && (
                          <div className="font-semibold text-amber-600 dark:text-amber-400">
                            {r.race_kind}
                          </div>
                        )}
                      </td>
                      {[0, 1, 2].map((i) => {
                        const p = top3[i];
                        return (
                          <td key={i} className="px-3 py-3 whitespace-nowrap">
                            {p ? (
                              <div className="flex items-baseline gap-1.5">
                                <span
                                  className={`font-bold ${MARK_STYLE[i]}`}
                                >
                                  {MARKS[i]}
                                </span>
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                                  {p.gate_no}
                                </span>
                                <span className="font-semibold">
                                  {p.horse_name}
                                </span>
                                <span className="text-xs text-zinc-500">
                                  {p.win_prob != null
                                    ? `${Math.round(p.win_prob * 100)}%`
                                    : ""}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-xs text-zinc-500 whitespace-nowrap">
                        {top3[0]?.basis ?? "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="mt-4 text-xs text-zinc-400">
        본 예측은 출마표 데이터 기반 통계 산출이며 적중을 보장하지 않습니다.
        참고용으로만 활용하세요.
      </p>
    </main>
  );
}
