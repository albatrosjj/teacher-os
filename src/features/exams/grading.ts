import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { ExamQuestion } from "./types";

const GradingSchema = z.object({
  scores: z.array(
    z.object({
      no: z.number(),
      student_answer: z.string(),
      score: z.number(),
      rationale: z.string(),
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

/**
 * Reads a photographed exam paper and grades each answer against the answer
 * key. Rationales and feedback come back in Turkish — the teacher-facing
 * language — regardless of the app's UI language.
 */
export async function gradeExamPaper(input: {
  questions: ExamQuestion[];
  imageBase64: string;
  mediaType: SupportedMediaType;
}): Promise<GradingOutput> {
  const client = new Anthropic();

  const answerKey = input.questions
    .map(
      (q) =>
        `Soru ${q.no} (${q.max_points} puan): ${q.question}\nCevap anahtarı: ${q.answer_key}`,
    )
    .join("\n\n");

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system:
      "Sen deneyimli bir öğretmensin. Fotoğrafı çekilmiş klasik yazılı sınav " +
      "kâğıtlarını okur ve cevap anahtarına göre puanlarsın. El yazısını " +
      "dikkatle çöz. Her soru için öğrencinin cevabını kısaca özetle, cevap " +
      "anahtarıyla karşılaştır ve 0 ile o sorunun tam puanı arasında bir puan " +
      "ver; kısmi puan verebilirsin. Gerekçeni kısa ve net yaz. Cevap okunamıyor " +
      "veya boşsa 0 ver ve bunu gerekçede belirt. Tüm çıktıyı Türkçe yaz.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.mediaType,
              data: input.imageBase64,
            },
          },
          {
            type: "text",
            text: `Bu sınav kâğıdını aşağıdaki cevap anahtarına göre değerlendir:\n\n${answerKey}`,
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
