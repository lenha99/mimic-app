-- 표시 점수 곡선 (modal_app.SCORE_CURVE 와 같은 매듭).
-- 새 채점부터 곡선을 거친 점수가 저장된다. 옛 기록을 그대로 두면 랭킹에서
-- 옛 점수가 일제히 밀리니, 이미 저장된 점수도 같은 곡선으로 한 번 옮긴다.
-- 곡선이 순증가라 기존 순위는 바뀌지 않는다.

create or replace function mimic_curve(raw numeric)
returns int
language sql
immutable
as $$
  select round(case
    when r <= 20 then 0  + (30 - 0)  * (r - 0)  / 20
    when r <= 35 then 30 + (55 - 30) * (r - 20) / 15
    when r <= 50 then 55 + (72 - 55) * (r - 35) / 15
    when r <= 65 then 72 + (85 - 72) * (r - 50) / 15
    when r <= 80 then 85 + (94 - 85) * (r - 65) / 15
    else              94 + (100 - 94) * (r - 80) / 20
  end)::int
  from (select greatest(0, least(100, raw)) as r) s
$$;

-- 점수 필드는 채점 서버(service_role)만 바꿀 수 있게 트리거가 막는다.
-- 이 일회성 이관 동안만 끈다.
alter table recordings disable trigger recordings_guard_score;

update recordings set
  score  = mimic_curve(score),
  pitch  = case when pitch is null or pitch = 0 then pitch else mimic_curve(pitch) end,
  tone   = case when tone is null then null else mimic_curve(tone) end,
  timing = case when timing is null then null else mimic_curve(timing) end
where score is not null;

update recordings set grade = case
    when score >= 90 then 'SS' when score >= 80 then 'S'
    when score >= 70 then 'A'  when score >= 55 then 'B' else 'C' end
where score is not null;

alter table recordings enable trigger recordings_guard_score;
