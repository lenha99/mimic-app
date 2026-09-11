# 출시 전 최종 체크 (네 PC에서 실행)

이 환경은 Dart SDK 다운로드가 차단되어 아래는 직접 돌려야 9.8 확정.

```bash
flutter pub get
flutter analyze --fatal-infos    # → "No issues found!" 떠야 함
flutter test                      # → 위젯 테스트 전체 통과
pytest test/scoring_test.py -v    # → 채점 5종 통과 (이미 검증됨)
./deploy.sh run                   # → 서버배포+URL주입+실행
```

## 검증 완료 (이 환경에서)
- 채점 엔진 5종 테스트 통과 (무음 0점, 완벽 90+, 재현성)
- 콤보/스트릭 로직 통과 (누적·끊김·마일스톤)
- 공유영상 mp4 실제 생성
- 자체 린터 import/문법 에러 0
- 전 화면 시각 렌더 확인

## 미검증 (네 PC 필요)
- flutter analyze 통과 여부
- 위젯 테스트 실제 실행
- 실기기 UI 렌더
