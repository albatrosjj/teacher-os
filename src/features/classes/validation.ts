export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
export const SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

export interface ClassInput {
  grade: number;
  section: string;
  academicYear: string;
}

export type ValidationResult =
  { ok: true; data: ClassInput } | { ok: false; message: string };

/**
 * Validates raw form values for creating a class.
 * Runs on the server; the form mirrors these rules for early feedback.
 */
export function validateClassInput(formData: FormData): ValidationResult {
  const grade = Number(formData.get("grade"));
  const section = String(formData.get("section") ?? "").toUpperCase();
  const academicYear = String(formData.get("academicYear") ?? "").trim();

  if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
    return { ok: false, message: "Please select a grade between 1 and 12." };
  }

  if (!/^[A-Z]$/.test(section)) {
    return { ok: false, message: "Please select a section (A, B, C…)." };
  }

  const yearMatch = academicYear.match(/^(\d{4})-(\d{4})$/);
  if (!yearMatch) {
    return {
      ok: false,
      message: "Academic year must look like 2025-2026.",
    };
  }

  const [, start, end] = yearMatch;
  if (Number(end) !== Number(start) + 1) {
    return {
      ok: false,
      message: "Academic year must span two consecutive years, e.g. 2025-2026.",
    };
  }

  return { ok: true, data: { grade, section, academicYear } };
}

/** Derives the display name from grade and section, e.g. 6 + "A" → "6/A". */
export function buildClassName(grade: number, section: string): string {
  return `${grade}/${section}`;
}
