export interface Student {
  id: string;
  class_id: string;
  student_number: number;
  first_name: string;
  last_name: string;
  created_at: string;
}

/** Result shape returned by student-related server actions, consumed by useActionState. */
export interface ActionResult {
  status: "idle" | "success" | "error";
  message?: string;
}
