# 같이 작업하는 법 (MIMIC)

둘이서 부딪히지 않고 빠르게 굴리기 위한 최소 규칙. 규칙이 일을 막으면 규칙을 고친다.

---

## 0. 처음 한 번만 (형이 할 것)

```bash
git clone https://github.com/lenha99/mimic-app.git
cd mimic-app
sh setup.sh          # 훅 등록 + pub get (Windows는 Git Bash에서)
flutter run          # 폰 USB 연결 + 개발자옵션 USB 디버깅 ON
```

`setup.sh`가 `main` 직접 push를 막는 훅을 깔아준다. **이걸 안 돌리면 실수로
main에 밀어넣게 된다.** (무료 플랜 private 저장소라 GitHub 서버쪽 보호를
못 걸어서 로컬에서 막는 방식)

Flutter SDK 설치가 안 돼 있으면 `CLAUDE.md`의 "환경 세팅 순서" 참고.
서버(Modal) 없이도 앱은 뜬다. 채점만 안 될 뿐.

---

### GitHub / git 이 처음이라면

이것부터 깔면 위 명령어가 다 돌아간다.

1. **Git** — https://git-scm.com/download/win (윈도우) / 맥은 `xcode-select --install`
2. **GitHub CLI** — https://cli.github.com → 설치 후 `gh auth login` (브라우저로 로그인)
3. 초대 메일의 **Accept invitation** 을 먼저 눌러야 clone 이 된다.
   (또는 https://github.com/lenha99/mimic-app/invitations)

용어 세 개만 알면 된다:

| 말 | 뜻 |
|---|---|
| **브랜치(branch)** | 내 작업용 복사본. 여기서 뭘 해도 `main`은 안 망가진다. |
| **커밋(commit)** | 저장 지점. 여기까지 한 걸로 기록해둬. |
| **PR (Pull Request)** | "내 브랜치를 main에 합쳐줘" 하는 요청 + 리뷰하는 자리. |

겁낼 것 없다. **커밋하고 push한 것은 거의 다 되돌릴 수 있다.**
되돌리기 어려운 건 `--force` 뿐인데, 그건 안 쓰면 된다.

---

## 1. 절대 규칙 (이것만 지키면 됨)

1. **`main`에 직접 push 하지 않는다.** 항상 브랜치 → PR → merge.
   (`setup.sh`를 돌렸으면 훅이 알아서 막아준다)
2. **작업 시작 전에 `git pull`** 한다. 안 하면 충돌난다.
3. **APK/키스토어/`.env`는 커밋하지 않는다.** (`.gitignore`에 이미 막아둠)
4. **서로 같은 파일을 동시에 만지지 않는다.** 만질 거면 먼저 말한다.

---

## 2. 매일 쓰는 흐름

```bash
# 1) 최신으로 맞추기
git checkout main
git pull

# 2) 브랜치 파기
git checkout -b feat/record-retry

# 3) 작업 → 커밋 (작게 자주)
git add -A
git commit -m "feat: 녹음 실패 시 재시도 버튼 추가"

# 4) 올리고 PR 만들기
git push -u origin feat/record-retry
gh pr create --fill          # 또는 GitHub 웹에서 'Compare & pull request'

# 5) 상대가 리뷰 → merge → 브랜치 자동 삭제
```

merge된 뒤 로컬 정리:
```bash
git checkout main && git pull && git branch -d feat/record-retry
```

---

## 3. 브랜치 이름

| 접두어 | 언제 | 예시 |
|---|---|---|
| `feat/` | 새 기능 | `feat/daily-challenge` |
| `fix/` | 버그 수정 | `fix/ios-mic-permission` |
| `refactor/` | 동작 그대로, 구조만 | `refactor/split-result-screen` |
| `chore/` | 설정·의존성·문서 | `chore/bump-flutter-3.27` |
| `exp/` | 실험 (merge 안 할 수도 있음) | `exp/new-scoring-weights` |

---

## 4. 커밋 메시지

```
<타입>: <한 줄 요약 — 뭘 했는지 한국어로>

(필요하면) 왜 이렇게 했는지 2~3줄
```

타입: `feat` `fix` `refactor` `chore` `docs` `test` `perf`

좋은 예: `fix: 안드로이드 13에서 마이크 권한 거부 시 앱 죽는 문제`
나쁜 예: `수정`, `update`, `ㅇㅇ`

---

## 5. PR 규칙

- **작게 쪼갠다.** 파일 20개 넘어가면 리뷰가 안 된다. 쪼갤 수 있으면 쪼갠다.
- PR 본문에 **뭘 바꿨는지 + 어떻게 확인했는지**를 쓴다 (템플릿이 뜬다).
- UI를 건드렸으면 **스크린샷/영상 필수**.
- CI(초록 체크)가 통과해야 merge.
- 리뷰어가 없으면 **Self-merge 해도 된다.** 단, 다음 중 하나면 반드시 상대 리뷰를 받는다:
  - `modal_app.py` / `scoring_engine.py` (서버·채점 로직)
  - `pubspec.yaml` (의존성)
  - `android/` `ios/` (빌드 설정)
  - 결제·수익화 관련

merge 방식은 **Squash merge**로 통일 (히스토리가 깔끔해짐).

---

## 6. 역할 나누기 제안

같은 파일 충돌을 피하려면 레이어로 나누는 게 제일 편하다.

| 영역 | 파일 |
|---|---|
| 앱 UI/UX | `lib/*_screen.dart`, `lib/theme.dart`, `lib/rewards.dart`, `lib/waveform.dart` |
| 앱 코어 | `lib/data.dart`, `lib/config.dart`, `lib/game_state.dart`, `lib/analytics.dart` |
| 서버/채점 | `modal_app.py`, `scoring_engine.py`, `video_maker.py` |
| 콘텐츠 | `memes.json`, `catalog.json`, `refs*/` |

---

## 7. 뭘 할지 정하는 곳

- **Issues** — 할 일/버그를 전부 여기에. 머릿속이나 카톡에 두지 않는다.
- 이슈에 `담당자(Assignee)`를 박아두면 중복 작업이 안 생긴다.
- 큰 그림·우선순위는 **Projects 보드**(Todo / In Progress / Done)에서 본다.

---

## 8. 테스트

PR 올리기 전 최소한 이것만:

```bash
flutter analyze --fatal-infos    # 경고 0
flutter test                     # 위젯 테스트
pytest test/scoring_test.py -v   # 채점 엔진 (서버 건드렸을 때만)
```

CI가 push할 때마다 자동으로 같은 걸 돌린다. 빨간 X면 merge 금지.

---

## 9. 릴리즈

`RELEASE_GATES.md` 참고. 요약하면:

```bash
flutter build apk --release \
  --dart-define=SCORE_URL=... --dart-define=VIDEO_URL=...
gh release create v0.2.0 build/app/outputs/flutter-apk/app-release.apk
```

APK는 **저장소가 아니라 GitHub Releases**에 올린다.

---

## 10. 막혔을 때

- 충돌났는데 모르겠다 → 브랜치를 그대로 두고 물어본다. 억지로 `--force` 하지 않는다.
- 잘못 커밋했다 → push 전이면 `git reset --soft HEAD~1`. push 후면 새 커밋으로 되돌린다.
- 뭔가 다 꼬였다 → 작업물을 복사해두고 `git clone` 새로 받는 게 제일 빠를 때가 많다.
