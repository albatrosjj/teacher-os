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

export interface RubricCriterion {
  name: string;
  weight: number;
}

export interface Rubric {
  id: string;
  name: string;
  criteria: RubricCriterion[];
  created_at: string;
}

export interface CriterionScore extends RubricCriterion {
  /** 1-5 as graded against the rubric. */
  score: number;
  rationale: string;
}

export interface PerformanceGrade {
  id: string;
  class_id: string;
  student_id: string;
  rubric_id: string | null;
  term: string;
  criteria_scores: CriterionScore[];
  suggested_score: number;
  final_score: number;
  rationale: string | null;
  created_at: string;
}
