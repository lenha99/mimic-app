import { MAX_ENTRY_NOTE, MAX_FEEDBACK_ASK, MAX_NOTES_PER_ENTRY, type EntryNote, type EntryNotes, type NoteKind } from "@/lib/entry-notes";
import { notify } from "@/lib/notify-server";
import { FEEDBACK_XP } from "@/lib/pass";
import { allow, tooMany } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requestT } from "@/lib/i18n";

/**
 * 출전작 댓글·피드백 — 갤러리에서 바로 단다 (11/6, 게시판을 합쳤다).
 * 댓글(kind=comment)과 피드백(kind=feedback)은 목록·숫자·알림이 따로다(11/7 — 전엔 같은 칸이었다).
 * 피드백도 한 칸 자유 입력 — 쓰기 어려우면 아무도 안 쓴다. 대신 남긴 사람은 XP 를 크게 받는다(lib/pass).
 *
 * GET 은 누구나(댓글 목록 · 피드백을 받는지). 쓰기는 로그인한 사람만 — 누가 남겼는지 보여야
 * 피드백이 오가고, 지울 사람도 분명해진다. 주인은 답글로 되묻고, 피드백 받기를 끄고 켜고,
 * 자기 출전작에 달린 댓글을 지울 수 있다. 출전작 화면은 30초마다 다시 만드는 정적 페이지라
 * 댓글은 브라우저가 따로 불러온다.
 */
const ID = /^[0-9a-f-]{36}$/i;

async function viewer(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function entryOf(id: string) {
  const { data } = await createServiceClient()
    .from("weekly_entries")
    .select("id, user_id, hidden, feedback_on, wants_feedback, feedback_ask")
    .eq("id", id)
    .maybeSingle();
  return data && !data.hidden ? data : null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return Response.json({ error: "bad request" }, { status: 400 });
  const [me, e] = await Promise.all([viewer(), entryOf(id)]);
  if (!e) return Response.json({ error: "not found" }, { status: 404 });
  const service = createServiceClient();
  const { data: rows } = await service
    .from("entry_notes")
    .select("id, user_id, parent_id, body, helpful, kind, created_at")
    .eq("entry_id", id)
    .eq("hidden", false)
    .order("created_at", { ascending: true })
    .limit(300);
  const people = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: profiles } = people.length
    ? await service.from("profiles").select("id, nickname").in("id", people)
    : { data: [] as { id: string; nickname: string }[] };
  const nick = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));
  const top: EntryNote[] = [];
  const byId = new Map<string, EntryNote>();
  for (const r of rows ?? []) {
    const n: EntryNote = {
      id: r.id,
      kind: r.kind === "feedback" ? "feedback" : "comment",
      body: r.body,
      nickname: nick.get(r.user_id) ?? "알 수 없음",
      createdAt: r.created_at,
      mine: me === r.user_id,
      byOwner: Boolean(e.user_id) && r.user_id === e.user_id,
      helpful: r.helpful === true,
      replies: [],
    };
    byId.set(r.id, n);
    const parent = r.parent_id ? byId.get(r.parent_id) : null;
    // 답글은 원글 쪽(댓글/피드백)을 따른다
    if (parent) parent.replies.push({ ...n, kind: parent.kind });
    else top.push(n);
  }
  const newest = top.reverse();
  const comments = newest.filter((n) => n.kind === "comment");
  // 주인이 도움됐다고 한 피드백이 맨 위, 그다음 새것. 답글은 그 아래에 오래된 순
  const feedback = newest.filter((n) => n.kind === "feedback").sort((a, b) => Number(b.helpful) - Number(a.helpful));
  const size = (xs: EntryNote[]) => xs.reduce((a, n) => a + 1 + n.replies.length, 0);
  const body: EntryNotes = {
    feedbackOn: e.feedback_on !== false,
    wantsFeedback: e.wants_feedback === true,
    ask: e.feedback_ask ?? null,
    owner: Boolean(me) && me === e.user_id,
    loggedIn: Boolean(me),
    count: size(comments),
    feedbackCount: size(feedback),
    comments,
    feedback,
  };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t = requestT(req);
  const { id } = await ctx.params;
  if (!ID.test(id)) return Response.json({ error: t("잘못된 요청이에요.", "Invalid request.") }, { status: 400 });
  const me = await viewer();
  if (!me) return Response.json({ error: t("로그인하면 댓글을 남길 수 있어요.", "Log in to comment.") }, { status: 401 });
  if (!allow(`entry-note:${me}`, 30, 3_600_000)) {
    return tooMany(t("너무 자주 남겼어요. 잠깐 쉬었다가 다시 해 주세요.", "Too many notes. Take a breather and try again."));
  }

  const input = (await req.json().catch(() => ({}))) as { body?: unknown; kind?: unknown; parentId?: unknown };
  const text = typeof input.body === "string" ? input.body.trim() : "";
  let kind: NoteKind = input.kind === "feedback" ? "feedback" : "comment";
  if (!text) return Response.json({ error: t("한 줄이라도 적어 주세요.", "Please write at least one line.") }, { status: 400 });
  if (text.length > MAX_ENTRY_NOTE) return Response.json({ error: t(`${MAX_ENTRY_NOTE}자까지예요.`, `Up to ${MAX_ENTRY_NOTE} characters.`) }, { status: 400 });

  const e = await entryOf(id);
  if (!e) return Response.json({ error: t("내려간 목소리예요.", "This voice was removed.") }, { status: 404 });
  const owner = e.user_id === me;
  if (e.feedback_on === false && !owner) {
    return Response.json({ error: t("❤ 만 받는 목소리예요.", "This voice only takes ❤.") }, { status: 403 });
  }

  const service = createServiceClient();
  // 답글은 한 단계만 — 답글에 답하면 원 댓글 아래에 붙이고, 알림은 답한 그 사람에게.
  let parentId: string | null = null;
  let replyTo: string | null = null;
  if (typeof input.parentId === "string" && ID.test(input.parentId)) {
    const { data: p } = await service.from("entry_notes").select("id, user_id, parent_id, kind").eq("id", input.parentId).eq("entry_id", id).maybeSingle();
    if (p) {
      parentId = p.parent_id ?? p.id;
      replyTo = p.user_id;
      kind = p.kind === "feedback" ? "feedback" : "comment";
    }
  }

  // 피드백 원글 — 주인이 부탁한 목소리에만, 주인 자신은 못 쓴다(주인은 답글로 되묻는다)
  const feedbackTop = kind === "feedback" && !parentId;
  if (feedbackTop) {
    if (!e.wants_feedback) return Response.json({ error: t("피드백을 부탁하지 않은 목소리예요. 댓글로 남겨 주세요.", "This voice isn't asking for feedback. Leave a comment instead.") }, { status: 403 });
    if (owner) return Response.json({ error: t("내 목소리엔 피드백 대신 답글로 남겨요.", "Reply instead on your own voice.") }, { status: 403 });
  }

  const { count } = await service.from("entry_notes").select("id", { count: "exact", head: true }).eq("entry_id", id).eq("user_id", me);
  if ((count ?? 0) >= MAX_NOTES_PER_ENTRY) {
    return Response.json({ error: t("이 목소리에는 충분히 남겼어요.", "You've left plenty on this one.") }, { status: 409 });
  }

  const { data: note, error } = await service
    .from("entry_notes")
    .insert({ entry_id: id, user_id: me, body: text, parent_id: parentId, kind })
    .select("id")
    .single();
  if (error || !note) return Response.json({ error: t("남기지 못했어요. 다시 해 주세요.", "Couldn't post. Please try again.") }, { status: 500 });

  // 알림 — 남의 목소리에 단 댓글은 주인에게, 답글은 답한 상대에게. 나에게는 안 보낸다.
  const push = (title: string) => ({ title, body: text.slice(0, 80), url: `/weekly/e/${id}` });
  if (replyTo && replyTo !== me) {
    await notify({
      userId: replyTo,
      kind: "note_reply",
      actor: me,
      entryId: id,
      push: push(kind === "feedback" ? t("내 피드백에 답글이 달렸어요", "Someone replied to your feedback") : t("내 댓글에 답글이 달렸어요", "Someone replied to you")),
    });
  }
  if (!owner && e.user_id && e.user_id !== replyTo) {
    const title = kind === "feedback" ? t("부탁한 피드백이 왔어요 🎯", "Feedback arrived 🎯") : t("내 목소리에 댓글이 달렸어요 💬", "New comment on your voice 💬");
    await notify({ userId: e.user_id, kind: kind === "feedback" ? "note_feedback" : "note", actor: me, entryId: id, push: push(title) });
  }
  // 이 목소리에 처음 남긴 피드백이면 XP 를 받는다 — 화면이 "+40 XP" 를 띄운다
  let xp = 0;
  if (feedbackTop) {
    const { count: mine } = await service.from("entry_notes").select("id", { count: "exact", head: true }).eq("entry_id", id).eq("user_id", me).eq("kind", "feedback").is("parent_id", null);
    if ((mine ?? 0) === 1) xp = FEEDBACK_XP.give;
  }
  return Response.json({ id: note.id, xp });
}

/**
 * 주인만. 두 가지:
 *  - 받는 방식 바꾸기 { feedbackOn?, wantsFeedback?, ask? } — 피드백 요청은 댓글을 연다
 *  - 댓글에 "도움됐어요" { noteId, helpful } — 켜면 쓴 사람에게 알림(한 번만)
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t = requestT(req);
  const { id } = await ctx.params;
  if (!ID.test(id)) return Response.json({ error: "bad request" }, { status: 400 });
  const [me, e] = await Promise.all([viewer(), entryOf(id)]);
  if (!me || !e || e.user_id !== me) return Response.json({ error: t("내 목소리만 바꿀 수 있어요.", "Only your own voice.") }, { status: 403 });
  const input = (await req.json().catch(() => ({}))) as { feedbackOn?: unknown; wantsFeedback?: unknown; ask?: unknown; noteId?: unknown; helpful?: unknown };
  const service = createServiceClient();

  if (typeof input.noteId === "string" && ID.test(input.noteId)) {
    const on = input.helpful === true;
    // 도움됐어요는 피드백 원글에만
    const { data: n } = await service
      .from("entry_notes")
      .update({ helpful: on })
      .eq("id", input.noteId)
      .eq("entry_id", id)
      .eq("kind", "feedback")
      .is("parent_id", null)
      .select("user_id")
      .maybeSingle();
    if (n && on && n.user_id !== me) {
      await notify({
        userId: n.user_id,
        kind: "note_helpful",
        actor: me,
        entryId: id,
        push: {
          title: t(`내 피드백이 도움됐대요 👍 +${FEEDBACK_XP.helpful} XP`, `Your feedback helped 👍 +${FEEDBACK_XP.helpful} XP`),
          body: t("들어 준 목소리에서 확인해 보세요", "See it on the voice you reviewed"),
          url: `/weekly/e/${id}`,
        },
        pushKey: `helpful:${input.noteId}`,
      });
    }
    return Response.json({ helpful: on });
  }

  const patch: { feedback_on?: boolean; wants_feedback?: boolean; feedback_ask?: string | null } = {};
  if (typeof input.feedbackOn === "boolean") patch.feedback_on = input.feedbackOn;
  if (typeof input.wantsFeedback === "boolean") {
    patch.wants_feedback = input.wantsFeedback;
    if (input.wantsFeedback) patch.feedback_on = true;
  }
  if (patch.feedback_on === false) patch.wants_feedback = false;
  if (typeof input.ask === "string") patch.feedback_ask = input.ask.trim().slice(0, MAX_FEEDBACK_ASK) || null;
  await service.from("weekly_entries").update(patch).eq("id", id);
  return Response.json({ ok: true });
}

/** 지우기 — 쓴 사람, 또는 출전작 주인(자기 목소리에 달린 것). 답글도 같이 지워진다. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t = requestT(req);
  const { id } = await ctx.params;
  const noteId = new URL(req.url).searchParams.get("note") ?? "";
  if (!ID.test(id) || !ID.test(noteId)) return Response.json({ error: "bad request" }, { status: 400 });
  const me = await viewer();
  if (!me) return Response.json({ error: t("로그인이 필요해요.", "Log in first.") }, { status: 401 });
  const service = createServiceClient();
  const [{ data: n }, e] = await Promise.all([
    service.from("entry_notes").select("id, user_id").eq("id", noteId).eq("entry_id", id).maybeSingle(),
    entryOf(id),
  ]);
  if (!n) return Response.json({ ok: true });
  if (n.user_id !== me && e?.user_id !== me) return Response.json({ error: t("지울 수 없어요.", "You can't delete this.") }, { status: 403 });
  await service.from("entry_notes").delete().eq("id", noteId);
  return Response.json({ ok: true });
}
