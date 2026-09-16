-- rankings 뷰에 프로필 정보(닉네임/아바타) 조인 — 랭킹 화면에서 user_id 대신 표시할 용도.
create or replace view rankings as
select
  r.user_id,
  r.meme_id,
  count(*) filter (where v.winner_id = r.id) as wins,
  count(*) filter (where v.winner_id is not null and v.winner_id <> r.id) as losses,
  p.nickname,
  p.avatar_emoji
from recordings r
join votes v on v.recording_a_id = r.id or v.recording_b_id = r.id
join profiles p on p.id = r.user_id
group by r.user_id, r.meme_id, p.nickname, p.avatar_emoji;
