import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { PerformanceNote, RubricCriterion } from "./types";

const RubricGradingSchema = z.object({
  criteria: z.array(
    z.object({
      name: z.string().describe("Rubrikteki ölçütün adı, aynen."),
      score: z.number().describe("1-5 arası puan (1 = Yetersiz, 5 = Çok iyi)."),
      rationale: z
        .string()
        .describe("Bu puanın kısa gerekçesi; notlardan somut örneklerle."),
    }),
  ),
  overall_rationale: z
    .string()
    .describe("Öğrencinin dönem performansının 2-3 cümlelik genel özeti."),
});

export type RubricGradingOutput = z.infer<typeof RubricGradingSchema>;

/**
 * Grades a student's term performance against a rubric using the teacher's
 * accumulated notes. Scores each criterion 1-5 with a short rationale, all
 * in Turkish. Criteria the notes say nothing about get a neutral 3.
 */
export async function gradePerformance(input: {
  studentName: string;
  criteria: RubricCriterion[];
  notes: Pick<PerformanceNote, "note" | "rating" | "noted_on">[];
}): Promise<RubricGradingOutput> {
  const client = new Anthropic();

  const rubricText = input.criteria
    .map((c) => `- ${c.name} (ağırlık %${c.weight})`)
    .join("\n");

  const notesText = input.notes
    .map(
      (n) =>
        `${n.noted_on}: ${n.note}${n.rating ? ` [öğretmen puanı: ${n.rating}/5]` : ""}`,
    )
    .join("\n");

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system:
      "Sen deneyimli bir lise öğretmenisin. Öğretmenin yıl boyunca tuttuğu " +
      "ders içi performans notlarını okuyup öğrenciyi verilen rubrik " +
      "ölçütlerine göre değerlendirirsin. Her ölçüte 1-5 arası puan ver " +
      "(1 = Yetersiz, 2 = Gelişmeli, 3 = Orta, 4 = İyi, 5 = Çok iyi) ve " +
      "notlardan somut örneklere dayanan kısa bir gerekçe yaz. Bir ölçüt " +
      "hakkında notlarda hiç bilgi yoksa 3 (Orta) ver ve gerekçede bilgi " +
      "olmadığını belirt. Adil ve dengeli ol; tek bir olumsuz not tüm dönemi " +
      "belirlemez, süreklilik ve gelişim önemlidir. Tüm çıktıyı Türkçe yaz.",
    messages: [
      {
        role: "user",
        content:
          `Öğrenci: ${input.studentName}\n\n` +
          `Rubrik ölçütleri:\n${rubricText}\n\n` +
          `Öğretmenin dönem boyunca tuttuğu notlar:\n${notesText}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(RubricGradingSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Performance grading response could not be parsed.");
  }
  return response.parsed_output;
}
