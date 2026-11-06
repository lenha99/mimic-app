-- 피드백을 제대로 받고 싶은 사람 (11/6).
--
-- 댓글(응원·한마디)과 피드백 요청을 나눈다. 댓글만 열면 "잘 들었어요"만 쌓이고, 정말 고칠 곳을
-- 알고 싶은 사람은 답을 못 얻는다. 피드백 요청(wants_feedback)을 켜면 갤러리 "🎯 피드백" 칸에
-- 모이고, 봐 줬으면 하는 곳(feedback_ask)을 한 줄 적어 둘 수 있다. 듣는 사람은 그 질문을 보고 쓴다.
-- 주인이 "도움됐어요"(helpful)를 누르면 쓴 사람에게 알림이 간다 — 피드백을 주는 쪽도 보람이 있어야 계속 준다.

alter table weekly_entries add column if not exists wants_feedback boolean not null default false;
alter table weekly_entries add column if not exists feedback_ask text check (feedback_ask is null or char_length(feedback_ask) <= 120);

-- 게시판에서 옮겨 온 두 개는 원래 피드백을 바라고 올린 것
update weekly_entries set wants_feedback = true, feedback_on = true where expires_at is not null;

alter table entry_notes add column if not exists helpful boolean not null default false;

alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'follow', 'dm', 'dm_request', 'listen_first', 'listen_daily', 'new_entry',
  'reward_likes', 'reward_follows', 'reward_pick', 'reward_prophet',
  'note', 'note_reply', 'note_helpful'
));
