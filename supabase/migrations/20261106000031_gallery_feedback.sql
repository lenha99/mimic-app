-- 연습 피드백을 갤러리로 합친다 (11/6).
--
-- 게시판(/practice/board)과 갤러리가 따로 있으니 올리는 곳이 두 군데였고, 사람이 적은 지금은
-- 양쪽 다 비어 보였다. 이제 갤러리에 올릴 때 "피드백 받기"를 고르고, 출전작 화면에서 댓글로
-- 피드백을 단다. 짚을 곳 태그는 없앤다 — 한 줄이면 충분하고, 더 궁금하면 올린 사람이 답글로 묻는다.
--
-- 읽기·쓰기는 전부 서버(service_role)를 거친다. RLS 정책은 열지 않는다(게시판 표와 같은 방식).

alter table weekly_entries add column if not exists feedback_on boolean not null default true;
-- 정해진 날 지워지는 출전작 — 게시판에서 옮겨 온 것(30일). 비어 있으면 계속 남는다.
alter table weekly_entries add column if not exists expires_at timestamptz;
create index if not exists weekly_entries_expiry_idx on weekly_entries (expires_at) where expires_at is not null;

create table if not exists entry_notes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references weekly_entries(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  -- 답글이면 원 댓글. 답글의 답글은 만들지 않는다(서버가 원 댓글로 붙인다).
  parent_id uuid references entry_notes(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  hidden boolean not null default false,
  reports int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists entry_notes_entry_idx on entry_notes (entry_id, created_at);
create index if not exists entry_notes_user_idx on entry_notes (user_id);
alter table entry_notes enable row level security;

-- ---- 게시판에 올라와 있던 글 → 갤러리 (30일 뒤 지움) ----
-- 길이·파형은 녹음에서 잰 값(11/6). 녹음 파일은 그대로 두고 출전작이 넘겨받는다 —
-- 게시판 글은 아래에서 지우니 게시판 만료 청소가 파일을 지우지 않는다.
-- 처음 만드는 DB 에는 이 글들이 없어서 아무것도 안 들어간다.
insert into weekly_challenges (id, season, script_id, field, title, starts_at, ends_at)
select distinct 'f_sc_v_villain', 0, 'sc_v_villain', '캐릭터', '여유로운 악당', 'epoch'::timestamptz, '2100-01-01'::timestamptz
from practice_posts
where id in ('ab4b627c-9425-4ba3-baec-58c1d262eaf2', 'eecf55b7-14e8-4892-9f9a-90b792a8ea8c') and script_id = 'sc_v_villain'
on conflict (id) do nothing;

insert into weekly_entries (id, challenge_id, user_id, owner, audio_path, duration_s, bars, created_at, updated_at, feedback_on, expires_at)
select p.id, 'f_' || p.script_id, p.user_id, 'u:' || p.user_id, p.audio_path, m.duration_s, m.bars, p.created_at, p.created_at, true, now() + interval '30 days'
from practice_posts p
join (values
    ('ab4b627c-9425-4ba3-baec-58c1d262eaf2'::uuid, 11.68::real,
     '{0.01,0.00,0.27,0.31,0.50,0.02,0.00,0.37,0.34,0.42,0.17,0.00,0.31,0.84,0.03,0.00,0.71,0.58,0.46,0.07,0.04,0.26,0.57,0.88,0.65,0.03,0.65,0.71,1.00,0.55,0.36,0.31,0.01,0.69,0.56,0.73,0.59,0.00,0.16,0.00}'::real[]),
    ('eecf55b7-14e8-4892-9f9a-90b792a8ea8c'::uuid, 11.64::real,
     '{0.00,0.72,0.70,0.65,0.01,0.00,0.70,0.57,0.71,0.40,0.08,0.00,0.00,0.71,0.68,0.00,0.00,0.36,0.20,0.15,0.01,0.00,0.00,0.25,0.70,0.36,0.46,0.16,1.00,0.72,0.51,0.31,0.32,0.07,0.56,0.40,0.31,0.15,0.01,0.00}'::real[])
  ) as m(post_id, duration_s, bars) on m.post_id = p.id
where not p.hidden
  and exists (select 1 from weekly_challenges c where c.id = 'f_' || p.script_id)
on conflict do nothing;

insert into entry_notes (id, entry_id, user_id, body, created_at)
select n.id, n.post_id, n.user_id, n.body, n.created_at
from practice_notes n
join weekly_entries e on e.id = n.post_id
where not n.hidden
on conflict do nothing;

-- 옮긴 게시판 글은 지운다(댓글은 cascade). 녹음 파일은 출전작이 쓰고 있다.
delete from practice_posts p where exists (select 1 from weekly_entries e where e.id = p.id);

-- 알림 종류 — 내 목소리에 달린 피드백(note) · 내 댓글에 달린 답글(note_reply)
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'follow', 'dm', 'dm_request', 'listen_first', 'listen_daily', 'new_entry',
  'reward_likes', 'reward_follows', 'reward_pick', 'reward_prophet',
  'note', 'note_reply'
));
