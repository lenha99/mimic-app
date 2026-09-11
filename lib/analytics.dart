import 'package:flutter/foundation.dart';
import 'config.dart';

/// 로깅 + 분석 이벤트를 한 곳에서.
/// 지금은 콘솔 출력. 나중에 Firebase/Amplitude를 _sink만 교체하면 연결됨.
/// 하드코딩된 print를 앱 전체에 흩뿌리지 않기 위한 단일 창구.
class Log {
  static void d(String msg) {
    if (Config.verboseLog && kDebugMode) debugPrint('🟡 $msg');
  }

  static void e(String msg, [Object? err, StackTrace? st]) {
    debugPrint('🔴 ERROR: $msg ${err ?? ''}');
    if (st != null) debugPrint(st.toString());
    // TODO(배포): Sentry.captureException(err, stackTrace: st);
  }
}

/// 분석 이벤트 — 바이럴/리텐션 측정의 근거.
/// 어떤 밈이 인기인지, 어디서 이탈하는지 데이터로 보려면 필수.
class Analytics {
  static void track(String event, [Map<String, Object?>? props]) {
    if (!Config.analyticsEnabled) {
      Log.d('analytics: $event ${props ?? ''}');
      return;
    }
    // TODO(배포): 실제 분석 SDK 호출 (Firebase logEvent 등)
  }

  // 핵심 퍼널 이벤트 (이름 고정 → 대시보드 일관성)
  static void memeOpened(String id) => track('meme_opened', {'meme': id});
  static void recordStarted(String id) => track('record_started', {'meme': id});
  static void scored(String id, int score, String grade) =>
      track('scored', {'meme': id, 'score': score, 'grade': grade});
  static void shared(String id, String type) =>
      track('shared', {'meme': id, 'type': type}); // type: video|challenge
  static void retried(String id) => track('retried', {'meme': id});
}
