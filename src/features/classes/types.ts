export interface Class {
  id: string;
  name: string;
  grade: number;
  section: string;
  academic_year: string;
  created_at: string;
}

/** Result shape returned by class-related server actions, consumed by useActionState. */
export interface ActionResult {
  status: "idle" | "success" | "error";
  message?: string;
}
