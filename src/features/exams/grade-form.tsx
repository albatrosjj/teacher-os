"use client";

import { useActionState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Student } from "@/features/students/types";

import { gradeSubmission } from "./actions";
import type { ActionResult } from "./types";

const initialState: ActionResult = { status: "idle" };

export function GradeForm({
  examId,
  students,
}: {
  examId: string;
  students: Student[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    gradeSubmission,
    initialState,
  );

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <input type="hidden" name="examId" value={examId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="studentId">Student</Label>
          <Select name="studentId" required>
            <SelectTrigger id="studentId" className="w-full">
              <SelectValue placeholder="Select a student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  #{s.student_number} {s.first_name} {s.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="photo">Photo of the paper</Label>
          <Input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            required
          />
        </div>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p
          role="status"
          className="rounded-md bg-green-100 px-4 py-3 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-200"
        >
          ✓ {state.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Reading and grading… (may take a minute)" : "Grade with AI"}
        </Button>
      </div>
    </form>
  );
}
