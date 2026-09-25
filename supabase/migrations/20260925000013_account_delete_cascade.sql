-- 회원 탈퇴가 외래키에 막히지 않게.
--
-- profiles 를 지우면 recordings 는 cascade 로 따라가는데, votes.voter_id 와
-- reports.reporter_id 는 규칙이 없어서(no action) 한 번이라도 투표·신고한 사람은
-- 탈퇴 자체가 실패했다.
--
-- 투표: 지운다. 이미 반영된 Elo 는 그대로 둔다 — 결과를 되돌리면 남의 순위가 흔들린다.
--       voter_id 를 null 로 두는 건 votes_voter_or_anon 제약(voter 나 anon 중 하나는 있어야)에 걸린다.
-- 신고: 남긴다. 신고 기록은 운영 판단에 필요하고, 누가 했는지만 지운다.

alter table votes drop constraint if exists votes_voter_id_fkey;
alter table votes add constraint votes_voter_id_fkey
  foreign key (voter_id) references profiles(id) on delete cascade;

alter table reports drop constraint if exists reports_reporter_id_fkey;
alter table reports add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references profiles(id) on delete set null;
