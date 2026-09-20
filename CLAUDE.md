# MIMIC 앱 — Claude Code 컨텍스트

## 프로젝트 개요
밈 사운드(SIUUUU 등)를 따라 외치면 AI가 점수를 매기는 Flutter 앱.
"나 호날두 98% 닮음" 공유 영상이 바이럴 핵심.

## 기술 스택
- **앱**: Flutter (Dart) — iOS/Android 동시 지원
- **채점 서버**: Python FastAPI on Modal (서버리스, 무료 티어)
- **채점 엔진**: librosa + yin 알고리즘 (pitch/tone/timing DTW 비교)
- **영상 생성**: ffmpeg — 원본+내 목소리 합성 오디오 + 닮음 % 카드

## 파일 구조
```
lib/
  main.dart          # 앱 진입점, 온보딩 분기
  config.dart        # 모든 환경설정 (URL 등) — 여기만 수정
  strings.dart       # 한/영/일 국제화 문자열
  l10n.dart          # context.s('key') 확장
  theme.dart         # 색상/폰트/스타일
  data.dart          # Meme 모델, Api 클라이언트
  analytics.dart     # 로깅/분석 (Log, Analytics)
  game_state.dart    # 콤보/스트릭 게이미피케이션
  rewards.dart       # 보상 연출 위젯 (컨페티, 마일스톤)
  home_screen.dart   # 밈 목록
  onboarding_screen.dart
  record_screen.dart # 녹음
  result_screen.dart # 결과 + 닮음 % + 공유
  waveform.dart      # 음파 애니메이션 위젯

scoring_engine.py    # 채점 엔진 (테스트 전용 — 배포되는 건 modal_app._score 쪽이다)
modal_app.py         # 서버 API (채점 + 영상생성 + 카탈로그/운영자 엔드포인트)
video_maker.py       # 공유영상 생성 (A: 합성오디오 B: 닮음%)
deploy.sh            # 원커맨드 배포 스크립트

content/
  registry.json      # 밈 콘텐츠의 단일 진실 소스 (출처·라이선스·QA 수치 포함)
  TAKEDOWNS.md       # 내린 콘텐츠 기록
tools/
  ingest.py          # 클립 인제스트: 받기 → 정규화 → 품질 게이트 → 업로드 → 검증
  sync_catalog.py    # registry → catalog.json / memes.json / 웹 / Flutter 사본 생성
  trend_scan.py      # 새 밈 후보 발굴
refs_kr/             # 원본 유래 클립 (gitignore — 레지스트리로 재생성한다)

web/                 # Next.js 웹앱 — 지금 사용자가 실제로 쓰는 건 이쪽이다
```

## 자주 수정하는 것
- 문구 변경: `lib/strings.dart`
- 색상 변경: `lib/theme.dart`
- 밈 추가: `python tools/ingest.py add ...` → `publish` (README §8). `catalog.json`·
  `memes.json`·웹 `FALLBACK`·Flutter `demoMemes` 는 `content/registry.json` 에서
  생성되는 사본이라 **직접 고치면 안 된다** (CI 가 막는다)
- 서버 URL: `lib/config.dart` defaultValue

## 환경 세팅 순서 (Windows + Android)
1. Flutter SDK 설치: https://flutter.dev/docs/get-started/install/windows
   - C:\flutter 에 압축 해제
   - 환경변수 Path에 C:\flutter\bin 추가
2. Android Studio 설치 (Android SDK 포함)
3. 폰: 설정 → 개발자 옵션 → USB 디버깅 ON → USB 연결
4. `flutter doctor` — 모두 ✓ 확인
5. `flutter pub get`
6. `flutter run`

## 서버 배포
```bash
pip install modal
modal token new
modal volume create meme-refs
modal volume put meme-refs ronaldo_siu.wav  # 기준 음성 먼저 준비
modal deploy modal_app.py
# 나온 URL 2개를 lib/config.dart defaultValue에 붙여넣기
```

## 테스트
```bash
pytest test/scoring_test.py -v    # 채점 엔진 (Python)
flutter test                       # 위젯 테스트 (Flutter)
flutter analyze --fatal-infos      # 정적 분석
```

## 주의사항
- `lib/config.dart` URL이 YOUR-WORKSPACE로 되어 있으면 서버 미배포 상태
- 기준 음성(wav) 없이 채점 API 호출하면 에러 — modal volume put 먼저
- flutter pub get 안 하면 import 에러 다량 발생
- Windows에서 배포 스크립트는 deploy.sh 대신 명령어 직접 실행
