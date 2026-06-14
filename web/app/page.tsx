import Link from "next/link";
import { supabase, type Race } from "@/lib/supabase";
import RaceBrowser, { type RaceCard } from "./RaceBrowser";

export const dynamic = "force-dynamic";

type RaceWithCount = Race & { entries: { count: number }[] };
type ResultRow = { race_id: string; gate_no: number; finish_position: number };
type PredRow = {
  race_id: string;
  gate_no: number;
  horse_name: string;
  rank: number | null;
};

export default async function Home() {
  const [{ data, error }, { data: resultData }, { data: predData }] =
    await Promise.all([
      supabase
        .from("races")
        .select("*, entries(count)")
        .order("race_date")
        .order("race_no"),
      supabase.from("results").select("race_id, gate_no, finish_position"),
      supabase.from("predictions").select("race_id, gate_no, horse_name, rank"),
    ]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 text-center">
        <h1 className="text-xl font-bold">데이터를 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-zinc-500">{error.message}</p>
        <p className="mt-4 text-sm text-zinc-500">
          Supabase 스키마(<code>supabase/schema.sql</code>)와 적재(
          <code>parser/ingest.py</code>)를 확인해 주세요.
        </p>
      </main>
    );
  }

  const races = (data ?? []) as RaceWithCount[];
  const results = (resultData ?? []) as ResultRow[];
  const preds = (predData ?? []) as PredRow[];

  const winnerGate = new Map<string, number>();
  const withResults = new Set<string>();
  for (const r of results) {
    withResults.add(r.race_id);
    if (r.finish_position === 1) winnerGate.set(r.race_id, r.gate_no);
  }
  const nameByRaceGate = new Map<string, string>();
  const oxGateByRace = new Map<string, number>();
  for (const p of preds) {
    nameByRaceGate.set(`${p.race_id}|${p.gate_no}`, p.horse_name);
    if (p.rank === 1) oxGateByRace.set(p.race_id, p.gate_no);
  }

  const cards: RaceCard[] = races.map((r) => {
    const wGate = winnerGate.get(r.id) ?? null;
    const ox = oxGateByRace.get(r.id) ?? null;
    return {
      id: r.id,
      race_date: r.race_date,
      race_no: r.race_no,
      venue: r.venue,
      grade: r.grade,
      distance_m: r.distance_m,
      weight_type: r.weight_type,
      rating_range: r.rating_range,
      race_kind: r.race_kind,
      start_time: r.start_time,
      entryCount: r.entries?.[0]?.count ?? 0,
      hasResults: withResults.has(r.id),
      winnerGate: wGate,
      winnerName: wGate != null ? nameByRaceGate.get(`${r.id}|${wGate}`) ?? null : null,
      winHit: wGate != null && ox != null ? wGate === ox : null,
    };
  });

  const upcoming = cards.filter((c) => !c.hasResults);
  const doneCount = cards.length - upcoming.length;
  const meetings = new Set(upcoming.map((r) => r.race_date)).size;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            서울 경마 출마표
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            KRA 상세 출마표 · 예정 {meetings}개 경기일 · {upcoming.length}경주
            {doneCount > 0 && (
              <>
                {" · "}
                <Link href="/stats" className="underline hover:text-emerald-600">
                  완료 {doneCount}건은 적중률 통계
                </Link>
              </>
            )}
          </p>
        </div>
        <Link
          href="/stats"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 shadow-sm transition hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          적중률 통계
        </Link>
      </header>

      {races.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          아직 데이터가 없습니다. PDF를 <code className="font-mono">pdfs/날짜/</code>에
          넣고 <code className="font-mono">python parser/ingest.py</code>로
          적재하세요.
        </div>
      ) : (
        <RaceBrowser races={upcoming} />
      )}

      <footer className="mt-8 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
        출마표 PDF에서 자동 추출된 데이터입니다.
      </footer>
    </main>
  );
}
