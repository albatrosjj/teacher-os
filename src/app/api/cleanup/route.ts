import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes scanned exam-paper photos older than 24 hours from storage and
 * clears their references, so papers are only briefly retained for the
 * annotated PDF. Triggered daily by Vercel Cron.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    cronSecret &&
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createClient();
  const cutoff = Date.now() - DAY_MS;
  const stalePaths: string[] = [];

  const { data: folders, error: listError } = await supabase.storage
    .from("exam-papers")
    .list("", { limit: 1000 });
  if (listError) {
    console.error("Cleanup: failed to list storage:", listError);
    return new Response("Storage list failed", { status: 500 });
  }

  for (const folder of folders ?? []) {
    const { data: files } = await supabase.storage
      .from("exam-papers")
      .list(folder.name, { limit: 1000 });
    for (const file of files ?? []) {
      const createdAt = Date.parse(file.created_at ?? "");
      if (!isNaN(createdAt) && createdAt < cutoff) {
        stalePaths.push(`${folder.name}/${file.name}`);
      }
    }
  }

  if (stalePaths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from("exam-papers")
      .remove(stalePaths);
    if (removeError) {
      console.error("Cleanup: failed to remove files:", removeError);
      return new Response("Storage remove failed", { status: 500 });
    }
  }

  // Clear page references on results whose scans have expired.
  const { error: updateError } = await supabase
    .from("exam_results")
    .update({ pages: null })
    .not("pages", "is", null)
    .lt("created_at", new Date(cutoff).toISOString());
  if (updateError) {
    console.error("Cleanup: failed to clear page references:", updateError);
  }

  return Response.json({ deleted: stalePaths.length });
}
