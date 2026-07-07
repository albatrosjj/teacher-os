"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { MAX_IMPORT_ROWS, type ImportedStudent } from "./import";
import type { ActionResult } from "./types";
import { validateStudentInput } from "./validation";

export async function createStudent(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const validation = validateStudentInput(formData);
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  const { classId, studentNumber, firstName, lastName } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.from("students").insert({
    class_id: classId,
    student_number: studentNumber,
    first_name: firstName,
    last_name: lastName,
  });

  if (error) {
    // Unique constraint on (class_id, student_number)
    if (error.code === "23505") {
      return {
        status: "error",
        message: `Number ${studentNumber} is already taken in this class.`,
      };
    }
    console.error("Failed to create student:", error);
    return {
      status: "error",
      message:
        "Something went wrong while saving the student. Please try again.",
    };
  }

  revalidatePath("/students");
  return { status: "success" };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateStudent(
  studentId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!UUID_PATTERN.test(studentId)) {
    return { status: "error", message: "Missing student." };
  }
  const validation = validateStudentInput(formData);
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  const { classId, studentNumber, firstName, lastName } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("students")
    .update({
      class_id: classId,
      student_number: studentNumber,
      first_name: firstName,
      last_name: lastName,
    })
    .eq("id", studentId);

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: `Number ${studentNumber} is already taken in this class.`,
      };
    }
    console.error("Failed to update student:", error);
    return {
      status: "error",
      message:
        "Something went wrong while saving the student. Please try again.",
    };
  }

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  return { status: "success" };
}

/** Deletes the student along with their notes and exam results (cascade). */
export async function deleteStudent(studentId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(studentId)) {
    return { status: "error", message: "Missing student." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId);
  if (error) {
    console.error("Failed to delete student:", error);
    return { status: "error", message: "Failed to delete the student." };
  }
  revalidatePath("/students");
  return { status: "success" };
}

export async function importStudents(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const classId = String(formData.get("classId") ?? "");
  if (!UUID_PATTERN.test(classId)) {
    return { status: "error", message: "Please select a class." };
  }

  let students: ImportedStudent[];
  try {
    students = JSON.parse(String(formData.get("students") ?? "[]"));
  } catch {
    return { status: "error", message: "The imported data was unreadable." };
  }

  const valid =
    Array.isArray(students) &&
    students.length > 0 &&
    students.length <= MAX_IMPORT_ROWS &&
    students.every(
      (s) =>
        Number.isInteger(s.studentNumber) &&
        s.studentNumber >= 1 &&
        s.studentNumber <= 9999 &&
        typeof s.firstName === "string" &&
        s.firstName.trim().length > 0 &&
        typeof s.lastName === "string" &&
        s.lastName.trim().length > 0,
    );
  if (!valid) {
    return {
      status: "error",
      message: `Nothing to import — check the file contents (max ${MAX_IMPORT_ROWS} students).`,
    };
  }

  const supabase = await createClient();

  // ignoreDuplicates skips numbers already taken in the class instead of failing the batch.
  const { data, error } = await supabase
    .from("students")
    .upsert(
      students.map((s) => ({
        class_id: classId,
        student_number: s.studentNumber,
        first_name: s.firstName.trim(),
        last_name: s.lastName.trim(),
      })),
      { onConflict: "class_id,student_number", ignoreDuplicates: true },
    )
    .select("id");

  if (error) {
    console.error("Failed to import students:", error);
    return {
      status: "error",
      message: "Something went wrong while importing. Please try again.",
    };
  }

  const inserted = data?.length ?? 0;
  const duplicates = students.length - inserted;

  revalidatePath("/students");
  return {
    status: "success",
    message:
      duplicates > 0
        ? `Imported ${inserted} students; ${duplicates} skipped (number already taken in this class).`
        : `Imported ${inserted} students.`,
  };
}
