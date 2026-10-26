import type { Lang } from "./i18n";

/**
 * 연습실 대본의 영어 제목·분야. 대본 본문은 한국어 그대로다 — 한국어로 소리 내 읽는
 * 연습이라 번역하면 의미가 없다. 영어 화면에선 "무슨 장면인지"만 알 수 있으면 된다.
 * 여기 없는 대본(내가 넣은 대본 등)은 한국어 제목 그대로 보인다.
 */
const TITLE_EN: Record<string, string> = {
  sc_v_apology: "A Late Apology",
  sc_v_rage: "Rage, Held Back… Then Not",
  sc_v_farewell: "Goodbye at the Station",
  sc_v_joy: "I Got In!",
  sc_v_fear: "A Sound in the Dark",
  sc_v_confess: "Right Before Confessing",
  sc_v_grief: "In the Empty Room",
  sc_v_sarcasm: "Sarcastic “Compliment”",
  sc_v_boy: "A Boy Sets Off on an Adventure",
  sc_v_elder: "The Village Elder",
  sc_v_villain: "The Unbothered Villain",
  sc_v_robot: "A Robot Learning to Feel",
  sc_v_noble: "The Fallen Noble Lady",
  sc_v_mascot: "Theme Park Mascot",
  sc_v_docu_sea: "Documentary · The Deep Sea",
  sc_v_docu_city: "Documentary · City at Dawn",
  sc_v_trailer: "Movie Trailer",
  sc_v_audiobook: "Audiobook · Opening Paragraph",
  sc_v_ad_coffee: "Coffee Commercial",
  sc_v_ad_sale: "Supermarket Sale Announcement",
  sc_v_ad_bank: "Bank · Trust Commercial",
  sc_v_ad_game: "Mobile Game Ad",
  sc_v_game_npc: "Innkeeper NPC",
  sc_v_game_boss: "Final Boss Appears",
  sc_a_news_open: "News Opening",
  sc_a_news_economy: "Economy News",
  sc_a_news_accident: "Incident Report",
  sc_a_news_culture: "Culture News",
  sc_a_news_close: "News Closing",
  sc_a_news_breaking: "Breaking News",
  sc_a_weather: "Morning Weather",
  sc_a_weather_storm: "Typhoon Forecast",
  sc_a_sports_goal: "Soccer Goal Call",
  sc_a_sports_baseball: "Baseball Walk-off",
  sc_a_radio_night: "Late-night Radio Opening",
  sc_a_radio_morning: "Morning Commute Radio",
  sc_a_diction_1: "Diction Drill · Final Consonants",
  sc_a_diction_2: "Diction Drill · Diphthongs",
  sc_a_read_letter: "Reading a Letter",
  sc_a_read_essay: "Essay Reading · First Snow",
};

const FIELD_EN: Record<string, string> = {
  "감정 연기": "Emotional acting",
  게임: "Game",
  광고: "Commercial",
  날씨: "Weather",
  낭독: "Reading aloud",
  내레이션: "Narration",
  뉴스: "News",
  라디오: "Radio",
  발음: "Diction",
  스포츠: "Sports",
  "스포츠 중계": "Sports call",
  캐릭터: "Character",
};

export function scriptTitle(id: string, ko: string, lang: Lang): string {
  return lang === "en" ? (TITLE_EN[id] ?? ko) : ko;
}

export function fieldName(ko: string, lang: Lang): string {
  return lang === "en" ? (FIELD_EN[ko] ?? ko) : ko;
}
