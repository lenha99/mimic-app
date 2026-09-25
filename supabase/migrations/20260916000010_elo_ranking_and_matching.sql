-- 이슈 #17 (C2): 랭킹 산식(Elo) + 매칭 큐.
-- 결정: 단순 승수 대신 Elo. A/B 페어 투표 자체가 Elo가 원래 설계된 상황(대국 결과)과 같다.
-- 랭킹 단위는 "레코딩"별 Elo이고, 유저 랭킹은 그 유저의 recordings 중 최고 Elo로 대표한다
-- (한 유저가 같은 밈을 여러 번 녹음할 수 있어서, 재도전 중 가장 잘한 것이 그 사람을 대표).

alter table recordings add column elo_rating int not null default 1200;

-- 투표가 들어올 때마다 두 레코딩의 Elo를 갱신. K=32(표준값), 스킵(승자 없음)은 반영 안 함.
create or replace function apply_vote_elo()
returns trigger as $$
declare
  elo_a int;
  elo_b int;
  expected_a numeric;
  score_a numeric;
  k constant int := 32;
begin
  if new.winner_id is null then
    return new;
  end if;

  select elo_rating into elo_a from recordings where id = new.recording_a_id;
  select elo_rating into elo_b from recordings where id = new.recording_b_id;

  expected_a := 1.0 / (1 + power(10, (elo_b - elo_a) / 400.0));
  score_a := case when new.winner_id = new.recording_a_id then 1 else 0 end;

  update recordings set elo_rating = round(elo_a + k * (score_a - expected_a))
    where id = new.recording_a_id;
  update recordings set elo_rating = round(elo_b + k * ((1 - score_a) - (1 - expected_a)))
    where id = new.recording_b_id;

  return new;
end;
$$ language plpgsql security definer;

create trigger votes_apply_elo
  after insert on votes
  for each row execute function apply_vote_elo();

-- rankings 뷰에 elo_rating(해당 유저의 그 밈 최고 기록) 추가.
-- CREATE OR REPLACE VIEW는 기존 컬럼 순서를 바꾸거나 중간에 끼워넣지 못하고
-- 끝에 추가만 가능해서, elo_rating을 반드시 마지막에 둬야 한다.
create or replace view rankings as
select
  r.user_id,
  r.meme_id,
  count(*) filter (where v.winner_id = r.id) as wins,
  count(*) filter (where v.winner_id is not null and v.winner_id <> r.id) as losses,
  p.nickname,
  p.avatar_emoji,
  max(r.elo_rating) as elo_rating
from recordings r
join votes v on v.recording_a_id = r.id or v.recording_b_id = r.id
join profiles p on p.id = r.user_id
group by r.user_id, r.meme_id, p.nickname, p.avatar_emoji;

-- 매칭 큐: (1) 응모작이 2개 이상인 밈 중 하나를 무작위로 고르고,
-- (2) 그 밈 안에서 노출(투표 등장) 횟수가 적은 순으로 우선해 2개를 반환한다.
-- 신규 레코딩은 노출 0이라 자동으로 먼저 노출됨 — "신규 노출 보장" 요구사항.
-- 밈별 최소 2개 미달이면 그 밈은 애초에 후보에서 빠지고, 자격 있는 밈이 하나도 없으면 빈 결과.
create or replace function get_vote_matchup(p_exclude_user uuid default null)
returns table (meme_id text, id uuid, audio_url text, user_id uuid) as $$
  with candidates as (
    select
      r.meme_id, r.id, r.audio_url, r.user_id,
      coalesce(sum(v.c), 0) as exposure
    from recordings r
    left join (
      select recording_a_id as rid, count(*) as c from votes group by recording_a_id
      union all
      select recording_b_id as rid, count(*) as c from votes group by recording_b_id
    ) v on v.rid = r.id
    where r.is_public
      and r.score is not null
      and (p_exclude_user is null or r.user_id is distinct from p_exclude_user)
    group by r.meme_id, r.id, r.audio_url, r.user_id
  ),
  eligible_memes as (
    select meme_id from candidates group by meme_id having count(*) >= 2
  ),
  chosen_meme as (
    select meme_id from eligible_memes order by random() limit 1
  )
  select c.meme_id, c.id, c.audio_url, c.user_id
  from candidates c
  join chosen_meme cm on cm.meme_id = c.meme_id
  order by c.exposure asc, random()
  limit 2;
$$ language sql stable;
