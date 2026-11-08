-- 릴레이 더빙 — 장면 길이를 장면마다 다르게(10~16줄). 새 비축 장면은 13줄.
-- 갈림길은 줄 수에서 나온다: 전개 = 끝에서 다섯째(10줄→6번, 13줄→9번), 결말 = 마지막 줄 (web/lib/relay.ts twistN).
-- 자동으로 붙은 제약 이름을 추측하지 않고, "between 1 and 10" 을 검사하는 제약을 찾아 지운다.
do $$
declare c record;
begin
  for c in
    select conrelid::regclass::text as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('relay_lines'::regclass, 'relay_sfx'::regclass)
      and (pg_get_constraintdef(oid) like '%(n <= 10)%' or pg_get_constraintdef(oid) like '%(after_n <= 10)%')
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table relay_lines add constraint relay_lines_n_range check (n between 1 and 16);
alter table relay_sfx add constraint relay_sfx_after_n_range check (after_n between 1 and 16);
