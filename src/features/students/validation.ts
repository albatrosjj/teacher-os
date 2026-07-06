export interface StudentInput {
  classId: string;
  studentNumber: number;
  firstName: string;
  lastName: string;
}

export type ValidationResult =
  { ok: true; data: StudentInput } | { ok: false; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates raw form values for creating a student.
 * Runs on the server; the form mirrors these rules for early feedback.
 */
export function validateStudentInput(formData: FormData): ValidationResult {
  const classId = String(formData.get("classId") ?? "");
  const studentNumber = Number(formData.get("studentNumber"));
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();

  if (!UUID_PATTERN.test(classId)) {
    return { ok: false, message: "Please select a class." };
  }

  if (
    !Number.isInteger(studentNumber) ||
    studentNumber < 1 ||
    studentNumber > 9999
  ) {
    return {
      ok: false,
      message: "Student number must be a whole number between 1 and 9999.",
    };
  }

  if (!firstName) {
    return { ok: false, message: "Please enter a first name." };
  }

  if (!lastName) {
    return { ok: false, message: "Please enter a last name." };
  }

  return { ok: true, data: { classId, studentNumber, firstName, lastName } };
}
