/// 앱 전체 설정 — 모든 환경값을 여기 한 곳에서 관리.
/// 빌드 시 --dart-define으로 덮어쓸 수 있어 하드코딩 제거.
///
/// 배포 예:
///   flutter run --dart-define=API_BASE=https://....modal.run \
///               --dart-define=APP_LINK=https://mimic.app
class Config {
  // 서버 URL (배포 후 --dart-define으로 주입, 기본값은 개발용)
  static const String scoreUrl = String.fromEnvironment(
    'SCORE_URL',
    defaultValue: 'https://lenha99--meme-scoring-score.modal.run',
  );
  static const String videoUrl = String.fromEnvironment(
    'VIDEO_URL',
    defaultValue: 'https://lenha99--meme-scoring-make-video.modal.run',
  );
  static const String memesUrl = String.fromEnvironment(
    'MEMES_URL',
    defaultValue: '', // 비면 내장 더미 사용
  );
  // 기준 음성(원본) 스트리밍 엔드포인트 — '원본 듣기'용
  static const String referenceUrl = String.fromEnvironment(
    'REFERENCE_URL',
    defaultValue: 'https://lenha99--meme-scoring-reference.modal.run',
  );
  static String refAudio(String memeId) => '$referenceUrl?meme_id=$memeId';

  // 공유/딥링크
  static const String appLink = String.fromEnvironment(
    'APP_LINK', defaultValue: 'https://mimic.app',
  );
  // 친구 지목 링크 — 실제로 열리는 랜딩 페이지(챌린지 안내 + 앱 받기).
  // 아직 스토어 미출시라 Modal 호스팅 페이지로 연결(친구가 APK 사이드로드 가능).
  static const String challengeBase = String.fromEnvironment(
    'CHALLENGE_URL',
    defaultValue: 'https://lenha99--meme-scoring-challenge.modal.run',
  );
  static String challengeLink(String memeId, {String title = '', int score = 0}) =>
      '$challengeBase?meme_id=$memeId'
      '&title=${Uri.encodeComponent(title)}&score=$score';

  // 운영 플래그
  static const bool analyticsEnabled = bool.fromEnvironment(
    'ANALYTICS', defaultValue: false);
  static const bool verboseLog = bool.fromEnvironment(
    'VERBOSE', defaultValue: true);

  // 무료 사용 제한 (수익화 기반)
  static const int freeDailyPlays = int.fromEnvironment(
    'FREE_PLAYS', defaultValue: 5);
}
