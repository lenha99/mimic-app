-- mimic-app/memes.json 의 기존 밈 목록 그대로 이식 (동물 사운드팩).
insert into memes (id, title, source, emoji) values
  ('rooster', '꼬끼오', '수탉', '🐓'),
  ('cat', '야오옹', '고양이', '🐱'),
  ('goat', '메에에', '염소', '🐐'),
  ('wolf', '아우우', '늑대', '🐺'),
  ('cow', '음메에', '소', '🐄'),
  ('dolphin', '이이익', '돌고래', '🐬')
on conflict (id) do nothing;
