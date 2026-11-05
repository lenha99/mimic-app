import { redirect } from "next/navigation";

/** 게시판 글은 같은 id 로 갤러리 출전작이 됐다(마이그레이션 31). 예전 링크는 그 출전작으로. */
export default async function BoardPostPage({ params }: { params: Promise<{ id: string }> }): Promise<never> {
  const { id } = await params;
  redirect(/^[0-9a-f-]{36}$/i.test(id) ? `/weekly/e/${id}` : "/weekly?f=feedback");
}
