# MIMIC — Claude Code 컨텍스트

## 프로젝트 개요
밈 사운드와 영화 명대사를 따라 외치면 채점해주는 **웹앱**. 설치 없이 링크 하나로
도전하고, 점수를 친구에게 도전장으로 던지는 것이 유일한 자가증식 장치다.

## 기술 스택
- **앱**: Next.js (web/) — 사용자가 실제로 쓰는 건 이쪽 하나다
- **채점 서버**: Python FastAPI on Modal (서버리스, 요청 없으면 과금 0)
- **채점 엔진**: librosa — pyin 억양 · MFCC 음색 · DTW 정렬

Flutter 클라이언트와 공유 영상 생성기가 있었으나 둘 다 걷어냈다. 쓰지 않는
클라이언트가 CI·카탈로그 동기화 비용을 계속 먹었고, 영상은 만드는 데 오래 걸려
공유 흐름을 끊었다. 히스토리는 git 에 남아 있다.

## 파일 구조
```
web/                 # Next.js 웹앱 (유일한 클라이언트)
  app/page.tsx       # 홈 — 맨 위 하나가 곧 첫 챌린지
  app/record/[id]/   # 듣기 → 카운트다운 → 녹음 → 채점 → 결과
  app/probe/         # 마이크 진단
  lib/memes.ts       # 카탈로그 조회 + 폴백 (생성됨)
  lib/config.ts      # 엔드포인트 한 곳

modal_app.py         # 서버 API (채점 + 카탈로그 + 운영자 엔드포인트 + 이벤트 로그)
scoring_engine.py    # 채점 엔진 사본 — 테스트 전용. 배포되는 건 modal_app._score 다

content/
  registry.json      # 밈 콘텐츠의 단일 진실 소스 (출처·라이선스·QA 수치 포함)
  TAKEDOWNS.md       # 내린 콘텐츠 기록
tools/
  ingest.py          # 인제스트: 받기 → 구간 선택 → 정규화 → 게이트 → 업로드 → 검증
  sync_catalog.py    # registry → catalog.json / memes.json / 웹 FALLBACK 생성
  picker.html        # 파형 보고 귀로 구간 고르는 UI
  trend_scan.py      # 새 밈 후보 발굴
refs_kr/             # 원본 유래 클립 (gitignore — 레지스트리로 재생성한다)
refs_animals/        # CC0 동물 소리 원본 (제자리 수정 금지)
```

## 자주 하는 것
- 밈 추가: `python tools/ingest.py pick ...` → `publish` (README §8)
- 콘텐츠 순서·문구: `content/registry.json` 만 고치고 `sync_catalog.py`.
  `catalog.json`·`memes.json`·웹 `FALLBACK` 은 **생성물이라 직접 고치면 CI 가 막는다**
- 정규화 규칙을 바꿨으면 `python tools/ingest.py renorm` 으로 전체 재생성
- 프로덕션이 레지스트리와 맞는지: `python tools/ingest.py doctor`

## 배포
```bash
modal deploy modal_app.py     # 서버
# 웹은 main 에 머지되면 Vercel 이 자동 배포한다
```

서버 배포가 코드보다 낡으면 조용히 기능이 사라진다 — 실제로 대사(`line`)가
7시간 동안 통째로 버려진 적이 있다. `/version` 이 배포된 커밋을 돌려주고
`doctor` 가 main 과 대조한다.

## 테스트
```bash
pytest test/ -q                      # 채점 엔진 + 카탈로그 드리프트
cd web && npm run build && npm run lint
```

## 이 레포에서 배운 것
- **경계마다 되읽어라.** "보냈다"로 끝내지 말고 "그쪽에서 실제로 그렇게 됐나"를
  확인한다. 업로드 200 을 믿었다가 파일이 볼륨에 안 남은 적, 라우드니스 목표를
  아무도 안 재서 12dB 벌어진 적, 배포가 낡아 필드가 버려진 적이 전부 같은 원인이다.
- **측정할 수 있는 건 게이트로, 없는 건 사람에게.** 대사 구간이 맞는지는 들어야
  안다. 타임스탬프를 추측으로 찍으면 4개 중 3개가 빗나간다 — 픽커로 사람이 고른다.
