-- 자유 출전(아무 대본이나 · id 'f_대본id', season 0)이 만들어진 날(11/3)부터 한 번도 저장되지 않았다.
-- weekly_challenges 의 id·season 검사가 주간('w20261102', season ≥ 1)만 허용해서 ensureWeek 의 upsert 가
-- 조용히 실패했고, 이어지는 출전작 insert 가 외래키에 걸려 "출전하지 못했어요"가 떴다.
alter table weekly_challenges drop constraint if exists weekly_challenges_id_check;
alter table weekly_challenges add constraint weekly_challenges_id_check
  check (id ~ '^w[0-9]{8}$' or id ~ '^f_[a-z0-9_]{1,62}$');

alter table weekly_challenges drop constraint if exists weekly_challenges_season_check;
alter table weekly_challenges add constraint weekly_challenges_season_check
  check (season > 0 or (season = 0 and id like 'f\_%'));
