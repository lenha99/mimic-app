-- 사용자 챌린지 — 내 소리로 만든 챌린지를 친구가 따라한다.
--
-- 콘텐츠를 운영자가 한 클립씩 손으로 넣는 걸로는 부족하고, 방송·영화 원본은 권리가
-- 걸린다. 사용자 목소리는 그 자체가 콘텐츠고 권리 문제가 없으며, 만드는 순간 링크로
-- 퍼진다.
--
-- 기준 음성은 Modal 볼륨({id}.wav, ugc_create)에 있고, 여기는 목록·검토 상태만 든다.
--   pending  — 링크로는 바로 된다. 홈 목록엔 안 뜬다.
--   approved — 운영자가 듣고 올린 것. 홈 "친구들이 만든 챌린지"에 뜬다.
--   rejected — 링크도 막힌다. 기준 음성도 지운다(ugc_remove).
--
-- 쓰기는 전부 서버(service_role)가 한다. 브라우저는 공개된 것과 내 것만 읽는다 —
-- pending 을 anon 에게 열면 검토 전 콘텐츠를 목록으로 긁어갈 수 있다.

create table challenges (
  id text primary key check (id ~ '^u_[a-z0-9]{8}$'),
  creator_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 20),
  line text check (line is null or char_length(line) <= 40),
  emoji text not null default '🎤' check (char_length(emoji) <= 8),
  duration_ms int,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index challenges_status_created_idx on challenges (status, created_at desc);
create index challenges_creator_idx on challenges (creator_id, created_at desc);

alter table challenges enable row level security;

create policy "approved challenges and my own are readable"
  on challenges for select
  using (status = 'approved' or auth.uid() = creator_id);

revoke insert, update, delete on challenges from anon, authenticated;
