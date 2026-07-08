import type { Metadata } from "next";
import Link from "next/link";

import { DeleteButton } from "@/components/delete-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Class } from "@/features/classes/types";
import { deleteRubric } from "@/features/performance/actions";
import { GradeRow } from "@/features/performance/grade-row";
import { RubricDialog } from "@/features/performance/rubric-dialog";
import type {
  PerformanceGrade,
  Rubric,
} from "@/features/performance/types";
import type { Student } from "@/features/students/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Performance grades",
};

const DEFAULT_TERM = "2025-2026 · 2. Dönem";

export default async function PerformanceGradesPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; rubricId?: string; term?: string }>;
}) {
  const params = await searchParams;
  const term = params.term?.trim() || DEFAULT_TERM;
  const supabase = await createClient();

  const [classesResult, rubricsResult] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, grade, section, academic_year, created_at")
      .order("grade")
      .order("section"),
    supabase
      .from("rubrics")
      .select("id, name, criteria, created_at")
      .order("created_at"),
  ]);
  if (classesResult.error) {
    console.error("Failed to load classes:", classesResult.error);
    throw new Error("Failed to load classes.");
  }
  const classes: Class[] = classesResult.data ?? [];
  const rubrics: Rubric[] = rubricsResult.data ?? [];
  const selectedClass =
    classes.find((cls) => cls.id === params.classId) ?? classes[0];
  const selectedRubric =
    rubrics.find((r) => r.id === params.rubricId) ?? rubrics[0];

  let students: Student[] = [];
  let grades: PerformanceGrade[] = [];
  let noteCounts = new Map<string, number>();

  if (selectedClass) {
    const studentsResult = await supabase
      .from("students")
      .select("id, class_id, student_number, first_name, last_name, created_at")
      .eq("class_id", selectedClass.id)
      .order("student_number");
    students = studentsResult.data ?? [];

    if (students.length > 0) {
      const studentIds = students.map((s) => s.id);
      const [gradesResult, notesResult] = await Promise.all([
        supabase
          .from("performance_grades")
          .select(
            "id, class_id, student_id, rubric_id, term, criteria_scores, suggested_score, final_score, rationale, created_at",
          )
          .eq("class_id", selectedClass.id)
          .eq("term", term),
        supabase
          .from("performance_notes")
          .select("student_id")
          .in("student_id", studentIds),
      ]);
      grades = gradesResult.data ?? [];
      noteCounts = (notesResult.data ?? []).reduce((map, row) => {
        map.set(row.student_id, (map.get(row.student_id) ?? 0) + 1);
        return map;
      }, new Map<string, number>());
    }
  }

  const gradeByStudent = new Map(grades.map((g) => [g.student_id, g]));
  const query = (overrides: Record<string, string>) => {
    const q = new URLSearchParams({
      ...(selectedClass ? { classId: selectedClass.id } : {}),
      ...(selectedRubric ? { rubricId: selectedRubric.id } : {}),
      term,
      ...overrides,
    });
    return `/performance/grades?${q}`;
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Performance grades
        </h1>
        <Button asChild variant="outline">
          <Link href="/performance">← Notes</Link>
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Rubrics</CardTitle>
              <RubricDialog />
            </div>
          </CardHeader>
          <CardContent>
            {rubrics.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No rubrics yet. Create one to grade term performance.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {rubrics.map((rubric) => (
                  <li
                    key={rubric.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <Link
                      href={query({ rubricId: rubric.id })}
                      className={`min-w-0 hover:underline ${
                        rubric.id === selectedRubric?.id ? "font-semibold" : ""
                      }`}
                    >
                      {rubric.name}
                      <span className="text-muted-foreground ml-2 text-sm font-normal">
                        {rubric.criteria
                          .map((c) => `${c.name} %${c.weight}`)
                          .join(" · ")}
                      </span>
                    </Link>
                    <span className="flex shrink-0 items-center">
                      <RubricDialog rubric={rubric} />
                      <DeleteButton
                        action={deleteRubric.bind(null, rubric.id)}
                        confirmText="Delete this rubric? Existing grades keep their scores."
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {classes.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center">
            No classes yet. Create a class first.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {classes.map((cls) => (
                <Button
                  key={cls.id}
                  asChild
                  variant={
                    cls.id === selectedClass?.id ? "default" : "outline"
                  }
                  size="sm"
                >
                  <Link href={query({ classId: cls.id })}>{cls.name}</Link>
                </Button>
              ))}
              <form className="ml-auto flex items-center gap-2" action="/performance/grades">
                {selectedClass && (
                  <input type="hidden" name="classId" value={selectedClass.id} />
                )}
                {selectedRubric && (
                  <input type="hidden" name="rubricId" value={selectedRubric.id} />
                )}
                <input
                  name="term"
                  defaultValue={term}
                  className="border-input bg-background h-8 w-48 rounded-md border px-2 text-sm"
                  aria-label="Term"
                />
                <Button type="submit" variant="outline" size="sm">
                  Set term
                </Button>
              </form>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedClass?.name} — {term}
                  {selectedRubric ? ` · ${selectedRubric.name}` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    No students in this class yet.
                  </p>
                ) : (
                  <ul className="divide-border divide-y">
                    {students.map((student) => (
                      <GradeRow
                        key={student.id}
                        studentLabel={`#${student.student_number} ${student.first_name} ${student.last_name}`}
                        noteCount={noteCounts.get(student.id) ?? 0}
                        classId={student.class_id}
                        studentId={student.id}
                        rubricId={selectedRubric?.id ?? null}
                        term={term}
                        grade={gradeByStudent.get(student.id) ?? null}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
