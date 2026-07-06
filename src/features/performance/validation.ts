export interface PerformanceNoteInput {
  studentId: string;
  note: string;
  rating: number | null;
  notedOn: string;
}

export type ValidationResult =
  { ok: true; data: PerformanceNoteInput } | { ok: false; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * Validates raw form values for recording a performance note.
 * Runs on the server; the form mirrors these rules for early feedback.
 */
export function validatePerformanceNoteInput(
  formData: FormData,
): ValidationResult {
  const studentId = String(formData.get("studentId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const rawRating = String(formData.get("rating") ?? "").trim();
  const notedOn = String(formData.get("notedOn") ?? "").trim();

  if (!UUID_PATTERN.test(studentId)) {
    return { ok: false, message: "Missing student." };
  }

  if (!note) {
    return { ok: false, message: "Please write a note." };
  }
  if (note.length > 2000) {
    return { ok: false, message: "Notes are limited to 2000 characters." };
  }

  let rating: number | null = null;
  if (rawRating) {
    rating = Number(rawRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { ok: false, message: "Rating must be between 1 and 5." };
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(notedOn) || isNaN(Date.parse(notedOn))) {
    return { ok: false, message: "Please pick a valid date." };
  }

  return { ok: true, data: { studentId, note, rating, notedOn } };
}
