-- 운영자 계정 목록. 공용 암호(ADMIN_PASSCODE) 대신 내 계정으로 로그인하면 운영자 화면이 열린다.
--
-- 아이디를 코드에 적지 않는 이유: 저장소가 공개라 운영자 아이디가 곧 공격 목표가 된다.
-- 계정 id 로 여기 한 줄씩 넣는다. 읽기는 서버(service_role)만.
create table admins (
  user_id uuid primary key references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;
revoke all on admins from anon, authenticated;
