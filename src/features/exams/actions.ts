"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  gradeExamPaper,
  isSupportedMediaType,
  type PaperImage,
} from "./grading";
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface ScanGradeResult {
  ok: boolean;
  message: string;
  studentLabel?: string;
  totalScore?: number;
}

/**
 * Grades one scanned paper (front photo + optional back photo). The student
 * is identified from the name/number written on the front side and matched
 * against the class roster. Re-scanning a student replaces their result.
 */
export async function gradeScannedPaper(
  examId: string,
  formData: FormData,
): Promise<ScanGradeResult> {
  if (!UUID_PATTERN.test(examId)) {
    return { ok: false, message: "Missing exam." };
  }

  const photos = [formData.get("front"), formData.get("back")].filter(
    (p): p is File => p instanceof File && p.size > 0,
  );
  if (photos.length === 0) {
    return { ok: false, message: "Missing paper photo." };
  }
  for (const photo of photos) {
    if (photo.size > MAX_IMAGE_BYTES) {
      return { ok: false, message: "Photo is too large (max 8 MB)." };
    }
    if (!isSupportedMediaType(photo.type)) {
      return {
        ok: false,
        message: "Unsupported image format. Use JPEG, PNG, or WebP.",
      };
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      message: "AI grading is not configured yet (missing ANTHROPIC_API_KEY).",
    };
  }

  const supabase = await createClient();

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, class_id, questions")
    .eq("id", examId)
    .maybeSingle();

  if (examError || !exam) {
    console.error("Failed to load exam for grading:", examError);
    return { ok: false, message: "Exam not found." };
  }

  const { data: roster, error: rosterError } = await supabase
    .from("students")
    .select("id, student_number, first_name, last_name")
    .eq("class_id", exam.class_id);

  if (rosterError || !roster || roster.length === 0) {
    console.error("Failed to load roster for grading:", rosterError);
    return { ok: false, message: "No students found in this class." };
  }

  const questions = exam.questions as ExamQuestion[];
  const images: PaperImage[] = await Promise.all(
    photos.map(async (photo) => ({
      base64: Buffer.from(await photo.arrayBuffer()).toString("base64"),
      mediaType: photo.type as PaperImage["mediaType"],
    })),
  );

  let grading;
  try {
    grading = await gradeExamPaper({
      questions,
      images,
      roster: roster.map((s) => ({
        student_number: s.student_number,
        first_name: s.first_name,
        last_name: s.last_name,
      })),
    });
  } catch (error) {
    console.error("AI grading failed:", error);
    return {
      ok: false,
      message: "AI grading failed. Please try again with a clearer photo.",
    };
  }

  const student = roster.find(
    (s) => s.student_number === grading.student_number,
  );
  if (!student) {
    return {
      ok: false,
      message: grading.student_name_on_paper
        ? `Student not matched (read on paper: "${grading.student_name_on_paper}"). Check the roster and re-scan the front side.`
        : "Student name could not be read from the front side. Re-scan with the name visible.",
    };
  }

  // Clamp scores to each question's max in case the model exceeds it.
  const maxByNo = new Map(questions.map((q) => [q.no, q.max_points]));
  const scores = grading.scores.map((s) => ({
    ...s,
    score: Math.max(0, Math.min(s.score, maxByNo.get(s.no) ?? s.score)),
  }));
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

  // Keep the scanned pages for 24h so the annotated class PDF can be built.
  // A daily cleanup job deletes them from storage afterwards.
  const pages: { page: number; path: string }[] = [];
  for (let i = 0; i < photos.length; i++) {
    const path = `${examId}/${student.id}-p${i + 1}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("exam-papers")
      .upload(path, photos[i], { contentType: photos[i].type, upsert: true });
    if (uploadError) {
      console.error("Failed to store scanned page:", uploadError);
      break; // grading still succeeds; the PDF just skips this paper
    }
    pages.push({ page: i + 1, path });
  }

  const { error } = await supabase.from("exam_results").upsert(
    {
      exam_id: examId,
      student_id: student.id,
      scores,
      total_score: totalScore,
      overall_feedback: grading.overall_feedback,
      pages: pages.length === photos.length ? pages : null,
    },
    { onConflict: "exam_id,student_id" },
  );

  if (error) {
    console.error("Failed to save exam result:", error);
    return {
      ok: false,
      message: "Grading succeeded but saving failed. Please try again.",
    };
  }

  revalidatePath(`/exams/${examId}`);
  return {
    ok: true,
    message: "Graded.",
    studentLabel: `#${student.student_number} ${student.first_name} ${student.last_name}`,
    totalScore,
  };
}
