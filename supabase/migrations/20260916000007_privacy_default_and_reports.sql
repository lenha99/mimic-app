-- 이슈 #16 (C1): 공개 기본값을 false로 — 목소리는 opt-in이어야 한다, opt-out이 아니라.
alter table recordings alter column is_public set default false;

-- 신고 테이블 + 신고 시 즉시 숨김.
create table reports (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings(id) on delete cascade,
  reporter_id uuid references profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

alter table reports enable row level security;

create policy "anyone signed in can file a report"
  on reports for insert with check (auth.uid() = reporter_id or reporter_id is null);

create policy "reporters can see their own reports"
  on reports for select using (auth.uid() = reporter_id);

-- 신고가 접수되는 즉시 해당 녹음을 비공개로 전환. 재검토/복구는 운영자 수동 처리(관리 UI는 별도 과제).
create or replace function hide_reported_recording()
returns trigger as $$
begin
  update recordings set is_public = false where id = new.recording_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger reports_auto_hide
  after insert on reports
  for each row execute function hide_reported_recording();
