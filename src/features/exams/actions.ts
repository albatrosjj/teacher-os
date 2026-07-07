"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { gradeExamPaper, isSupportedMediaType } from "./grading";
import type { ActionResult, ExamQuestion } from "./types";
import { validateExamInput } from "./validation";

export async function createExam(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const validation = validateExamInput(formData);
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  const { classId, title, examDate, questions } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.from("exams").insert({
    class_id: classId,
    title,
    exam_date: examDate,
    questions,
  });

  if (error) {
    console.error("Failed to create exam:", error);
    return {
      status: "error",
      message: "Something went wrong while saving the exam. Please try again.",
    };
  }

  revalidatePath("/exams");
  return { status: "success" };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * Grades a photographed exam paper with Claude and stores the result.
 * Re-grading the same student replaces the previous result.
 */
export async function gradeSubmission(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const examId = String(formData.get("examId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const photo = formData.get("photo");

  if (!UUID_PATTERN.test(examId) || !UUID_PATTERN.test(studentId)) {
    return { status: "error", message: "Missing exam or student." };
  }
  if (!(photo instanceof File) || photo.size === 0) {
    return { status: "error", message: "Please choose a photo of the paper." };
  }
  if (photo.size > MAX_IMAGE_BYTES) {
    return { status: "error", message: "Photo is too large (max 20 MB)." };
  }
  if (!isSupportedMediaType(photo.type)) {
    return {
      status: "error",
      message: "Unsupported image format. Use JPEG, PNG, or WebP.",
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      status: "error",
      message: "AI grading is not configured yet (missing ANTHROPIC_API_KEY).",
    };
  }

  const supabase = await createClient();

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, questions")
    .eq("id", examId)
    .maybeSingle();

  if (examError || !exam) {
    console.error("Failed to load exam for grading:", examError);
    return { status: "error", message: "Exam not found." };
  }

  const questions = exam.questions as ExamQuestion[];
  const imageBase64 = Buffer.from(await photo.arrayBuffer()).toString(
    "base64",
  );

  let grading;
  try {
    grading = await gradeExamPaper({
      questions,
      imageBase64,
      mediaType: photo.type,
    });
  } catch (error) {
    console.error("AI grading failed:", error);
    return {
      status: "error",
      message: "AI grading failed. Please try again with a clearer photo.",
    };
  }

  // Clamp scores to each question's max in case the model exceeds it.
  const maxByNo = new Map(questions.map((q) => [q.no, q.max_points]));
  const scores = grading.scores.map((s) => ({
    ...s,
    score: Math.max(0, Math.min(s.score, maxByNo.get(s.no) ?? s.score)),
  }));
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

  const { error } = await supabase.from("exam_results").upsert(
    {
      exam_id: examId,
      student_id: studentId,
      scores,
      total_score: totalScore,
      overall_feedback: grading.overall_feedback,
    },
    { onConflict: "exam_id,student_id" },
  );

  if (error) {
    console.error("Failed to save exam result:", error);
    return {
      status: "error",
      message: "Grading succeeded but saving failed. Please try again.",
    };
  }

  revalidatePath(`/exams/${examId}`);
  return { status: "success", message: `Graded: ${totalScore} points.` };
}
