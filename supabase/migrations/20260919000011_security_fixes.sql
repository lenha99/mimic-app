-- PR #28 리뷰에서 나온 보안 구멍 수정.
--
-- 7~10번 마이그레이션이 아직 실제 프로젝트에 적용되기 전이라, 되돌릴 것 없이
-- 이 파일 하나로 정리한다. 고치는 것:
--   1) 게스트 녹음 탈취 (claim 정책에 토큰 검사 없음 + 토큰이 select로 샘)
--   2) 비로그인 대량 takedown (reports 정책이 익명 삽입 허용)
--   3) 투표 위조 (anon_id를 매번 새로 만들면 유니크 인덱스 우회)
--   4) elo_rating이 초안 가드에서 누락 → 클라이언트가 직접 설정 가능
--   5) rankings 뷰가 security_invoker 없이 RLS를 건너뜀
-- 덤으로: auth.role() NULL fail-open, security definer search_path 미고정,
--        Elo lost update 경쟁조건, /vote 영구 데드엔드, get_vote_matchup 휘발성.


-- ───────────────────────────────────────────────────────────────────────
-- 1) 게스트 녹음 탈취 차단
-- ───────────────────────────────────────────────────────────────────────
-- 기존 정책은 `using (user_id is null)` 뿐이라 로그인만 하면 아무나 모든 게스트
-- 녹음을 가져갈 수 있었다. 클라이언트 UPDATE 경로를 아예 없애고 RPC로만 연다.
drop policy if exists "logged-in users can claim guest recordings" on recordings;

-- claim_token이 select로 새면 RPC에 토큰 검사를 붙여도 의미가 없다.
-- 컬럼 단위 revoke는 테이블 단위 grant가 있으면 무시되므로, 테이블 grant를
-- 걷어내고 claim_token만 빼서 다시 준다.
revoke select on recordings from anon, authenticated;
grant select (
  id, user_id, meme_id, audio_url, score, grade,
  pitch, tone, timing, is_public, created_at, elo_rating
) on recordings to anon, authenticated;

-- 토큰을 아는 사람만 귀속시킬 수 있다. 성공하면 토큰은 즉시 소각(1회용).
create or replace function claim_recording(p_claim_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed uuid;
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;

  update recordings
     set user_id = auth.uid(),
         claim_token = null
   where claim_token = p_claim_token
     and user_id is null
  returning id into claimed;

  if claimed is null then
    raise exception 'invalid or already claimed token';
  end if;

  return claimed;
end;
$$;

revoke all on function claim_recording(uuid) from public;
grant execute on function claim_recording(uuid) to authenticated;

-- 게스트는 user_id가 없어서 `auth.uid() = user_id` select 정책에 걸리지 않는다.
-- 즉 자기 비공개 녹음을 자기도 못 본다. 토큰으로 조회할 통로를 열어준다.
create or replace function get_guest_recording(p_claim_token uuid)
returns table (id uuid, meme_id text, audio_url text, score int, grade text, is_public boolean)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select r.id, r.meme_id, r.audio_url, r.score, r.grade, r.is_public
  from recordings r
  where r.claim_token = p_claim_token
    and r.user_id is null;
$$;

revoke all on function get_guest_recording(uuid) from public;
grant execute on function get_guest_recording(uuid) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 2) 신고 — 비로그인 대량 takedown 차단
-- ───────────────────────────────────────────────────────────────────────
-- 정책 이름은 "anyone signed in"이었지만 `or reporter_id is null`이 붙어 있어서
-- anon 키만으로 전 녹음을 숨길 수 있었다.
drop policy if exists "anyone signed in can file a report" on reports;

create policy "signed-in users can file a report"
  on reports for insert
  with check (auth.uid() is not null and auth.uid() = reporter_id);

-- 같은 사람이 같은 녹음을 반복 신고해 카운트를 부풀리지 못하게.
create unique index if not exists reports_one_per_user_recording
  on reports (recording_id, reporter_id);

create or replace function hide_reported_recording()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update recordings set is_public = false where id = new.recording_id;
  return new;
end;
$$;


-- ───────────────────────────────────────────────────────────────────────
-- 3) 투표 위조 차단
-- ───────────────────────────────────────────────────────────────────────
-- anon_id는 클라이언트가 정하는 값이라, 매번 새로 만들면 votes_one_per_matchup
-- 유니크 인덱스를 무한히 우회할 수 있었다. /vote는 이미 로그인 전용이므로 닫는다.
drop policy if exists "authenticated users can vote" on votes;

create policy "signed-in users can vote"
  on votes for insert
  with check (
    auth.uid() is not null
    and auth.uid() = voter_id
    -- 승자는 반드시 두 후보 중 하나 (null = 스킵)
    and (winner_id is null or winner_id in (recording_a_id, recording_b_id))
    -- 두 녹음이 모두 그 밈의 공개 녹음이어야 하고, 내 녹음이면 안 된다
    and exists (
      select 1 from recordings ra
      where ra.id = recording_a_id
        and ra.meme_id = votes.meme_id
        and ra.is_public
        and ra.user_id is distinct from auth.uid()
    )
    and exists (
      select 1 from recordings rb
      where rb.id = recording_b_id
        and rb.meme_id = votes.meme_id
        and rb.is_public
        and rb.user_id is distinct from auth.uid()
    )
  );

-- 정책은 삽입 경로만 막는다. 제약으로 한 번 더 못박아 둔다.
alter table votes drop constraint if exists votes_winner_is_a_or_b;
alter table votes add constraint votes_winner_is_a_or_b
  check (winner_id is null or winner_id = recording_a_id or winner_id = recording_b_id);


-- ───────────────────────────────────────────────────────────────────────
-- 4) elo_rating을 점수 무결성 가드에 포함
-- ───────────────────────────────────────────────────────────────────────
-- 초안 insert에서 elo_rating이 빠져 있어 클라이언트가 999999로 넣을 수 있었다.
drop policy if exists "users and guests can insert draft recordings" on recordings;

create policy "users and guests can insert draft recordings"
  on recordings for insert
  with check (
    (auth.uid() = user_id or user_id is null)
    and score is null and grade is null and pitch is null and tone is null and timing is null
    and elo_rating = 1200
  );

-- UPDATE 쪽도 막는다. 단 apply_vote_elo의 정상 갱신은 통과해야 하므로
-- 트랜잭션 로컬 플래그(app.elo_update)로 구분한다.
--
-- auth.role()이 NULL이면 조건 전체가 NULL이 되어 if를 안 타고 조용히 통과하던
-- fail-open도 같이 막는다 (coalesce).
create or replace function guard_recording_score_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.score is distinct from old.score
      or new.grade is distinct from old.grade
      or new.pitch is distinct from old.pitch
      or new.tone is distinct from old.tone
      or new.timing is distinct from old.timing)
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'score fields can only be set by the scoring service';
  end if;

  if new.elo_rating is distinct from old.elo_rating
     and coalesce(current_setting('app.elo_update', true), '') <> 'on'
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'elo_rating is maintained by the vote trigger';
  end if;

  return new;
end;
$$;


-- ───────────────────────────────────────────────────────────────────────
-- 5) rankings 뷰 — RLS 적용 + 비공개 녹음 제외
-- ───────────────────────────────────────────────────────────────────────
-- Postgres 뷰는 기본이 소유자 권한이라 RLS를 건너뛴다. is_public 기본값이
-- false가 된 뒤로는 일부러 비공개로 둔 녹음이 닉네임까지 달고 공개 랭킹에
-- 집계되고 있었다.
--
-- 컬럼 순서는 create or replace view 제약 때문에 기존과 동일하게 유지한다.
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
where r.is_public
group by r.user_id, r.meme_id, p.nickname, p.avatar_emoji;

alter view rankings set (security_invoker = on);


-- ───────────────────────────────────────────────────────────────────────
-- 6) Elo 갱신 — lost update 경쟁조건 제거
-- ───────────────────────────────────────────────────────────────────────
-- for update 없이 읽고 쓰면 동시 투표 시 나중 update가 앞의 결과를 덮어쓴다.
-- 두 행을 id 순으로 잠가 데드락도 피한다.
create or replace function apply_vote_elo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  -- 항상 같은 순서(id 오름차순)로 잠근다 — 반대 순서로 들어온 투표와의 데드락 방지.
  perform 1
    from recordings
   where id in (new.recording_a_id, new.recording_b_id)
   order by id
     for update;

  select elo_rating into elo_a from recordings where id = new.recording_a_id;
  select elo_rating into elo_b from recordings where id = new.recording_b_id;

  expected_a := 1.0 / (1 + power(10, (elo_b - elo_a) / 400.0));
  score_a := case when new.winner_id = new.recording_a_id then 1 else 0 end;

  -- 가드 트리거에게 "이건 정상 갱신"이라고 알린다 (트랜잭션 로컬).
  perform set_config('app.elo_update', 'on', true);

  update recordings set elo_rating = round(elo_a + k * (score_a - expected_a))
    where id = new.recording_a_id;
  update recordings set elo_rating = round(elo_b + k * (expected_a - score_a))
    where id = new.recording_b_id;

  perform set_config('app.elo_update', 'off', true);

  return new;
end;
$$;


-- ───────────────────────────────────────────────────────────────────────
-- 7) 매칭 큐 — 영구 데드엔드 제거 + volatile
-- ───────────────────────────────────────────────────────────────────────
-- 이미 투표한 매치업을 제외하지 않아서, 응모작이 2개뿐인 밈 하나만 남으면
-- 같은 쌍이 계속 반환되고 유니크 인덱스가 23505로 거부 → 빠져나갈 길이 없었다.
-- 이미 투표한 녹음을 후보에서 빼면 매번 진행이 보장된다.
--
-- random()을 쓰므로 stable이 아니라 volatile이어야 한다.
create or replace function get_vote_matchup(p_exclude_user uuid default null)
returns table (meme_id text, id uuid, audio_url text, user_id uuid)
language sql
volatile
set search_path = public, pg_temp
as $$
  with candidates as (
    select
      r.meme_id as c_meme_id,
      r.id as c_id,
      r.audio_url as c_audio_url,
      r.user_id as c_user_id,
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
      and (
        p_exclude_user is null
        or not exists (
          select 1 from votes v2
          where v2.voter_id = p_exclude_user
            and (v2.recording_a_id = r.id or v2.recording_b_id = r.id)
        )
      )
    group by r.meme_id, r.id, r.audio_url, r.user_id
  ),
  eligible_memes as (
    select c.c_meme_id from candidates c group by c.c_meme_id having count(*) >= 2
  ),
  chosen_meme as (
    select em.c_meme_id from eligible_memes em order by random() limit 1
  )
  select c.c_meme_id, c.c_id, c.c_audio_url, c.c_user_id
  from candidates c
  join chosen_meme cm on cm.c_meme_id = c.c_meme_id
  order by c.exposure asc, random()
  limit 2;
$$;
