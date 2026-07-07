import type { Metadata } from "next";

import type { Class } from "@/features/classes/types";
import { VoiceNoteRecorder } from "@/features/performance/voice-note-recorder";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Voice Note",
};

export default async function VoiceNotePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select("id, name, grade, section, academic_year, created_at")
    .order("grade")
    .order("section");

  if (error) {
    console.error("Failed to load classes:", error);
    throw new Error("Failed to load classes.");
  }

  const classes: Class[] = data ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Voice Note</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Say the student&apos;s number followed by the note — for example
          &ldquo;12, derse çok aktif katıldı&rdquo;. The note is saved to that
          student with today&apos;s date.
        </p>
      </div>
      {classes.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          No classes yet. Create a class and add students first.
        </p>
      ) : (
        <VoiceNoteRecorder classes={classes} />
      )}
    </div>
  );
}
