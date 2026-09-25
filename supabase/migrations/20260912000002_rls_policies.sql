-- Row Level Security — 초안. Dev A가 실제 요구사항에 맞춰 다듬을 것.

alter table profiles enable row level security;
alter table memes enable row level security;
alter table recordings enable row level security;
alter table votes enable row level security;

-- profiles: 닉네임은 랭킹에 노출되므로 전체 공개 읽기, 본인 것만 쓰기.
create policy "profiles are viewable by everyone"
  on profiles for select using (true);
create policy "users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- memes: 운영자가 관리하는 고정 목록. 읽기는 전체 공개, 쓰기는 service role만.
create policy "memes are viewable by everyone"
  on memes for select using (true);

-- recordings: 공개된 것만 전체 공개, 본인 것은 공개 여부 상관없이 항상 조회 가능.
create policy "public recordings are viewable by everyone"
  on recordings for select using (is_public or auth.uid() = user_id);
create policy "users can insert their own recordings"
  on recordings for insert with check (auth.uid() = user_id);
create policy "users can update their own recordings"
  on recordings for update using (auth.uid() = user_id);
create policy "users can delete their own recordings"
  on recordings for delete using (auth.uid() = user_id);

-- votes: 집계용이라 읽기는 공개, 쓰기는 로그인 유저 또는 anon_id를 가진 게스트.
create policy "votes are viewable by everyone"
  on votes for select using (true);
create policy "authenticated users can vote"
  on votes for insert with check (auth.uid() = voter_id or (voter_id is null and anon_id is not null));
