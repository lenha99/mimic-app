-- 캐릭터 파츠 확장 (머리·머리색·얼굴·안경·효과).
--
-- 12번 제약은 값 목록까지 SQL 에 박아서, 파츠 하나 늘릴 때마다 마이그레이션이
-- 필요했고 한쪽만 늘리면 저장이 조용히 거부됐다. 허용 목록은 web/lib/avatar.ts 한
-- 곳에 두고(모르는 값은 거기서 기본값으로 떨어진다), DB 는 모양만 지킨다:
--   · 알려진 키만
--   · 값은 짧은 소문자 문자열만 (임의 문자열·중첩 객체로 부풀리지 못하게)

alter table profiles drop constraint if exists profiles_avatar_valid;

alter table profiles add constraint profiles_avatar_valid check (
  jsonb_typeof(avatar) = 'object'
  and (avatar - array['body', 'color', 'eyes', 'hair', 'hairColor', 'face', 'glasses', 'hat', 'fx']) = '{}'::jsonb
  and not jsonb_path_exists(avatar, '$.* ? (@.type() != "string" || !(@ like_regex "^[a-z]{1,16}$"))')
);
