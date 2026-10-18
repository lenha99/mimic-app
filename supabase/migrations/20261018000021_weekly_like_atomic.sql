-- ❤ 넣기를 한 트랜잭션으로 — "같은 네트워크에서 한 출전작에 3번까지"가 동시 요청에 뚫리지 않게.
--
-- 예전엔 서버가 개수를 센 뒤 넣었다. 서로 다른 기기 id 로 동시에 보내면 모두 3 미만을 보고
-- 모두 들어갔다. 출전작·네트워크 쌍마다 잠금을 잡고 세고 넣는다.
--
-- 돌려주는 값: 'ok'(넣음) · 'dup'(이 사람은 이미 누름) · 'cap'(이 네트워크 상한)

create or replace function weekly_like(
  p_entry uuid,
  p_voters text[],
  p_user uuid,
  p_ip_hash text,
  p_cap int
) returns text as $$
declare
  n int;
begin
  -- 한 사람이 게스트 → 로그인으로 넘어가도 한 표다. 아는 이름표를 전부 본다.
  if exists (select 1 from weekly_likes where entry_id = p_entry and voter = any(p_voters)) then
    return 'dup';
  end if;
  perform pg_advisory_xact_lock(hashtext('weekly_like:' || p_entry::text || ':' || p_ip_hash));
  select count(*) into n from weekly_likes where entry_id = p_entry and ip_hash = p_ip_hash;
  if n >= p_cap then
    return 'cap';
  end if;
  insert into weekly_likes (entry_id, voter, user_id, ip_hash)
    values (p_entry, p_voters[1], p_user, p_ip_hash)
    on conflict do nothing;
  return 'ok';
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function weekly_like(uuid, text[], uuid, text, int) from public, anon, authenticated;
