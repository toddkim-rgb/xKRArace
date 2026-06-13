"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Entry, type Prediction } from "@/lib/supabase";
import { scoreRace, type RankPick } from "@/lib/scoring";

const PRED_MARKS: Record<number, { mark: string; cls: string }> = {
  1: { mark: "◎", cls: "text-emerald-600 dark:text-emerald-400" },
  2: { mark: "○", cls: "text-sky-600 dark:text-sky-400" },
  3: { mark: "▲", cls: "text-amber-600 dark:text-amber-400" },
};
const BAR_COLOR: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-sky-500",
  3: "bg-amber-500",
};
// 차트 막대(BAR_COLOR)와 동일한 1·2·3 색 언어
const FINISH_BADGE: Record<number, string> = {
  1: "bg-emerald-500 text-white shadow-sm",
  2: "bg-sky-500 text-white shadow-sm",
  3: "bg-amber-500 text-amber-950 shadow-sm",
};
const WEIGHT_INFO = [
  { key: "레이팅", w: 28 },
  { key: "승률", w: 18 },
  { key: "최고기록", w: 16 },
  { key: "복승률", w: 12 },
  { key: "기수승률", w: 10 },
  { key: "조교사승률", w: 6 },
  { key: "상금효율", w: 6 },
  { key: "중량증감", w: 4 },
];

function opinionFor(e: Entry): string[] {
  const out: string[] = [];
  if (e.rating != null) out.push(`레이팅 R${e.rating}`);
  if ((e.career_starts ?? 0) > 0 && e.career_record) {
    const wins = parseInt(e.career_record.split("/")[0], 10) || 0;
    out.push(
      `통산 ${e.career_starts}전 ${wins}승 (승률 ${Math.round((wins / e.career_starts!) * 100)}%)`,
    );
  } else {
    out.push("공식 전적 없음(신마) — 불확실성 높음");
  }
  if (e.jockey && e.jockey_stats) out.push(`기수 ${e.jockey} ${e.jockey_stats}`);
  if (e.best_time) out.push(`동거리 최고기록 ${e.best_time}`);
  if (e.weight_delta != null && e.weight_delta >= 2)
    out.push(`부담중량 +${e.weight_delta}kg 증량 부담`);
  return out;
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 font-medium " +
        (ok
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500")
      }
    >
      {ok ? "✓ " : "✗ "}
      {label}
    </span>
  );
}

export default function PredictionResultCard({
  entries,
  preds,
  initial,
  raceId,
}: {
  entries: Entry[];
  preds: Prediction[];
  initial: Record<number, number>;
  raceId: string;
}) {
  const router = useRouter();
  const predByGate = useMemo(
    () => new Map(preds.map((p) => [p.gate_no, p])),
    [preds],
  );
  const ranked = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          (predByGate.get(a.gate_no)?.rank ?? 99) -
            (predByGate.get(b.gate_no)?.rank ?? 99) || a.gate_no - b.gate_no,
      ),
    [entries, predByGate],
  );

  const [editing, setEditing] = useState(false);
  const [positions, setPositions] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      entries.map((e) => [e.gate_no, initial[e.gate_no]?.toString() ?? ""]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 헤더의 "경주 결과 입력" 버튼(#result-input)으로 진입하면 입력 모드로 펼친다.
  useEffect(() => {
    const openIfTargeted = () => {
      if (window.location.hash === "#result-input") setEditing(true);
    };
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
    return () => window.removeEventListener("hashchange", openIfTargeted);
  }, []);

  const savedFinishes = useMemo(
    () =>
      new Map<number, number>(
        Object.entries(initial).map(([g, p]) => [Number(g), p]),
      ),
    [initial],
  );
  const hasResults = savedFinishes.size > 0;

  const liveFinishes = new Map<number, number>();
  for (const [g, v] of Object.entries(positions)) {
    const n = parseInt(v, 10);
    if (n >= 1) liveFinishes.set(Number(g), n);
  }
  const finishes = editing ? liveFinishes : savedFinishes;

  const predPicks: RankPick[] = preds
    .filter((p) => p.rank != null)
    .map((p) => ({ gate_no: p.gate_no, rank: p.rank as number }));
  const score = scoreRace(predPicks, finishes);

  const dupes = (() => {
    const seen = new Set<number>();
    const dup = new Set<number>();
    for (const v of liveFinishes.values()) {
      if (seen.has(v)) dup.add(v);
      seen.add(v);
    }
    return dup;
  })();

  async function save() {
    setSaving(true);
    setMsg(null);
    const rows = entries
      .map((e) => ({
        race_id: raceId,
        gate_no: e.gate_no,
        finish_position: parseInt(positions[e.gate_no] ?? "", 10),
      }))
      .filter((r) => r.finish_position >= 1);
    if (rows.length === 0) {
      setMsg("착순을 1개 이상 입력해 주세요.");
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("results")
      .upsert(rows, { onConflict: "race_id,gate_no" });
    setSaving(false);
    if (error) {
      const missing =
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message.includes("does not exist") ||
        error.message.includes("schema cache");
      setMsg(
        missing
          ? "results 테이블이 없습니다. supabase/results.sql 을 먼저 실행해 주세요."
          : `저장 실패: ${error.message}`,
      );
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function clearAll() {
    if (!confirm("이 경주의 입력된 결과를 모두 삭제할까요?")) return;
    setSaving(true);
    const { error } = await supabase
      .from("results")
      .delete()
      .eq("race_id", raceId);
    setSaving(false);
    if (error) {
      setMsg(`삭제 실패: ${error.message}`);
      return;
    }
    setPositions(Object.fromEntries(entries.map((e) => [e.gate_no, ""])));
    setEditing(false);
    router.refresh();
  }

  return (
    <section
      id="result-input"
      className="mb-6 scroll-mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
          예측 우승 확률 비교
          <span className="ml-2 font-normal text-xs text-zinc-400">
            막대 = 절대 확률 · 우측 = 실제 착순
          </span>
        </h2>
        <button
          onClick={() => setEditing((v) => !v)}
          className={
            "rounded-md px-3 py-1.5 text-xs font-bold transition " +
            (editing
              ? "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200"
              : "bg-emerald-600 text-white hover:bg-emerald-500")
          }
        >
          {editing ? "입력 닫기" : hasResults ? "✓ 결과 수정" : "결과 입력"}
        </button>
      </div>

      {/* 적중 요약 (결과 있을 때) */}
      {score.evaluated && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          {editing && <span className="text-zinc-400">미리보기:</span>}
          <Badge ok={score.win} label="단승(◎ 1착)" />
          <Badge ok={score.place} label="◎ 3착내" />
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            top3 {score.top3Overlap}/3
          </span>
          {score.trifectaExact && <Badge ok label="삼복승 정확" />}
        </div>
      )}

      {/* 차트: 예측 막대 + 실제 착순(또는 입력) */}
      <div className="mt-4 space-y-2">
        {ranked.map((e) => {
          const p = predByGate.get(e.gate_no);
          const prob = p?.win_prob ?? 0;
          const rank = p?.rank ?? 0;
          const mark = PRED_MARKS[rank];
          const fin = finishes.get(e.gate_no);
          const val = positions[e.gate_no] ?? "";
          const isDup = parseInt(val, 10) >= 1 && dupes.has(parseInt(val, 10));
          return (
            <div key={e.gate_no} className="flex items-center gap-2 text-sm">
              <span className="w-7 shrink-0 text-right text-xs font-semibold text-zinc-500">
                {mark ? (
                  <span className={`text-base ${mark.cls}`}>{mark.mark}</span>
                ) : rank ? (
                  `${rank}`
                ) : (
                  "-"
                )}
              </span>
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {e.gate_no}
              </span>
              <span className="w-24 shrink-0 truncate font-semibold sm:w-32">
                {e.horse_name}
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                <div className="absolute inset-y-0 left-1/4 w-px bg-zinc-200 dark:bg-zinc-700" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-200 dark:bg-zinc-700" />
                <div className="absolute inset-y-0 left-3/4 w-px bg-zinc-200 dark:bg-zinc-700" />
                <div
                  className={`relative h-full rounded-md ${BAR_COLOR[rank] ?? "bg-zinc-300 dark:bg-zinc-600"}`}
                  style={{ width: `${Math.max(prob * 100, 0.8)}%` }}
                />
              </div>
              <span className="w-11 shrink-0 text-right font-mono text-xs font-semibold">
                {(prob * 100).toFixed(1)}%
              </span>
              {/* 실제 착순 — 보기: 배지 / 입력: number */}
              {editing ? (
                <input
                  type="number"
                  min={1}
                  max={entries.length}
                  value={val}
                  onChange={(ev) =>
                    setPositions((q) => ({ ...q, [e.gate_no]: ev.target.value }))
                  }
                  placeholder="착"
                  className={
                    "w-11 shrink-0 rounded border px-1 py-0.5 text-center text-sm focus:outline-none focus:ring-1 " +
                    (isDup
                      ? "border-red-400 ring-red-400"
                      : "border-zinc-300 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800")
                  }
                />
              ) : (
                <span className="flex w-11 shrink-0 justify-center">
                  {fin ? (
                    <span
                      className={
                        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold " +
                        (FINISH_BADGE[fin] ??
                          "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300")
                      }
                    >
                      {fin}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-300 dark:text-zinc-600">
                      –
                    </span>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 입력 모드 컨트롤 */}
      {editing && (
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {dupes.size > 0 && (
            <p className="mb-2 text-xs text-red-500">
              중복된 착순: {[...dupes].sort((a, b) => a - b).join(", ")}착
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={save}
              disabled={saving || dupes.size > 0}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
            {hasResults && (
              <button
                onClick={clearAll}
                disabled={saving}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                결과 삭제
              </button>
            )}
            <span className="text-xs text-zinc-400">
              각 마번의 실제 착순 입력 (1=우승) · 공개 입력
            </span>
            {msg && <span className="text-xs text-zinc-500">{msg}</span>}
          </div>
        </div>
      )}

      {/* 신뢰도 + 근거 + 산출방식 (보기 모드에서만) */}
      {!editing && (
        <>
          {(() => {
            const topProb = predByGate.get(ranked[0]?.gate_no)?.win_prob ?? 0;
            const conf =
              topProb >= 0.4
                ? { label: "변별력 높음", cls: "text-emerald-600 dark:text-emerald-400", note: "지표가 특정 마필로 뚜렷하게 수렴하는 경주입니다." }
                : topProb >= 0.2
                  ? { label: "변별력 보통", cls: "text-sky-600 dark:text-sky-400", note: "상위권 후보 간 지표 차이가 어느 정도 존재합니다." }
                  : { label: "변별력 낮음", cls: "text-amber-600 dark:text-amber-400", note: "전적 등 변별 지표가 적어 확률 분포가 평탄합니다. 참고 수준으로만 활용하세요." };
            return (
              <p className="mt-4 text-xs text-zinc-500">
                <span className={`font-bold ${conf.cls}`}>■ {conf.label}</span>{" "}
                {conf.note}
              </p>
            );
          })()}

          <details className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <summary className="cursor-pointer text-xs font-bold text-zinc-600 dark:text-zinc-400">
              상위 3두 산출 근거 · 산출 방식
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ranked.slice(0, 3).map((e) => {
                const p = predByGate.get(e.gate_no);
                if (!p) return null;
                const mark = PRED_MARKS[p.rank ?? 0];
                return (
                  <div
                    key={e.gate_no}
                    className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <div className="flex items-baseline gap-1.5">
                      {mark && (
                        <span className={`font-bold ${mark.cls}`}>{mark.mark}</span>
                      )}
                      <span className="font-bold">
                        {e.gate_no} {e.horse_name}
                      </span>
                      <span className="ml-auto font-mono text-xs font-semibold text-zinc-500">
                        {p.win_prob != null ? `${(p.win_prob * 100).toFixed(1)}%` : ""}
                      </span>
                    </div>
                    {p.factors && (
                      <div className="mt-2.5 space-y-1">
                        {WEIGHT_INFO.map(({ key }) => {
                          const v = p.factors![key];
                          if (v == null) return null;
                          return (
                            <div key={key} className="flex items-center gap-1.5 text-[10px]">
                              <span className="w-14 shrink-0 text-zinc-500">{key}</span>
                              <div className="h-1.5 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                                <div
                                  className={`h-full rounded ${v >= 0.7 ? "bg-emerald-500" : v >= 0.4 ? "bg-sky-400" : "bg-zinc-300 dark:bg-zinc-600"}`}
                                  style={{ width: `${Math.max(v * 100, 3)}%` }}
                                />
                              </div>
                              <span className="w-6 shrink-0 text-right font-mono text-zinc-500">
                                {Math.round(v * 100)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <ul className="mt-2.5 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {opinionFor(e).map((line, i) => (
                        <li key={i}>· {line}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-800/50">
              <span className="font-bold text-zinc-600 dark:text-zinc-400">
                산출 방식
              </span>{" "}
              — 각 지표를 경주 내에서 0~100으로 정규화한 뒤 아래 가중치로 합산하고,
              softmax 변환으로 우승 확률을 계산합니다. 결측 지표(신마 등)는 중립(50)
              처리합니다.
              <div className="mt-2 flex flex-wrap gap-1.5">
                {WEIGHT_INFO.map(({ key, w }) => (
                  <span
                    key={key}
                    className="rounded-full bg-white px-2 py-0.5 font-medium text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"
                  >
                    {key} {w}%
                  </span>
                ))}
              </div>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
