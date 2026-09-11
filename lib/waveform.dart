import 'package:flutter/material.dart';
import 'dart:math';
import 'theme.dart';

/// 정적 파형 비교 막대 — 실제 진폭 데이터(0..1)를 위아래 대칭으로 그림.
/// 결과 화면의 '원본 vs 나' 비교에 사용.
class WaveBars extends StatelessWidget {
  final List<double> bars;
  final Color color;
  final double height;
  const WaveBars({
    super.key, required this.bars, required this.color, this.height = 46,
  });

  @override
  Widget build(BuildContext context) {
    if (bars.isEmpty) {
      return SizedBox(height: height);
    }
    return SizedBox(
      height: height,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          for (final v in bars)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 0.6),
                child: Container(
                  height: (height * v).clamp(2.0, height),
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 음파 막대 비주얼 — 이 앱의 시그니처.
/// 녹음 중엔 출렁이고, 정지 시엔 잔잔하게.
class Waveform extends StatefulWidget {
  final bool active;
  final Color color;
  final double height;
  const Waveform({
    super.key, required this.active,
    this.color = AppTheme.volt, this.height = 80,
  });

  @override
  State<Waveform> createState() => _WaveformState();
}

class _WaveformState extends State<Waveform>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  final _rng = Random();
  final int bars = 40;
  late List<double> _seed;

  @override
  void initState() {
    super.initState();
    _seed = List.generate(bars, (_) => _rng.nextDouble());
    _c = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 성능: 음파 애니메이션을 별도 레이어로 격리해 부모 리페인트 차단
    return RepaintBoundary(
      child: SizedBox(
        height: widget.height,
        child: AnimatedBuilder(
          animation: _c,
          builder: (_, __) => Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: List.generate(bars, (i) {
            final base = _seed[i];
            final amp = widget.active
                ? (0.2 + base * 0.8) *
                    (0.5 + 0.5 * sin(_c.value * pi * 2 + i * 0.5)).abs()
                : 0.12 + base * 0.10;
            return Container(
              width: 3,
              height: widget.height * amp.clamp(0.06, 1.0),
              decoration: BoxDecoration(
                color: widget.color.withValues(alpha: widget.active ? 1 : 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            );
          }),
        ),
      ),
      ),
    );
  }
}
