"use client";

import { useActionState, useEffect, useRef } from "react";

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

import { createPerformanceNote } from "./actions";
import type { ActionResult } from "./types";
import { RATINGS } from "./validation";

const initialState: ActionResult = { status: "idle" };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewNoteForm({ studentId }: { studentId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createPerformanceNote,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid gap-2">
        <Label htmlFor="note">Performance note</Label>
        <Textarea
          id="note"
          name="note"
          maxLength={2000}
          placeholder="e.g. Participated actively in class discussion"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="rating">Rating (optional)</Label>
          <Select name="rating">
            <SelectTrigger id="rating" className="w-full">
              <SelectValue placeholder="No rating" />
            </SelectTrigger>
            <SelectContent>
              {RATINGS.map((rating) => (
                <SelectItem key={rating} value={String(rating)}>
                  {rating}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notedOn">Date</Label>
          <Input
            id="notedOn"
            name="notedOn"
            type="date"
            defaultValue={today()}
            required
          />
        </div>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
