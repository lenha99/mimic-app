import 'package:flutter/material.dart';
import 'theme.dart';
import 'data.dart';
import 'l10n.dart';
import 'analytics.dart';
import 'game_state.dart';
import 'record_screen.dart';

class HomeScreen extends StatefulWidget {
  final GameState game;
  const HomeScreen({super.key, required this.game});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<Meme>> _memesFuture;

  @override
  void initState() {
    super.initState();
    _memesFuture = Api.memes();
    Api.warmScore(); // 채점 서버 미리 깨우기 — 녹음 끝나면 이미 따뜻하도록
  }

  void _reload() => setState(() => _memesFuture = Api.memes());

  static String _fmt(int n) =>
      n >= 10000 ? '${(n / 10000).toStringAsFixed(1)}만' : '$n';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: FutureBuilder<List<Meme>>(
          future: _memesFuture,
          builder: (ctx, snap) {
            // 로딩 상태
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(
                child: CircularProgressIndicator(color: AppTheme.volt));
            }
            // 에러 상태 (재시도 가능)
            if (snap.hasError) {
              return _ErrorState(onRetry: _reload);
            }
            final memes = snap.data ?? const [];
            // 빈 상태
            if (memes.isEmpty) return const _EmptyState();
            // 정상
            return _HomeContent(memes: memes, fmt: _fmt, game: widget.game);
          },
        ),
      ),
    );
  }
}

class _HomeContent extends StatelessWidget {
  final List<Meme> memes;
  final String Function(int) fmt;
  final GameState game;
  const _HomeContent({required this.memes, required this.fmt, required this.game});

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Text('🎙', style: TextStyle(fontSize: 28)),
                  const SizedBox(width: 8),
                  ShaderMask(
                    shaderCallback: (b) => const LinearGradient(
                      colors: [AppTheme.volt, AppTheme.cyan]).createShader(b),
                    child: Text('MIMIC', style: AppTheme.hero.copyWith(
                      fontSize: 28, color: Colors.white)),
                  ),
                ]),
                const SizedBox(height: 14),
                RichText(text: TextSpan(
                  style: AppTheme.hero,
                  children: [
                    TextSpan(text: context.s('home_hero')),
                    TextSpan(text: context.s('home_hero_accent'),
                      style: const TextStyle(color: AppTheme.volt)),
                    const TextSpan(text: ' '),
                  ],
                )),
                const SizedBox(height: 6),
                Text(context.s('home_sub'), style: AppTheme.label),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(child: _ChallengeBanner(featured: memes.first)),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2, mainAxisSpacing: 14,
              crossAxisSpacing: 14, childAspectRatio: 0.82),
            delegate: SliverChildBuilderDelegate(
              (ctx, i) => _MemeCard(meme: memes[i], fmt: fmt, game: game),
              childCount: memes.length),
          ),
        ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Text('😵', style: TextStyle(fontSize: 48)),
      const SizedBox(height: 12),
      Text(context.s('err_network'), style: AppTheme.label),
      const SizedBox(height: 16),
      OutlinedButton(onPressed: onRetry,
        child: Text(context.s('result_retry'),
          style: const TextStyle(color: AppTheme.volt))),
    ]),
  );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();
  @override
  Widget build(BuildContext context) => const Center(
    child: Text('🎙', style: TextStyle(fontSize: 56)));
}

class _ChallengeBanner extends StatelessWidget {
  final Meme featured;
  const _ChallengeBanner({required this.featured});
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(24, 12, 24, 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.hotPink, Color(0xFFA855F7)],
          begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(
          color: AppTheme.hotPink.withOpacity(0.35),
          blurRadius: 30, offset: const Offset(0, 10))],
      ),
      child: Row(children: [
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(color: Colors.white,
                borderRadius: BorderRadius.circular(8)),
              child: const Text('● LIVE', style: TextStyle(
                color: AppTheme.hotPink, fontSize: 9, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(height: 6),
            Text('${featured.title} ${featured.emoji}',
              style: AppTheme.title.copyWith(fontSize: 19)),
            const SizedBox(height: 2),
            Text(context.s('challenge_desc'),
              style: AppTheme.label.copyWith(color: Colors.white70)),
          ],
        )),
        const Text('🏆', style: TextStyle(fontSize: 38)),
      ]),
    );
  }
}

class _MemeCard extends StatelessWidget {
  final Meme meme;
  final String Function(int) fmt;
  final GameState game;
  const _MemeCard({required this.meme, required this.fmt, required this.game});

  @override
  Widget build(BuildContext context) {
    final glow = AppTheme.cardGlows[meme.colorIndex];
    return Semantics(
      button: true,
      label: '${meme.title}, ${meme.source}, '
             '${fmt(meme.plays)}${context.s('plays_suffix')}',
      child: GestureDetector(
        onTap: () {
          Analytics.memeOpened(meme.id);
          Navigator.push(context, MaterialPageRoute(
            builder: (_) => RecordScreen(meme: meme, game: game)));
        },
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.04),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withOpacity(0.08))),
          clipBehavior: Clip.antiAlias,
          child: Stack(children: [
            Positioned(top: -20, right: -20, child: Container(
              width: 80, height: 80,
              decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: [
                BoxShadow(color: glow.withOpacity(0.5),
                  blurRadius: 30, spreadRadius: 10)]))),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(meme.emoji, style: const TextStyle(fontSize: 34)),
                  const Spacer(),
                  Text(meme.title, style: AppTheme.title.copyWith(fontSize: 18)),
                  const SizedBox(height: 2),
                  Text(meme.source, style: AppTheme.label.copyWith(fontSize: 11)),
                  const SizedBox(height: 8),
                  Row(children: [
                    Icon(Icons.mic, size: 13, color: glow),
                    const SizedBox(width: 3),
                    Flexible(child: Text(
                      '${fmt(meme.plays)}${context.s('plays_suffix')}',
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.label.copyWith(color: glow,
                        fontSize: 11, fontWeight: FontWeight.w700))),
                  ]),
                ],
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
