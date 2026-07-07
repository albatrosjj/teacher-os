import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Class } from "@/features/classes/types";
import type { Exam } from "@/features/exams/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Exams",
};

export default async function ExamsPage() {
  const supabase = await createClient();

  const [classesResult, examsResult] = await Promise.all([
    supabase.from("classes").select("id, name"),
    supabase
      .from("exams")
      .select("id, class_id, title, exam_date, questions, created_at")
      .order("exam_date", { ascending: false }),
  ]);

  if (classesResult.error || examsResult.error) {
    console.error(
      "Failed to load exams:",
      classesResult.error ?? examsResult.error,
    );
    throw new Error("Failed to load exams.");
  }

  const classNames = new Map(
    (classesResult.data ?? []).map((cls: Pick<Class, "id" | "name">) => [
      cls.id,
      cls.name,
    ]),
  );
  const exams: Exam[] = examsResult.data ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Exams</h1>
        <Button asChild>
          <Link href="/exams/new">New exam</Link>
        </Button>
      </div>
      {exams.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          No exams yet. Create your first exam to start AI grading.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {exams.map((exam) => (
            <Link key={exam.id} href={`/exams/${exam.id}`}>
              <Card className="hover:bg-muted/50 h-full transition-colors">
                <CardHeader>
                  <CardTitle>{exam.title}</CardTitle>
                  <CardDescription>
                    {classNames.get(exam.class_id) ?? "Unknown class"} ·{" "}
                    {exam.exam_date} · {exam.questions.length} question
                    {exam.questions.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
