-- 알림 종류별 켜기/끄기 — 다른 앱들처럼 처음 켤 때 한 번에 고른다(components/social/notify-sheet).
--   new_entries (이미 있음) : 새 목소리가 올라오면
--   mine                    : 내 목소리를 누가 듣거나 구독하면
--   dm                      : 메시지 · 메시지 요청
-- 코드는 이 열이 없어도 돈다(전부 켜진 것으로 본다) — 배포가 마이그레이션보다 먼저 나가도 안전.
alter table push_subs add column if not exists mine boolean not null default true;
alter table push_subs add column if not exists dm boolean not null default true;
