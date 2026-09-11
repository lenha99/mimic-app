import 'package:flutter/material.dart';
import 'strings.dart';

/// context.s('key') 로 어디서든 현지화 문자열 접근.
extension L10n on BuildContext {
  Strings get _strings => Strings.of(Localizations.localeOf(this));
  String s(String key) => _strings.get(key);
}
