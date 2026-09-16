-- mimic-app/web(Dev B)의 Meme 타입에 이미 있는 plays(도전 횟수) 필드를 맞춘다.
-- 기존 web/lib/memes.ts의 FALLBACK 데이터와 동일한 값으로 채워서 이전 시 숫자가 안 튀게 한다.
alter table memes add column plays int not null default 0;

update memes set plays = 128400 where id = 'rooster';
update memes set plays = 96300  where id = 'cat';
update memes set plays = 81200  where id = 'goat';
update memes set plays = 67400  where id = 'wolf';
update memes set plays = 54100  where id = 'cow';
update memes set plays = 41900  where id = 'dolphin';
