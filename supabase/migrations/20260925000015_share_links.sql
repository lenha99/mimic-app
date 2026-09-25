-- 녹음 공유 링크 (/p/{id}).
--
-- 친구한테 가는 게 "87점"이라는 숫자뿐이면, 이 앱에서 제일 웃긴 장면 — 내 캐릭터가
-- 내 목소리로 외치는 것 — 을 받은 사람은 못 본다. 링크로 그 장면을 보낸다.
--
-- shared: 링크를 가진 사람만 들을 수 있는 "목록에 없는" 녹음. 공개(is_public)와 다르다 —
--   투표·랭킹에 안 올라가고, RLS 로도 열지 않는다. 열면 anon 이 shared 인 행을 목록으로
--   긁어갈 수 있다. 공유 페이지는 서버가 id 하나로만 조회한다(추측 불가한 uuid).
-- avatar: 녹음할 때의 캐릭터. 게스트는 프로필이 없어서, 이게 없으면 링크에서 기본
--   캐릭터로 나온다.

alter table recordings add column shared boolean not null default false;
alter table recordings add column avatar jsonb;

alter table recordings add constraint recordings_avatar_valid check (
  avatar is null or (
    jsonb_typeof(avatar) = 'object'
    and (avatar - array['body', 'color', 'eyes', 'hair', 'hairColor', 'face', 'glasses', 'hat', 'fx']) = '{}'::jsonb
    and not jsonb_path_exists(avatar, '$.* ? (@.type() != "string" || !(@ like_regex "^[a-z]{1,16}$"))')
  )
);

-- 11번에서 컬럼 단위 select 로 바꿨으므로 새 컬럼도 명시한다. 행 단위 공개 범위는
-- 기존 RLS(공개 녹음 · 내 녹음) 그대로다. shared 는 브라우저가 못 바꾼다(12번: update 는 is_public 만).
grant select (shared, avatar) on recordings to anon, authenticated;
