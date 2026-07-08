-- TeacherOS schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
-- RLS policies will be added together with authentication.

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade smallint not null check (grade between 1 and 12),
  section text not null check (section ~ '^[A-Z]$'),
  academic_year text not null check (academic_year ~ '^\d{4}-\d{4}$'),
  created_at timestamptz not null default now(),
  unique (grade, section, academic_year)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_number smallint not null check (student_number between 1 and 9999),
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  created_at timestamptz not null default now(),
  unique (class_id, student_number)
);

create table if not exists public.performance_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  note text not null check (length(trim(note)) > 0),
  rating smallint check (rating between 1 and 5),
  noted_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists performance_notes_student_idx
  on public.performance_notes (student_id, noted_on desc);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  subject text,
  exam_date date not null default current_date,
  -- [{"no": 1, "question": "...", "answer_key": "...", "max_points": 10, "outcome": "..."}, ...]
  questions jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  -- [{"no": 1, "student_answer": "...", "score": 8, "rationale": "..."}, ...]
  scores jsonb not null,
  total_score numeric not null,
  overall_feedback text,
  -- Scanned page references, kept ~24h for the annotated PDF, then cleared:
  -- [{"page": 1, "path": "<examId>/<studentId>-p1.jpg"}, ...]
  pages jsonb,
  created_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

create index if not exists exam_results_exam_idx
  on public.exam_results (exam_id);

create table if not exists public.rubrics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  -- [{"name": "Derse katılım", "weight": 30}, ...] — weights sum to 100
  criteria jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.performance_grades (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  rubric_id uuid references public.rubrics (id) on delete set null,
  term text not null check (length(trim(term)) > 0),
  -- [{"name": "...", "weight": 30, "score": 4, "rationale": "..."}, ...]
  criteria_scores jsonb not null,
  suggested_score numeric not null,
  final_score numeric not null,
  rationale text,
  created_at timestamptz not null default now(),
  unique (student_id, term)
);

create index if not exists performance_grades_class_idx
  on public.performance_grades (class_id, term);

-- Storage for scanned exam papers (auto-deleted after 24h by /api/cleanup).
insert into storage.buckets (id, name, public)
values ('exam-papers', 'exam-papers', false)
on conflict (id) do nothing;

drop policy if exists "exam papers full access" on storage.objects;
create policy "exam papers full access" on storage.objects
  for all
  using (bucket_id = 'exam-papers')
  with check (bucket_id = 'exam-papers');
