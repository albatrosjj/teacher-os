"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import type { Class } from "@/features/classes/types";

import { createExam, updateExam } from "./actions";
import type { ActionResult, Exam } from "./types";
import { MAX_QUESTIONS } from "./validation";

const initialState: ActionResult = { status: "idle" };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface QuestionDraft {
  question: string;
  answer_key: string;
  max_points: string;
  outcome: string;
}

const emptyQuestion: QuestionDraft = {
  question: "",
  answer_key: "",
  max_points: "10",
  outcome: "",
};

export function ExamForm({
  classes,
  exam,
}: {
  classes: Class[];
  /** When set, the form edits this exam instead of creating a new one. */
  exam?: Exam;
}) {
  const router = useRouter();
  const action = exam ? updateExam.bind(null, exam.id) : createExam;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    exam
      ? exam.questions.map((q) => ({
          question: q.question,
          answer_key: q.answer_key,
          max_points: String(q.max_points),
          outcome: q.outcome ?? "",
        }))
      : [emptyQuestion],
  );

  useEffect(() => {
    if (state.status === "success") {
      router.push(exam ? `/exams/${exam.id}` : "/exams");
    }
  }, [state, router, exam]);

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  const questionsJson = JSON.stringify(
    questions.map((q, i) => ({
      no: i + 1,
      question: q.question,
      answer_key: q.answer_key,
      max_points: Number(q.max_points),
      outcome: q.outcome.trim() || undefined,
    })),
  );

  const totalPoints = questions.reduce(
    (sum, q) => sum + (Number(q.max_points) || 0),
    0,
  );

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="questions" value={questionsJson} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="classId">Class</Label>
          <Select name="classId" defaultValue={exam?.class_id} required>
            <SelectTrigger id="classId" className="w-full">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            name="subject"
            maxLength={100}
            defaultValue={exam?.subject ?? ""}
            placeholder="e.g. Matematik"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            maxLength={200}
            defaultValue={exam?.title}
            placeholder="e.g. 1st Term Written Exam"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="examDate">Date</Label>
          <Input
            id="examDate"
            name="examDate"
            type="date"
            defaultValue={exam?.exam_date ?? today()}
            required
          />
        </div>
      </div>

      <div className="grid gap-4">
        {questions.map((q, index) => (
          <fieldset
            key={index}
            className="border-border grid gap-3 rounded-lg border p-4"
          >
            <div className="flex items-center justify-between">
              <legend className="text-sm font-semibold">
                Question {index + 1}
              </legend>
              {questions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setQuestions((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </Button>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`q-${index}-text`}>Question text (optional)</Label>
              <Textarea
                id={`q-${index}-text`}
                rows={2}
                value={q.question}
                onChange={(e) =>
                  updateQuestion(index, { question: e.target.value })
                }
                placeholder="The question as written on the paper"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="grid gap-2">
                <Label htmlFor={`q-${index}-key`}>Answer key</Label>
                <Textarea
                  id={`q-${index}-key`}
                  rows={2}
                  value={q.answer_key}
                  onChange={(e) =>
                    updateQuestion(index, { answer_key: e.target.value })
                  }
                  placeholder="Expected answer and what earns partial credit"
                  required
                />
              </div>
              <div className="grid content-start gap-2">
                <Label htmlFor={`q-${index}-points`}>Points</Label>
                <Input
                  id={`q-${index}-points`}
                  type="number"
                  min={1}
                  max={100}
                  value={q.max_points}
                  onChange={(e) =>
                    updateQuestion(index, { max_points: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`q-${index}-outcome`}>Learning outcome (kazanım)</Label>
              <Input
                id={`q-${index}-outcome`}
                value={q.outcome}
                onChange={(e) =>
                  updateQuestion(index, { outcome: e.target.value })
                }
                placeholder="e.g. Kesirlerle toplama işlemi yapar"
              />
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={questions.length >= MAX_QUESTIONS}
          onClick={() => setQuestions((prev) => [...prev, emptyQuestion])}
        >
          Add question
        </Button>
        <span className="text-muted-foreground text-sm">
          Total: {totalPoints} points
        </span>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : exam ? "Save changes" : "Create exam"}
        </Button>
      </div>
    </form>
  );
}
