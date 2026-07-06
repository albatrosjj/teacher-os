export interface ImportedStudent {
  studentNumber: number;
  firstName: string;
  lastName: string;
}

export interface ParseOutcome {
  students: ImportedStudent[];
  /** 1-based Excel row numbers that were skipped, with the reason. */
  skipped: { row: number; reason: string }[];
}

export const MAX_IMPORT_ROWS = 500;

const NUMBER_HEADERS = ["no", "numara", "öğrenci no", "okul no", "number"];
const FIRST_NAME_HEADERS = ["ad", "adı", "isim", "first name"];
const LAST_NAME_HEADERS = ["soyad", "soyadı", "last name"];
const FULL_NAME_HEADERS = ["ad soyad", "adı soyadı", "name", "ad-soyad"];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr")
    .replace(/[\s._-]+/g, " ")
    .trim();
}

/**
 * Maps a spreadsheet (first row = headers) to student rows.
 * Accepts either separate first/last name columns or a single
 * full-name column, whose last word becomes the surname.
 */
export function mapRowsToStudents(rows: unknown[][]): ParseOutcome {
  if (rows.length < 2) {
    return { students: [], skipped: [] };
  }

  const headers = rows[0].map(normalizeHeader);
  const numberCol = headers.findIndex((h) => NUMBER_HEADERS.includes(h));
  const firstCol = headers.findIndex((h) => FIRST_NAME_HEADERS.includes(h));
  const lastCol = headers.findIndex((h) => LAST_NAME_HEADERS.includes(h));
  const fullCol = headers.findIndex((h) => FULL_NAME_HEADERS.includes(h));

  const hasNames = (firstCol >= 0 && lastCol >= 0) || fullCol >= 0;
  if (numberCol < 0 || !hasNames) {
    throw new Error(
      "Could not find the expected columns. The first row must contain a student number column (No / Numara) and name columns (Ad + Soyad, or Ad Soyad).",
    );
  }

  const students: ImportedStudent[] = [];
  const skipped: ParseOutcome["skipped"] = [];
  const seenNumbers = new Set<number>();

  rows.slice(1).forEach((row, index) => {
    const excelRow = index + 2;
    const cell = (col: number) => String(row[col] ?? "").trim();

    const rawNumber = cell(numberCol);
    if (!rawNumber && !cell(firstCol) && !cell(lastCol) && !cell(fullCol)) {
      return; // fully empty row — ignore silently
    }

    const studentNumber = Number(rawNumber);
    let firstName: string;
    let lastName: string;

    if (firstCol >= 0 && lastCol >= 0 && (cell(firstCol) || cell(lastCol))) {
      firstName = cell(firstCol);
      lastName = cell(lastCol);
    } else {
      const parts = cell(fullCol).split(/\s+/).filter(Boolean);
      lastName = parts.length > 1 ? (parts.pop() as string) : "";
      firstName = parts.join(" ");
    }

    if (
      !Number.isInteger(studentNumber) ||
      studentNumber < 1 ||
      studentNumber > 9999
    ) {
      skipped.push({ row: excelRow, reason: "invalid student number" });
      return;
    }
    if (!firstName || !lastName) {
      skipped.push({ row: excelRow, reason: "missing name" });
      return;
    }
    if (seenNumbers.has(studentNumber)) {
      skipped.push({ row: excelRow, reason: "duplicate number in file" });
      return;
    }

    seenNumbers.add(studentNumber);
    students.push({ studentNumber, firstName, lastName });
  });

  return { students, skipped };
}
