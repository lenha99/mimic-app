import 'package:flutter_test/flutter_test.dart';
import 'package:meme_mimic/config.dart';
import 'package:meme_mimic/data.dart';

void main() {
  group('Config', () {
    test('challengeLink은 challengeBase + meme_id 쿼리', () {
      final link = Config.challengeLink('siu');
      expect(link, startsWith(Config.challengeBase));
      expect(link, contains('meme_id=siu'));
    });
    test('무료 횟수 기본값 양수', () {
      expect(Config.freeDailyPlays, greaterThan(0));
    });
  });

  group('Meme', () {
    test('colorIndex는 0~3 범위', () {
      for (final m in demoMemes) {
        expect(m.colorIndex, inInclusiveRange(0, 3));
      }
    });
    test('fromJson 파싱', () {
      final m = Meme.fromJson({'id':'x','title':'T','plays':5});
      expect(m.id, 'x'); expect(m.plays, 5); expect(m.emoji, '🎙');
    });
  });

  group('ScoreResult', () {
    test('breakdown 누락 시 0 폴백', () {
      final r = ScoreResult.fromJson({'score':80,'grade':'S'});
      expect(r.pitch, 0); expect(r.score, 80);
    });
  });
}
