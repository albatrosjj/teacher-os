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
import type { Exam, ExamResult, QuestionScore } from "@/features/exams/types";
import type { PerformanceNote } from "@/features/performance/types";
import type { Student } from "@/features/students/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reports",
};

function buildHref(params: {
  classId?: string;
  subject?: string;
  examId?: string;
  perf?: boolean;
}): string {
  const query = new URLSearchParams();
  if (params.classId) query.set("classId", params.classId);
  if (params.subject) query.set("subject", params.subject);
  if (params.examId) query.set("examId", params.examId);
  if (params.perf) query.set("perf", "1");
  const qs = query.toString();
  return qs ? `/reports?${qs}` : "/reports";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    classId?: string;
    subject?: string;
    examId?: string;
    perf?: string;
  }>;
}) {
  const params = await searchParams;
  const includePerf = params.perf === "1";
  const supabase = await createClient();

  const { data: classesData, error: classesError } = await supabase
    .from("classes")
    .select("id, name, grade, section, academic_year, created_at")
    .order("grade")
    .order("section");
  if (classesError) {
    console.error("Failed to load classes:", classesError);
    throw new Error("Failed to load classes.");
  }
  const classes: Class[] = classesData ?? [];
  const selectedClass =
    classes.find((cls) => cls.id === params.classId) ?? classes[0];

  let students: Student[] = [];
  let exams: Exam[] = [];
  let notes: PerformanceNote[] = [];

  if (selectedClass) {
    const [studentsResult, examsResult] = await Promise.all([
      supabase
        .from("students")
        .select(
          "id, class_id, student_number, first_name, last_name, created_at",
        )
        .eq("class_id", selectedClass.id)
        .order("student_number"),
      supabase
        .from("exams")
        .select("id, class_id, title, subject, exam_date, questions, created_at")
        .eq("class_id", selectedClass.id)
        .order("exam_date"),
    ]);
    students = studentsResult.data ?? [];
    exams = examsResult.data ?? [];

    if (includePerf && students.length > 0) {
      const notesResult = await supabase
        .from("performance_notes")
        .select("id, student_id, note, rating, noted_on, created_at")
        .in(
          "student_id",
          students.map((s) => s.id),
        );
      notes = notesResult.data ?? [];
    }
  }

  const subjects = Array.from(
    new Set(exams.map((e) => e.subject).filter((s): s is string => !!s)),
  ).sort();
  const selectedSubject = subjects.includes(params.subject ?? "")
    ? params.subject
    : undefined;
  const subjectExams = selectedSubject
    ? exams.filter((e) => e.subject === selectedSubject)
    : exams;
  const selectedExam = subjectExams.find((e) => e.id === params.examId);
  const shownExams = selectedExam ? [selectedExam] : subjectExams;

  let results: ExamResult[] = [];
  if (shownExams.length > 0) {
    const resultsResult = await supabase
      .from("exam_results")
      .select(
        "id, exam_id, student_id, scores, total_score, overall_feedback, pages, created_at",
      )
      .in(
        "exam_id",
        shownExams.map((e) => e.id),
      );
    results = resultsResult.data ?? [];
  }

  const resultBy = new Map(
    results.map((r) => [`${r.exam_id}:${r.student_id}`, r]),
  );

  // Performance summary per student: note count and average rating.
  const perfByStudent = new Map<string, { count: number; avg: number | null }>();
  if (includePerf) {
    for (const student of students) {
      const own = notes.filter((n) => n.student_id === student.id);
      const rated = own.filter((n) => n.rating != null);
      perfByStudent.set(student.id, {
        count: own.length,
        avg:
          rated.length > 0
            ? rated.reduce((sum, n) => sum + (n.rating ?? 0), 0) / rated.length
            : null,
      });
    }
  }

  const base = {
    classId: selectedClass?.id,
    subject: selectedSubject,
    examId: selectedExam?.id,
    perf: includePerf,
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Reports</h1>

      {classes.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          No classes yet. Create a class first.
        </p>
      ) : (
        <div className="grid gap-6">
          {/* Filters */}
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground w-16 text-sm">Class</span>
              {classes.map((cls) => (
                <Button
                  key={cls.id}
                  asChild
                  variant={cls.id === selectedClass?.id ? "default" : "outline"}
                  size="sm"
                >
                  <Link
                    href={buildHref({ classId: cls.id, perf: includePerf })}
                  >
                    {cls.name}
                  </Link>
                </Button>
              ))}
            </div>
            {subjects.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground w-16 text-sm">
                  Subject
                </span>
                <Button
                  asChild
                  variant={!selectedSubject ? "default" : "outline"}
                  size="sm"
                >
                  <Link href={buildHref({ ...base, subject: undefined, examId: undefined })}>
                    All
                  </Link>
                </Button>
                {subjects.map((subject) => (
                  <Button
                    key={subject}
                    asChild
                    variant={subject === selectedSubject ? "default" : "outline"}
                    size="sm"
                  >
                    <Link
                      href={buildHref({ ...base, subject, examId: undefined })}
                    >
                      {subject}
                    </Link>
                  </Button>
                ))}
              </div>
            )}
            {subjectExams.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground w-16 text-sm">Exam</span>
                <Button
                  asChild
                  variant={!selectedExam ? "default" : "outline"}
                  size="sm"
                >
                  <Link href={buildHref({ ...base, examId: undefined })}>
                    All
                  </Link>
                </Button>
                {subjectExams.map((exam) => (
                  <Button
                    key={exam.id}
                    asChild
                    variant={exam.id === selectedExam?.id ? "default" : "outline"}
                    size="sm"
                  >
                    <Link href={buildHref({ ...base, examId: exam.id })}>
                      {exam.title}
                    </Link>
                  </Button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground w-16 text-sm">Extra</span>
              <Button
                asChild
                variant={includePerf ? "default" : "outline"}
                size="sm"
              >
                <Link href={buildHref({ ...base, perf: !includePerf })}>
                  {includePerf ? "✓ " : ""}Performance
                </Link>
              </Button>
            </div>
          </div>

          {/* Score table */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedClass?.name} — scores</CardTitle>
              <CardDescription>
                {shownExams.length === 0
                  ? "No exams match the filters."
                  : selectedExam
                    ? `${selectedExam.title} (${selectedExam.exam_date})`
                    : `${shownExams.length} exam${shownExams.length === 1 ? "" : "s"}`}
                {includePerf ? " · performance included" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-border border-b text-left">
                    <th className="py-2 pr-3 font-medium">Student</th>
                    {shownExams.map((exam) => (
                      <th key={exam.id} className="px-3 py-2 text-right font-medium">
                        {exam.title}
                      </th>
                    ))}
                    {includePerf && (
                      <th className="px-3 py-2 text-right font-medium">
                        Perf. (avg/5 · notes)
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const perf = perfByStudent.get(student.id);
                    return (
                      <tr key={student.id} className="border-border border-b">
                        <td className="py-2 pr-3">
                          <span className="text-muted-foreground mr-2 font-mono tabular-nums">
                            #{student.student_number}
                          </span>
                          {student.first_name} {student.last_name}
                        </td>
                        {shownExams.map((exam) => {
                          const result = resultBy.get(
                            `${exam.id}:${student.id}`,
                          );
                          return (
                            <td
                              key={exam.id}
                              className="px-3 py-2 text-right tabular-nums"
                            >
                              {result ? result.total_score : "—"}
                            </td>
                          );
                        })}
                        {includePerf && (
                          <td className="px-3 py-2 text-right tabular-nums">
                            {perf && perf.count > 0
                              ? `${perf.avg != null ? perf.avg.toFixed(1) : "—"} · ${perf.count}`
                              : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Exam analysis */}
          {selectedExam && (
            <Card>
              <CardHeader>
                <CardTitle>Exam analysis</CardTitle>
                <CardDescription>
                  Class success per question, matched to learning outcomes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const examResults = results.filter(
                    (r) => r.exam_id === selectedExam.id,
                  );
                  if (examResults.length === 0) {
                    return (
                      <p className="text-muted-foreground py-6 text-center text-sm">
                        No graded papers for this exam yet.
                      </p>
                    );
                  }
                  return (
                    <div className="grid gap-3">
                      {selectedExam.questions.map((q) => {
                        const scores = examResults
                          .map(
                            (r) =>
                              (r.scores as QuestionScore[]).find(
                                (s) => s.no === q.no,
                              )?.score,
                          )
                          .filter((s): s is number => s != null);
                        const pct =
                          scores.length > 0
                            ? Math.round(
                                (scores.reduce((a, b) => a + b, 0) /
                                  (scores.length * q.max_points)) *
                                  100,
                              )
                            : 0;
                        return (
                          <div key={q.no} className="grid gap-1">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="font-medium">
                                Q{q.no}
                                {q.outcome ? (
                                  <span className="text-muted-foreground ml-2 font-normal">
                                    {q.outcome}
                                  </span>
                                ) : null}
                              </span>
                              <span className="shrink-0 font-semibold tabular-nums">
                                %{pct}
                              </span>
                            </div>
                            <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
                              <div
                                className={`h-full rounded-full ${
                                  pct >= 70
                                    ? "bg-green-500"
                                    : pct >= 40
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                }`}
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-muted-foreground mt-2 text-xs">
                        Success = class average score on the question as a
                        percentage of its full points ({results.filter((r) => r.exam_id === selectedExam.id).length} paper
                        {results.filter((r) => r.exam_id === selectedExam.id).length === 1 ? "" : "s"}).
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
