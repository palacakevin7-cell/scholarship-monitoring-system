-- ============================================================================
-- SCHOLARPULSE: STUDENT SCHOLARSHIP MONITORING & COMPLIANCE SYSTEM
-- Supabase PostgreSQL Database Schema & Initial Seed Script
-- Paste this script directly into your Supabase Dashboard SQL Editor
-- ============================================================================

-- 1. Create PROFILES Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'coordinator', 'scholar')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create SCHOLARSHIP_PROGRAMS Table
CREATE TABLE IF NOT EXISTS public.scholarship_programs (
  id TEXT PRIMARY KEY,
  program_name TEXT NOT NULL,
  required_gwa NUMERIC(3, 2) NOT NULL,
  min_units INTEGER NOT NULL,
  allow_failing_grade BOOLEAN DEFAULT false NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create SCHOLARS Table
CREATE TABLE IF NOT EXISTS public.scholars (
  id TEXT PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  degree_program TEXT NOT NULL,
  year_level TEXT NOT NULL,
  scholarship_id TEXT REFERENCES public.scholarship_programs(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Active' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create GRADE_SUBMISSIONS Table
CREATE TABLE IF NOT EXISTS public.grade_submissions (
  id TEXT PRIMARY KEY,
  scholar_id TEXT REFERENCES public.scholars(id) ON DELETE CASCADE NOT NULL,
  academic_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  gwa NUMERIC(3, 2) NOT NULL,
  units_enrolled INTEGER NOT NULL,
  failed_subjects INTEGER DEFAULT 0 NOT NULL,
  incomplete_subjects INTEGER DEFAULT 0 NOT NULL,
  submission_status TEXT DEFAULT 'Pending' CHECK (submission_status IN ('Pending', 'Verified', 'Returned')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  verified_by TEXT,
  verified_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- DISABLE RLS OR ALLOW PUBLIC ACCESS FOR QUICK DEVELOPMENT / GH PAGES
-- ============================================================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholars DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_submissions DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INITIAL SEED DATA
-- ============================================================================

-- Insert Programs
INSERT INTO public.scholarship_programs (id, program_name, required_gwa, min_units, allow_failing_grade, active)
VALUES 
  ('prog-01', 'University Academic Excellence Grant', 1.75, 18, false, true),
  ('prog-02', 'DOST STEM Merit Scholarship', 2.00, 18, false, true),
  ('prog-03', 'CHED Higher Education Assistance', 2.50, 15, true, true),
  ('prog-04', 'LGU Athletic & Leadership Grant', 2.75, 15, true, true)
ON CONFLICT (id) DO NOTHING;

-- Insert Scholars
INSERT INTO public.scholars (id, student_id, full_name, degree_program, year_level, scholarship_id, status)
VALUES
  ('sch-01', '2024-10042', 'Maria Clara Santos', 'BS Computer Science', '2nd Year', 'prog-01', 'Compliant'),
  ('sch-02', '2024-10089', 'Juan Dela Cruz', 'BS Information Technology', '3rd Year', 'prog-02', 'For Verification'),
  ('sch-03', '2023-04512', 'Alyssa Valdez', 'BS Civil Engineering', '4th Year', 'prog-01', 'With Deficiency'),
  ('sch-04', '2025-11005', 'Carlos Yulo', 'BS Sports Science', '1st Year', 'prog-04', 'Pending Submission'),
  ('sch-05', '2023-08891', 'Patricia Reyes', 'BS Accountancy', '3rd Year', 'prog-03', 'Compliant')
ON CONFLICT (id) DO NOTHING;

-- Insert Grade Submissions
INSERT INTO public.grade_submissions (id, scholar_id, academic_year, semester, gwa, units_enrolled, failed_subjects, incomplete_subjects, submission_status, submitted_at, verified_by, verified_at)
VALUES
  ('sub-101', 'sch-01', '2025-2026', '1st Semester', 1.35, 21, 0, 0, 'Verified', NOW() - INTERVAL '15 days', 'Staff User (Admin)', NOW() - INTERVAL '14 days'),
  ('sub-102', 'sch-02', '2025-2026', '1st Semester', 1.85, 18, 0, 0, 'Pending', NOW() - INTERVAL '2 days', NULL, NULL),
  ('sub-103', 'sch-03', '2025-2026', '1st Semester', 2.10, 15, 1, 0, 'Verified', NOW() - INTERVAL '10 days', 'Staff User (Admin)', NOW() - INTERVAL '9 days'),
  ('sub-104', 'sch-05', '2025-2026', '1st Semester', 1.90, 18, 0, 0, 'Verified', NOW() - INTERVAL '12 days', 'Staff User (Admin)', NOW() - INTERVAL '11 days')
ON CONFLICT (id) DO NOTHING;

-- Verification notification query
SELECT 'Database schema and seed data created successfully!' AS result;
