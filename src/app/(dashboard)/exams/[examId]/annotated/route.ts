import { readFile } from "fs/promises";
import path from "path";

import fontkit from "@pdf-lib/fontkit";
import { notFound } from "next/navigation";
import { PDFDocument, rgb } from "pdf-lib";

import type {
  Exam,
  ExamResult,
  QuestionScore,
  StoredPage,
} from "@/features/exams/types";
import type { Student } from "@/features/students/types";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const RED = rgb(0.85, 0.1, 0.1);
const FONT_PATH = path.join(
  process.cwd(),
  "src/features/exams/fonts/PatrickHand-Regular.ttf",
);

/**
 * Builds a single PDF of the whole class's scanned papers with the
 * per-question scores written in red handwriting at the spots the AI
 * located, plus the total on the front page. Generated on the fly —
 * nothing extra is stored.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ examId: string }> },
) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data: exam } = (await supabase
    .from("exams")
    .select("id, class_id, title, exam_date, questions, created_at")
    .eq("id", examId)
    .maybeSingle()) as { data: Exam | null };
  if (!exam) notFound();

  const [{ data: results }, { data: students }] = await Promise.all([
    supabase
      .from("exam_results")
      .select(
        "id, exam_id, student_id, scores, total_score, overall_feedback, pages, created_at",
      )
      .eq("exam_id", examId),
    supabase
      .from("students")
      .select("id, class_id, student_number, first_name, last_name, created_at")
      .eq("class_id", exam.class_id)
      .order("student_number"),
  ]);

  const resultByStudent = new Map(
    ((results ?? []) as ExamResult[]).map((r) => [r.student_id, r]),
  );
  const maxTotal = exam.questions.reduce((sum, q) => sum + q.max_points, 0);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(FONT_PATH));

  let included = 0;
  for (const student of (students ?? []) as Student[]) {
    const result = resultByStudent.get(student.id);
    if (!result?.pages?.length) continue;

    const scores = result.scores as QuestionScore[];
    const storedPages = result.pages as StoredPage[];

    for (const stored of storedPages) {
      const { data: blob } = await supabase.storage
        .from("exam-papers")
        .download(stored.path);
      if (!blob) continue; // already cleaned up after 24h

      const image = await pdf.embedJpg(await blob.arrayBuffer());
      const page = pdf.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });

      const fontSize = Math.max(24, Math.round(image.width / 30));

      for (const s of scores) {
        if (!s.position || s.position.page !== stored.page) continue;
        const x = Math.min(Math.max(s.position.x, 0), 0.93) * image.width;
        // PDF origin is bottom-left; positions are measured from the top.
        const y =
          image.height -
          Math.min(Math.max(s.position.y, 0.02), 1) * image.height;
        page.drawText(String(s.score), {
          x,
          y,
          size: fontSize,
          font,
          color: RED,
        });
      }

      if (stored.page === 1) {
        const totalText = `${result.total_score} / ${maxTotal}`;
        const totalSize = fontSize * 1.6;
        page.drawText(totalText, {
          x: image.width - font.widthOfTextAtSize(totalText, totalSize) - 24,
          y: image.height - totalSize - 16,
          size: totalSize,
          font,
          color: RED,
        });
      }
    }
    included += 1;
  }

  if (included === 0) {
    return new Response(
      "No scanned pages available. Papers are kept for 24 hours after scanning.",
      { status: 404 },
    );
  }

  const bytes = await pdf.save();
  const filename = `${exam.title.replace(/[^\p{L}\p{N} _-]/gu, "")}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
