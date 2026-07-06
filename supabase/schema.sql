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
