import 'package:flutter/material.dart';
import 'dart:math';
import 'theme.dart';

/// 콤보 배지 — 점수 위에 떠서 변동 보상감을 줌.
class ComboBadge extends StatelessWidget {
  final int combo;
  const ComboBadge({super.key, required this.combo});
  @override
  Widget build(BuildContext context) {
    if (combo < 2) return const SizedBox.shrink();
    final hot = combo >= 5;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: hot
          ? [AppTheme.hotPink, const Color(0xFFFF8A00)]
          : [AppTheme.volt, AppTheme.cyan],),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(
          color: (hot ? AppTheme.hotPink : AppTheme.volt).withValues(alpha: 0.5),
          blurRadius: 20,),],
      ),
      child: Text('${hot ? "🔥" : "⚡️"} COMBO x$combo',
        style: const TextStyle(color: Colors.black,
          fontWeight: FontWeight.w900, fontSize: 15,),),
    );
  }
}

/// 마일스톤 배너 — 3/5/10 콤보 등 달성 시 큰 연출.
class MilestoneBanner extends StatefulWidget {
  final String text;
  const MilestoneBanner({super.key, required this.text});
  @override
  State<MilestoneBanner> createState() => _MilestoneBannerState();
}

class _MilestoneBannerState extends State<MilestoneBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 600),)..forward();
  }
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: CurvedAnimation(parent: _c, curve: Curves.elasticOut),
      child: Text(widget.text, style: const TextStyle(
        fontSize: 26, fontWeight: FontWeight.w900, color: AppTheme.volt,
        shadows: [Shadow(color: AppTheme.hotPink, blurRadius: 20)],),),
    );
  }
}

/// 일일 스트릭 칩.
class StreakChip extends StatelessWidget {
  final int days;
  const StreakChip({super.key, required this.days});
  @override
  Widget build(BuildContext context) {
    if (days < 1) return const SizedBox.shrink();
    return Row(mainAxisSize: MainAxisSize.min, children: [
      const Text('🔥', style: TextStyle(fontSize: 16)),
      const SizedBox(width: 4),
      Text('$days일 연속', style: AppTheme.label.copyWith(
        color: AppTheme.volt, fontWeight: FontWeight.w800,),),
    ],);
  }
}

/// 고득점 시 터지는 파티클(색종이). 즉각 보상의 핵심 쾌감.
class ConfettiBurst extends StatefulWidget {
  final bool active;
  const ConfettiBurst({super.key, required this.active});
  @override
  State<ConfettiBurst> createState() => _ConfettiBurstState();
}

class _ConfettiBurstState extends State<ConfettiBurst>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  final _rng = Random();
  late List<_Particle> _ps;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 1400),);
    _ps = List.generate(40, (_) => _Particle(_rng));
    if (widget.active) _c.forward();
  }

  @override
  void didUpdateWidget(ConfettiBurst old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) { _c.forward(from: 0); }
  }

  @override
  void dispose() { _c.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) return const SizedBox.shrink();
    return IgnorePointer(child: AnimatedBuilder(
      animation: _c,
      builder: (_, __) => CustomPaint(
        size: Size.infinite,
        painter: _ConfettiPainter(_ps, _c.value),),
    ),);
  }
}

class _Particle {
  final double angle, speed, size;
  final Color color;
  _Particle(Random r)
      : angle = r.nextDouble() * 2 * pi,
        speed = 150 + r.nextDouble() * 250,
        size = 5 + r.nextDouble() * 7,
        color = [AppTheme.volt, AppTheme.cyan, AppTheme.hotPink,
                 const Color(0xFFA855F7),][r.nextInt(4)];
}

class _ConfettiPainter extends CustomPainter {
  final List<_Particle> ps;
  final double t;
  _ConfettiPainter(this.ps, this.t);
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2, cy = size.height * 0.35;
    final p = Paint();
    for (final particle in ps) {
      final dist = particle.speed * t;
      final x = cx + cos(particle.angle) * dist;
      final y = cy + sin(particle.angle) * dist + 200 * t * t; // 중력
      p.color = particle.color.withValues(alpha: (1 - t).clamp(0, 1));
      canvas.drawCircle(Offset(x, y), particle.size * (1 - t * 0.5), p);
    }
  }
  @override
  bool shouldRepaint(_ConfettiPainter old) => old.t != t;
}
