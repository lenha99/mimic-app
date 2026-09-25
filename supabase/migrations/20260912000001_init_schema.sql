-- MIMIC 웹 리빌드 — 초기 스키마
-- WEB_REBUILD_PLAN.html 03번 "데이터 모델" 참고

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique not null,
  avatar_emoji text not null default '🎙',
  provider text not null,
  created_at timestamptz not null default now()
);

create table memes (
  id text primary key,
  title text not null,
  source text,
  emoji text not null default '🎙',
  ref_audio_url text,
  created_at timestamptz not null default now()
);

create table recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  meme_id text not null references memes(id) on delete cascade,
  audio_url text not null,
  score int,
  grade text,
  pitch int,
  tone int,
  timing int,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create index recordings_meme_id_idx on recordings(meme_id);
create index recordings_user_id_idx on recordings(user_id);
create index recordings_public_idx on recordings(meme_id) where is_public;

create table votes (
  id uuid primary key default gen_random_uuid(),
  meme_id text not null references memes(id) on delete cascade,
  recording_a_id uuid not null references recordings(id) on delete cascade,
  recording_b_id uuid not null references recordings(id) on delete cascade,
  winner_id uuid references recordings(id),
  voter_id uuid references profiles(id),
  anon_id text,
  created_at timestamptz not null default now(),
  constraint votes_distinct_recordings check (recording_a_id <> recording_b_id),
  constraint votes_voter_or_anon check (voter_id is not null or anon_id is not null)
);
create index votes_meme_id_idx on votes(meme_id);

-- 밈별 · 전체 랭킹 계산용 뷰. 승/패 집계만 하고, 정렬/그룹핑은 조회하는 쪽에서.
create view rankings as
select
  r.user_id,
  r.meme_id,
  count(*) filter (where v.winner_id = r.id) as wins,
  count(*) filter (where v.winner_id is not null and v.winner_id <> r.id) as losses
from recordings r
join votes v on v.recording_a_id = r.id or v.recording_b_id = r.id
group by r.user_id, r.meme_id;
