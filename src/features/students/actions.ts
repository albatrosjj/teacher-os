"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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
