-- 더빙 방 2단계 (11/10) — 방 제목 · 공개 목록 · 우리 대본 방 · 나가면 지우기.
--
-- - 방 제목(title)은 방장이 바꾼다. 공개(public)면 릴레이 "방" 탭 목록에 제목·종류·인원만 보인다.
-- - kind 'script' = 우리 대본 방: 배역 없이 붙여 넣은 대본(script)을 단락별로 아무나 녹음한다.
--   장면이 없으므로 scene_id 는 비어 있다.
-- - 녹음 보관: 방을 나가면 그 사람 녹음을 지운다. 멤버가 아무도 없으면 방을 통째로 지운다.
--   간직하고 싶은 사람은 "내 기기에 저장"으로 내려받는다(서버엔 안 남긴다).

alter table relay_rooms add column if not exists title text not null default '' check (char_length(title) <= 40);
alter table relay_rooms add column if not exists public boolean not null default true;
alter table relay_rooms add column if not exists kind text not null default 'scene' check (kind in ('scene', 'script'));
alter table relay_rooms add column if not exists script text check (script is null or char_length(script) <= 4000);
alter table relay_rooms add column if not exists last_at timestamptz not null default now();
alter table relay_rooms alter column scene_id drop not null;

-- 장면 방 제목은 장면 이름으로 채워 둔다
update relay_rooms r set title = left(s.title, 40) from relay_scenes s where r.scene_id = s.id and r.title = '';

create index if not exists relay_rooms_public_idx on relay_rooms (last_at desc) where public and not locked;

-- 대본 방 녹음 — part 는 단락 번호(1부터), null 이면 처음부터 끝까지 읽은 녹음
create table if not exists relay_room_takes (
  id uuid primary key default gen_random_uuid(),
  room text not null references relay_rooms(code) on delete cascade,
  owner text not null,
  user_id uuid references profiles(id) on delete set null,
  name text not null default '',
  part int check (part is null or part between 1 and 60),
  audio_path text not null,
  duration_s real not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists relay_room_takes_room_idx on relay_room_takes (room, part, created_at);
create index if not exists relay_room_takes_owner_idx on relay_room_takes (room, owner);

alter table relay_room_takes enable row level security;
revoke all on relay_room_takes from anon, authenticated;
