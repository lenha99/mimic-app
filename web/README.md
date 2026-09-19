# MIMIC Web

Flutter 앱(`../lib`)을 대체할 웹앱. 기획서 v0.2 기준 **M1 진행 중**이다.

## 지금 상태

| 화면 | 경로 | 상태 |
|---|---|---|
| 홈 (밈 목록) | `/` | 동작 — 카탈로그는 아직 Modal 에서 읽는다 |
| 마이크 검사 | `/probe` | 동작 — **V1 검증 도구** (이슈 #13) |
| 녹음 | `/record/[memeId]` | 없음 — V1 결과를 본 뒤 착수 |
| 결과 | `/result/[recordingId]` | 없음 — 공유 방식 확정 후 (이슈 #14) |
| 투표·랭킹·로그인 | — | 없음 — M2 |

서버는 아직 기존 Modal 엔드포인트를 그대로 쓴다. Supabase 이전은 이슈 #18.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
```

`.env.example` 을 `.env.local` 로 복사하면 엔드포인트를 덮어쓸 수 있다. 비워두면
`lib/config.ts` 의 기본값(현재 배포된 Modal 주소)을 쓴다.

## V1 검증 절차 (이슈 #13)

웹 전환 전체가 이 검증 하나에 걸려 있다. **카카오톡 인앱 브라우저에서 마이크가
열리지 않으면 바이럴 루프가 성립하지 않는다.**

1. 배포해서 **HTTPS 주소**를 확보한다
2. 그 주소의 `/probe` 링크를 카카오톡으로 자기 자신에게 보낸다
3. **카톡 안에서** 링크를 눌러 연다 (외부 브라우저로 열지 않는다)
4. "마이크 열고 2.5초 녹음" 실행
5. "결과 복사" 버튼으로 결과를 받아 이슈 #13 에 붙여넣는다
6. 안드로이드·iOS 양쪽에서 반복

> **`localhost` 나 LAN 주소(`http://192.168...`)로 테스트하지 말 것.**
> `getUserMedia` 는 보안 컨텍스트에서만 노출되므로, http 로 열면 카톡과 무관하게
> 실패한다. 거짓 실패로 오판하기 쉽다.

## 구조

```
app/
  layout.tsx        루트 레이아웃 + OG 메타 기본값
  page.tsx          홈
  probe/page.tsx    마이크 검사 (클라이언트 컴포넌트)
  globals.css       디자인 토큰 — ../lib/theme.dart 이식
lib/
  config.ts         환경값 단일 관리 (Flutter 쪽 lib/config.dart 대응)
  memes.ts          카탈로그 fetch + 폴백
```

## 규칙

- Next.js 16 App Router. **`node_modules/next/dist/docs/` 의 문서를 먼저 읽는다** —
  이 버전은 학습 데이터와 다를 수 있다.
- 다크 단일 테마. 제품 아이덴티티가 "무대 조명"이라 라이트 모드를 만들지 않는다.
- 색·서체는 `globals.css` 의 토큰만 쓴다. 하드코딩 금지.
- `main` 직접 푸시 금지. `feature/*` 브랜치 → PR → 리뷰 1인 → merge.
