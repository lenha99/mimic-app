-- 목소리 구독 · 메시지 요청 · 알림 · 웹 푸시.
--
-- 올린 사람에게 "누가 내 목소리를 듣고, 구독하고, 말을 건다"는 보상을 돌려주는 장치들.
-- 사람이 적은 지금 이게 올릴 이유다. 전부 서버(service_role)만 읽고 쓴다 — 주간 챌린지
-- 표들처럼 RLS 정책을 하나도 열지 않고, 본인 확인은 API 라우트가 한다.

-- 구독: 로그인한 사람이 로그인한 출전자를 구독한다. 구독당한 사람은 알림으로 안다.
create table voice_follows (
  follower uuid not null references profiles(id) on delete cascade,
  creator uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, creator),
  check (follower <> creator)
);
create index voice_follows_creator_idx on voice_follows (creator, created_at desc);

-- 메시지 받기: 구독자만(기본) 또는 끄기.
alter table profiles add column if not exists dm_policy text not null default 'followers'
  check (dm_policy in ('followers', 'off'));

-- 대화방. a < b 로 한 쌍에 하나. 상대가 받아주기 전(request)엔 요청한 쪽이 메시지 1개만 보낼 수 있다.
create table dm_threads (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references profiles(id) on delete cascade,
  b uuid not null references profiles(id) on delete cascade,
  requester uuid not null references profiles(id) on delete cascade,
  status text not null default 'request' check (status in ('request', 'open', 'declined')),
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (a < b),
  check (requester = a or requester = b),
  unique (a, b)
);
create index dm_threads_a_idx on dm_threads (a, last_at desc);
create index dm_threads_b_idx on dm_threads (b, last_at desc);

create table dm_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references dm_threads(id) on delete cascade,
  sender uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index dm_messages_thread_idx on dm_messages (thread_id, id);

create table dm_blocks (
  blocker uuid not null references profiles(id) on delete cascade,
  blocked uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

-- 앱 안 알림(🔔). 푸시는 설치한 사람만 받으니 이게 기본 통로다.
create table notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('follow', 'dm', 'dm_request', 'listen_first', 'listen_daily', 'new_entry')),
  actor uuid references profiles(id) on delete set null,
  entry_id uuid references weekly_entries(id) on delete cascade,
  thread_id uuid references dm_threads(id) on delete cascade,
  count int,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on notifications (user_id, id desc);

-- 웹 푸시 구독. 게스트(기기 id)도 받을 수 있다 — 출전·새 출전작 알림은 가입 없이도 온다.
create table push_subs (
  endpoint text primary key check (char_length(endpoint) <= 1000),
  user_id uuid references profiles(id) on delete cascade,
  client text check (char_length(client) <= 64),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  new_entries boolean not null default true,
  created_at timestamptz not null default now()
);
create index push_subs_user_idx on push_subs (user_id);
create index push_subs_client_idx on push_subs (client);

-- 알림 빈도 제한 — 키 하나에 한 번. 'first:<entry>', 'daily:<owner>:<날짜>' 같은 키.
create table notif_sent (
  key text primary key check (char_length(key) <= 200),
  sent_at timestamptz not null default now()
);

-- 서로 다른 청취자 — "오늘 N명이 들었어요"와 첫 청취 알림용. 본인 재생은 안 센다.
create table entry_listens (
  entry_id uuid not null references weekly_entries(id) on delete cascade,
  listener text not null check (char_length(listener) between 3 and 80),
  created_at timestamptz not null default now(),
  primary key (entry_id, listener)
);
create index entry_listens_time_idx on entry_listens (created_at);

alter table voice_follows enable row level security;
alter table dm_threads enable row level security;
alter table dm_messages enable row level security;
alter table dm_blocks enable row level security;
alter table notifications enable row level security;
alter table push_subs enable row level security;
alter table notif_sent enable row level security;
alter table entry_listens enable row level security;

revoke all on voice_follows, dm_threads, dm_messages, dm_blocks, notifications, push_subs, notif_sent, entry_listens
  from anon, authenticated;
