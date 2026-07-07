import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/delete-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteStudent } from "@/features/students/actions";
import { EditStudentDialog } from "@/features/students/edit-student-dialog";
import { NewNoteForm } from "@/features/performance/new-note-form";
import { NoteList } from "@/features/performance/note-list";
import type { PerformanceNote } from "@/features/performance/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Student",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  if (!UUID_PATTERN.test(studentId)) {
    notFound();
  }

  const supabase = await createClient();

  const [studentResult, notesResult, classesResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, class_id, student_number, first_name, last_name, created_at")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("performance_notes")
      .select("id, student_id, note, rating, noted_on, created_at")
      .eq("student_id", studentId)
      .order("noted_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("classes")
      .select("id, name, grade, section, academic_year, created_at")
      .order("grade")
      .order("section"),
  ]);

  if (studentResult.error || notesResult.error || classesResult.error) {
    console.error(
      "Failed to load student:",
      studentResult.error ?? notesResult.error ?? classesResult.error,
    );
    throw new Error("Failed to load student.");
  }

  const student = studentResult.data;
  if (!student) {
    notFound();
  }

  const notes: PerformanceNote[] = notesResult.data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {student.first_name} {student.last_name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Student number{" "}
            <span className="font-mono tabular-nums">
              #{student.student_number}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <EditStudentDialog
            student={student}
            classes={classesResult.data ?? []}
          />
          <DeleteButton
            action={deleteStudent.bind(null, student.id)}
            confirmText={`Delete ${student.first_name} ${student.last_name}? Their notes and exam results are deleted too.`}
            redirectTo="/students"
          />
        </div>
      </div>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>New performance note</CardTitle>
          </CardHeader>
          <CardContent>
            <NewNoteForm studentId={student.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              Performance notes{notes.length > 0 ? ` (${notes.length})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NoteList notes={notes} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
