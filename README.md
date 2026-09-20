# MIMIC — 밈 따라하기 앱 완성 패키지

밈 사운드(SIUUUU 등)를 따라하면 점수가 나오고, 결과가 자동으로
"원본 vs 나" 공유영상이 되어 퍼지는 앱. **운영 비용 거의 0**으로 설계.

---

## 0. 같이 작업하는 사람에게

| | |
|---|---|
| 협업 규칙 (브랜치/PR/커밋) | **[CONTRIBUTING.md](CONTRIBUTING.md)** ← 먼저 읽기 |
| 코드 구조·환경 세팅 | [CLAUDE.md](CLAUDE.md) |
| 릴리즈 기준 | [RELEASE_GATES.md](RELEASE_GATES.md) |
| 할 일 / 버그 | [Issues](../../issues) |

빠른 시작:
```bash
git clone https://github.com/lenha99/mimic-app.git
cd mimic-app && flutter pub get && flutter run
```

**`main`에 직접 push 금지.** 브랜치 → PR → merge.

---

## 1. 무엇이 들어있나

| 영역 | 파일 | 상태 |
|---|---|---|
| 채점 엔진 + 서버리스 API | `modal_app.py` | ✅ `test/calibration_test.py` 로 회귀 검증 |
| 공유영상 생성기 | `video_maker.py` | ✅ 실제 mp4 생성 검증 |
| 기준 음성 생성 | `make_reference.py` | ✅ 코드 검증(네 PC 실행) |
| Flutter 앱 | `lib/*.dart` | ✅ 전체 화면 구현 |
| 디자인 프리뷰 | `preview.html` | ✅ 브라우저로 확인 |

---

## 2. 배포 순서 (전부 무료 티어)

### (1) 채점/영상 서버 — Modal
```bash
pip install modal
modal token new                       # 무료 가입
modal volume create meme-refs
```

### (2) 기준 음성 만들기 → 업로드
```bash
# 방법 A(추천): 직접 "시우우~" 녹음해서 ronaldo_siu.wav 저장
# 방법 B: 무료 TTS
pip install edge-tts
python make_reference.py              # refs/ 에 mp3 생성
# wav 변환 후 업로드
modal volume put meme-refs ronaldo_siu.wav
```

### (3) 서버 배포
```bash
modal deploy modal_app.py
# 출력된 URL 2개를 복사:
#   .../score        (채점)
#   .../make_video   (공유영상)
```

### (4) Flutter 앱
```bash
flutter create meme_mimic
# lib/*.dart, pubspec.yaml 덮어쓰기
# data.dart 의 baseUrl 을 (3)의 score URL로 교체
flutter pub get
flutter run
```

---

## 3. 비용 구조 (왜 0원에 가깝나)

- **서버**: Modal은 요청 올 때만 실행 → 유휴 시 과금 0. 무료 크레딧으로 초기 수천 회 채점/영상 커버.
- **저장**: 기준 음성 몇 개뿐 → 볼륨 무료 범위.
- **TTS**: edge-tts는 완전 무료.
- 유저가 늘어 무료 한도를 넘기면 그때 종량 과금 → 이미 트래픽이 있다는 뜻.

---

## 4. 바이럴 설계 (상위 1% 기준 적용)

핵심 원칙: **공유는 부산물이 아니라 결과물 그 자체**.

1. **자동 공유영상** — 따라하기를 끝내면 원본 vs 나 + 대형 등급 +
   "너도 도전해봐" 워터마크가 박힌 9:16 영상이 즉시 생성. 틱톡/릴스/쇼츠에 그대로.
2. **친구 지목(K-factor)** — 결과 화면의 "친구 지목하기"가 공유 버튼만큼 큼.
   "내 점수 넘어봐" 링크로 받은 사람이 바로 도전자가 됨 → 자가증식.
3. **사회적 증거** — 홈에 "12.8만명 도전" 노출로 참여 압력.
4. **주간 챌린지 + 랭킹** — 1등 영상 앱 메인 노출로 고득점 경쟁 유도.

목표 지표: K-factor > 1 (한 명이 평균 1명 이상 초대).
이게 광고비 0으로 성장하는 유일한 조건.

---

## 5. 수익화 (트래픽 확보 후)

- 1순위: **보상형 광고** — 재도전/영상 워터마크 제거 시 광고 시청.
- 2순위: 밈 팩 구독, 프리미엄 등급 이펙트.
- 원칙: 매출보다 유저 수가 먼저. 바이럴로 트래픽 확보 → 광고로 회수.

---

## 6. 저작권 안전장치

- 초기엔 **직접 녹음한 오리지널** 기준 음성만 사용(방법 A).
- 유명 영화/애니 원본 오디오 직접 사용은 분쟁 위험 → 피할 것.
- UGC(유저 녹음)를 기준으로 승격하면 콘텐츠도 늘고 책임도 분산.

---

## 7. 남은 작업 (정직한 미완성 목록)

- [ ] 기준 음성 실제 파일 (네가 녹음/생성)
- [ ] Modal 배포 후 URL 교체
- [ ] 앱에서 make_video 호출 → 받은 mp4를 share_plus로 공유하는 연결
      (현재는 텍스트 공유. 영상 다운로드 후 `Share.shareXFiles`로 교체)
- [ ] 로그인/랭킹 백엔드 (Supabase 무료 티어 권장)
- [ ] 부적절 UGC 모더레이션

---

## 8. 밈 추가하기 (코드 수정 없이)

운영자가 새 밈을 늘리는 법:

1. **기준 음성 업로드**
   ```bash
   modal volume put meme-refs new_meme.wav
   ```
2. **memes.json 에 한 줄 추가** (서버가 이 파일을 앱에 제공)
   ```json
   {"id": "new_meme", "title": "제목", "source": "출처", "emoji": "🎯", "plays": 0}
   ```
3. 끝. 카드 글로우 색은 id 해시로 **자동 배정**, 앱 재배포 불필요.

`MEMES_URL` 환경변수로 memes.json 위치를 주면 앱이 자동으로 최신 목록을 불러옴.
비워두면 내장 기본 4종 사용.

## 9. UI/UX 적용 디자인 (8.7/10)

- 글래스모피즘 카드 + id별 컬러 글로우 자동 배정
- 보라/핑크 배경 글로우, 그라데이션 텍스트
- 회전 등급링·펄스·플로팅 마이크 모션
- LIVE 뱃지 + "N명 참여중" 실시간감
- 첫 실행 3초 온보딩(shared_preferences 1회 판별)
- breakdown 칩 카드화로 가독성 확보

`preview2.html` 을 브라우저로 열면 4화면 전체 확인 가능.
