export interface ExamQuestion {
  no: number;
  question: string;
  answer_key: string;
  max_points: number;
}

export interface Exam {
  id: string;
  class_id: string;
  title: string;
  exam_date: string;
  questions: ExamQuestion[];
  created_at: string;
}

export interface QuestionScore {
  no: number;
  student_answer: string;
  score: number;
  rationale: string;
}

export interface ExamResult {
  id: string;
  exam_id: string;
  student_id: string;
  scores: QuestionScore[];
  total_score: number;
  overall_feedback: string | null;
  created_at: string;
}

/** Result shape returned by exam server actions, consumed by useActionState. */
export interface ActionResult {
  status: "idle" | "success" | "error";
  message?: string;
}
