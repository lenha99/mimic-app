-- 투표·랭킹을 main 에 올리기 전에 막아야 할 구멍들 + 아바타.
--
--   1) 녹음 주인이 모든 컬럼을 고칠 수 있었다 — 신고로 숨긴 녹음을 다시 공개하고,
--      Elo 를 쌓은 뒤 audio_url 을 바꿔치기하고, meme_id 를 옮길 수 있었다.
--   2) 버킷이 public 이라 "나만 볼 수 있게 저장"한 녹음도 URL 만 있으면 들렸고,
--      신고로 숨겨도 이미 퍼진 URL 로는 계속 재생됐다.
--   3) memes 테이블에 동물 6개만 있어 명대사 밈은 저장이 FK 에서 막혔다.
--   4) 아바타 — 목소리에 맞춰 움직이는 캐릭터의 모양.


-- ───────────────────────────────────────────────────────────────────────
-- 1) 주인이 바꿀 수 있는 건 공개 여부 하나뿐
-- ───────────────────────────────────────────────────────────────────────
-- 신고 숨김은 공개 여부와 다른 축이다. 주인이 is_public 을 다시 켜도 hidden 이면
-- 안 보인다. hidden 은 운영자(service_role)만 푼다.
alter table recordings add column hidden boolean not null default false;

-- 이미 신고된 녹음은 숨김 상태로 옮긴다.
update recordings set hidden = true
 where id in (select recording_id from reports);

-- 삽입은 전부 /api/publish-recording(service_role)이 한다. 브라우저 경로를 닫는다 —
-- 열어두면 점수 없는 쓰레기 행이나 남의 파일을 가리키는 행을 만들 수 있다.
revoke insert on recordings from anon, authenticated;

-- 삭제도 서버(/api/recordings)만. 브라우저가 행만 지우면 Storage 파일이 고아로 남는다.
revoke delete on recordings from anon, authenticated;

-- 수정은 컬럼 단위로. 테이블 grant 가 있으면 컬럼 revoke 가 무시되므로 걷어내고 다시 준다.
revoke update on recordings from anon, authenticated;
grant update (is_public) on recordings to authenticated;

-- 11번에서 컬럼 단위 select grant 로 바꿨으므로 새 컬럼도 명시해야 읽힌다.
grant select (hidden) on recordings to anon, authenticated;

create or replace function hide_reported_recording()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update recordings set hidden = true, is_public = false where id = new.recording_id;
  return new;
end;
$$;

drop policy if exists "public recordings are viewable by everyone" on recordings;
create policy "public recordings are viewable by everyone"
  on recordings for select
  using ((is_public and not hidden) or auth.uid() = user_id);


-- ───────────────────────────────────────────────────────────────────────
-- 2) 비공개 버킷 — 재생은 서버가 서명한 짧은 URL 로만
-- ───────────────────────────────────────────────────────────────────────
-- 컬럼에 URL 이 아니라 버킷 안 경로를 둔다. URL 은 매 요청마다 서버가 만든다.
alter table recordings rename column audio_url to audio_path;

update recordings
   set audio_path = regexp_replace(audio_path, '^.*/storage/v1/object/public/recordings/', '')
 where audio_path like '%/storage/v1/object/public/recordings/%';

update storage.buckets set public = false where id = 'recordings';

-- SQL 함수 본문은 텍스트로 저장돼서 컬럼 이름 변경을 따라오지 않는다. 다시 만든다.
drop function if exists get_guest_recording(uuid);
create function get_guest_recording(p_claim_token uuid)
returns table (id uuid, meme_id text, audio_path text, score int, grade text, is_public boolean)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select r.id, r.meme_id, r.audio_path, r.score, r.grade, r.is_public
  from recordings r
  where r.claim_token = p_claim_token
    and r.user_id is null;
$$;

revoke all on function get_guest_recording(uuid) from public;
grant execute on function get_guest_recording(uuid) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 투표 · 매칭 · 랭킹에서 숨긴 녹음 제외
-- ───────────────────────────────────────────────────────────────────────
drop policy if exists "signed-in users can vote" on votes;
create policy "signed-in users can vote"
  on votes for insert
  with check (
    auth.uid() is not null
    and auth.uid() = voter_id
    and (winner_id is null or winner_id in (recording_a_id, recording_b_id))
    and exists (
      select 1 from recordings ra
      where ra.id = recording_a_id
        and ra.meme_id = votes.meme_id
        and ra.is_public and not ra.hidden
        and ra.user_id is distinct from auth.uid()
    )
    and exists (
      select 1 from recordings rb
      where rb.id = recording_b_id
        and rb.meme_id = votes.meme_id
        and rb.is_public and not rb.hidden
        and rb.user_id is distinct from auth.uid()
    )
  );

-- 반환 컬럼 이름이 바뀌므로 create or replace 로는 안 되고 다시 만든다.
drop function if exists get_vote_matchup(uuid);
create function get_vote_matchup(p_exclude_user uuid default null)
returns table (meme_id text, id uuid, audio_path text, user_id uuid)
language sql
volatile
set search_path = public, pg_temp
as $$
  with candidates as (
    select
      r.meme_id as c_meme_id,
      r.id as c_id,
      r.audio_path as c_audio_path,
      r.user_id as c_user_id,
      coalesce(sum(v.c), 0) as exposure
    from recordings r
    left join (
      select recording_a_id as rid, count(*) as c from votes group by recording_a_id
      union all
      select recording_b_id as rid, count(*) as c from votes group by recording_b_id
    ) v on v.rid = r.id
    where r.is_public
      and not r.hidden
      and r.score is not null
      and (p_exclude_user is null or r.user_id is distinct from p_exclude_user)
      and (
        p_exclude_user is null
        or not exists (
          select 1 from votes v2
          where v2.voter_id = p_exclude_user
            and (v2.recording_a_id = r.id or v2.recording_b_id = r.id)
        )
      )
    group by r.meme_id, r.id, r.audio_path, r.user_id
  ),
  eligible_memes as (
    select c.c_meme_id from candidates c group by c.c_meme_id having count(*) >= 2
  ),
  chosen_meme as (
    select em.c_meme_id from eligible_memes em order by random() limit 1
  )
  select c.c_meme_id, c.c_id, c.c_audio_path, c.c_user_id
  from candidates c
  join chosen_meme cm on cm.c_meme_id = c.c_meme_id
  order by c.exposure asc, random()
  limit 2;
$$;
grant execute on function get_vote_matchup(uuid) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 4) 아바타
-- ───────────────────────────────────────────────────────────────────────
-- 허용 값은 web/lib/avatar.ts 의 선택지와 같아야 한다. 한쪽만 늘리면 저장이 거부된다.
alter table profiles add column avatar jsonb not null default '{}'::jsonb;

alter table profiles add constraint profiles_avatar_valid check (
  jsonb_typeof(avatar) = 'object'
  and (avatar - array['body', 'color', 'eyes', 'hat']) = '{}'::jsonb
  and coalesce(avatar->>'body',  'blob')  in ('blob', 'cat', 'bear', 'ghost')
  and coalesce(avatar->>'color', 'volt')  in ('volt', 'pink', 'cyan', 'lime', 'peach', 'lilac')
  and coalesce(avatar->>'eyes',  'dot')   in ('dot', 'happy', 'sleepy', 'star')
  and coalesce(avatar->>'hat',   'none')  in ('none', 'cap', 'crown', 'bow', 'headset')
);

-- 랭킹 뷰 끝에 붙인다 (create or replace view 는 끝에만 추가할 수 있다).
create or replace view rankings as
select
  r.user_id,
  r.meme_id,
  count(*) filter (where v.winner_id = r.id) as wins,
  count(*) filter (where v.winner_id is not null and v.winner_id <> r.id) as losses,
  p.nickname,
  p.avatar_emoji,
  max(r.elo_rating) as elo_rating,
  p.avatar
from recordings r
join votes v on v.recording_a_id = r.id or v.recording_b_id = r.id
join profiles p on p.id = r.user_id
where r.is_public and not r.hidden
group by r.user_id, r.meme_id, p.nickname, p.avatar_emoji, p.avatar;

alter view rankings set (security_invoker = on);


-- ───────────────────────────────────────────────────────────────────────
-- 3) memes — 명대사 밈 추가
-- ───────────────────────────────────────────────────────────────────────
-- content/registry.json 이 진실 소스다. 앞으로 새 밈은 /api/publish-recording 이
-- 카탈로그를 보고 저장 직전에 upsert 한다. 여기는 지금 있는 것만 채운다.
insert into memes (id, title, source, emoji) values
  ('muyaho', '무야호', '무한도전', '🎉'),
  ('eoiga_eopne', '어이가 없네', '베테랑', '😑'),
  ('mitjang_ppaegi', '동작 그만', '타짜', '🃏'),
  ('geoje_yaho', '거제 야호', '원이 · 리센느 미나미', '🏝️'),
  ('bap_meokgo', '밥은 먹고 다니냐', '살인의 추억', '🍚')
on conflict (id) do nothing;
