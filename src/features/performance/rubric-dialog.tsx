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

import { saveRubric } from "./actions";
import type { ActionResult, Rubric, RubricCriterion } from "./types";

const initialState: ActionResult = { status: "idle" };

const DEFAULT_CRITERIA: RubricCriterion[] = [
  { name: "Derse katılım", weight: 40 },
  { name: "Sorumluluklarını yerine getirme", weight: 30 },
  { name: "İş birliği ve iletişim", weight: 30 },
];

export function RubricDialog({ rubric }: { rubric?: Rubric }) {
  const [open, setOpen] = useState(false);
  const [criteria, setCriteria] = useState<RubricCriterion[]>(
    rubric?.criteria ?? DEFAULT_CRITERIA,
  );
  const [state, formAction, pending] = useActionState(
    saveRubric.bind(null, rubric?.id ?? null),
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      setOpen(false);
    }
  }, [state]);

  const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);

  const updateCriterion = (
    index: number,
    patch: Partial<RubricCriterion>,
  ) => {
    setCriteria((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={rubric ? "ghost" : "outline"} size="sm">
          {rubric ? "Edit" : "+ New rubric"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rubric ? "Edit rubric" : "New rubric"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input
            type="hidden"
            name="criteria"
            value={JSON.stringify(criteria)}
          />
          <div className="grid gap-2">
            <Label htmlFor="rubric-name">Name</Label>
            <Input
              id="rubric-name"
              name="name"
              maxLength={200}
              defaultValue={rubric?.name}
              placeholder="e.g. Term performance rubric"
              required
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Criteria (weights must total 100)</Label>
              <span
                className={`text-sm tabular-nums ${
                  totalWeight === 100
                    ? "text-muted-foreground"
                    : "text-destructive"
                }`}
              >
                {totalWeight}/100
              </span>
            </div>
            {criteria.map((criterion, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={criterion.name}
                  maxLength={200}
                  placeholder="Criterion name"
                  onChange={(e) =>
                    updateCriterion(index, { name: e.target.value })
                  }
                  required
                />
                <Input
                  type="number"
                  className="w-20 shrink-0"
                  min={1}
                  max={100}
                  value={criterion.weight || ""}
                  placeholder="%"
                  onChange={(e) =>
                    updateCriterion(index, { weight: Number(e.target.value) })
                  }
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  disabled={criteria.length <= 1}
                  onClick={() =>
                    setCriteria((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              disabled={criteria.length >= 10}
              onClick={() =>
                setCriteria((prev) => [...prev, { name: "", weight: 0 }])
              }
            >
              + Add criterion
            </Button>
          </div>
          {state.status === "error" && (
            <p role="alert" className="text-destructive text-sm">
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending || totalWeight !== 100}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
