#!/bin/sh
# clone 직후 한 번만 실행. (Windows는 Git Bash에서 sh setup.sh)
set -e

echo "▸ git 훅 등록 (main 직접 push 차단)"
git config core.hooksPath .githooks

echo "▸ merge 시 pull 전략을 rebase로 (히스토리 깔끔)"
git config pull.rebase true

echo "▸ Flutter 의존성"
flutter pub get

echo ""
echo "✅ 준비 끝. 'flutter run' 으로 실행하세요."
echo "   협업 규칙은 CONTRIBUTING.md 를 먼저 읽어주세요."
