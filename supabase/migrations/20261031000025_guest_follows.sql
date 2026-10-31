-- 로그인 없이도 구독 — 구독하는 쪽도, 구독받는 쪽도 손님(기기)일 수 있다.
--
-- 사람이 적은 지금은 로그인 문턱이 곧 이탈이다. 그래서 구독은 기기 id 로도 되고, 로그인하면
-- 그 기기의 구독이 계정으로 옮겨 간다(lib/social-server.claimGuest). 로그인하면 "누가 구독했는지"
-- 보이고 메시지를 주고받을 수 있다 — 그게 로그인할 이유다.
--
-- 이름표는 weekly_entries.owner 와 같다: 'u:<user id>' 또는 'g:<기기 id>'.
-- voice_follows(마이그레이션 24, 계정끼리만)는 여기로 옮기고 더 쓰지 않는다.

create table follows (
  follower text not null check (follower ~ '^[ug]:[a-z0-9-]{8,40}$'),
  creator text not null check (creator ~ '^[ug]:[a-z0-9-]{8,40}$'),
  created_at timestamptz not null default now(),
  primary key (follower, creator),
  check (follower <> creator)
);
create index follows_creator_idx on follows (creator, created_at desc);

insert into follows (follower, creator, created_at)
  select 'u:' || follower, 'u:' || creator, created_at from voice_follows
  on conflict do nothing;

alter table follows enable row level security;
revoke all on follows from anon, authenticated;
