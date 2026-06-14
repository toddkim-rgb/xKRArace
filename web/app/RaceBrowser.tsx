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

type Status = "all" | "upcoming" | "done";

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
  const [status, setStatus] = useState<Status>("all");
  const [date, setDate] = useState<string>("all");
  const [grades, setGrades] = useState<Set<string>>(new Set());
  const [dists, setDists] = useState<Set<number>>(new Set());

  const dates = useMemo(
    () => [...new Set(races.map((r) => r.race_date))].sort(),
    [races],
  );
  const allGrades = useMemo(
    () => [...new Set(races.map((r) => r.grade).filter(Boolean) as string[])],
    [races],
  );
  const allDists = useMemo(
    () =>
      [...new Set(races.map((r) => r.distance_m).filter(Boolean) as number[])].sort(
        (a, b) => a - b,
      ),
    [races],
  );

  const doneCount = races.filter((r) => r.hasResults).length;
  const counts = {
    all: races.length,
    upcoming: races.length - doneCount,
    done: doneCount,
  };

  const filtered = useMemo(
    () =>
      races.filter((r) => {
        if (status === "done" && !r.hasResults) return false;
        if (status === "upcoming" && r.hasResults) return false;
        if (date !== "all" && r.race_date !== date) return false;
        if (grades.size && !grades.has(r.grade ?? "")) return false;
        if (dists.size && !dists.has(r.distance_m ?? -1)) return false;
        return true;
      }),
    [races, status, date, grades, dists],
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

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setter(next);
  };

  const filtersActive =
    status !== "all" || date !== "all" || grades.size > 0 || dists.size > 0;
  const reset = () => {
    setStatus("all");
    setDate("all");
    setGrades(new Set());
    setDists(new Set());
  };

  const STATUS_TABS: { key: Status; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "upcoming", label: "예정·진행" },
    { key: "done", label: "완료" },
  ];

  return (
    <div>
      {/* 상태 세그먼트 */}
      <div className="mb-4 inline-flex rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={
              "rounded-lg px-4 py-1.5 text-sm font-bold transition " +
              (status === t.key
                ? "bg-white text-emerald-600 shadow-sm dark:bg-zinc-800 dark:text-emerald-400"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")
            }
          >
            {t.label}
            <span className="ml-1.5 text-xs font-medium text-zinc-400">
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

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
            <Chip
              key={g}
              active={grades.has(g)}
              onClick={() => toggle(grades, g, setGrades)}
            >
              {g}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-10 shrink-0 text-xs font-semibold text-zinc-400">거리</span>
          {allDists.map((d) => (
            <Chip
              key={d}
              active={dists.has(d)}
              onClick={() => toggle(dists, d, setDists)}
            >
              {d}m
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
      <p className="mb-4 text-sm text-zinc-500">
        {filtered.length}개 경주
        {status === "done" && " · 결과 입력 완료"}
      </p>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          조건에 맞는 경주가 없습니다.
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
                className={
                  "group rounded-xl border bg-white p-4 shadow-sm transition hover:border-emerald-600 hover:bg-emerald-600 hover:shadow-lg dark:bg-zinc-900 " +
                  (r.hasResults
                    ? "border-emerald-200 dark:border-emerald-900/60"
                    : "border-zinc-200 dark:border-zinc-800")
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-extrabold text-emerald-600 transition-colors group-hover:text-white dark:text-emerald-400">
                      {r.race_no}경주
                    </span>
                    <span className="text-sm text-zinc-500 group-hover:text-emerald-50">
                      출전 {r.entryCount}두
                    </span>
                  </div>
                  {r.hasResults ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 group-hover:bg-white dark:bg-emerald-950 dark:text-emerald-300 dark:group-hover:bg-white dark:group-hover:text-emerald-700">
                      완료
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-500 group-hover:text-emerald-50">
                      {r.start_time}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {[r.grade, `${r.distance_m}m`, r.weight_type, r.rating_range]
                    .filter(Boolean)
                    .map((tag, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 transition-colors group-hover:bg-emerald-500/80 group-hover:text-white dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
                {r.race_kind && r.race_kind !== "일반경주" && (
                  <div className="mt-2 truncate text-xs font-semibold text-amber-600 group-hover:text-amber-200 dark:text-amber-400">
                    {r.race_kind}
                  </div>
                )}
                {r.hasResults && (
                  <div className="mt-2.5 flex items-center gap-1.5 border-t border-zinc-100 pt-2.5 text-xs group-hover:border-emerald-400/40 dark:border-zinc-800">
                    <span className="font-bold text-rose-500 group-hover:text-white">
                      🏁 1착
                    </span>
                    {r.winnerGate != null && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white group-hover:bg-white group-hover:text-emerald-700 dark:bg-zinc-100 dark:text-zinc-900">
                        {r.winnerGate}
                      </span>
                    )}
                    <span className="truncate font-semibold group-hover:text-white">
                      {r.winnerName ?? "-"}
                    </span>
                    {r.winHit === true && (
                      <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700 group-hover:bg-white dark:bg-emerald-950 dark:text-emerald-300 dark:group-hover:bg-white dark:group-hover:text-emerald-700">
                        ◎ 적중
                      </span>
                    )}
                    {r.winHit === false && (
                      <span className="ml-auto shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-500 group-hover:bg-emerald-700 group-hover:text-emerald-50 dark:bg-zinc-800">
                        예측 빗나감
                      </span>
                    )}
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
