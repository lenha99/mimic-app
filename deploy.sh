#!/usr/bin/env bash
# MIMIC 원커맨드 배포. 서버 URL을 자동으로 앱에 주입.
# 사용: ./deploy.sh [run|build-apk|build-ios]
set -euo pipefail

echo "▶ 1/3 서버 배포 (Modal)"
modal deploy modal_app.py | tee /tmp/modal_out.txt

# 배포 출력에서 엔드포인트 URL 자동 추출
SCORE_URL=$(grep -oE 'https://[^ ]+score[^ ]*\.modal\.run' /tmp/modal_out.txt | head -1)
VIDEO_URL=$(grep -oE 'https://[^ ]+make-video[^ ]*\.modal\.run' /tmp/modal_out.txt | head -1)
echo "  SCORE_URL=$SCORE_URL"
echo "  VIDEO_URL=$VIDEO_URL"

if [ -z "$SCORE_URL" ]; then
  echo "✗ URL 추출 실패. modal 출력 확인 필요." >&2; exit 1
fi

DEFINES="--dart-define=SCORE_URL=$SCORE_URL --dart-define=VIDEO_URL=$VIDEO_URL"
APP_LINK="${APP_LINK:-https://mimic.app}"
DEFINES="$DEFINES --dart-define=APP_LINK=$APP_LINK"

echo "▶ 2/3 의존성 설치"
flutter pub get

echo "▶ 3/3 빌드/실행"
case "${1:-run}" in
  run)        flutter run $DEFINES ;;
  build-apk)  flutter build apk --release $DEFINES ;;
  build-ios)  flutter build ios --release $DEFINES ;;
  *) echo "사용: ./deploy.sh [run|build-apk|build-ios]"; exit 1 ;;
esac
echo "✓ 완료"
