import 'package:flutter/material.dart';
import 'theme.dart';
import 'l10n.dart';
import 'game_state.dart';
import 'home_screen.dart';

/// 첫 실행 시 3초 안에 "뭐 하는 앱인지" 전달. 전 문자열 현지화.
class OnboardingScreen extends StatelessWidget {
  final GameState game;
  const OnboardingScreen({super.key, required this.game});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(children: [
        Positioned(top: -40, right: -40, child: _blob(AppTheme.cyan, 180)),
        Positioned(bottom: 120, left: -50, child: _blob(AppTheme.hotPink, 160)),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const _FloatingMic(),
                const SizedBox(height: 24),
                RichText(
                  textAlign: TextAlign.center,
                  text: TextSpan(
                    style: AppTheme.hero.copyWith(fontSize: 30, height: 1.15),
                    children: [
                      TextSpan(text: context.s('onboard_title')),
                      TextSpan(text: context.s('onboard_title_accent'),
                        style: const TextStyle(color: AppTheme.volt)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Text(context.s('onboard_sub'),
                  textAlign: TextAlign.center,
                  style: AppTheme.label.copyWith(fontSize: 14, height: 1.5)),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  child: Semantics(
                    button: true,
                    label: context.s('onboard_cta'),
                    child: ElevatedButton(
                      onPressed: () => Navigator.pushReplacement(context,
                        MaterialPageRoute(builder: (_) => HomeScreen(game: game))),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.volt,
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30))),
                      child: Text(context.s('onboard_cta'),
                        style: const TextStyle(color: Colors.black,
                          fontWeight: FontWeight.w800, fontSize: 17)),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(context.s('onboard_time'),
                  style: AppTheme.label.copyWith(fontSize: 12)),
              ],
            ),
          ),
        ),
      ]),
    );
  }

  Widget _blob(Color c, double size) => Container(
    width: size, height: size,
    decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: [
      BoxShadow(color: c.withOpacity(0.35), blurRadius: 70, spreadRadius: 20)]),
  );
}

class _FloatingMic extends StatefulWidget {
  const _FloatingMic();
  @override
  State<_FloatingMic> createState() => _FloatingMicState();
}

class _FloatingMicState extends State<_FloatingMic>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this, duration: const Duration(seconds: 3))..repeat(reverse: true);
  }
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    builder: (_, child) => Transform.translate(
      offset: Offset(0, -10 * _c.value), child: child),
    child: const Text('🎙', style: TextStyle(fontSize: 72)),
  );
}
