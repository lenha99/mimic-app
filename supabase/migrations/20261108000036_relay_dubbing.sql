-- 릴레이 더빙 (11/8).
--
-- 애니풍·면접·뉴스·영화 장면(10줄)을 여러 사람이 한 줄씩 녹음해 완성한다. 동시 접속은 없다 —
-- 아무도 안 한 줄은 TTS 가 읽고, 장면은 열린 뒤 사흘째 21시(KST)에 무조건 개봉한다.
-- 상영관은 둘(act 연기 계열 · real 현실 계열), 상영관마다 상영 중인 장면은 하나다.
--
-- 계급은 VOICE PASS 레벨로 정한다(web/lib/relay.ts): 배우(누구나) · 애드리브(LV3) · 작가(LV5) · 감독(LV7).
-- 조건 검사는 전부 서버 라우트(service_role)가 한다. 표에는 공개 읽기 정책만 둔다.

create table if not exists relay_scenes (
  id uuid primary key default gen_random_uuid(),
  hall text not null check (hall in ('act', 'real')),
  -- 비축 장면이면 content/relay_scenes.json 의 key. 감독이 만든 장면은 null.
  stock_key text,
  title text not null,
  logline text not null default '',
  genre text not null default 'etc',
  -- [{id, name, type, voice, desc}]
  roles jsonb not null default '[]',
  director text,
  director_user uuid references profiles(id) on delete set null,
  director_name text,
  prompt_id uuid,
  mode text not null default 'normal' check (mode in ('normal', 'chaos')),
  -- pending: 새 감독 첫 장면(운영자 승인 대기) · queued: 상영 대기 · live: 상영 중 · premiered: 개봉 · void: 아무도 안 와서 무효(비축으로 돌아감)
  status text not null default 'queued' check (status in ('pending', 'queued', 'live', 'premiered', 'void')),
  opens_at timestamptz,
  premiere_at timestamptz,
  -- 개봉 때 박제하는 정식판·크레딧 (web/lib/relay.ts FinalCut)
  final jsonb,
  real_actors int not null default 0,
  listens int not null default 0,
  best_week text,
  created_at timestamptz not null default now()
);
create index if not exists relay_scenes_status_idx on relay_scenes (status, hall, premiere_at);
create index if not exists relay_scenes_director_idx on relay_scenes (director);
-- 상영관마다 상영 중은 하나 — 동시에 두 요청이 다음 장면을 열어도 하나만 들어간다.
create unique index if not exists relay_scenes_one_live on relay_scenes (hall) where status = 'live';

create table if not exists relay_lines (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references relay_scenes(id) on delete cascade,
  n int not null check (n between 1 and 10),
  role text not null,
  text text not null check (char_length(text) between 1 and 80),
  dir text not null default '',
  tip text not null default '',
  -- 정적 TTS(/relay/tts/…) 또는 스토리지 경로(tts/…). 비면 브라우저 TTS 로 읽는다.
  tts text,
  sec real not null default 3,
  -- 갈림길 후보(작가가 쓴 6·10번 대사). 기본 대사는 false.
  candidate boolean not null default false,
  twist boolean not null default false,
  author text,
  author_user uuid references profiles(id) on delete set null,
  author_name text,
  won boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists relay_lines_base_uq on relay_lines (scene_id, n) where not candidate;
create index if not exists relay_lines_scene_idx on relay_lines (scene_id, n);
create index if not exists relay_lines_author_idx on relay_lines (author) where candidate;

-- 배역 주인. 장면 하나에 한 사람 한 배역 — 개봉 24시간 전 막판 캐스팅(late)만 예외.
create table if not exists relay_roles (
  scene_id uuid not null references relay_scenes(id) on delete cascade,
  role text not null,
  owner text not null,
  user_id uuid references profiles(id) on delete set null,
  late boolean not null default false,
  claimed_at timestamptz not null default now(),
  priority_until timestamptz not null,
  primary key (scene_id, role)
);
create unique index if not exists relay_roles_one_per_scene on relay_roles (scene_id, owner) where not late;

create table if not exists relay_takes (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references relay_scenes(id) on delete cascade,
  line_id uuid not null references relay_lines(id) on delete cascade,
  owner text not null,
  user_id uuid references profiles(id) on delete set null,
  name text not null default '',
  avatar jsonb not null default '{}',
  audio_path text not null,
  duration_s real not null default 0,
  kind text not null default 'line' check (kind in ('line', 'adlib')),
  stamp text check (stamp in ('ok', 'ng')),
  direction text,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists relay_takes_one on relay_takes (line_id, owner, kind);
create index if not exists relay_takes_scene_idx on relay_takes (scene_id);
create index if not exists relay_takes_owner_idx on relay_takes (owner);

-- 감독의 캐스팅 지명
create table if not exists relay_casts (
  scene_id uuid not null references relay_scenes(id) on delete cascade,
  role text not null,
  owner text not null,
  created_at timestamptz not null default now(),
  primary key (scene_id, role)
);

-- 줄 뒤에 넣는 효과음(감독)
create table if not exists relay_sfx (
  scene_id uuid not null references relay_scenes(id) on delete cascade,
  after_n int not null check (after_n between 1 and 10),
  sfx text not null,
  primary key (scene_id, after_n)
);

-- 상황 신청 — LV1 도 할 수 있는 창작. 감독이 골라 장면으로 만들면 크레딧에 "원안".
create table if not exists relay_prompts (
  id uuid primary key default gen_random_uuid(),
  owner text not null,
  user_id uuid references profiles(id) on delete set null,
  name text not null default '',
  text text not null check (char_length(text) between 4 and 40),
  scene_id uuid references relay_scenes(id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists relay_prompts_open_idx on relay_prompts (created_at desc) where scene_id is null and not hidden;

alter table relay_scenes enable row level security;
alter table relay_lines enable row level security;
alter table relay_roles enable row level security;
alter table relay_takes enable row level security;
alter table relay_casts enable row level security;
alter table relay_sfx enable row level security;
alter table relay_prompts enable row level security;

drop policy if exists relay_scenes_read on relay_scenes;
create policy relay_scenes_read on relay_scenes for select using (status in ('live', 'premiered'));
drop policy if exists relay_lines_read on relay_lines;
create policy relay_lines_read on relay_lines for select using (not hidden);

-- 알림 — 장면으로 가는 알림 6종
alter table notifications add column if not exists scene_id uuid references relay_scenes(id) on delete cascade;
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'follow', 'dm', 'dm_request', 'listen_first', 'listen_daily', 'new_entry',
  'reward_likes', 'reward_follows', 'reward_pick', 'reward_prophet',
  'note', 'note_reply', 'note_helpful', 'note_feedback',
  'relay_cast', 'relay_ng', 'relay_voiced', 'relay_premiere', 'relay_role', 'relay_unlock'
));

-- 개봉작 완청 수 (시청률)
create or replace function relay_bump_listen(p_scene uuid) returns void
language sql security definer set search_path = public as $$
  update relay_scenes set listens = listens + 1 where id = p_scene and status = 'premiered';
$$;
revoke all on function relay_bump_listen(uuid) from public;
grant execute on function relay_bump_listen(uuid) to service_role;
