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

export async function updatePerformanceNote(
  noteId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!UUID_PATTERN.test(noteId)) {
    return { status: "error", message: "Missing note." };
  }
  const validation = validatePerformanceNoteInput(formData);
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  const { studentId, note, rating, notedOn } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("performance_notes")
    .update({ note, rating, noted_on: notedOn })
    .eq("id", noteId);

  if (error) {
    console.error("Failed to update performance note:", error);
    return {
      status: "error",
      message: "Something went wrong while saving the note. Please try again.",
    };
  }

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/performance");
  return { status: "success" };
}

export async function deletePerformanceNote(
  noteId: string,
): Promise<ActionResult> {
  if (!UUID_PATTERN.test(noteId)) {
    return { status: "error", message: "Missing note." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("performance_notes")
    .delete()
    .eq("id", noteId);
  if (error) {
    console.error("Failed to delete performance note:", error);
    return { status: "error", message: "Failed to delete the note." };
  }
  revalidatePath("/performance");
  return { status: "success" };
}

function parseCriteria(raw: string):
  | { ok: true; criteria: { name: string; weight: number }[] }
  | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "The rubric data was unreadable." };
  }
  const valid =
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    parsed.length <= 10 &&
    parsed.every(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        typeof c.name === "string" &&
        c.name.trim().length > 0 &&
        Number.isFinite(c.weight) &&
        c.weight > 0,
    );
  if (!valid) {
    return { ok: false, message: "Each criterion needs a name and a weight." };
  }
  const criteria = (parsed as { name: string; weight: number }[]).map((c) => ({
    name: c.name.trim(),
    weight: Math.round(c.weight),
  }));
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight !== 100) {
    return {
      ok: false,
      message: `Criterion weights must add up to 100 (currently ${totalWeight}).`,
    };
  }
  return { ok: true, criteria };
}

/** Creates a rubric, or updates it when `rubricId` is set. */
export async function saveRubric(
  rubricId: string | null,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 200) {
    return { status: "error", message: "Please enter a rubric name." };
  }
  const parsed = parseCriteria(String(formData.get("criteria") ?? "[]"));
  if (!parsed.ok) {
    return { status: "error", message: parsed.message };
  }

  const supabase = await createClient();
  const { error } = rubricId
    ? await supabase
        .from("rubrics")
        .update({ name, criteria: parsed.criteria })
        .eq("id", rubricId)
    : await supabase.from("rubrics").insert({ name, criteria: parsed.criteria });

  if (error) {
    console.error("Failed to save rubric:", error);
    return {
      status: "error",
      message: "Something went wrong while saving the rubric.",
    };
  }
  revalidatePath("/performance/grades");
  return { status: "success" };
}

export async function deleteRubric(rubricId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(rubricId)) {
    return { status: "error", message: "Missing rubric." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("rubrics").delete().eq("id", rubricId);
  if (error) {
    console.error("Failed to delete rubric:", error);
    return { status: "error", message: "Failed to delete the rubric." };
  }
  revalidatePath("/performance/grades");
  return { status: "success" };
}

export interface ComputeGradeResult {
  ok: boolean;
  message: string;
  suggested?: number;
}

/**
 * AI-grades one student's term performance against a rubric from their
 * accumulated notes, and stores the suggestion (final = suggested until the
 * teacher edits it). Recomputing replaces the previous grade for the term.
 */
export async function computePerformanceGrade(input: {
  classId: string;
  studentId: string;
  rubricId: string;
  term: string;
}): Promise<ComputeGradeResult> {
  const { classId, studentId, rubricId } = input;
  const term = input.term.trim();
  if (
    !UUID_PATTERN.test(classId) ||
    !UUID_PATTERN.test(studentId) ||
    !UUID_PATTERN.test(rubricId) ||
    !term ||
    term.length > 100
  ) {
    return { ok: false, message: "Missing class, student, rubric, or term." };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      message: "AI grading is not configured yet (missing ANTHROPIC_API_KEY).",
    };
  }

  const supabase = await createClient();
  const [studentResult, rubricResult, notesResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("rubrics")
      .select("id, criteria")
      .eq("id", rubricId)
      .maybeSingle(),
    supabase
      .from("performance_notes")
      .select("note, rating, noted_on")
      .eq("student_id", studentId)
      .order("noted_on"),
  ]);

  const student = studentResult.data;
  const rubric = rubricResult.data;
  const notes = notesResult.data ?? [];
  if (!student || !rubric) {
    return { ok: false, message: "Student or rubric not found." };
  }
  if (notes.length === 0) {
    return { ok: false, message: "No notes for this student yet." };
  }

  const criteria = rubric.criteria as { name: string; weight: number }[];

  const { gradePerformance } = await import("./performance-grading");
  let grading;
  try {
    grading = await gradePerformance({
      studentName: `${student.first_name} ${student.last_name}`,
      criteria,
      notes,
    });
  } catch (error) {
    console.error("Performance AI grading failed:", error);
    return { ok: false, message: "AI grading failed. Please try again." };
  }

  // Weighted 1-5 scores → 100 scale; unknown criteria from the model are dropped.
  const weightByName = new Map(criteria.map((c) => [c.name, c.weight]));
  const criteriaScores = grading.criteria
    .filter((c) => weightByName.has(c.name))
    .map((c) => ({
      name: c.name,
      weight: weightByName.get(c.name)!,
      score: Math.max(1, Math.min(5, Math.round(c.score))),
      rationale: c.rationale,
    }));
  if (criteriaScores.length !== criteria.length) {
    return { ok: false, message: "AI grading was incomplete. Please retry." };
  }
  const suggested = Math.round(
    criteriaScores.reduce((sum, c) => sum + (c.score / 5) * c.weight, 0),
  );

  const { error } = await supabase.from("performance_grades").upsert(
    {
      class_id: classId,
      student_id: studentId,
      rubric_id: rubricId,
      term,
      criteria_scores: criteriaScores,
      suggested_score: suggested,
      final_score: suggested,
      rationale: grading.overall_rationale,
    },
    { onConflict: "student_id,term" },
  );
  if (error) {
    console.error("Failed to save performance grade:", error);
    return { ok: false, message: "Grading succeeded but saving failed." };
  }

  revalidatePath("/performance/grades");
  return { ok: true, message: "Graded.", suggested };
}

/** Teacher's final say: overrides the AI-suggested score. */
export async function updateFinalGrade(
  gradeId: string,
  finalScore: number,
): Promise<ActionResult> {
  if (!UUID_PATTERN.test(gradeId)) {
    return { status: "error", message: "Missing grade." };
  }
  if (!Number.isFinite(finalScore) || finalScore < 0 || finalScore > 100) {
    return { status: "error", message: "Score must be between 0 and 100." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("performance_grades")
    .update({ final_score: Math.round(finalScore) })
    .eq("id", gradeId);
  if (error) {
    console.error("Failed to update final grade:", error);
    return { status: "error", message: "Failed to save the score." };
  }
  revalidatePath("/performance/grades");
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
