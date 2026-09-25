-- 이슈 #23: "클라이언트 점수만 사용하면 안 된다" — 랭킹이 있는 이상 점수 위변조를 막아야 한다.
-- 브라우저(anon/authenticated 키)는 점수 없는 "초안" 행만 만들 수 있고,
-- 실제 score/grade/pitch/tone/timing은 서버(service_role, /api/publish-recording)만 채울 수 있다.

drop policy "users and guests can insert recordings" on recordings;

create policy "users and guests can insert draft recordings"
  on recordings for insert
  with check (
    (auth.uid() = user_id or user_id is null)
    and score is null and grade is null and pitch is null and tone is null and timing is null
  );

-- UPDATE는 RLS의 using/with check만으로는 "이 컬럼만 못 바꾸게" 할 수 없어서 트리거로 막는다.
-- service_role은 RLS를 우회하지만 트리거는 여전히 실행되므로, 역할(role) 자체를 검사한다.
create or replace function guard_recording_score_update()
returns trigger as $$
begin
  if (new.score is distinct from old.score
      or new.grade is distinct from old.grade
      or new.pitch is distinct from old.pitch
      or new.tone is distinct from old.tone
      or new.timing is distinct from old.timing)
     and auth.role() <> 'service_role' then
    raise exception 'score fields can only be set by the scoring service';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger recordings_guard_score
  before update on recordings
  for each row execute function guard_recording_score_update();
