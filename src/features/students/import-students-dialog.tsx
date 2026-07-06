"use client";

import { useActionState, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Class } from "@/features/classes/types";

import { importStudents } from "./actions";
import {
  MAX_IMPORT_ROWS,
  mapRowsToStudents,
  type ParseOutcome,
} from "./import";
import type { ActionResult } from "./types";

const initialState: ActionResult = { status: "idle" };

export function ImportStudentsDialog({ classes }: { classes: Class[] }) {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParseOutcome | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    importStudents,
    initialState,
  );

  if (classes.length === 0) {
    return null;
  }

  async function handleFile(file: File | undefined) {
    setParsed(null);
    setParseError(null);
    if (!file) return;

    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
      });
      const outcome = mapRowsToStudents(rows);
      if (outcome.students.length === 0) {
        setParseError("No usable rows found in the file.");
        return;
      }
      if (outcome.students.length > MAX_IMPORT_ROWS) {
        setParseError(`Too many rows — the limit is ${MAX_IMPORT_ROWS}.`);
        return;
      }
      setParsed(outcome);
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Could not read the file.",
      );
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setParsed(null);
      setParseError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Import from Excel</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Students from Excel</DialogTitle>
          <DialogDescription>
            Upload an .xlsx or .csv file. The first row must contain the column
            names: a student number column (No / Numara) and either Ad + Soyad
            columns or a single Ad Soyad column.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="import-classId">Class</Label>
            <Select name="classId" required>
              <SelectTrigger id="import-classId" className="w-full">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} ({cls.academic_year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="import-file">File</Label>
            <input
              ref={fileInputRef}
              id="import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="border-input file:bg-muted file:text-foreground w-full rounded-lg border p-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </div>
          {parsed && (
            <input
              type="hidden"
              name="students"
              value={JSON.stringify(parsed.students)}
            />
          )}
          {parsed && (
            <div className="grid gap-2 text-sm">
              <p>
                <strong>{parsed.students.length}</strong> students ready to
                import
                {parsed.skipped.length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    — {parsed.skipped.length} rows skipped (
                    {parsed.skipped
                      .slice(0, 3)
                      .map((s) => `row ${s.row}: ${s.reason}`)
                      .join("; ")}
                    {parsed.skipped.length > 3 ? "; …" : ""})
                  </span>
                )}
              </p>
              <ul className="border-border text-muted-foreground max-h-40 divide-y overflow-y-auto rounded-lg border px-3">
                {parsed.students.map((student) => (
                  <li key={student.studentNumber} className="flex gap-3 py-1">
                    <span className="w-12 shrink-0 font-mono tabular-nums">
                      #{student.studentNumber}
                    </span>
                    <span>
                      {student.firstName} {student.lastName}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parseError && (
            <p role="alert" className="text-destructive text-sm">
              {parseError}
            </p>
          )}
          {state.status === "error" && (
            <p role="alert" className="text-destructive text-sm">
              {state.message}
            </p>
          )}
          {state.status === "success" && (
            <p role="status" className="text-sm text-green-600">
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending || !parsed}>
              {pending
                ? "Importing…"
                : `Import${parsed ? ` ${parsed.students.length} students` : ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
