import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const [studentResult, notesResult] = await Promise.all([
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
  ]);

  if (studentResult.error || notesResult.error) {
    console.error(
      "Failed to load student:",
      studentResult.error ?? notesResult.error,
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
      <div className="mb-8">
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
