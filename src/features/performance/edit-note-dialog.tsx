"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

import { updatePerformanceNote } from "./actions";
import type { ActionResult, PerformanceNote } from "./types";
import { RATINGS } from "./validation";

const initialState: ActionResult = { status: "idle" };

export function EditNoteDialog({ note }: { note: PerformanceNote }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updatePerformanceNote.bind(null, note.id),
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit note</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="studentId" value={note.student_id} />
          <div className="grid gap-2">
            <Label htmlFor={`note-${note.id}`}>Note</Label>
            <Textarea
              id={`note-${note.id}`}
              name="note"
              maxLength={2000}
              defaultValue={note.note}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`rating-${note.id}`}>Rating (optional)</Label>
              <Select
                name="rating"
                defaultValue={note.rating ? String(note.rating) : undefined}
              >
                <SelectTrigger id={`rating-${note.id}`} className="w-full">
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
              <Label htmlFor={`notedOn-${note.id}`}>Date</Label>
              <Input
                id={`notedOn-${note.id}`}
                name="notedOn"
                type="date"
                defaultValue={note.noted_on}
                required
              />
            </div>
          </div>
          {state.status === "error" && (
            <p role="alert" className="text-destructive text-sm">
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
