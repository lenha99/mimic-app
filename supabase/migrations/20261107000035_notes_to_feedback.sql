-- 지금까지 달린 댓글은 사실상 전부 피드백이었다 (11/7, 운영자 판단).
-- 34 에서 댓글/피드백을 나누며 👍 받은 것만 피드백으로 옮겼는데, 나머지도 피드백으로 옮긴다.
-- 주인이 자기 목소리에 쓴 원글은 피드백이 아니니 댓글로 둔다(주인이 XP 를 받지 않게).
-- 답글은 원글을 따른다.

update entry_notes n
set kind = 'feedback'
from weekly_entries e
where n.entry_id = e.id
  and n.parent_id is null
  and n.created_at < '2026-11-07 05:00:00+00'
  and (e.user_id is null or n.user_id <> e.user_id);

update entry_notes c
set kind = p.kind
from entry_notes p
where c.parent_id = p.id
  and c.kind <> p.kind;
