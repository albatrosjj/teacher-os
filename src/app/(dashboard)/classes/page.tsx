import type { Metadata } from "next";

import { ClassCard } from "@/features/classes/class-card";
import { NewClassDialog } from "@/features/classes/new-class-dialog";
import type { Class } from "@/features/classes/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Classes",
};

export default async function ClassesPage() {
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
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
        <NewClassDialog />
      </div>
      {classes.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          No classes yet. Create your first class to get started.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard key={cls.id} class={cls} />
          ))}
        </div>
      )}
    </div>
  );
}
