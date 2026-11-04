-- 혼자 하는 진행 — 연습 하루 기록(연속 기록·혼자 XP)과 목소리 타입 도감.
-- 사람이 적어 ❤·구독으로만 XP 가 쌓이면 다들 Lv 1 이다(11/4). 녹음 자체는 여기 없다 — 숫자만.
-- owner 는 'u:<계정>' 또는 'g:<기기>' (follows 와 같은 이름표). 로그인하면 claimGuest 가 옮긴다.

create table solo_days (
  owner text not null check (char_length(owner) between 3 and 80),
  day date not null,
  takes int not null default 0 check (takes >= 0),
  primary key (owner, day)
);

create table voice_dex (
  owner text not null check (char_length(owner) between 3 and 80),
  type_id text not null check (type_id ~ '^[a-z]{2,16}$'),
  first_at timestamptz not null default now(),
  primary key (owner, type_id)
);

-- 서버(서비스 키)만 읽고 쓴다 — 정책 없음.
alter table solo_days enable row level security;
alter table voice_dex enable row level security;
