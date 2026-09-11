import 'dart:ui';

/// 국제화(i18n). 글로벌 타깃이므로 모든 UI 문자열을 여기로 분리.
/// 기기 언어에 맞춰 자동 선택, 미지원 언어는 영어 폴백.
/// 대기업 기준: UI에 하드코딩된 문자열이 없어야 함.
class Strings {
  final Map<String, String> _m;
  Strings(this._m);

  String get(String key) => _m[key] ?? _en[key] ?? key;

  static Strings of(Locale locale) {
    switch (locale.languageCode) {
      case 'ko': return Strings(_ko);
      case 'ja': return Strings(_ja);
      default:   return Strings(_en);
    }
  }

  static const supported = [Locale('en'), Locale('ko'), Locale('ja')];

  static const _en = {
    'onboard_title': 'Shout the meme,\nget your ',
    'onboard_title_accent': 'score',
    'onboard_sub': 'From a rooster\'s crow to a wolf\'s howl —\nmimic the animal, get graded, flex to friends',
    'onboard_cta': 'Get started',
    'onboard_time': 'Takes 3 seconds',
    'home_hero': 'Mimic it,\nget ',
    'home_hero_accent': 'scored',
    'home_sub': 'Pick a meme → shout it → get your grade',
    'challenge_weekly': 'WEEKLY CHALLENGE',
    'challenge_desc': 'Top video featured on home',
    'plays_suffix': ' tried',
    'rec_play_original': 'Play original',
    'rec_hint': 'Tap and shout it!',
    'rec_again_hint': 'Tap again to score',
    'rec_scoring': 'Scoring...',
    'rec_mic_denied': 'Microphone access needed. Enable it in settings.',
    'result_share': 'Share as video',
    'result_making': 'Making video...',
    'result_challenge': 'Challenge a friend',
    'result_retry': 'Try again',
    'err_network': 'Network is unstable. Please try again.',
    'err_video': 'Failed to make video. Please try again.',
    'stat_pitch': 'Pitch', 'stat_tone': 'Tone', 'stat_timing': 'Timing',
    'combo_broken': 'Combo broken! Try again',
    'streak_suffix': ' day streak',
    'best_combo': 'Best combo',
    'retry_cta': 'One more!',
  };
  static const _ko = {
    'onboard_title': '밈을 외치면\n',
    'onboard_title_accent': '점수',
    'onboard_sub': '수탉 꼬끼오부터 늑대 하울링까지\n동물 소리 따라 외치고 등급 받아 자랑하기',
    'onboard_cta': '시작하기',
    'onboard_time': '3초면 끝나요',
    'home_hero': '따라하면\n',
    'home_hero_accent': '점수',
    'home_sub': '밈 고르고 → 따라 외치고 → 등급 받기',
    'challenge_weekly': '이번 주 챌린지',
    'challenge_desc': '1등 영상 메인 노출',
    'plays_suffix': '명 도전',
    'rec_play_original': '원본 듣기',
    'rec_hint': '버튼을 누르고 따라 외쳐!',
    'rec_again_hint': '다시 누르면 채점',
    'rec_scoring': '채점 중...',
    'rec_mic_denied': '마이크 권한이 필요해. 설정에서 허용해줘.',
    'result_share': '영상으로 공유하기',
    'result_making': '영상 만드는 중...',
    'result_challenge': '친구 지목하기',
    'result_retry': '다시 도전',
    'err_network': '네트워크가 불안정해. 잠시 후 다시 시도해줘.',
    'err_video': '영상 만들기에 실패했어. 다시 시도해줘.',
    'stat_pitch': '억양', 'stat_tone': '음색', 'stat_timing': '타이밍',
    'combo_broken': '콤보 끊김! 다시 도전',
    'streak_suffix': '일 연속',
    'best_combo': '최고 콤보',
    'retry_cta': '한 번 더!',
  };
  static const _ja = {
    'onboard_title': 'ミームを叫べば\n',
    'onboard_title_accent': 'スコア',
    'onboard_sub': 'ニワトリの鳴き声からオオカミの遠吠えまで\n動物の声を真似して採点、友達に自慢しよう',
    'onboard_cta': 'はじめる',
    'onboard_time': '3秒で終わる',
    'home_hero': '真似して\n',
    'home_hero_accent': 'スコア',
    'home_sub': 'ミームを選んで → 叫んで → 採点',
    'challenge_weekly': '今週のチャレンジ',
    'challenge_desc': '1位の動画をホームに掲載',
    'plays_suffix': '人挑戦',
    'rec_play_original': 'オリジナルを聞く',
    'rec_hint': 'ボタンを押して真似しよう！',
    'rec_again_hint': 'もう一度押すと採点',
    'rec_scoring': '採点中...',
    'rec_mic_denied': 'マイクの許可が必要です。設定で許可してください。',
    'result_share': '動画でシェア',
    'result_making': '動画作成中...',
    'result_challenge': '友達を指名',
    'result_retry': 'もう一度',
    'err_network': 'ネットワークが不安定です。後でもう一度お試しください。',
    'err_video': '動画作成に失敗しました。もう一度お試しください。',
    'stat_pitch': '抑揚', 'stat_tone': '音色', 'stat_timing': 'タイミング',
    'combo_broken': 'コンボ途切れ！もう一度',
    'streak_suffix': '日連続',
    'best_combo': '最高コンボ',
    'retry_cta': 'もう一回！',
  };
}
