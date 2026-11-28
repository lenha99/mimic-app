import type { Metadata } from "next";
import ExamView from "./exam-view";

export const metadata: Metadata = { title: "승급전 · VOICE PASS" };

export default function ExamPage() {
  return <ExamView />;
}
