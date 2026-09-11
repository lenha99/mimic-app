import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:meme_mimic/data.dart';
import 'package:meme_mimic/strings.dart';
import 'package:meme_mimic/theme.dart';

void main() {
  group('Meme 모델', () {
    test('JSON 파싱이 누락 필드를 기본값으로 채운다', () {
      final m = Meme.fromJson({'id': 'x', 'title': 'T'});
      expect(m.id, 'x');
      expect(m.emoji, '🎙');      // 기본값
      expect(m.plays, 0);          // 기본값
    });

    test('colorIndex는 항상 0~3 범위', () {
      for (final id in ['a', 'ronaldo_siu', 'zzz', '123', '한글']) {
        final m = Meme(id: id, title: '', source: '', emoji: '',
            plays: 0, refUrl: '');
        expect(m.colorIndex, inInclusiveRange(0, 3));
      }
    });

    test('같은 id는 항상 같은 색 (재현성)', () {
      final a = Meme(id: 'siu', title: '', source: '', emoji: '', plays: 0, refUrl: '');
      final b = Meme(id: 'siu', title: '', source: '', emoji: '', plays: 0, refUrl: '');
      expect(a.colorIndex, b.colorIndex);
    });
  });

  group('ScoreResult', () {
    test('breakdown 정상 파싱', () {
      final r = ScoreResult.fromJson({
        'score': 97, 'grade': 'SS',
        'breakdown': {'pitch': 99, 'tone': 95, 'timing': 95}});
      expect(r.score, 97);
      expect(r.grade, 'SS');
      expect(r.tone, 95);
    });

    test('breakdown 누락 시 0 폴백 (크래시 방지)', () {
      final r = ScoreResult.fromJson({'score': 50, 'grade': 'B'});
      expect(r.pitch, 0);
      expect(r.tone, 0);
    });
  });

  group('국제화', () {
    test('지원 3개 언어 모두 동일 키 집합을 가진다', () {
      final en = Strings.of(const Locale('en'));
      final ko = Strings.of(const Locale('ko'));
      final ja = Strings.of(const Locale('ja'));
      for (final k in ['onboard_cta', 'home_sub', 'result_share',
                       'rec_hint', 'err_network', 'stat_pitch']) {
        expect(en.get(k), isNot(k), reason: 'en 누락: $k');
        expect(ko.get(k), isNot(k), reason: 'ko 누락: $k');
        expect(ja.get(k), isNot(k), reason: 'ja 누락: $k');
      }
    });

    test('미지원 언어는 영어로 폴백', () {
      final fr = Strings.of(const Locale('fr'));
      expect(fr.get('onboard_cta'), 'Get started');
    });
  });

  group('테마', () {
    test('등급 색이 모든 등급에 정의됨', () {
      for (final g in ['SS', 'S', 'A', 'B', 'C']) {
        expect(AppTheme.gradeColor(g), isA<Color>());
      }
    });
    test('카드 글로우 팔레트 4색', () {
      expect(AppTheme.cardGlows.length, 4);
    });
  });
}
