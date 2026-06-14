"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type RaceCard = {
  id: string;
  race_date: string;
  race_no: number;
  venue: string;
  grade: string | null;
  distance_m: number | null;
  weight_type: string | null;
  rating_range: string | null;
  race_kind: string | null;
  start_time: string | null;
  entryCount: number;
  hasResults: boolean;
  winnerGate: number | null;
  winnerName: string | null;
  winHit: boolean | null;
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
function dayLabel(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()} ${DAYS[dt.getDay()]}`;
}
function fullLabel(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일 (${DAYS[dt.getDay()]})`;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-3 py-1 text-xs font-medium transition " +
        (active
          ? "bg-emerald-600 text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700")
      }
    >
      {children}
    </button>
  );
}

export default function RaceBrowser({ races }: { races: RaceCard[] }) {
  const [date, setDate] = useState<string>("all");
  const [grades, setGrades] = useState<Set<string>>(new Set());

  const dates = useMemo(
    () => [...new Set(races.map((r) => r.race_date))].sort(),
    [races],
  );
  const allGrades = useMemo(
    () => [...new Set(races.map((r) => r.grade).filter(Boolean) as string[])],
    [races],
  );

  const filtered = useMemo(
    () =>
      races.filter((r) => {
        if (date !== "all" && r.race_date !== date) return false;
        if (grades.size && !grades.has(r.grade ?? "")) return false;
        return true;
      }),
    [races, date, grades],
  );

  const byDate = useMemo(() => {
    const m = new Map<string, RaceCard[]>();
    for (const r of filtered) {
      const list = m.get(r.race_date) ?? [];
      list.push(r);
      m.set(r.race_date, list);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const toggleGrade = (g: string) => {
    const next = new Set(grades);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    setGrades(next);
  };

  const filtersActive = date !== "all" || grades.size > 0;
  const reset = () => {
    setDate("all");
    setGrades(new Set());
  };

  return (
    <div>
      {/* 필터 */}
      <div className="mb-6 space-y-2.5 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-10 shrink-0 text-xs font-semibold text-zinc-400">날짜</span>
          <Chip active={date === "all"} onClick={() => setDate("all")}>
            전체
          </Chip>
          {dates.map((d) => (
            <Chip key={d} active={date === d} onClick={() => setDate(d)}>
              {dayLabel(d)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-10 shrink-0 text-xs font-semibold text-zinc-400">등급</span>
          {allGrades.map((g) => (
            <Chip key={g} active={grades.has(g)} onClick={() => toggleGrade(g)}>
              {g}
            </Chip>
          ))}
          {filtersActive && (
            <button
              onClick={reset}
              className="ml-auto rounded-full px-3 py-1 text-xs font-medium text-zinc-400 hover:text-red-500"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 결과 */}
      <p className="mb-4 text-sm text-zinc-500">예정 {filtered.length}경주</p>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          예정 경주가 없습니다. 새 출마표를 적재하거나 필터를 변경해 보세요.
        </div>
      )}

      {byDate.map(([d, list]) => (
        <section key={d} className="mb-10">
          <h2 className="mb-4 border-b border-zinc-200 pb-2 text-lg font-bold dark:border-zinc-800">
            {fullLabel(d)}
            <span className="ml-2 text-sm font-normal text-zinc-400">
              {list.length}경주
            </span>
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
                      출전 {r.entryCount}두
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
    </div>
  );
}
