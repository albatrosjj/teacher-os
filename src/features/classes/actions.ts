"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import type { ActionResult } from "./types";
import { buildClassName, validateClassInput } from "./validation";

export async function createClass(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const validation = validateClassInput(formData);
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  const { grade, section, academicYear } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.from("classes").insert({
    name: buildClassName(grade, section),
    grade,
    section,
    academic_year: academicYear,
  });

  if (error) {
    // Unique constraint on (grade, section, academic_year)
    if (error.code === "23505") {
      return {
        status: "error",
        message: `Class ${buildClassName(grade, section)} already exists for ${academicYear}.`,
      };
    }
    console.error("Failed to create class:", error);
    return {
      status: "error",
      message: "Something went wrong while saving the class. Please try again.",
    };
  }

  revalidatePath("/classes");
  return { status: "success" };
}
