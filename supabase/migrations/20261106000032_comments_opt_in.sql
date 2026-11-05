-- 댓글은 고른 사람만 (11/6). 갤러리 합치기(…031) 때 원래 있던 출전작까지 전부 "댓글 받는 중"으로
-- 켜 버렸는데, 그 사람들은 고른 적이 없다 — ❤ 만 받는 것으로 돌린다. 주인은 출전작 화면에서 켤 수 있다.
-- 게시판에서 옮겨 온 두 개(expires_at 있음)는 원래 피드백을 바라고 올린 것이라 그대로 둔다.
-- #113 배포(2026-11-05 16:32 UTC) 뒤에 올린 건 올릴 때 직접 고른 값이라 건드리지 않는다.
update weekly_entries
set feedback_on = false
where expires_at is null
  and created_at < '2026-11-05 16:32:29+00'
  and feedback_on;

alter table weekly_entries alter column feedback_on set default false;
