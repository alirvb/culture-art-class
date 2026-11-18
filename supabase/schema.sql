-- Culture and Art class — shared Supabase schema
-- Run this whole file in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Free tier is enough for a school class.

create extension if not exists pgcrypto;

-- Assignments: created by the teacher. No class field on purpose:
-- class comes from the student's submission.
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  grade int not null check (grade in (7, 8, 9)),
  deadline date,
  created_at timestamptz not null default now()
);

-- Submissions: one row per student homework.
-- description is PRIVATE: it is only shown in the teacher panel and in
-- tracking for that student. It must never be sent to the Wall.
-- annotations is a JSON array: [{id, x, y, note}] where x/y are 0-100 (%).
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  student_name text not null,
  grade int not null check (grade in (7, 8, 9)),
  class_name text not null check (class_name in ('الف', 'ب', 'ج')),
  assignment_id uuid references public.assignments(id) on delete set null,
  assignment_title text default '',
  file_url text default '',
  file_name text default '',
  file_mime text default '',
  description text default '',
  status text not null default 'بررسی نشده'
    check (status in ('بررسی نشده', 'بررسی شده', 'نمره داده شده')),
  score numeric,
  feedback text default '',
  annotations jsonb not null default '[]'::jsonb,
  featured boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Settings: a single row (id = 1) holding site texts + teacher password hash.
-- teacher_password_hash is a SHA-256 hex string, set on first use in the app.
create table if not exists public.settings (
  id int primary key,
  site_texts jsonb not null default '{}'::jsonb,
  teacher_password_hash text,
  updated_at timestamptz not null default now()
);
insert into public.settings (id, site_texts)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- Indexes
create index if not exists idx_submissions_grade on public.submissions (grade);
create index if not exists idx_submissions_assignment on public.submissions (assignment_id);
create index if not exists idx_submissions_tracking on public.submissions (tracking_code);
create index if not exists idx_submissions_featured on public.submissions (featured);
create index if not exists idx_assignments_grade on public.assignments (grade);

-- Row Level Security: open for this school use-case (anon key only).
-- The teacher password is checked in the app (hash comparison), not by RLS.
-- If you want tighter rules later, add policies per table here.
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.settings enable row level security;

drop policy if exists "public read" on public.assignments;
create policy "public read" on public.assignments for select using (true);
drop policy if exists "public write" on public.assignments;
create policy "public write" on public.assignments for all using (true);

drop policy if exists "public read" on public.submissions;
create policy "public read" on public.submissions for select using (true);
drop policy if exists "public write" on public.submissions;
create policy "public write" on public.submissions for all using (true);

drop policy if exists "public read" on public.settings;
create policy "public read" on public.settings for select using (true);
drop policy if exists "public write" on public.settings;
create policy "public write" on public.settings for all using (true);
