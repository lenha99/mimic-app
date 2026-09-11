import 'dart:io';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'theme.dart';
import 'data.dart';
import 'config.dart';
import 'l10n.dart';
import 'analytics.dart';
import 'game_state.dart';
import 'rewards.dart';
import 'waveform.dart';

class ResultScreen extends StatefulWidget {
  final Meme meme;
  final ScoreResult result;
  final File recording;
  final GameState game;
  const ResultScreen({super.key, required this.meme, required this.result,
    required this.recording, required this.game});

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _pop;
  bool _making = false;
  RewardEvent? _reward;
  bool _confetti = false;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 700))..forward();
    _pop = CurvedAnimation(parent: _c, curve: Curves.elasticOut);
    _applyReward();
  }

  Future<void> _applyReward() async {
    final ev = await widget.game.applyScore(widget.result.score);
    if (!mounted) return;
    setState(() {
      _reward = ev;
      _confetti = widget.result.score >= 78; // S 이상이면 컨페티
    });
  }

  @override
  void dispose() { _c.dispose(); super.dispose(); }

  Future<void> _share() async {
    setState(() => _making = true);
    Analytics.shared(widget.meme.id, 'video');
    try {
      final video = await Api.makeVideo(
        memeId: widget.meme.id, title: widget.meme.title,
        source: widget.meme.source,
        score: widget.result.score, grade: widget.result.grade,
        rec: widget.recording);
      await Share.shareXFiles([XFile(video.path)],
        text: '나 ${widget.meme.title} ${widget.result.grade} '
              '${widget.result.score}점 🎙 너도 도전해봐!');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.s('err_video'))));
      }
    } finally {
      if (mounted) setState(() => _making = false);
    }
  }

  void _challengeFriend() {
    Analytics.shared(widget.meme.id, 'challenge');
    Share.share(
      '🎙 ${widget.meme.title} 따라하기 챌린지!\n'
      '내 점수 ${widget.result.score}점(${widget.result.grade}) 넘어봐 😎\n'
      '👉 ${Config.challengeLink(widget.meme.id, title: widget.meme.title, score: widget.result.score)}');
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.result;
    final gc = AppTheme.gradeColor(r.grade);
    final ev = _reward;
    return Scaffold(
      body: Stack(children: [
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(children: [
              const Spacer(flex: 1),
              // 스트릭 + 콤보 상단 표시
              if (ev != null) Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  StreakChip(days: ev.dailyStreak),
                  if (ev.dailyStreak >= 1 && ev.combo >= 2)
                    const SizedBox(width: 12),
                  ComboBadge(combo: ev.combo),
                ],
              ),
              const SizedBox(height: 10),
              Text('${widget.meme.title} 따라하기', style: AppTheme.label),
              const SizedBox(height: 18),
              // 마일스톤
              if (ev?.milestone != null) ...[
                MilestoneBanner(text: ev!.milestone!),
                const SizedBox(height: 12),
              ],
              // 닮음 % — 공유 욕구 핵심 카피
              _SimilarityDisplay(
                score: r.score, source: widget.meme.source),
              const SizedBox(height: 14),
              // 등급
              ScaleTransition(scale: _pop, child: Column(children: [
                Container(
                  width: 170, height: 170,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: gc, width: 5),
                    boxShadow: [BoxShadow(color: gc.withOpacity(0.4),
                      blurRadius: 50, spreadRadius: 4)]),
                  alignment: Alignment.center,
                  child: Text(r.grade, style: TextStyle(fontSize: 76,
                    fontWeight: FontWeight.w900, color: gc, height: 1)),
                ),
                const SizedBox(height: 18),
                Text('${r.score}점', style: AppTheme.hero.copyWith(
                  fontSize: 50, color: AppTheme.white)),
              ])),
              const SizedBox(height: 14),
              // 콤보 끊김 안내(손실 회피)
              if (ev?.comboBroken == true)
                Text(context.s('combo_broken'),
                  style: AppTheme.label.copyWith(color: AppTheme.hotPink)),
              const SizedBox(height: 18),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                _Stat(label: context.s('stat_pitch'), value: r.pitch, color: AppTheme.volt),
                const SizedBox(width: 14),
                _Stat(label: context.s('stat_tone'), value: r.tone, color: AppTheme.cyan),
                const SizedBox(width: 14),
                _Stat(label: context.s('stat_timing'), value: r.timing, color: AppTheme.hotPink),
              ]),
              if (r.refWave.isNotEmpty || r.userWave.isNotEmpty) ...[
                const SizedBox(height: 20),
                _WaveCompare(result: r),
              ],
              const Spacer(flex: 2),
              SizedBox(width: double.infinity, child: ElevatedButton.icon(
                onPressed: _making ? null : _share,
                icon: _making
                  ? const SizedBox(width: 18, height: 18,
                      child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
                  : const Icon(Icons.ios_share, color: Colors.black),
                label: Text(_making ? context.s('result_making') : context.s('result_share'),
                  style: const TextStyle(color: Colors.black,
                    fontWeight: FontWeight.w800, fontSize: 16)),
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.volt,
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
              )),
              const SizedBox(height: 10),
              SizedBox(width: double.infinity, child: OutlinedButton.icon(
                onPressed: _challengeFriend,
                icon: const Icon(Icons.bolt, color: AppTheme.hotPink),
                label: Text(context.s('result_challenge'),
                  style: const TextStyle(color: AppTheme.hotPink,
                    fontWeight: FontWeight.w800, fontSize: 16)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppTheme.hotPink, width: 1.5),
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
              )),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () { Analytics.retried(widget.meme.id); Navigator.pop(context); },
                child: Text(
                  // 콤보 살아있으면 "한 번 더!"로 도전 욕구 자극
                  (ev?.combo ?? 0) >= 1 ? context.s('retry_cta') : context.s('result_retry'),
                  style: AppTheme.label.copyWith(
                    color: (ev?.combo ?? 0) >= 1 ? AppTheme.volt : AppTheme.white,
                    fontWeight: FontWeight.w700)),
              ),
              const Spacer(flex: 1),
            ]),
          ),
        ),
        // 컨페티는 최상단
        Positioned.fill(child: ConfettiBurst(active: _confetti)),
      ]),
    );
  }
}

class _SimilarityDisplay extends StatelessWidget {
  final int score;
  final String source;
  const _SimilarityDisplay({required this.score, required this.source});

  int get _pct => (30 + score * 0.70).round();

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text('${context.s('similarity_label')} $source',
        style: AppTheme.label),
      const SizedBox(height: 4),
      ShaderMask(
        shaderCallback: (b) => const LinearGradient(
          colors: [AppTheme.volt, AppTheme.cyan]).createShader(b),
        child: Text('$_pct${context.s('similarity')}',
          style: const TextStyle(fontSize: 52, fontWeight: FontWeight.w900,
            color: Colors.white, height: 1)),
      ),
    ]);
  }
}

/// 원본 vs 나 파형 비교 — 채점 직후 결과 화면에서 바로 확인 (공유 영상과 동일 비주얼).
class _WaveCompare extends StatelessWidget {
  final ScoreResult result;
  const _WaveCompare({required this.result});

  Widget _row(String label, List<double> bars, Color color) {
    return Row(children: [
      SizedBox(width: 36, child: Text(label,
        style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 13))),
      const SizedBox(width: 8),
      Expanded(child: WaveBars(bars: bars, color: color, height: 42)),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(children: [
        _row('원본', result.refWave, AppTheme.volt),
        const SizedBox(height: 12),
        _row('나', result.userWave, AppTheme.hotPink),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  const _Stat({required this.label, required this.value, required this.color});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.08))),
      child: Column(children: [
        Text('$value', style: TextStyle(fontSize: 22,
          fontWeight: FontWeight.w900, color: color)),
        const SizedBox(height: 2),
        Text(label, style: AppTheme.label.copyWith(fontSize: 11)),
      ]),
    );
  }
}
