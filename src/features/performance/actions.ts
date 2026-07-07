"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import type { ActionResult } from "./types";
import { validatePerformanceNoteInput } from "./validation";

export async function createPerformanceNote(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const validation = validatePerformanceNoteInput(formData);
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  const { studentId, note, rating, notedOn } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.from("performance_notes").insert({
    student_id: studentId,
    note,
    rating,
    noted_on: notedOn,
  });

  if (error) {
    console.error("Failed to save performance note:", error);
    return {
      status: "error",
      message: "Something went wrong while saving the note. Please try again.",
    };
  }

  revalidatePath(`/students/${studentId}`);
  return { status: "success" };
}

/**
 * Saves a note captured by voice: resolves the spoken student number within
 * the class, then records the note dated today.
 */
export async function createVoiceNote(input: {
  classId: string;
  studentNumber: number;
  note: string;
}): Promise<ActionResult> {
  const { classId, studentNumber } = input;
  const note = input.note.trim();

  if (!UUID_PATTERN.test(classId)) {
    return { status: "error", message: "Missing class." };
  }
  if (
    !Number.isInteger(studentNumber) ||
    studentNumber < 1 ||
    studentNumber > 9999
  ) {
    return { status: "error", message: "Invalid student number." };
  }
  if (!note || note.length > 2000) {
    return { status: "error", message: "Missing or too long note." };
  }

  const supabase = await createClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("class_id", classId)
    .eq("student_number", studentNumber)
    .maybeSingle();

  if (studentError) {
    console.error("Failed to look up student for voice note:", studentError);
    return {
      status: "error",
      message: "Something went wrong while saving the note. Please try again.",
    };
  }
  if (!student) {
    return {
      status: "error",
      message: `No student with number ${studentNumber} in this class.`,
    };
  }

  const { error } = await supabase.from("performance_notes").insert({
    student_id: student.id,
    note,
  });

  if (error) {
    console.error("Failed to save voice note:", error);
    return {
      status: "error",
      message: "Something went wrong while saving the note. Please try again.",
    };
  }

  revalidatePath(`/students/${student.id}`);
  return {
    status: "success",
    message: `Saved for #${studentNumber} ${student.first_name} ${student.last_name}.`,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
