-- 연습 피드백 게시판 (/practice/board) + 앱 한 줄 피드백.
--
-- 성우 지망생이 제일 원하는 건 "누가 내 낭독을 들어주는 것"이다. 연습 테이크는 원래
-- 기기에만 남는데(PRIVACY.md), 본인이 골라서 올린 테이크만 여기 14일 동안 공개된다.
-- 듣는 사람은 대본을 보면서 듣고, 짚을 곳(속도·호흡·발음…)과 한 줄을 남긴다.
--
-- 읽기·쓰기는 전부 서버(service_role)를 거친다. 올리기 상한(사람당 3개, 전체 400개),
-- 신고 숨김, 재생 URL 서명을 한 곳에서 지키려고 RLS 정책은 하나도 열지 않는다 —
-- anon·authenticated 는 이 표들에 아무것도 못 한다.


create table practice_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  -- 기본 대본 id(sc_…), 내 대본(my_…), 명대사(밈 id). 내 대본은 기기에만 있어서
  -- 제목·본문을 올릴 때 같이 찍어 둔다.
  script_id text not null check (char_length(script_id) <= 64),
  title text not null check (char_length(title) between 1 and 40),
  script_text text not null check (char_length(script_text) between 1 and 900),
  track text not null check (track in ('voice', 'anchor', 'line')),
  -- "어디를 봐주세요" — 비워도 된다.
  ask text check (char_length(ask) <= 120),
  audio_path text not null,
  hidden boolean not null default false,
  reports int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);

create index practice_posts_live_idx on practice_posts (created_at desc) where not hidden;
create index practice_posts_user_idx on practice_posts (user_id);
create index practice_posts_expiry_idx on practice_posts (expires_at);

create table practice_notes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references practice_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  tags text[] not null default '{}'
    check (tags <@ array['pace', 'breath', 'diction', 'emotion', 'ending', 'good']::text[]),
  body text not null check (char_length(body) between 1 and 300),
  hidden boolean not null default false,
  reports int not null default 0,
  created_at timestamptz not null default now()
);

create index practice_notes_post_idx on practice_notes (post_id, created_at);
create index practice_notes_user_idx on practice_notes (user_id);

-- 같은 사람이 같은 글을 두 번 신고해도 한 번으로 센다.
create table practice_reports (
  user_id uuid not null references profiles(id) on delete cascade,
  post_id uuid references practice_posts(id) on delete cascade,
  note_id uuid references practice_notes(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (note_id is null))
);

create unique index practice_reports_post_once on practice_reports (user_id, post_id) where post_id is not null;
create unique index practice_reports_note_once on practice_reports (user_id, note_id) where note_id is not null;


-- 앱 한 줄 피드백 — 결과 화면의 👍/👎 + 한 줄. 로그인 없이도 남긴다.
create table app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  client_id text check (char_length(client_id) <= 64),
  page text not null check (page in ('record', 'practice', 'board')),
  item_id text check (char_length(item_id) <= 64),
  rating smallint not null check (rating in (-1, 1)),
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now()
);

create index app_feedback_created_idx on app_feedback (created_at desc);


alter table practice_posts enable row level security;
alter table practice_notes enable row level security;
alter table practice_reports enable row level security;
alter table app_feedback enable row level security;

revoke all on practice_posts, practice_notes, practice_reports, app_feedback from anon, authenticated;
