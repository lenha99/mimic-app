-- 피드백을 댓글과 진짜로 나눈다 (11/7).
--
-- 33 에서 "🎯 피드백 요청"을 만들었지만 실제로 쓰는 칸은 댓글과 같았다 — 💬 를 눌러도 🎯 를 눌러도
-- 같은 시트, 같은 목록, 같은 한 줄 입력칸. 받는 사람 눈엔 둘이 똑같았다.
-- 이제 피드백은 따로 쌓인다: 좋았던 점(body) + 바꿔 보면 좋을 점(tip) 두 칸을 다 채워야 남는다.
-- 답글은 원글의 kind 를 따른다. "도움됐어요"(helpful)는 피드백에만 의미가 있다.

alter table entry_notes add column if not exists kind text not null default 'comment';
alter table entry_notes drop constraint if exists entry_notes_kind_check;
alter table entry_notes add constraint entry_notes_kind_check check (kind in ('comment', 'feedback'));
alter table entry_notes add column if not exists tip text check (tip is null or char_length(tip) <= 300);

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
