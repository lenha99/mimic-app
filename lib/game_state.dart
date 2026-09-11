import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 재미 엔진: 콤보·스트릭·일일 연속을 관리.
/// 모든 보상 로직을 한 곳에 모아 화면은 결과만 표시.
class GameState extends ChangeNotifier {
  int combo = 0;          // 연속 고득점(B+ 이상) 횟수
  int bestCombo = 0;
  int dailyStreak = 0;    // 며칠 연속 플레이
  int totalPlays = 0;
  String? _lastPlayDate;

  static const _comboThreshold = 60; // 이 점수 이상이면 콤보 유지

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    combo = p.getInt('combo') ?? 0;
    bestCombo = p.getInt('bestCombo') ?? 0;
    dailyStreak = p.getInt('dailyStreak') ?? 0;
    totalPlays = p.getInt('totalPlays') ?? 0;
    _lastPlayDate = p.getString('lastPlayDate');
    _refreshDailyStreak();
    notifyListeners();
  }

  /// 채점 결과를 반영하고 보상 이벤트를 반환.
  Future<RewardEvent> applyScore(int score) async {
    totalPlays++;
    final wasCombo = combo;

    if (score >= _comboThreshold) {
      combo++;
      if (combo > bestCombo) bestCombo = combo;
    } else {
      combo = 0; // 콤보 끊김
    }

    _bumpDailyStreak();
    await _save();
    notifyListeners();

    return RewardEvent(
      score: score,
      combo: combo,
      comboBroken: wasCombo >= 2 && combo == 0,
      newBestCombo: combo > 0 && combo == bestCombo && combo >= 3,
      dailyStreak: dailyStreak,
      milestone: _milestone(combo),
    );
  }

  /// 콤보 배수 — 점수 위에 곱해지는 변동 보상 연출용.
  double get comboMultiplier => 1.0 + (combo * 0.1).clamp(0.0, 1.0);

  String? _milestone(int c) {
    if (c == 3) return 'COMBO x3 🔥';
    if (c == 5) return 'ON FIRE 🔥🔥';
    if (c == 10) return 'UNSTOPPABLE ⚡️';
    if (c > 0 && c % 10 == 0) return 'LEGEND x$c 👑';
    return null;
  }

  void _bumpDailyStreak() {
    final today = _todayStr();
    if (_lastPlayDate == today) return;        // 오늘 이미 카운트됨
    final yesterday = _dateStr(DateTime.now().subtract(const Duration(days: 1)));
    dailyStreak = (_lastPlayDate == yesterday) ? dailyStreak + 1 : 1;
    _lastPlayDate = today;
  }

  void _refreshDailyStreak() {
    if (_lastPlayDate == null) return;
    final today = _todayStr();
    final yesterday = _dateStr(DateTime.now().subtract(const Duration(days: 1)));
    if (_lastPlayDate != today && _lastPlayDate != yesterday) {
      dailyStreak = 0; // 하루 이상 건너뜀 → 리셋
    }
  }

  String _todayStr() => _dateStr(DateTime.now());
  String _dateStr(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _save() async {
    final p = await SharedPreferences.getInstance();
    await p.setInt('combo', combo);
    await p.setInt('bestCombo', bestCombo);
    await p.setInt('dailyStreak', dailyStreak);
    await p.setInt('totalPlays', totalPlays);
    if (_lastPlayDate != null) await p.setString('lastPlayDate', _lastPlayDate!);
  }
}

/// 한 번의 채점이 만들어낸 보상 이벤트. 화면은 이것만 보고 연출.
class RewardEvent {
  final int score, combo, dailyStreak;
  final bool comboBroken, newBestCombo;
  final String? milestone;
  RewardEvent({
    required this.score, required this.combo, required this.dailyStreak,
    required this.comboBroken, required this.newBestCombo, this.milestone,
  });
}
