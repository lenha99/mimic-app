import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'theme.dart';
import 'strings.dart';
import 'home_screen.dart';
import 'onboarding_screen.dart';
import 'analytics.dart';
import 'game_state.dart';

void main() {
  // 전역 에러 캡처 — 대기업 기준: 어떤 크래시도 추적되어야 함
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    Log.e('FlutterError', details.exception, details.stack);
  };
  runApp(const MimicApp());
}

class MimicApp extends StatelessWidget {
  const MimicApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MIMIC',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.theme,
      // 국제화 등록 — 기기 언어 자동 적용, 미지원은 영어
      supportedLocales: Strings.supported,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: const _Root(),
    );
  }
}

class _Root extends StatefulWidget {
  const _Root();
  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  bool? _firstRun;
  final _game = GameState();

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final seen = prefs.getBool('onboarded') ?? false;
      if (!seen) await prefs.setBool('onboarded', true);
      await _game.load();
      if (mounted) setState(() => _firstRun = !seen);
    } catch (e, st) {
      Log.e('onboarding check 실패', e, st);
      if (mounted) setState(() => _firstRun = false); // 안전 폴백
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_firstRun == null) {
      return const Scaffold(body: Center(
        child: CircularProgressIndicator(color: AppTheme.volt),),);
    }
    return _firstRun!
        ? OnboardingScreen(game: _game)
        : HomeScreen(game: _game);
  }
}
