import { redirect } from "next/navigation";

/** 연습 피드백 게시판은 갤러리로 합쳤다(11/6). 예전 링크는 갤러리의 피드백 칸으로. */
export default function BoardPage(): never {
  redirect("/weekly?f=feedback");
}
