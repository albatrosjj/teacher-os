"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { computePerformanceGrade, updateFinalGrade } from "./actions";
import type { PerformanceGrade } from "./types";

/**
 * One student row in the grades table: AI-grade button, expandable rationale,
 * and an editable final score (the teacher's override of the AI suggestion).
 */
export function GradeRow({
  studentLabel,
  noteCount,
  classId,
  studentId,
  rubricId,
  term,
  grade,
}: {
  studentLabel: string;
  noteCount: number;
  classId: string;
  studentId: string;
  rubricId: string | null;
  term: string;
  grade: PerformanceGrade | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runGrading = () => {
    if (!rubricId) return;
    setError(null);
    startTransition(async () => {
      const result = await computePerformanceGrade({
        classId,
        studentId,
        rubricId,
        term,
      });
      if (!result.ok) {
        setError(result.message);
      }
    });
  };

  const saveFinal = (value: string) => {
    if (!grade) return;
    const score = Number(value);
    if (!Number.isFinite(score) || score === grade.final_score) return;
    startTransition(async () => {
      const result = await updateFinalGrade(grade.id, score);
      if (result.status === "error") {
        setError(result.message ?? "Failed to save the score.");
      }
    });
  };

  return (
    <li className="grid gap-1 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-medium">{studentLabel}</span>
          <span className="text-muted-foreground ml-2 text-sm">
            {noteCount} {noteCount === 1 ? "note" : "notes"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {grade && (
            <>
              <span className="text-muted-foreground text-sm tabular-nums">
                AI: {grade.suggested_score}
              </span>
              <Input
                type="number"
                min={0}
                max={100}
                defaultValue={grade.final_score}
                className="w-20 text-right tabular-nums"
                aria-label={`Final score for ${studentLabel}`}
                onBlur={(e) => saveFinal(e.target.value)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Hide" : "Details"}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !rubricId || noteCount === 0}
            onClick={runGrading}
          >
            {pending ? "Grading…" : grade ? "Regrade" : "Grade with AI"}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {expanded && grade && (
        <div className="bg-muted/50 grid gap-2 rounded-md p-3 text-sm">
          {grade.criteria_scores.map((criterion) => (
            <div key={criterion.name} className="grid gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {criterion.name}{" "}
                  <span className="text-muted-foreground font-normal">
                    (%{criterion.weight})
                  </span>
                </span>
                <span className="tabular-nums">{criterion.score}/5</span>
              </div>
              <p className="text-muted-foreground">{criterion.rationale}</p>
            </div>
          ))}
          {grade.rationale && (
            <p className="border-border border-t pt-2">{grade.rationale}</p>
          )}
        </div>
      )}
    </li>
  );
}
