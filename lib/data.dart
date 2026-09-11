import 'dart:io';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path_provider/path_provider.dart';
import 'config.dart';
import 'analytics.dart';

class Meme {
  final String id, title, source, emoji, refUrl;
  final int plays;
  const Meme({
    required this.id, required this.title, required this.source,
    required this.emoji, required this.plays, required this.refUrl,
  });
  factory Meme.fromJson(Map<String, dynamic> j) => Meme(
        id: j['id'], title: j['title'], source: j['source'] ?? '',
        emoji: j['emoji'] ?? '🎙', plays: j['plays'] ?? 0,
        refUrl: j['ref_url'] ?? '',
      );

  /// id 해시로 카드 글로우 색 자동 배정 — 밈 추가 시 색 지정 불필요.
  int get colorIndex => id.hashCode.abs() % 4;
}

class ScoreResult {
  final int score, pitch, tone, timing;
  final String grade;
  final List<double> refWave, userWave; // 원본/내 음성 파형 막대(0..1)
  ScoreResult({required this.score, required this.grade,
    required this.pitch, required this.tone, required this.timing,
    this.refWave = const [], this.userWave = const [],});
  factory ScoreResult.fromJson(Map<String, dynamic> j) {
    final b = j['breakdown'] ?? {};
    final w = j['waveform'] ?? {};
    List<double> bars(dynamic x) =>
        (x as List?)?.map((e) => (e as num).toDouble()).toList() ?? const [];
    return ScoreResult(
      score: j['score'] ?? 0, grade: j['grade'] ?? 'C',
      pitch: b['pitch'] ?? 0, tone: b['tone'] ?? 0, timing: b['timing'] ?? 0,
      refWave: bars(w['ref']), userWave: bars(w['user']),);
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

/// 모든 네트워크 호출 단일 창구. 타임아웃·에러로깅 일관 처리.
class Api {
  // 서버리스 콜드 스타트(~30s)를 견디도록 넉넉히. 워밍 후엔 ~2s.
  static const _timeout = Duration(seconds: 90);

  /// 채점 컨테이너 미리 깨우기 (fire-and-forget). 홈 진입 시 호출해
  /// 사용자가 밈 고르고 녹음하는 동안 콜드 스타트를 끝내둔다.
  /// GET이라 405가 나도 컨테이너는 깨어나므로 목적 달성. 에러는 무시.
  static Future<void> warmScore() async {
    try {
      await http.get(Uri.parse(Config.scoreUrl))
          .timeout(const Duration(seconds: 20));
    } catch (_) {/* 워밍 실패는 무시 — 실제 채점 때 다시 시도됨 */}
  }

  static Future<ScoreResult> score(String memeId, File rec) async {
    try {
      final req = http.MultipartRequest(
        'POST', Uri.parse('${Config.scoreUrl}?meme_id=$memeId'),);
      req.files.add(await http.MultipartFile.fromPath('file', rec.path,
          contentType: MediaType('audio', 'wav'),),);
      final res = await http.Response.fromStream(
          await req.send().timeout(_timeout),);
      if (res.statusCode != 200) {
        throw ApiException('채점 서버 오류 (${res.statusCode})');
      }
      return ScoreResult.fromJson(jsonDecode(res.body));
    } on ApiException {
      rethrow;
    } catch (e, st) {
      Log.e('score 실패', e, st);
      throw ApiException('네트워크가 불안정해. 잠시 후 다시 시도해줘.');
    }
  }

  static Future<File> makeVideo({
    required String memeId, required String title, required String source,
    required int score, required String grade, required File rec,}) async {
    try {
      final uri = Uri.parse('${Config.videoUrl}'
          '?meme_id=$memeId&title=${Uri.encodeComponent(title)}'
          '&source=${Uri.encodeComponent(source)}'
          '&score=$score&grade=$grade');
      final req = http.MultipartRequest('POST', uri);
      req.files.add(await http.MultipartFile.fromPath('file', rec.path,
          contentType: MediaType('audio', 'wav'),),);
      final res = await http.Response.fromStream(
          await req.send().timeout(_timeout),);
      if (res.statusCode != 200) {
        throw ApiException('영상 생성 실패 (${res.statusCode})');
      }
      final dir = await getTemporaryDirectory();
      final f = File('${dir.path}/share_${DateTime.now().millisecondsSinceEpoch}.mp4');
      await f.writeAsBytes(res.bodyBytes);
      return f;
    } on ApiException {
      rethrow;
    } catch (e, st) {
      Log.e('makeVideo 실패', e, st);
      throw ApiException('영상 만들기에 실패했어. 다시 시도해줘.');
    }
  }

  /// 밈 목록: 서버 있으면 fetch, 없으면 내장 더미.
  static Future<List<Meme>> memes() async {
    if (Config.memesUrl.isEmpty) return demoMemes;
    try {
      final res = await http.get(Uri.parse(Config.memesUrl)).timeout(_timeout);
      final list = (jsonDecode(res.body) as List)
          .map((j) => Meme.fromJson(j)).toList();
      return list.isEmpty ? demoMemes : list;
    } catch (e, st) {
      Log.e('memes fetch 실패, 더미로 폴백', e, st);
      return demoMemes;
    }
  }
}

const demoMemes = [
  Meme(id: 'rooster', title: '꼬끼오', source: '수탉',
      emoji: '🐓', plays: 128400, refUrl: '',),
  Meme(id: 'cat', title: '야오옹', source: '고양이',
      emoji: '🐱', plays: 96300, refUrl: '',),
  Meme(id: 'goat', title: '메에에', source: '염소',
      emoji: '🐐', plays: 81200, refUrl: '',),
  Meme(id: 'wolf', title: '아우우', source: '늑대',
      emoji: '🐺', plays: 67400, refUrl: '',),
  Meme(id: 'cow', title: '음메에', source: '소',
      emoji: '🐄', plays: 54100, refUrl: '',),
  Meme(id: 'dolphin', title: '이이익', source: '돌고래',
      emoji: '🐬', plays: 41900, refUrl: '',),
];
