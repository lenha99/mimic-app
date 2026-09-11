import 'package:flutter/material.dart';
import 'package:record/record.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import 'theme.dart';
import 'data.dart';
import 'config.dart';
import 'analytics.dart';
import 'waveform.dart';
import 'l10n.dart';
import 'game_state.dart';
import 'result_screen.dart';

class RecordScreen extends StatefulWidget {
  final Meme meme;
  final GameState game;
  const RecordScreen({super.key, required this.meme, required this.game});

  @override
  State<RecordScreen> createState() => _RecordScreenState();
}

class _RecordScreenState extends State<RecordScreen> {
  final _recorder = AudioRecorder();
  final _player = AudioPlayer();
  bool _recording = false;
  bool _scoring = false;
  

  Future<void> _playReference() async {
    // refUrl이 있으면 그걸, 없으면 서버 기준 음성 엔드포인트에서 스트리밍.
    final url = widget.meme.refUrl.isNotEmpty
        ? widget.meme.refUrl
        : Config.refAudio(widget.meme.id);
    try {
      await _player.setUrl(url);
      await _player.play();
    } catch (e, st) {
      Log.e('원본 재생 실패', e, st);
    }
  }

  Future<void> _toggleRecord() async {
    if (_recording) {
      final path = await _recorder.stop();
      setState(() => _recording = false);
      if (path != null) _sendForScoring(File(path));
    } else {
      if (!await _recorder.hasPermission()) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(context.s('rec_mic_denied')),),);
        return;
      }
      Analytics.recordStarted(widget.meme.id);
      final dir = await getTemporaryDirectory();
      final p = '${dir.path}/take_${DateTime.now().millisecondsSinceEpoch}.wav';
      await _recorder.start(
        const RecordConfig(encoder: AudioEncoder.wav), path: p,);
      setState(() => _recording = true);
    }
  }

  Future<void> _sendForScoring(File f) async {
    setState(() => _scoring = true);
    try {
      final result = await Api.score(widget.meme.id, f);
      Analytics.scored(widget.meme.id, result.score, result.grade);
      if (!mounted) return;
      Navigator.pushReplacement(context, MaterialPageRoute(
        builder: (_) => ResultScreen(
          meme: widget.meme, result: result, recording: f, game: widget.game,),),);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _scoring = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),);
    }
  }

  @override
  void dispose() {
    _recorder.dispose();
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.meme;
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Spacer(flex: 1),
              Text(m.emoji, style: const TextStyle(fontSize: 64)),
              const SizedBox(height: 12),
              Text(m.title, style: AppTheme.hero.copyWith(fontSize: 44)),
              Text(m.source, style: AppTheme.label),
              const SizedBox(height: 28),
              // 원본 듣기
              OutlinedButton.icon(
                onPressed: _playReference,
                icon: const Icon(Icons.volume_up, color: AppTheme.cyan),
                label: Text(context.s('rec_play_original'),
                    style: AppTheme.label.copyWith(color: AppTheme.cyan),),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppTheme.cyan),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(30),),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 22, vertical: 12,),
                ),
              ),
              const Spacer(flex: 1),
              Waveform(active: _recording, height: 90),
              const Spacer(flex: 1),
              // 녹음 버튼 (주역)
              _RecordButton(
                recording: _recording, scoring: _scoring,
                onTap: _scoring ? null : _toggleRecord,),
              const SizedBox(height: 14),
              Text(
                _scoring ? context.s('rec_scoring')
                  : _recording ? context.s('rec_again_hint')
                  : context.s('rec_hint'),
                style: AppTheme.label,),
              const Spacer(flex: 2),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecordButton extends StatelessWidget {
  final bool recording, scoring;
  final VoidCallback? onTap;
  const _RecordButton({
    required this.recording, required this.scoring, required this.onTap,});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: recording ? '녹음 정지하고 채점하기'
           : scoring ? '채점 중'
           : '녹음 시작',
      enabled: onTap != null,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          width: recording ? 96 : 110,
          height: recording ? 96 : 110,
          decoration: BoxDecoration(
            color: recording ? AppTheme.hotPink : AppTheme.volt,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: (recording ? AppTheme.hotPink : AppTheme.volt)
                    .withValues(alpha: 0.5),
                blurRadius: 40, spreadRadius: 6,),
            ],
          ),
          child: scoring
              ? const Padding(padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(
                    color: Colors.black, strokeWidth: 3,),)
              : Icon(recording ? Icons.stop : Icons.mic,
                  size: 48, color: Colors.black,),
        ),
      ),
    );
  }
}
