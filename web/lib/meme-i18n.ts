import type { Lang } from "./i18n";
import type { Meme } from "./memes";

/**
 * 영어 화면용 밈 설명 — 제목·출처를 영어로, 대사엔 로마자 읽기와 뜻을 붙인다.
 *
 * 대사 자체는 한국어 그대로다(원본 소리를 따라 하는 거니까). 외국인에게 필요한 건
 * "뭐라고 소리 내야 하는지(roman)"와 "무슨 장면인지(meaning)"다. K-드라마·영화
 * 팬이 이 앱에 들어올 이유가 바로 이 두 줄이다.
 *
 * 레지스트리 밖에 둔 건 번역이 채점·권리 정보와 상관없는 화면 문구라서다.
 * 여기 없는 밈(새로 넣은 것·친구가 만든 것)은 한국어 그대로 보인다.
 */
type MemeEn = { title: string; source: string; roman?: string; meaning?: string };

const EN: Record<string, MemeEn> = {
  muyaho: {
    title: "Muyaho!",
    source: "Infinite Challenge",
    roman: "mu-ya-ho~!",
    meaning: "A grandpa's iconic victory yell — Korea's ultimate “woo-hoo!”",
  },
  eoiga_eopne: {
    title: "You kidding me?",
    source: "Veteran (2015)",
    roman: "eo-i-ga eom-ne",
    meaning: "“I'm speechless.” Yoo Ah-in's smug, disbelieving sneer.",
  },
  mitjang_ppaegi: {
    title: "Freeze!",
    source: "Tazza: The High Rollers",
    roman: "dong-jak geu-man, mit-jang ppae-gi-nya",
    meaning: "“Freeze. Dealing from the bottom?” — catching a card cheat.",
  },
  geoje_yaho: {
    title: "Geoje Yaho!",
    source: "Wonee · Minami (RESCENE)",
    roman: "geo-je! ya-ho!",
    meaning: "A cheerful shout-out to Geoje Island that went viral.",
  },
  bap_meokgo: {
    title: "Are you even eating?",
    source: "Memories of Murder",
    roman: "ba-beun meok-go da-ni-nya",
    meaning: "Song Kang-ho's haunting line to a suspect.",
  },
  galbi_tongdak: {
    title: "Ribs or Fried Chicken?",
    source: "Extreme Job",
    roman: "ji-geum-kka-ji i-reon ma-seun eop-seot-da. i-geo-seun gal-bi-in-ga, tong-dak-in-ga",
    meaning: "“Never tasted anything like this. Is it ribs, or fried chicken?” — the legendary ad line.",
  },
  mohito: {
    title: "Mojito in the Maldives",
    source: "Inside Men",
    roman: "mo-hi-tto ga-seo mol-di-beu-na han jan hal-la-ni-kka",
    meaning: "Lee Byung-hun mixes it up: “Going to Mojito for a Maldives.”",
  },
  choeseon: {
    title: "Is this your best?",
    source: "Secret Garden",
    roman: "i-ge choe-seo-nim-ni-kka? hwak-sil-hae-yo?",
    meaning: "The rich-boss line every Korean has quoted at work.",
  },
  neona_jal: {
    title: "Mind your own business",
    source: "Lady Vengeance",
    roman: "neo-na jal-ha-se-yo",
    meaning: "Lit. “You do well yourself.” Lee Young-ae's ice-cold smile.",
  },
  huryeon: {
    title: "Happy now?!",
    source: "Sunflower (2006)",
    roman: "kkok geu-reo-ke da ga-jyeo-ga-ya-man so-gi hu-ryeon-haen-nya!",
    meaning: "“Did you have to take everything to feel satisfied?!” — a raw, tearful outburst.",
  },
  gyehoek: {
    title: "You've got a plan",
    source: "Parasite",
    roman: "neo-neun gye-hoe-gi da it-gu-na",
    meaning: "Song Kang-ho, proud dad: “You've got it all planned out.”",
  },
  neugeu_seojang: {
    title: "Your police chief…",
    source: "Nameless Gangster",
    roman: "neu-geu seo-jang nam-cheon-dong sal-je?",
    meaning: "“Your police chief lives in Namcheon-dong, right?” — thick Busan-dialect flex.",
  },
  idae: {
    title: "I went to Ewha",
    source: "Tazza: The High Rollers",
    roman: "na i-dae na-on yeo-ja-ya",
    meaning: "“I'm a woman who graduated from Ewha!” — Kim Hye-soo's diva line.",
  },
  sara_itne: {
    title: "Still got it~",
    source: "Nameless Gangster",
    roman: "sa-ra-it-ne~",
    meaning: "Busan slang for “Alive and kicking!” — pure swagger.",
  },
  deuruwa: {
    title: "Bring it on",
    source: "New World",
    roman: "deu-ru-wa",
    meaning: "“Come on in.” Hwang Jung-min, alone in an elevator vs. a gang.",
  },
  rooster: { title: "Cock-a-doodle-doo", source: "Rooster", roman: "kko-kki-o" },
  cat: { title: "Meow", source: "Cat", roman: "ya-o-ong" },
  goat: { title: "Baa", source: "Goat", roman: "me-e-e" },
  wolf: { title: "Awoo", source: "Wolf", roman: "a-u-u" },
  cow: { title: "Moo", source: "Cow", roman: "eum-me-e" },
  dolphin: { title: "Eee-eee", source: "Dolphin", roman: "i-i-ik" },
};

export type MemeText = { title: string; source: string; roman?: string; meaning?: string };

/** 화면에 찍을 제목·출처. 영어면 번역이 있을 때만 바꾼다. */
export function memeText(meme: Pick<Meme, "id" | "title" | "source">, lang: Lang): MemeText {
  const en = lang === "en" ? EN[meme.id] : undefined;
  if (!en) return { title: meme.title, source: meme.source };
  return en;
}
