import Link from "next/link";
import { supabase, type Race } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type RaceWithCount = Race & { entries: { count: number }[] };

function formatDate(d: string) {
  const date = new Date(d + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

export default async function Home() {
  const { data, error } = await supabase
    .from("races")
    .select("*, entries(count)")
    .order("race_date")
    .order("race_no");

  if (error) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 text-center">
        <h1 className="text-xl font-bold">데이터를 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-zinc-500">{error.message}</p>
        <p className="mt-4 text-sm text-zinc-500">
          Supabase에 <code>supabase/setup.sql</code>을 실행했는지 확인해 주세요.
        </p>
      </main>
    );
  }

  const races = (data ?? []) as RaceWithCount[];
  const byDate = new Map<string, RaceWithCount[]>();
  for (const r of races) {
    const list = byDate.get(r.race_date) ?? [];
    list.push(r);
    byDate.set(r.race_date, list);
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            서울 경마 출마표
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            KRA 상세 출마표 · 경주 {races.length}건 ·{" "}
            {races.reduce((n, r) => n + (r.entries?.[0]?.count ?? 0), 0)}두 출전
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/stats"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 shadow-sm transition hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            적중률 통계
          </Link>
        </div>
      </header>

      {races.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          아직 데이터가 없습니다. Supabase SQL Editor에서{" "}
          <code className="font-mono">supabase/setup.sql</code>을 실행해 주세요.
        </div>
      )}

      {[...byDate.entries()].map(([date, list]) => (
        <section key={date} className="mb-12">
          <h2 className="mb-4 border-b border-zinc-200 pb-2 text-lg font-bold dark:border-zinc-800">
            {formatDate(date)}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((r) => (
              <Link
                key={r.id}
                href={`/race/${r.id}`}
                className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                      {r.race_no}경주
                    </span>
                    <span className="text-sm text-zinc-500">
                      출전 {r.entries?.[0]?.count ?? 0}두
                    </span>
                  </div>
                  <span className="text-sm text-zinc-500">{r.start_time}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium dark:bg-zinc-800">
                    {r.grade}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    {r.distance_m}m
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    {r.weight_type}
                  </span>
                  {r.rating_range && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                      {r.rating_range}
                    </span>
                  )}
                </div>
                {r.race_kind && r.race_kind !== "일반경주" && (
                  <div className="mt-2 truncate text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {r.race_kind}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}

      <footer className="mt-8 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
        출마표 PDF에서 자동 추출된 데이터입니다.
      </footer>
    </main>
  );
}
