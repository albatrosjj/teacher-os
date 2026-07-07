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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateClass(
  classId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!UUID_PATTERN.test(classId)) {
    return { status: "error", message: "Missing class." };
  }
  const validation = validateClassInput(formData);
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  const { grade, section, academicYear } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("classes")
    .update({
      name: buildClassName(grade, section),
      grade,
      section,
      academic_year: academicYear,
    })
    .eq("id", classId);

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: `Class ${buildClassName(grade, section)} already exists for ${academicYear}.`,
      };
    }
    console.error("Failed to update class:", error);
    return {
      status: "error",
      message: "Something went wrong while saving the class. Please try again.",
    };
  }

  revalidatePath("/classes");
  return { status: "success" };
}

/** Deletes the class along with its students, notes, exams, and results. */
export async function deleteClass(classId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(classId)) {
    return { status: "error", message: "Missing class." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) {
    console.error("Failed to delete class:", error);
    return { status: "error", message: "Failed to delete the class." };
  }
  revalidatePath("/classes");
  revalidatePath("/students");
  revalidatePath("/exams");
  return { status: "success" };
}
