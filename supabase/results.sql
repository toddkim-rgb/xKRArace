-- xHRrace 실제 경주 결과 테이블 (독립 마이그레이션)
-- ⚠ setup.sql 과 분리되어 있습니다. setup.sql 은 매번 DROP/재생성하지만
--    이 파일은 멱등(create if not exists)이라 한 번만 실행하면 되고,
--    setup.sql 을 재실행해도 입력한 결과가 보존됩니다.
--    (races 를 FK 로 참조하지 않으므로 races DROP 의 영향을 받지 않음)

create table if not exists public.results (
  id              bigint generated always as identity primary key,
  race_id         text not null,            -- '260613-05' (느슨한 참조)
  gate_no         int  not null,
  finish_position int  not null,            -- 실제 착순 (1=우승)
  updated_at      timestamptz not null default now(),
  unique (race_id, gate_no)
);

create index if not exists results_race_idx on public.results (race_id);

alter table public.results enable row level security;

-- 공개 입력 허용 (개인 프로젝트). 정책은 멱등하게 재생성.
drop policy if exists "public read results"   on public.results;
drop policy if exists "public insert results" on public.results;
drop policy if exists "public update results" on public.results;
drop policy if exists "public delete results" on public.results;

create policy "public read results"   on public.results for select using (true);
create policy "public insert results" on public.results for insert with check (true);
create policy "public update results" on public.results for update using (true);
create policy "public delete results" on public.results for delete using (true);
