"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { gradeScannedPaper } from "./actions";

interface ScannedPaper {
  front: File;
  back: File | null;
}

type PaperStatus =
  | { kind: "pending" }
  | { kind: "grading" }
  | { kind: "done"; label: string; total: number }
  | { kind: "failed"; message: string };

/**
 * Downscales a camera photo to keep upload size and AI cost low while
 * preserving enough resolution to read handwriting.
 */
async function downscale(file: File): Promise<File> {
  const MAX_EDGE = 2048;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg" && file.size < 2_000_000) {
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) return file;
    return new File([blob], "paper.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function ExamScanner({ examId }: { examId: string }) {
  const router = useRouter();
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const [pendingFront, setPendingFront] = useState<File | null>(null);
  const [papers, setPapers] = useState<ScannedPaper[]>([]);
  const [statuses, setStatuses] = useState<PaperStatus[]>([]);
  const [phase, setPhase] = useState<"scanning" | "grading" | "finished">(
    "scanning",
  );

  async function onFrontPicked(file: File | undefined) {
    if (!file) return;
    setPendingFront(await downscale(file));
  }

  async function onBackPicked(file: File | undefined) {
    if (!pendingFront) return;
    const back = file ? await downscale(file) : null;
    setPapers((prev) => [...prev, { front: pendingFront, back }]);
    setStatuses((prev) => [...prev, { kind: "pending" }]);
    setPendingFront(null);
  }

  function skipBack() {
    void onBackPicked(undefined);
  }

  function removePaper(index: number) {
    setPapers((prev) => prev.filter((_, i) => i !== index));
    setStatuses((prev) => prev.filter((_, i) => i !== index));
  }

  async function finishScanning() {
    setPhase("grading");
    for (let i = 0; i < papers.length; i++) {
      setStatuses((prev) =>
        prev.map((s, j) => (j === i ? { kind: "grading" } : s)),
      );
      const formData = new FormData();
      formData.set("front", papers[i].front);
      if (papers[i].back) formData.set("back", papers[i].back!);
      try {
        const result = await gradeScannedPaper(examId, formData);
        setStatuses((prev) =>
          prev.map((s, j) =>
            j === i
              ? result.ok
                ? {
                    kind: "done",
                    label: result.studentLabel ?? "",
                    total: result.totalScore ?? 0,
                  }
                : { kind: "failed", message: result.message }
              : s,
          ),
        );
      } catch {
        setStatuses((prev) =>
          prev.map((s, j) =>
            j === i
              ? { kind: "failed", message: "Network error — try re-scanning." }
              : s,
          ),
        );
      }
    }
    setPhase("finished");
    router.refresh();
  }

  const gradedCount = statuses.filter((s) => s.kind === "done").length;

  return (
    <div className="grid gap-4">
      <input
        ref={frontInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onFrontPicked(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={backInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onBackPicked(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {phase === "scanning" && (
        <>
          {pendingFront === null ? (
            <Button
              size="lg"
              className="h-16 text-base"
              onClick={() => frontInputRef.current?.click()}
            >
              📄 Scan front side (paper {papers.length + 1})
            </Button>
          ) : (
            <div className="grid gap-2">
              <Button
                size="lg"
                className="h-16 text-base"
                onClick={() => backInputRef.current?.click()}
              >
                📄 Scan back side
              </Button>
              <Button variant="outline" onClick={skipBack}>
                No back side — save paper
              </Button>
            </div>
          )}
        </>
      )}

      {papers.length > 0 && (
        <ul className="divide-border divide-y text-sm">
          {papers.map((paper, i) => {
            const status = statuses[i];
            return (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span>
                  Paper {i + 1}
                  <span className="text-muted-foreground ml-2">
                    {paper.back ? "front + back" : "front only"}
                  </span>
                </span>
                <span className="text-right">
                  {status.kind === "pending" &&
                    (phase === "scanning" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePaper(i)}
                      >
                        Remove
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">Waiting…</span>
                    ))}
                  {status.kind === "grading" && (
                    <span className="text-muted-foreground animate-pulse">
                      Grading…
                    </span>
                  )}
                  {status.kind === "done" && (
                    <span className="font-medium text-green-700 dark:text-green-300">
                      ✓ {status.label} — {status.total} pts
                    </span>
                  )}
                  {status.kind === "failed" && (
                    <span className="text-destructive">{status.message}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {phase === "scanning" && papers.length > 0 && pendingFront === null && (
        <Button size="lg" variant="secondary" onClick={finishScanning}>
          Finish scanning — grade {papers.length} paper
          {papers.length === 1 ? "" : "s"}
        </Button>
      )}
      {phase === "grading" && (
        <p className="text-muted-foreground text-center text-sm">
          Grading {gradedCount + 1} of {papers.length}… keep this page open.
        </p>
      )}
      {phase === "finished" && (
        <div className="grid gap-3">
          <p className="text-center text-sm font-medium">
            Done — {gradedCount}/{papers.length} papers graded. Scores are
            listed below.
            {gradedCount < papers.length &&
              " Re-scan the failed papers if needed."}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setPapers([]);
              setStatuses([]);
              setPhase("scanning");
            }}
          >
            Scan more papers
          </Button>
        </div>
      )}
    </div>
  );
}
