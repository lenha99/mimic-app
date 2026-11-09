-- 릴레이 더빙 방 (11/10) — 친구·구독자끼리 링크로 들어와 배역을 나눠 찍고, 실시간 채팅으로 떠든다.
--
-- 방 장면은 relay_scenes 에 status 'room'(찍는 중) · 'room_done'(완성) 으로 들어간다.
-- 공개 상영관 코드는 전부 status 'live'/'premiered' 만 보므로 방이 섞이지 않는다
-- (상영관 하나당 상영 중 하나라는 유일 인덱스도 status='live' 에만 걸려 있다).
-- 읽기 정책도 live/premiered 만 열려 있어 방은 service_role(서버 라우트)만 읽는다.
--
-- 채팅은 방을 다 쓰면 지운다: 완성 뒤 24시간(뒤풀이) → 크론이 relay_room_msgs 를 지운다.
-- 실시간 전달은 Supabase Realtime broadcast(표에 저장 안 함) — 이 표는 늦게 온 사람이 읽는 기록이다.

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where contype = 'c' and conrelid = 'relay_scenes'::regclass and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table relay_scenes drop constraint %I', c.conname);
  end loop;
end $$;
alter table relay_scenes add constraint relay_scenes_status_check
  check (status in ('pending', 'queued', 'live', 'premiered', 'void', 'room', 'room_done'));

create table if not exists relay_rooms (
  -- 링크에 들어가는 코드(추측 불가 22자). 링크가 곧 입장권이다.
  code text primary key check (code ~ '^[A-Za-z0-9_-]{16,32}$'),
  scene_id uuid not null unique references relay_scenes(id) on delete cascade,
  host text not null,
  host_user uuid references profiles(id) on delete set null,
  locked boolean not null default false,
  -- 완성(개봉) 때 now()+24h. 지나면 크론이 채팅을 지운다.
  chat_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists relay_rooms_host_idx on relay_rooms (host, created_at desc);

create table if not exists relay_room_members (
  room text not null references relay_rooms(code) on delete cascade,
  owner text not null,
  user_id uuid references profiles(id) on delete set null,
  name text not null default '',
  avatar jsonb not null default '{}',
  kicked boolean not null default false,
  -- 오프라인 채팅 알림을 마지막으로 보낸 때(방마다 30분에 한 번)
  notified_at timestamptz,
  -- 방 화면을 마지막으로 본 때 — 지금 보고 있는 사람에겐 알림을 안 보낸다
  seen_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (room, owner)
);
create index if not exists relay_room_members_owner_idx on relay_room_members (owner);

create table if not exists relay_room_msgs (
  id bigint generated always as identity primary key,
  room text not null references relay_rooms(code) on delete cascade,
  owner text,
  name text not null default '',
  kind text not null default 'chat' check (kind in ('chat', 'system')),
  text text not null check (char_length(text) between 1 and 300),
  reported boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists relay_room_msgs_room_idx on relay_room_msgs (room, id);
create index if not exists relay_room_msgs_reported_idx on relay_room_msgs (created_at desc) where reported;

alter table relay_rooms enable row level security;
alter table relay_room_members enable row level security;
alter table relay_room_msgs enable row level security;
revoke all on relay_rooms, relay_room_members, relay_room_msgs from anon, authenticated;

-- 알림 — 방 초대 · 방 채팅
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'follow', 'dm', 'dm_request', 'listen_first', 'listen_daily', 'new_entry',
  'reward_likes', 'reward_follows', 'reward_pick', 'reward_prophet',
  'note', 'note_reply', 'note_helpful', 'note_feedback',
  'relay_cast', 'relay_ng', 'relay_voiced', 'relay_premiere', 'relay_role', 'relay_unlock',
  'relay_room_invite', 'relay_room_chat'
));
