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
  app/page.tsx       # 홈 — 이번 주 보이스 챌린지 + 입구 둘(명대사 챌린지 · 연습실)
  app/weekly/        # 주간 보이스 챌린지 — 매주 대본 하나, 출전작에 ❤, 시상대·명예의 전당
  lib/weekly.ts      # 주차 계산·대본 순서(ROTATION)·기기 기록. DB 없이 "이번 주 대본"을 안다
  lib/weekly-server.ts  # 순위·정산(1~3위 박제)·수상 조회. 표에 RLS 정책이 없어 조건은 여기서 건다
  app/challenges/    # 챌린지 목록 — 명대사 · 친구가 만든 · 몸풀기(동물 소리)
  app/me/            # "나" 탭 — 로그인했으면 /profile, 아니면 손님 허브
  components/bottom-nav.tsx  # 하단 탭(홈·챌린지·연습실·나). "챌린지"=/weekly. 몰입 화면에선 숨긴다
  app/record/[id]/   # 듣기 → 카운트다운 → 녹음 → 채점 → 결과
  app/practice/      # 연습실 — 대본(기준 음성 없음)·명대사 반복 연습, 기록은 기기 IndexedDB
  app/practice/new/  # 내 대본 넣기·고치기 — 대본은 기기 localStorage 에만 (lib/my-scripts.ts)
  app/probe/         # 마이크 진단
  lib/memes.ts       # 카탈로그 조회 + 폴백 (생성됨)
  lib/config.ts      # 엔드포인트 한 곳
  lib/scripts.ts     # 연습실 대본 (생성됨 — registry.json 의 scripts)
  lib/voice-analysis.ts  # 브라우저 측정: 말 속도·쉼·억양 폭·문장 끝 처짐
  lib/script-match.ts    # 대본 ↔ 받아쓰기 비교 (빠뜨림·바꿈·덧붙임). 받아쓰기는 modal_app.transcribe

modal_app.py         # 서버 API (채점 + 카탈로그 + 운영자 엔드포인트 + 이벤트 로그)
scoring_engine.py    # 채점 엔진 사본 — 테스트 전용. 배포되는 건 modal_app._score 다

content/
  registry.json      # 밈·대본의 단일 진실 소스 (출처·라이선스·권리 상태·QA 수치 포함)
  TAKEDOWNS.md       # 내린 콘텐츠 기록
tools/
  ingest.py          # 인제스트: 받기 → 구간 선택 → 정규화 → 게이트 → 업로드 → 검증
  sync_catalog.py    # registry → catalog.json / memes.json / 웹 FALLBACK 생성
  picker.html        # 파형 보고 귀로 구간 고르는 UI
  trend_scan.py      # 새 밈 후보 발굴
  make_examples.py   # AI 예시 음성(edge-tts) → web/public/examples + web/lib/examples.ts (생성물). 대본·명대사를 바꿨으면 다시 돌린다
refs_kr/             # 원본 유래 클립 (gitignore — 레지스트리로 재생성한다)
refs_animals/        # CC0 동물 소리 원본 (제자리 수정 금지)
```

## 자주 하는 것
- 밈 추가: `python tools/ingest.py pick ...` → `publish` (README §8)
- 콘텐츠 순서·문구: `content/registry.json` 만 고치고 `sync_catalog.py`.
  `catalog.json`·`memes.json`·웹 `FALLBACK` 은 **생성물이라 직접 고치면 CI 가 막는다**
- 연습실 대본: `registry.json` 의 `scripts` 에 쓰고 `sync_catalog.py`. 숫자·영문은 한글로
  풀어 쓴다(속도를 음절로 잰다). 권리 상태(`rights`)가 `clip` 인 콘텐츠는 유료 기능에 쓰지 않는다
- 정규화 규칙을 바꿨으면 `python tools/ingest.py renorm` 으로 전체 재생성
- 프로덕션이 레지스트리와 맞는지: `python tools/ingest.py doctor`
- 주간 챌린지 대본 순서: `web/lib/weekly.ts` 의 `ROTATION`. 이미 지난 주를 바꾸면 그 주 기록과
  어긋나니 뒤쪽에만 덧붙인다. 마이그레이션은 `npx supabase db push` (자동 적용 안 됨)

## 배포
서버는 `modal_app.py` 가 바뀐 채 main 에 머지되면 GitHub Actions(`deploy-modal.yml`)가
테스트 후 자동 배포한다. 토큰은 저장소 Secret 에만 있어 협업자는 Modal 계정이 필요 없다.
```bash
gh workflow run deploy-modal.yml   # 수동 재배포
modal deploy modal_app.py          # 로컬에서 직접 (토큰 있는 사람만)
# 웹은 main 에 머지되면 Vercel 이 자동 배포한다
```

서버 배포가 코드보다 낡으면 조용히 기능이 사라진다 — 실제로 대사(`line`)가
7시간 동안 통째로 버려진 적이 있다. `/version` 이 배포된 커밋을 돌려주고
`doctor` 가 main 과 대조한다.

## 비용 가드 (Modal)
- 채점·받아쓰기는 웹앱 서버만 부른다 — `x-mimic-proxy` 헤더(Vercel `PROXY_TOKEN` = Modal Secret
  `mimic-proxy`). Secret 에 `PROXY_ENFORCE=1` 이 있어야 실제로 막는다
- 업로드는 디코딩 단계에서 길이를 자른다(`_decode_upload(max_s=)`). 다 처리한 뒤에 길이를 보면 이미 CPU 를 쓴 뒤다
- `max_containers` 가 최악의 시간당 비용 상한이다. 늘리기 전에 계산부터

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
