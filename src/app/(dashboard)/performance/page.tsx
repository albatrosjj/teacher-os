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
import { deletePerformanceNote } from "@/features/performance/actions";
import { EditNoteDialog } from "@/features/performance/edit-note-dialog";
import type { PerformanceNote } from "@/features/performance/types";
import type { Student } from "@/features/students/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Performance",
};

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const { classId } = await searchParams;
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
  const selected = classes.find((cls) => cls.id === classId) ?? classes[0];

  let students: Student[] = [];
  let notes: (PerformanceNote & { students?: unknown })[] = [];

  if (selected) {
    const studentsResult = await supabase
      .from("students")
      .select("id, class_id, student_number, first_name, last_name, created_at")
      .eq("class_id", selected.id)
      .order("student_number");
    students = studentsResult.data ?? [];

    if (students.length > 0) {
      const notesResult = await supabase
        .from("performance_notes")
        .select("id, student_id, note, rating, noted_on, created_at")
        .in(
          "student_id",
          students.map((s) => s.id),
        )
        .order("noted_on", { ascending: false })
        .order("created_at", { ascending: false });
      notes = notesResult.data ?? [];
    }
  }

  const studentById = new Map(students.map((s) => [s.id, s]));

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
        <Button asChild>
          <Link href="/voice">🎙️ Voice note</Link>
        </Button>
      </div>

      {classes.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          No classes yet. Create a class first.
        </p>
      ) : (
        <div className="grid gap-6">
          <div className="flex flex-wrap gap-2">
            {classes.map((cls) => (
              <Button
                key={cls.id}
                asChild
                variant={cls.id === selected?.id ? "default" : "outline"}
                size="sm"
              >
                <Link href={`/performance?classId=${cls.id}`}>{cls.name}</Link>
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {selected?.name} — notes{notes.length > 0 ? ` (${notes.length})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No performance notes in this class yet. Add them from a
                  student&apos;s page or with a voice note.
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {notes.map((note) => {
                    const student = studentById.get(note.student_id);
                    return (
                      <li key={note.id} className="grid gap-1 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={`/students/${note.student_id}`}
                            className="font-medium hover:underline"
                          >
                            {student
                              ? `#${student.student_number} ${student.first_name} ${student.last_name}`
                              : "Unknown student"}
                          </Link>
                          <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                            {note.noted_on}
                            {note.rating ? ` · ${note.rating}/5` : ""}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm">{note.note}</p>
                          <span className="flex shrink-0 items-center">
                            <EditNoteDialog note={note} />
                            <DeleteButton
                              action={deletePerformanceNote.bind(null, note.id)}
                              confirmText="Delete this note?"
                            />
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
