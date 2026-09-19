# MIMIC Web

Flutter 앱(`../lib`)을 대체할 웹앱. 기획서 v0.2 기준 **M1 진행 중**이다.

## 지금 상태

| 화면 | 경로 | 상태 |
|---|---|---|
| 홈 (밈 목록) | `/` | 동작 — 카탈로그는 아직 Modal 에서 읽는다. 우상단에 랭킹·투표·로그인 링크 추가됨 |
| 마이크 검사 | `/probe` | 동작 — **V1 검증 도구** (이슈 #13) |
| 녹음+결과 | `/record/[id]` | 동작 — Modal 채점까지. **아직 저장 안 됨**(공개/투표 등록 미연결, 아래 참고) |
| 로그인 | `/login` | 동작 — 카카오·구글 (Dev A, 이슈 #18 인프라) |
| 투표 | `/vote` | 동작 — 로그인 유저만. `get_vote_matchup()` RPC가 매칭 담당 (이슈 #17) |
| 랭킹 | `/rank` | 동작 — Elo 기준, 밈별/전체 탭 (이슈 #17) |
| 프로필 | `/profile` | 동작 — 닉네임 수정, 로그아웃 |

서버(채점)는 계속 Modal. 카탈로그·기준음성 Supabase 이전은 이슈 #18 진행 중 — `memes` 테이블은
이미 있고 `plays` 필드까지 `lib/memes.ts`의 `Meme` 타입과 맞춰뒀다.

### `/record`를 투표·랭킹에 연결하려면 (Dev B 쪽 남은 작업)

지금 `recorder.tsx`는 Modal 채점 결과를 화면에 보여주기만 하고 저장하지 않는다
("녹음은 채점에만 쓰이고 저장되지 않습니다" 문구 그대로 맞다, 아직은).

결과 화면에 "공개하기" 버튼을 추가하면 이렇게 연결된다 — **점수를 다시 안 보내도 된다**,
서버가 같은 오디오로 Modal을 다시 불러 확정 점수를 낸다(이슈 #23, 클라이언트 점수 위조 방지):

```ts
const form = new FormData();
form.append("file", blob, "recording.webm"); // submit()에서 이미 갖고 있는 그 blob
form.append("is_public", String(wantsToPublish)); // 기본 false(이슈 #16)

const res = await fetch(`/api/publish-recording?meme_id=${meme.id}`, {
  method: "POST",
  body: form,
});
const { recordingId, claimToken, score, grade, breakdown } = await res.json();
// claimToken이 오면(비로그인 상태) localStorage에 저장해뒀다가
// 로그인 후 claim_recording() RPC로 본인 계정에 귀속시키면 됨.
//   await supabase.rpc("claim_recording", { p_claim_token: claimToken });
// 토큰은 1회용이라 성공하면 즉시 소각된다. 로그인 전에 결과를 다시 읽어야 하면
// get_guest_recording() RPC를 쓴다 (게스트는 user_id가 없어 select로는 못 읽음).
```

로그인 여부는 서버가 세션으로 알아서 판단한다(비로그인이면 게스트로 저장, 이슈 #19).

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
  record/[id]/      녹음 + Modal 채점
  login/            카카오·구글 로그인 (Dev A)
  auth/callback/    OAuth 콜백 + 첫 로그인 시 profiles row 생성
  profile/          닉네임 수정, 로그아웃
  vote/             A/B 투표 배틀
  rank/             Elo 랭킹
  api/score/        기존 Modal 채점 프록시 (Dev B)
  api/publish-recording/  결과 확정 저장 — Modal 재채점 후 Supabase에 기록 (Dev A)
  globals.css       디자인 토큰 — ../lib/theme.dart 이식
lib/
  config.ts         환경값 단일 관리 (Flutter 쪽 lib/config.dart 대응)
  memes.ts          카탈로그 fetch + 폴백
  supabase/         클라이언트(client.ts) · 서버(server.ts) · service_role(service.ts)
types/
  database.ts       Supabase 스키마 타입 (공통 파일 — CLAUDE.md 규칙 확인 후 수정)
```

Supabase 관련 SQL은 저장소 루트 `supabase/migrations/`에 있다(모노레포 결정, 이슈 #21).

## 규칙

- Next.js 16 App Router. **`node_modules/next/dist/docs/` 의 문서를 먼저 읽는다** —
  이 버전은 학습 데이터와 다를 수 있다.
- 다크 단일 테마. 제품 아이덴티티가 "무대 조명"이라 라이트 모드를 만들지 않는다.
- 색·서체는 `globals.css` 의 토큰만 쓴다. 하드코딩 금지.
- `main` 직접 푸시 금지. `feature/*` 브랜치 → PR → 리뷰 1인 → merge.
