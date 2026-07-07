import type { ExamQuestion } from "./types";

export interface ExamInput {
  classId: string;
  title: string;
  examDate: string;
  questions: ExamQuestion[];
}

export type ValidationResult =
  | { ok: true; data: ExamInput }
  | { ok: false; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_QUESTIONS = 30;

/**
 * Validates raw form values for creating an exam.
 * Runs on the server; the form mirrors these rules for early feedback.
 */
export function validateExamInput(formData: FormData): ValidationResult {
  const classId = String(formData.get("classId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const examDate = String(formData.get("examDate") ?? "").trim();

  if (!UUID_PATTERN.test(classId)) {
    return { ok: false, message: "Please select a class." };
  }
  if (!title || title.length > 200) {
    return { ok: false, message: "Please enter a title (max 200 characters)." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate) || isNaN(Date.parse(examDate))) {
    return { ok: false, message: "Please pick a valid date." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("questions") ?? "[]"));
  } catch {
    return { ok: false, message: "The question data was unreadable." };
  }

  const valid =
    Array.isArray(raw) &&
    raw.length > 0 &&
    raw.length <= MAX_QUESTIONS &&
    raw.every(
      (q) =>
        typeof q === "object" &&
        q !== null &&
        Number.isInteger(q.no) &&
        typeof q.question === "string" &&
        typeof q.answer_key === "string" &&
        q.answer_key.trim().length > 0 &&
        Number.isFinite(q.max_points) &&
        q.max_points > 0 &&
        q.max_points <= 100,
    );
  if (!valid) {
    return {
      ok: false,
      message: `Each question needs an answer key and points (1-100), max ${MAX_QUESTIONS} questions.`,
    };
  }

  const questions: ExamQuestion[] = (raw as ExamQuestion[]).map((q, i) => ({
    no: i + 1,
    question: q.question.trim(),
    answer_key: q.answer_key.trim(),
    max_points: q.max_points,
  }));

  return { ok: true, data: { classId, title, examDate, questions } };
}
