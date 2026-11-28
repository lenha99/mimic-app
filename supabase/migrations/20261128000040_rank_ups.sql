-- 승급전(11/28) — XP 를 채워도 승급전을 통과해야 레벨이 오른다.
-- 한 줄 = 승급전 한 번(통과 또는 실패). seed 는 이 표가 생기기 전에 이미 오른 레벨을 그대로 인정한 줄.
-- owner 는 'u:<계정>' 또는 'g:<기기>' (follows·solo_days 와 같은 이름표). 로그인하면 claimGuest 가 옮긴다.
-- 표가 없을 때 코드는 예전처럼 XP 만으로 레벨을 매긴다 — 이 마이그레이션 전에도 안전하다.

create table rank_ups (
  id bigserial primary key,
  owner text not null check (char_length(owner) between 3 and 80),
  level int not null check (level between 1 and 20),
  passed boolean not null,
  seed boolean not null default false,
  day date not null,
  created_at timestamptz not null default now()
);

create index rank_ups_owner on rank_ups (owner, level);

-- 서버(서비스 키)만 읽고 쓴다 — 정책 없음.
alter table rank_ups enable row level security;
