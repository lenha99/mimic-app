-- 피드백을 댓글과 진짜로 나눈다 (11/7).
--
-- 33 에서 "🎯 피드백 요청"을 만들었지만 실제로 쓰는 칸은 댓글과 같았다 — 💬 를 눌러도 🎯 를 눌러도
-- 같은 시트, 같은 목록, 같은 한 줄 입력칸. 받는 사람 눈엔 둘이 똑같았다.
-- 이제 피드백은 따로 쌓인다(목록·숫자·알림). 쓰는 건 댓글처럼 한 칸 — 쉬워야 남긴다.
-- 답글은 원글의 kind 를 따른다. "도움됐어요"(helpful)는 피드백에만 의미가 있다.
-- 남긴 사람의 XP 는 이 표에서 센다(web/lib/pass-server — 목소리당 +40, 👍 받으면 +60).

alter table entry_notes add column if not exists kind text not null default 'comment';
alter table entry_notes drop constraint if exists entry_notes_kind_check;
alter table entry_notes add constraint entry_notes_kind_check check (kind in ('comment', 'feedback'));
create index if not exists entry_notes_feedback_user_idx on entry_notes (user_id) where kind = 'feedback' and parent_id is null;

-- 지금까지 "도움됐어요"를 받은 건 피드백으로 쓰인 것
update entry_notes set kind = 'feedback' where helpful = true and parent_id is null;
update entry_notes c set kind = 'feedback' from entry_notes p where c.parent_id = p.id and p.kind = 'feedback';

-- 피드백 알림은 댓글 알림과 따로 ("부탁한 피드백이 왔어요")
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'follow', 'dm', 'dm_request', 'listen_first', 'listen_daily', 'new_entry',
  'reward_likes', 'reward_follows', 'reward_pick', 'reward_prophet',
  'note', 'note_reply', 'note_helpful', 'note_feedback'
));
