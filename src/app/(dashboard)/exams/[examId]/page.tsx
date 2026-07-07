import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { deleteExam } from "@/features/exams/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExamScanner } from "@/features/exams/exam-scanner";
import type { Exam, ExamResult, QuestionScore } from "@/features/exams/types";
import type { Student } from "@/features/students/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Exam",
};

// AI grading can take up to a minute per paper.
export const maxDuration = 120;

export default async function ExamPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data: exam, error: examError } = (await supabase
    .from("exams")
    .select("id, class_id, title, subject, exam_date, questions, created_at")
    .eq("id", examId)
    .maybeSingle()) as { data: Exam | null; error: unknown };

  if (examError) {
    console.error("Failed to load exam:", examError);
    throw new Error("Failed to load exam.");
  }
  if (!exam) notFound();

  const [studentsResult, resultsResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, class_id, student_number, first_name, last_name, created_at")
      .eq("class_id", exam.class_id)
      .order("student_number"),
    supabase
      .from("exam_results")
      .select(
        "id, exam_id, student_id, scores, total_score, overall_feedback, pages, created_at",
      )
      .eq("exam_id", examId),
  ]);

  if (studentsResult.error || resultsResult.error) {
    console.error(
      "Failed to load exam data:",
      studentsResult.error ?? resultsResult.error,
    );
    throw new Error("Failed to load exam data.");
  }

  const students: Student[] = studentsResult.data ?? [];
  const results: ExamResult[] = resultsResult.data ?? [];
  const resultByStudent = new Map(results.map((r) => [r.student_id, r]));
  const maxTotal = exam.questions.reduce((sum, q) => sum + q.max_points, 0);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{exam.title}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {exam.subject ? `${exam.subject} · ` : ""}
            {exam.exam_date} · {exam.questions.length} questions · {maxTotal}{" "}
            points · {results.length}/{students.length} papers graded
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild variant="outline" size="sm">
            <a href={`/exams/${exam.id}/edit`}>Edit</a>
          </Button>
          <DeleteButton
            action={deleteExam.bind(null, exam.id)}
            confirmText="Delete this exam and all its results?"
            redirectTo="/exams"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan papers</CardTitle>
          <CardDescription>
            Scan each paper&apos;s front side, then its back side, and repeat
            for the whole class. The front side must show the student&apos;s
            name — the AI matches it to the roster automatically. When all
            papers are scanned, tap &ldquo;Finish scanning&rdquo;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExamScanner examId={exam.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Results</CardTitle>
            {results.some((r) => r.pages?.length) && (
              <Button asChild variant="outline" size="sm">
                <a href={`/exams/${exam.id}/annotated`} download>
                  Download marked PDF
                </a>
              </Button>
            )}
          </div>
          {results.some((r) => r.pages?.length) && (
            <CardDescription>
              The PDF shows each paper with scores written in red. Scanned
              photos are kept for 24 hours, then deleted automatically.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No papers graded yet.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {students
                .filter((s) => resultByStudent.has(s.id))
                .map((student) => {
                  const result = resultByStudent.get(student.id)!;
                  const scores = result.scores as QuestionScore[];
                  return (
                    <li key={student.id} className="py-4">
                      <details>
                        <summary className="flex cursor-pointer items-center justify-between gap-3">
                          <span>
                            <span className="text-muted-foreground mr-2 font-mono text-sm tabular-nums">
                              #{student.student_number}
                            </span>
                            {student.first_name} {student.last_name}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {result.total_score} / {maxTotal}
                          </span>
                        </summary>
                        <div className="mt-3 grid gap-2 text-sm">
                          {scores.map((s) => (
                            <div
                              key={s.no}
                              className="bg-muted/50 rounded-md px-3 py-2"
                            >
                              <div className="flex justify-between font-medium">
                                <span>Question {s.no}</span>
                                <span className="tabular-nums">{s.score} pts</span>
                              </div>
                              <p className="text-muted-foreground mt-1">
                                {s.rationale}
                              </p>
                            </div>
                          ))}
                          {result.overall_feedback && (
                            <p className="text-muted-foreground mt-1 italic">
                              {result.overall_feedback}
                            </p>
                          )}
                        </div>
                      </details>
                    </li>
                  );
                })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
