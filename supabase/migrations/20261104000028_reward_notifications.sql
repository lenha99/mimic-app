-- 보상 알림 — 첫 ❤ · ❤ 단계(3·10·30·100) · 구독자 단계(3·10·30) · 운영자 픽 · 픽 예언가.
-- 보상 자체는 표가 없다(받은 ❤·구독자·준 ❤·픽으로 계산). 알림 종류만 늘린다.
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in (
  'follow', 'dm', 'dm_request', 'listen_first', 'listen_daily', 'new_entry',
  'reward_likes', 'reward_follows', 'reward_pick', 'reward_prophet'
));
