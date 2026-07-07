import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { ExamQuestion } from "./types";

const GradingSchema = z.object({
  student_number: z
    .number()
    .nullable()
    .describe(
      "Kâğıdın ön yüzünde yazan öğrenci numarası; listede eşleşen öğrencinin numarası. Bulunamazsa null.",
    ),
  student_name_on_paper: z
    .string()
    .describe("Kâğıtta okunan ad soyad, olduğu gibi. Okunamıyorsa boş bırak."),
  scores: z.array(
    z.object({
      no: z.number(),
      student_answer: z.string(),
      score: z.number(),
      rationale: z.string(),
      position: z
        .object({
          page: z
            .number()
            .describe("Cevabın bulunduğu görsel: 1 = ön yüz, 2 = arka yüz."),
          x: z
            .number()
            .describe(
              "Puanın yazılacağı noktanın yatay konumu, 0 (sol) - 1 (sağ) arası. Cevabın hemen sağındaki boşluğu seç.",
            ),
          y: z
            .number()
            .describe(
              "Puanın yazılacağı noktanın dikey konumu, 0 (üst) - 1 (alt) arası.",
            ),
        })
        .nullable()
        .describe("Cevap kâğıtta bulunamadıysa null."),
    }),
  ),
  overall_feedback: z.string(),
});

export type GradingOutput = z.infer<typeof GradingSchema>;

const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export function isSupportedMediaType(
  type: string,
): type is SupportedMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(type);
}

export interface PaperImage {
  base64: string;
  mediaType: SupportedMediaType;
}

export interface RosterEntry {
  student_number: number;
  first_name: string;
  last_name: string;
}

/**
 * Reads a photographed exam paper (front side first, then back if present),
 * identifies the student from the name/number written on the front, and
 * grades each answer against the answer key. Output is in Turkish — the
 * teacher-facing language — regardless of the app's UI language.
 */
export async function gradeExamPaper(input: {
  questions: ExamQuestion[];
  images: PaperImage[];
  roster: RosterEntry[];
}): Promise<GradingOutput> {
  const client = new Anthropic();

  const answerKey = input.questions
    .map(
      (q) =>
        `Soru ${q.no} (${q.max_points} puan): ${q.question}\nCevap anahtarı: ${q.answer_key}`,
    )
    .join("\n\n");

  const rosterText = input.roster
    .map((s) => `${s.student_number} - ${s.first_name} ${s.last_name}`)
    .join("\n");

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system:
      "Sen deneyimli bir öğretmensin. Fotoğrafı çekilmiş klasik yazılı sınav " +
      "kâğıtlarını okur ve cevap anahtarına göre puanlarsın. İlk görsel kâğıdın " +
      "ön yüzü, varsa ikinci görsel arka yüzüdür. Önce ön yüzdeki ad soyad ve " +
      "numaradan öğrenciyi sınıf listesinde bul (yazım küçük farklılıklarla " +
      "eşleşebilir); emin olamazsan student_number alanını null bırak. Sonra " +
      "el yazısını dikkatle çözerek her soru için öğrencinin cevabını kısaca " +
      "özetle, cevap anahtarıyla karşılaştır ve 0 ile o sorunun tam puanı " +
      "arasında bir puan ver; kısmi puan verebilirsin. Cevap okunamıyor veya " +
      "boşsa 0 ver ve bunu gerekçede belirt. Tüm çıktıyı Türkçe yaz.",
    messages: [
      {
        role: "user",
        content: [
          ...input.images.map(
            (img) =>
              ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: img.mediaType,
                  data: img.base64,
                },
              }) as const,
          ),
          {
            type: "text",
            text:
              `Sınıf listesi (numara - ad soyad):\n${rosterText}\n\n` +
              `Bu sınav kâğıdını aşağıdaki cevap anahtarına göre değerlendir:\n\n${answerKey}`,
          },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(GradingSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Grading response could not be parsed.");
  }
  return response.parsed_output;
}
