import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { Class } from "@/features/classes/types";
import { ExamForm } from "@/features/exams/exam-form";
import type { Exam } from "@/features/exams/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit Exam",
};

export default async function EditExamPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const supabase = await createClient();

  const [examResult, classesResult] = await Promise.all([
    supabase
      .from("exams")
      .select("id, class_id, title, subject, exam_date, questions, created_at")
      .eq("id", examId)
      .maybeSingle(),
    supabase
      .from("classes")
      .select("id, name, grade, section, academic_year, created_at")
      .order("grade")
      .order("section"),
  ]);

  const exam = examResult.data as Exam | null;
  if (examResult.error || classesResult.error) {
    console.error(
      "Failed to load exam for editing:",
      examResult.error ?? classesResult.error,
    );
    throw new Error("Failed to load exam.");
  }
  if (!exam) notFound();

  const classes: Class[] = classesResult.data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Edit Exam</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Changing questions after papers were graded doesn&apos;t re-grade
          them — re-scan the papers if the answer key changed.
        </p>
      </div>
      <ExamForm classes={classes} exam={exam} />
    </div>
  );
}
