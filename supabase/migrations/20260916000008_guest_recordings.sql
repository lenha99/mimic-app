-- 이슈 #19 (C4): /record를 게스트에게 개방하므로 recordings.user_id가 로그인 필수면 안 된다.
alter table recordings alter column user_id drop not null;

-- 게스트 녹음을 로그인 후 본인 계정에 귀속시키기 위한 토큰.
-- 게스트가 녹음할 때 클라이언트가 임의의 uuid를 만들어 localStorage에 저장해두고,
-- 나중에 로그인하면 그 토큰으로 이 recording을 자기 것으로 "claim"한다.
alter table recordings add column claim_token uuid default gen_random_uuid();

drop policy "users can insert their own recordings" on recordings;

-- 로그인 유저는 본인 user_id로, 게스트는 user_id를 비워서 삽입 가능.
create policy "users and guests can insert recordings"
  on recordings for insert
  with check (
    (auth.uid() = user_id)
    or (user_id is null)
  );

-- 게스트 녹음(user_id is null)을 로그인한 사람이 자기 것으로 귀속.
-- claim_token을 아는 사람만 성공한다 — 모르면 이 정책을 통과해도 매칭되는 row가 없음.
create policy "logged-in users can claim guest recordings"
  on recordings for update
  using (user_id is null)
  with check (auth.uid() = user_id);
