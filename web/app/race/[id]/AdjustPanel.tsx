"use client";

import { useMemo, useState } from "react";
import {
  applyAdjustments,
  TRACK_OPTIONS,
  type AdjustEntry,
  type AdjustPred,
  type TrackCond,
} from "@/lib/adjust";

const RANK_CLS: Record<number, string> = {
  1: "text-emerald-600 dark:text-emerald-400",
  2: "text-sky-600 dark:text-sky-400",
  3: "text-amber-600 dark:text-amber-400",
};
const RANK_MARK: Record<number, string> = { 1: "◎", 2: "○", 3: "▲" };
const BAR_CLS: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-sky-500",
  3: "bg-amber-500",
};

export default function AdjustPanel({
  entries,
  preds,
  raceDate,
}: {
  entries: AdjustEntry[];
  preds: AdjustPred[];
  raceDate: string;
}) {
  const [cond, setCond] = useState<TrackCond>("선택 안함");

  const rows = useMemo(
    () => applyAdjustments(entries, preds, cond, raceDate),
    [entries, preds, cond, raceDate],
  );
  const hasAnyDelta = rows.some((r) => r.deltas.length > 0);

  return (
    <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
          당일 조건 보정
          <span className="ml-2 font-normal text-xs text-zinc-400">
            기본 확률은 그대로 두고 보정 확률을 별도 계산합니다
          </span>
        </h2>
        <div className="flex flex-wrap gap-1 text-xs">
          {TRACK_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setCond(opt)}
              className={
                "rounded-md px-2.5 py-1 font-medium transition " +
                (cond === opt
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700")
              }
            >
              {opt === "선택 안함" ? "주로: 선택 안함" : opt}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-zinc-500">
        자동 반영: 2주내 진료 · 출발조교 불량 · 장기휴양 · 조교량 부족 · 체중
        급변 — 당일 주로 상태를 선택하면 해당 조건 입상 실적 가점이 추가됩니다.
      </p>

      <div className="mt-4 space-y-2.5">
        {rows.map((r) => {
          const moved = r.baseRank - r.adjRank;
          return (
            <div key={r.gate_no} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-right text-xs font-semibold">
                  {RANK_MARK[r.adjRank] ? (
                    <span className={`text-base font-bold ${RANK_CLS[r.adjRank]}`}>
                      {RANK_MARK[r.adjRank]}
                    </span>
                  ) : (
                    <span className="text-zinc-500">{r.adjRank}위</span>
                  )}
                </span>
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {r.gate_no}
                </span>
                <span className="w-28 shrink-0 truncate font-semibold sm:w-36">
                  {r.horse_name}
                </span>
                <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                  <div className="absolute inset-y-0 left-1/4 w-px bg-zinc-200 dark:bg-zinc-700" />
                  <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-200 dark:bg-zinc-700" />
                  <div className="absolute inset-y-0 left-3/4 w-px bg-zinc-200 dark:bg-zinc-700" />
                  {/* 기본 확률(회색 기준선) 위에 보정 확률 막대 */}
                  <div
                    className="absolute inset-y-0 rounded-md bg-zinc-300/70 dark:bg-zinc-600/60"
                    style={{ width: `${Math.max(r.baseProb * 100, 0.8)}%` }}
                  />
                  <div
                    className={`absolute inset-y-1 rounded ${BAR_CLS[r.adjRank] ?? "bg-zinc-400 dark:bg-zinc-500"}`}
                    style={{ width: `${Math.max(r.adjProb * 100, 0.8)}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right font-mono text-xs">
                  <span className="text-zinc-400">
                    {(r.baseProb * 100).toFixed(1)}%
                  </span>
                  {" → "}
                  <span className="font-semibold">
                    {(r.adjProb * 100).toFixed(1)}%
                  </span>
                </span>
                <span className="w-10 shrink-0 text-right text-xs font-semibold">
                  {moved > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ▲{moved}
                    </span>
                  )}
                  {moved < 0 && (
                    <span className="text-red-500">▼{-moved}</span>
                  )}
                  {moved === 0 && <span className="text-zinc-400">-</span>}
                </span>
              </div>
              {r.deltas.length > 0 && (
                <div className="ml-[4.5rem] mt-1 flex flex-wrap gap-1">
                  {r.deltas.map((d, i) => (
                    <span
                      key={i}
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 " +
                        (d.value >= 0
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900"
                          : "bg-red-50 text-red-600 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900")
                      }
                    >
                      {d.label} {d.value >= 0 ? "+" : ""}
                      {(d.value * 100).toFixed(0)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!hasAnyDelta && (
        <p className="mt-3 text-xs text-zinc-400">
          현재 적용된 보정이 없습니다. 보정 신호(진료·출발조교 등)가 없거나 DB가
          이전 버전입니다 — supabase/setup.sql 최신본 실행 후 반영됩니다.
        </p>
      )}
      <p className="mt-3 text-xs text-zinc-400">
        회색 막대 = 기본 확률, 색 막대 = 보정 확률 · 칩 숫자는 점수 보정량(×100)
        · 주로 가점은 입증된 입상 실적에만 부여됩니다.
      </p>
    </section>
  );
}
