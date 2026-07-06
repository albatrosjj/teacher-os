import type { Metadata } from "next";

import type { Class } from "@/features/classes/types";
import { ClassRoster } from "@/features/students/class-roster";
import { NewStudentDialog } from "@/features/students/new-student-dialog";
import type { Student } from "@/features/students/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Students",
};

export default async function StudentsPage() {
  const supabase = await createClient();

  const [classesResult, studentsResult] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, grade, section, academic_year, created_at")
      .order("grade")
      .order("section"),
    supabase
      .from("students")
      .select("id, class_id, student_number, first_name, last_name, created_at")
      .order("student_number"),
  ]);

  if (classesResult.error || studentsResult.error) {
    console.error(
      "Failed to load students:",
      classesResult.error ?? studentsResult.error,
    );
    throw new Error("Failed to load students.");
  }

  const classes: Class[] = classesResult.data ?? [];
  const students: Student[] = studentsResult.data ?? [];

  const rosters = classes
    .map((cls) => ({
      class: cls,
      students: students.filter((student) => student.class_id === cls.id),
    }))
    .filter((roster) => roster.students.length > 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Students</h1>
        <NewStudentDialog classes={classes} />
      </div>
      {rosters.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          {classes.length === 0
            ? "No classes yet. Create a class before adding students."
            : "No students yet. Add your first student to get started."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rosters.map((roster) => (
            <ClassRoster
              key={roster.class.id}
              className={roster.class.name}
              students={roster.students}
            />
          ))}
        </div>
      )}
    </div>
  );
}
