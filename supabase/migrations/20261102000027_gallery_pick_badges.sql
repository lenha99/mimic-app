-- 목소리 갤러리 · 운영자 픽 · 강점 배지 · 인스타 소개 동의.
--
-- featured_at : 운영자 픽. 홈과 갤러리 맨 위에 고정된다(주가 바뀌어도 남는다).
-- promo_ok    : 출전할 때 "MIMIC 인스타에 소개돼도 좋아요"를 스스로 켰는지(기본 꺼짐).
-- badges      : 잘한 점만 — 공개 화면에 붙는 배지. 못한 점은 저장하지 않는다(본인 화면에만).
-- 코드는 이 열들이 없어도 돈다 — 배포가 마이그레이션보다 먼저 나가도 안전.
alter table weekly_entries add column if not exists featured_at timestamptz;
alter table weekly_entries add column if not exists promo_ok boolean not null default false;
alter table weekly_entries add column if not exists badges text[] not null default '{}';
create index if not exists weekly_entries_featured_idx on weekly_entries (featured_at desc) where featured_at is not null;
create index if not exists weekly_entries_recent_idx on weekly_entries (updated_at desc) where hidden = false;
