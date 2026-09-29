-- 따라하기 피드 (/feed) — 남이 따라한 걸 보는 곳.
--
-- 지금까지 이 앱엔 만드는 쪽(녹음)만 있고 보는 쪽이 없었다. 올려도 볼 사람이 없으면
-- 올릴 이유가 없고, 볼 게 없으면 다시 올 이유가 없다. 피드는 공개(is_public) 녹음만
-- 싣는다 — "링크로만"(shared) 저장한 건 친구한테 보낸 것이지 모두에게 보인 게 아니다.
--
-- 반응은 두 축이다. 투표 화면의 "웃겨도 좋고, 똑같아도 좋고"를 그대로 가른 것:
--   same  🎯 똑같다 — 잘 따라했다
--   funny 😂 웃기다 — 망했는데 웃기다 (점수가 낮아도 올릴 이유가 된다)
-- 하트 하나로 묶으면 잘하는 사람만 위로 가고, 못하는 사람은 올릴 이유가 사라진다.


-- ───────────────────────────────────────────────────────────────────────
-- 반응
-- ───────────────────────────────────────────────────────────────────────
create table reactions (
  recording_id uuid not null references recordings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('same', 'funny')),
  created_at timestamptz not null default now(),
  primary key (recording_id, user_id, kind)
);

create index reactions_user_idx on reactions (user_id);

alter table reactions enable row level security;

-- 누가 뭘 눌렀는지는 본인만 본다. 개수는 feed_page() 가 센다 — 행을 공개하면
-- "누가 누구 녹음에 웃겼다"를 목록으로 긁어갈 수 있다.
create policy "own reactions are readable"
  on reactions for select
  using (auth.uid() = user_id);

-- 공개된(숨김 아닌) 남의 녹음에만. 내 녹음에 내가 누르는 건 막는다.
create policy "signed-in users react to public recordings"
  on reactions for insert
  with check (
    auth.uid() is not null
    and auth.uid() = user_id
    and exists (
      select 1 from recordings r
      where r.id = recording_id
        and r.is_public and not r.hidden
        and r.user_id is distinct from auth.uid()
    )
  );

create policy "own reactions are removable"
  on reactions for delete
  using (auth.uid() = user_id);

revoke all on reactions from anon;
revoke update on reactions from authenticated;
grant select, insert, delete on reactions to authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 피드 한 페이지
-- ───────────────────────────────────────────────────────────────────────
-- security definer 인 이유: 반응 개수를 세려면 남의 반응 행을 읽어야 하는데 RLS 는
-- 본인 것만 연다. 대신 여기서 공개·숨김 조건을 직접 걸고, 공개 녹음의 공개 정보만
-- 내보낸다 (claim_token 같은 건 안 나간다).
--
-- 정렬:
--   hot   — 반응을 나이로 나눈다. 새 녹음도 반응 0 에서 +1 로 시작해 한동안 위에 뜬다.
--   new   — 최신순.
--   funny — 웃기다 많은 순, 같으면 점수 낮은 순. 반응이 하나도 없을 때도 "망한 테이크"가
--           위로 와서 탭이 비지 않는다.
-- p_pin: 공유·저장 직후 "피드에서 보기"로 들어온 녹음을 첫 장에 고정한다 (첫 페이지만).
create or replace function feed_page(
  p_sort text default 'hot',
  p_offset int default 0,
  p_limit int default 8,
  p_pin uuid default null
)
returns table (
  id uuid,
  meme_id text,
  audio_path text,
  score int,
  grade text,
  created_at timestamptz,
  user_id uuid,
  nickname text,
  avatar jsonb,
  same_count int,
  funny_count int,
  my_same boolean,
  my_funny boolean,
  pinned boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with visible as (
    select r.*
    from recordings r
    where r.is_public
      and not r.hidden
      and r.score is not null
  ),
  counted as (
    select
      v.id, v.meme_id, v.audio_path, v.score, v.grade, v.created_at, v.user_id,
      coalesce(v.avatar, p.avatar) as avatar,
      p.nickname,
      coalesce(sum((x.kind = 'same')::int), 0)::int as same_count,
      coalesce(sum((x.kind = 'funny')::int), 0)::int as funny_count,
      coalesce(bool_or(x.kind = 'same' and x.user_id = auth.uid()), false) as my_same,
      coalesce(bool_or(x.kind = 'funny' and x.user_id = auth.uid()), false) as my_funny
    from visible v
    left join profiles p on p.id = v.user_id
    left join reactions x on x.recording_id = v.id
    group by v.id, v.meme_id, v.audio_path, v.score, v.grade, v.created_at, v.user_id,
             v.avatar, p.avatar, p.nickname
  ),
  ranked as (
    select
      c.*,
      -- p_pin 이 null 이면 비교도 null 이 된다. 그대로 두면 아래 where 에서 2페이지부터
      -- 모든 행이 걸러진다 (not (null and true) = null).
      coalesce(c.id = p_pin, false) as pinned,
      case coalesce(p_sort, 'hot')
        when 'new' then extract(epoch from c.created_at)
        when 'funny' then c.funny_count * 1000 + (100 - coalesce(c.score, 100))
        else (c.same_count + 1.5 * c.funny_count + 1)
             / power(extract(epoch from (now() - c.created_at)) / 3600 + 2, 1.3)
      end as rank_key
    from counted c
  )
  select
    r.id, r.meme_id, r.audio_path, r.score, r.grade, r.created_at, r.user_id,
    r.nickname, r.avatar, r.same_count, r.funny_count, r.my_same, r.my_funny, r.pinned
  from ranked r
  -- 고정한 녹음은 첫 페이지 맨 앞에만. 다음 페이지에서 또 나오면 같은 걸 두 번 본다.
  where not (r.pinned and coalesce(p_offset, 0) > 0)
  order by (r.pinned and coalesce(p_offset, 0) = 0) desc, r.rank_key desc, r.created_at desc, r.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function feed_page(text, int, int, uuid) from public;
grant execute on function feed_page(text, int, int, uuid) to anon, authenticated;
