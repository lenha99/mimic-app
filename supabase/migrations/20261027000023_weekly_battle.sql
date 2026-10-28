-- 블라인드 보이스 배틀.
--
-- ❤ 는 친구를 많이 부른 사람이 이긴다. 같은 대본을 읽은 두 녹음을 이름·캐릭터 없이
-- 나란히 들려주고 "어느 쪽이 더 좋아요?"만 묻는다. 결과는 출전작마다 Elo 로 쌓인다.
-- ❤ 순위(시상대)는 그대로 두고, 배틀 순위를 따로 보여준다.

alter table weekly_entries
  add column battle_rating real not null default 1000,
  add column battle_wins int not null default 0,
  add column battle_losses int not null default 0;

create table weekly_battle_votes (
  id bigint generated always as identity primary key,
  challenge_id text not null references weekly_challenges(id) on delete cascade,
  -- 두 출전작 id 를 작은 쪽부터 이은 것. 한 사람이 같은 쌍을 두 번 심사하지 않게.
  pair text not null check (char_length(pair) = 73),
  winner_id uuid not null references weekly_entries(id) on delete cascade,
  loser_id uuid not null references weekly_entries(id) on delete cascade,
  -- 'u:<user id>' 또는 'g:<기기 id>' — ❤ 와 같은 이름표.
  voter text not null check (char_length(voter) between 3 and 80),
  user_id uuid references profiles(id) on delete set null,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  unique (voter, pair)
);

create index weekly_battle_votes_voter_idx on weekly_battle_votes (challenge_id, voter);
create index weekly_battle_votes_ip_idx on weekly_battle_votes (challenge_id, ip_hash, created_at);

alter table weekly_battle_votes enable row level security;
revoke all on weekly_battle_votes from anon, authenticated;

-- 한 표를 한 트랜잭션으로: 중복 확인 → 네트워크 상한 → 넣기 → 두 출전작 Elo 갱신.
-- 돌려주는 값: 'ok' · 'dup'(이 사람은 이 쌍을 이미 심사) · 'cap'(이 네트워크 하루 상한)
create or replace function weekly_battle_vote(
  p_week text,
  p_winner uuid,
  p_loser uuid,
  p_voters text[],
  p_user uuid,
  p_ip_hash text,
  p_cap int
) returns text as $$
declare
  k_pair text := least(p_winner::text, p_loser::text) || '|' || greatest(p_winner::text, p_loser::text);
  n int;
  rw real;
  rl real;
  expect real;
  k constant real := 24;
begin
  if exists (select 1 from weekly_battle_votes where pair = k_pair and voter = any(p_voters)) then
    return 'dup';
  end if;
  perform pg_advisory_xact_lock(hashtext('weekly_battle:' || p_week || ':' || p_ip_hash));
  select count(*) into n from weekly_battle_votes
    where challenge_id = p_week and ip_hash = p_ip_hash and created_at > now() - interval '1 day';
  if n >= p_cap then
    return 'cap';
  end if;

  -- 두 행을 같은 순서로 잠근다 — 동시에 반대 순서로 잠그면 교착된다.
  perform 1 from weekly_entries where id in (p_winner, p_loser) order by id for update;
  select battle_rating into rw from weekly_entries where id = p_winner;
  select battle_rating into rl from weekly_entries where id = p_loser;
  expect := 1 / (1 + power(10, (rl - rw) / 400));

  insert into weekly_battle_votes (challenge_id, pair, winner_id, loser_id, voter, user_id, ip_hash)
    values (p_week, k_pair, p_winner, p_loser, p_voters[1], p_user, p_ip_hash)
    on conflict do nothing;
  if not found then
    return 'dup';
  end if;

  update weekly_entries set battle_rating = rw + k * (1 - expect), battle_wins = battle_wins + 1 where id = p_winner;
  update weekly_entries set battle_rating = rl - k * (1 - expect), battle_losses = battle_losses + 1 where id = p_loser;
  return 'ok';
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function weekly_battle_vote(text, uuid, uuid, text[], uuid, text, int) from public, anon, authenticated;

-- 녹음을 교체하면 다른 소리가 되므로 배틀 기록도 처음부터. (❤ 를 0 으로 돌리는 것과 같은 규칙)
create or replace function weekly_battle_reset() returns trigger as $$
begin
  if new.audio_path is distinct from old.audio_path then
    new.battle_rating := 1000;
    new.battle_wins := 0;
    new.battle_losses := 0;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger weekly_entries_battle_reset
  before update on weekly_entries
  for each row execute function weekly_battle_reset();
