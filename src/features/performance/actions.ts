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
