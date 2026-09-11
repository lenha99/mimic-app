import 'package:flutter/material.dart';

/// "방송 송출" 컨셉 디자인 토큰
/// 검정 무대 + 형광 옐로우 스포트라이트 + 음파
class AppTheme {
  // 팔레트
  static const Color stage = Color(0xFF0A0A0B);      // 무대 배경(검정)
  static const Color panel = Color(0xFF161618);      // 카드 패널
  static const Color volt = Color(0xFFE8FF3A);       // 형광 옐로우(주역)
  static const Color hotPink = Color(0xFFFF2D78);    // 액센트(점수/하트)
  static const Color cyan = Color(0xFF00E5FF);       // 보조 액센트
  static const Color ash = Color(0xFF8A8A92);        // 보조 텍스트
  static const Color white = Color(0xFFF5F5F7);

  // 등급별 색
  static Color gradeColor(String g) => switch (g) {
        'SS' => volt,
        'S' => cyan,
        'A' => const Color(0xFF7CFF6B),
        'B' => hotPink,
        _ => ash,
      };

  // 카드 글로우 색 (id 해시로 자동 배정)
  static const List<Color> cardGlows = [volt, cyan, hotPink, Color(0xFFA855F7)];

  static const String display = 'Pretendard'; // 두꺼운 표제 (없으면 기본)
  static const String body = 'Pretendard';

  static TextStyle get hero => const TextStyle(
        fontFamily: display, fontSize: 40, fontWeight: FontWeight.w900,
        color: white, height: 1.0, letterSpacing: -1.5,
      );
  static TextStyle get title => const TextStyle(
        fontFamily: display, fontSize: 22, fontWeight: FontWeight.w800,
        color: white, letterSpacing: -0.5,
      );
  static TextStyle get label => const TextStyle(
        fontFamily: body, fontSize: 13, fontWeight: FontWeight.w600,
        color: ash, letterSpacing: 0.2,
      );

  static ThemeData get theme => ThemeData(
        scaffoldBackgroundColor: stage,
        useMaterial3: true,
        colorScheme: const ColorScheme.dark(
          primary: volt, surface: panel, secondary: hotPink,
        ),
        fontFamily: body,
      );
}
