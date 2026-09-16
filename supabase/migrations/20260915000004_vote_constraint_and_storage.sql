-- 같은 사람(로그인 유저 또는 anon_id)이 같은 매치업에 중복 투표 못하게.
-- recording_a/b 순서가 뒤바뀌어 들어와도 막기 위해 정렬된 조합에 유니크 인덱스를 건다.
create unique index votes_one_per_matchup
  on votes (
    meme_id,
    least(recording_a_id, recording_b_id),
    greatest(recording_a_id, recording_b_id),
    coalesce(voter_id::text, anon_id)
  );

-- 녹음 파일 저장용 버킷. 링크로 퍼지는 게 목적인 콘텐츠라 public으로 둔다.
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', true)
on conflict (id) do nothing;

-- 본인 폴더(uid/...)에만 업로드 · 수정 · 삭제 가능. 읽기는 public 버킷이라 RLS 없이 허용됨.
create policy "users can upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can update their own recordings"
  on storage.objects for update using (
    bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own recordings"
  on storage.objects for delete using (
    bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text
  );
