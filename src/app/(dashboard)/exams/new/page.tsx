import type { Metadata } from "next";

import type { Class } from "@/features/classes/types";
import { ExamForm } from "@/features/exams/exam-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New Exam",
};

export default async function NewExamPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select("id, name, grade, section, academic_year, created_at")
    .order("grade")
    .order("section");

  if (error) {
    console.error("Failed to load classes:", error);
    throw new Error("Failed to load classes.");
  }

  const classes: Class[] = data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">New Exam</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Define the questions and answer key. The AI grades each paper
          against this key, so describe what earns partial credit.
        </p>
      </div>
      {classes.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          No classes yet. Create a class first.
        </p>
      ) : (
        <ExamForm classes={classes} />
      )}
    </div>
  );
}
