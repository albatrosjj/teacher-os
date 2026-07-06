export interface PerformanceNote {
  id: string;
  student_id: string;
  note: string;
  rating: number | null;
  noted_on: string;
  created_at: string;
}

/** Result shape returned by performance-note server actions, consumed by useActionState. */
export interface ActionResult {
  status: "idle" | "success" | "error";
  message?: string;
}
