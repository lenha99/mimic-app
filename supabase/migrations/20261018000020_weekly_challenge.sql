-- 주간 보이스 챌린지 — 매주 대본 하나, 출전작에 ❤ 를 받아 순위를 겨룬다.
--
-- 연습실에서 고른 테이크 하나를 "이번 주 챌린지"에 출전시킨다. 한 사람(또는 한 기기)
-- 한 작품. 교체하면 ❤ 가 초기화된다. 월요일 0시(KST)에 열리고 일요일 24시에 닫히며,
-- 닫히면 1~3위를 weekly_awards 에 박제한다.
--
-- 사람이 적은 지금은 로그인을 요구하지 않는다(출전·❤ 모두 게스트 가능). 게스트 출전은
-- claim_token 으로 나중에 계정에 귀속된다 — recordings 의 게스트 귀속(마이그레이션 8)과 같다.
--
-- practice_posts(마이그레이션 18)처럼 RLS 정책을 하나도 열지 않는다. 읽기·쓰기는 전부
-- 서버(service_role)가 하고, 숨김·기간·본인 확인 조건은 lib/weekly-server.ts 가 건다.

create table weekly_challenges (
  -- 'w20261019' — 그 주 월요일(KST). 주차 계산은 lib/weekly.ts 와 같아야 한다.
  id text primary key check (id ~ '^w[0-9]{8}$'),
  season int not null check (season > 0),
  script_id text not null check (char_length(script_id) <= 64),
  field text not null check (char_length(field) between 1 and 20),
  title text not null check (char_length(title) between 1 and 40),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table weekly_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null references weekly_challenges(id) on delete cascade,
  -- 로그인 출전이면 계정, 게스트면 null.
  user_id uuid references profiles(id) on delete cascade,
  -- 1인 1작품의 "1인". 'u:<user id>' 또는 'g:<기기 id>'.
  owner text not null check (char_length(owner) between 3 and 80),
  -- 게스트가 나중에 로그인해서 가져갈 열쇠이자, 게스트 본인 확인(교체·내리기) 수단.
  claim_token uuid,
  guest_name text check (char_length(guest_name) <= 24),
  avatar jsonb not null default '{}'::jsonb,
  audio_path text not null,
  duration_s real not null check (duration_s > 0 and duration_s <= 90),
  -- 카드에 그릴 파형 (0~1, 최대 48개). 재생 전에도 모양이 보여야 누른다.
  bars real[] not null default '{}' check (cardinality(bars) <= 64),
  like_count int not null default 0,
  play_count int not null default 0,
  hidden boolean not null default false,
  reports int not null default 0,
  created_at timestamptz not null default now(),
  -- 마지막으로 녹음을 바꾼 때. 같은 ❤ 수면 먼저 도달한(=먼저 바꾼) 쪽이 위다.
  updated_at timestamptz not null default now(),
  -- 게스트 출전엔 반드시 열쇠가 있다. 열쇠 없는 게스트 행은 아무도 지울 수 없다.
  check (user_id is not null or claim_token is not null),
  unique (challenge_id, owner)
);

create unique index weekly_entries_one_per_user on weekly_entries (challenge_id, user_id) where user_id is not null;
create index weekly_entries_rank_idx on weekly_entries (challenge_id, like_count desc, updated_at) where not hidden;
create index weekly_entries_user_idx on weekly_entries (user_id);
create index weekly_entries_claim_idx on weekly_entries (claim_token) where claim_token is not null;

create table weekly_likes (
  entry_id uuid not null references weekly_entries(id) on delete cascade,
  -- 'u:<user id>' 또는 'g:<기기 id>'
  voter text not null check (char_length(voter) between 3 and 80),
  user_id uuid references profiles(id) on delete cascade,
  -- 같은 네트워크에서 몰아주는 걸 세려고 남긴다. 원문 IP 는 저장하지 않는다.
  ip_hash text not null check (char_length(ip_hash) <= 64),
  created_at timestamptz not null default now(),
  primary key (entry_id, voter)
);

create index weekly_likes_ip_idx on weekly_likes (entry_id, ip_hash);
create index weekly_likes_voter_idx on weekly_likes (voter);

-- ❤ 수는 행을 세서 매번 계산하지 않고 트리거로 들고 다닌다 — 순위 정렬이 이 값 하나다.
create or replace function weekly_like_count() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update weekly_entries set like_count = like_count + 1 where id = new.entry_id;
    return new;
  else
    update weekly_entries set like_count = greatest(0, like_count - 1) where id = old.entry_id;
    return old;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create trigger weekly_likes_count
  after insert or delete on weekly_likes
  for each row execute function weekly_like_count();

-- 재생 수 — 끝까지 들은 횟수. 서버가 횟수 제한을 건 뒤 부른다.
create or replace function weekly_bump_play(p_entry uuid) returns void as $$
  update weekly_entries set play_count = play_count + 1 where id = p_entry;
$$ language sql security definer set search_path = public;

-- 신고 — 한 계정이 한 출전작에 한 번. 서로 다른 세 계정이면 숨긴다(api/weekly/.../report).
create table weekly_reports (
  entry_id uuid not null references weekly_entries(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);

create table weekly_awards (
  challenge_id text not null references weekly_challenges(id) on delete cascade,
  place smallint not null check (place between 1 and 3),
  entry_id uuid references weekly_entries(id) on delete set null,
  user_id uuid references profiles(id) on delete cascade,
  -- 시즌이 끝난 뒤 이름·캐릭터가 바뀌거나 출전작이 지워져도 명예의 전당은 남는다.
  name text not null check (char_length(name) <= 24),
  avatar jsonb not null default '{}'::jsonb,
  likes int not null,
  primary key (challenge_id, place)
);

create index weekly_awards_user_idx on weekly_awards (user_id);

alter table weekly_challenges enable row level security;
alter table weekly_entries enable row level security;
alter table weekly_likes enable row level security;
alter table weekly_reports enable row level security;
alter table weekly_awards enable row level security;

revoke all on weekly_challenges, weekly_entries, weekly_likes, weekly_reports, weekly_awards from anon, authenticated;
revoke all on function weekly_bump_play(uuid) from public, anon, authenticated;
