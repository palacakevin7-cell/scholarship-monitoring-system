/**
 * SCHOLARPULSE DATABASE MANAGER (js/db.js)
 * Implements relational database models (Supabase PostgreSQL layout) with localStorage persistence
 * and realistic initial seed records for rapid 2.5-hour lab testing and evaluation.
 */

// Supabase Backend Configuration
const SUPABASE_CONFIG = {
  URL: 'https://cglwrlpqgafocqwsfnuu.supabase.co',
  ANON_KEY: 'sb_publishable_2J4UyR4xlAX-frHQ6yaZ3g_99mezWqL'
};

// Initialize Supabase Client if available
let supabaseClient = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
    console.log("Supabase Client initialized successfully with URL:", SUPABASE_CONFIG.URL);
  } catch (err) {
    console.warn("Supabase init fallback to local memory DB store:", err.message);
  }
}

const DB_KEYS = {
  PROFILES: 'scholarpulse_profiles',
  PROGRAMS: 'scholarpulse_programs',
  SCHOLARS: 'scholarpulse_scholars',
  SUBMISSIONS: 'scholarpulse_submissions',
  CURRENT_USER: 'scholarpulse_current_user'
};

// Initial Seed Data
const DEFAULT_PROGRAMS = [
  {
    id: 'prog-01',
    program_name: 'University Academic Excellence Grant',
    required_gwa: 1.75, // GWA <= 1.75
    min_units: 18,
    allow_failing_grade: false,
    active: true
  },
  {
    id: 'prog-02',
    program_name: 'DOST STEM Merit Scholarship',
    required_gwa: 2.00, // GWA <= 2.00
    min_units: 18,
    allow_failing_grade: false,
    active: true
  },
  {
    id: 'prog-03',
    program_name: 'CHED Higher Education Assistance',
    required_gwa: 2.50, // GWA <= 2.50
    min_units: 15,
    allow_failing_grade: true,
    active: true
  },
  {
    id: 'prog-04',
    program_name: 'LGU Athletic & Leadership Grant',
    required_gwa: 2.75, // GWA <= 2.75
    min_units: 15,
    allow_failing_grade: true,
    active: true
  }
];

const DEFAULT_SCHOLARS = [
  {
    id: 'sch-01',
    student_id: '2024-10042',
    full_name: 'Maria Clara Santos',
    degree_program: 'BS Computer Science',
    year_level: '2nd Year',
    scholarship_id: 'prog-01',
    status: 'Compliant'
  },
  {
    id: 'sch-02',
    student_id: '2024-10089',
    full_name: 'Juan Dela Cruz',
    degree_program: 'BS Information Technology',
    year_level: '3rd Year',
    scholarship_id: 'prog-02',
    status: 'For Verification'
  },
  {
    id: 'sch-03',
    student_id: '2023-04512',
    full_name: 'Alyssa Valdez',
    degree_program: 'BS Civil Engineering',
    year_level: '4th Year',
    scholarship_id: 'prog-01',
    status: 'With Deficiency'
  },
  {
    id: 'sch-04',
    student_id: '2025-11005',
    full_name: 'Carlos Yulo',
    degree_program: 'BS Sports Science',
    year_level: '1st Year',
    scholarship_id: 'prog-04',
    status: 'Pending Submission'
  },
  {
    id: 'sch-05',
    student_id: '2023-08891',
    full_name: 'Patricia Reyes',
    degree_program: 'BS Accountancy',
    year_level: '3rd Year',
    scholarship_id: 'prog-03',
    status: 'Compliant'
  }
];

const DEFAULT_SUBMISSIONS = [
  {
    id: 'sub-101',
    scholar_id: 'sch-01',
    academic_year: '2025-2026',
    semester: '1st Semester',
    gwa: 1.35,
    units_enrolled: 21,
    failed_subjects: 0,
    incomplete_subjects: 0,
    submission_status: 'Verified',
    submitted_at: '2026-09-15 09:30',
    verified_by: 'Staff User (Admin)',
    verified_at: '2026-09-16 14:20'
  },
  {
    id: 'sub-102',
    scholar_id: 'sch-02',
    academic_year: '2025-2026',
    semester: '1st Semester',
    gwa: 1.85,
    units_enrolled: 18,
    failed_subjects: 0,
    incomplete_subjects: 0,
    submission_status: 'Pending',
    submitted_at: '2026-09-28 11:10',
    verified_by: null,
    verified_at: null
  },
  {
    id: 'sub-103',
    scholar_id: 'sch-03',
    academic_year: '2025-2026',
    semester: '1st Semester',
    gwa: 2.10, // Program 1 requires <= 1.75! Deficiency trigger
    units_enrolled: 15, // Required 18! Deficiency trigger
    failed_subjects: 1, // Program 1 disallows failing grades! Deficiency trigger
    incomplete_subjects: 0,
    submission_status: 'Verified',
    submitted_at: '2026-09-20 16:45',
    verified_by: 'Staff User (Admin)',
    verified_at: '2026-09-21 10:05'
  },
  {
    id: 'sub-104',
    scholar_id: 'sch-05',
    academic_year: '2025-2026',
    semester: '1st Semester',
    gwa: 1.90,
    units_enrolled: 18,
    failed_subjects: 0,
    incomplete_subjects: 0,
    submission_status: 'Verified',
    submitted_at: '2026-09-18 10:00',
    verified_by: 'Staff User (Admin)',
    verified_at: '2026-09-19 11:30'
  }
];

class DatabaseManager {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(DB_KEYS.PROGRAMS)) {
      this.save(DB_KEYS.PROGRAMS, DEFAULT_PROGRAMS);
    }
    if (!localStorage.getItem(DB_KEYS.SCHOLARS)) {
      this.save(DB_KEYS.SCHOLARS, DEFAULT_SCHOLARS);
    }
    if (!localStorage.getItem(DB_KEYS.SUBMISSIONS)) {
      this.save(DB_KEYS.SUBMISSIONS, DEFAULT_SUBMISSIONS);
    }
    if (!localStorage.getItem(DB_KEYS.CURRENT_USER)) {
      this.save(DB_KEYS.CURRENT_USER, {
        id: 'usr-001',
        full_name: 'Admin Staff',
        role: 'staff'
      });
    }
  }

  resetToDefault() {
    this.save(DB_KEYS.PROGRAMS, DEFAULT_PROGRAMS);
    this.save(DB_KEYS.SCHOLARS, DEFAULT_SCHOLARS);
    this.save(DB_KEYS.SUBMISSIONS, DEFAULT_SUBMISSIONS);
  }

  get(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // --- Programs CRUD ---
  getPrograms() {
    return this.get(DB_KEYS.PROGRAMS);
  }

  getProgramById(id) {
    return this.getPrograms().find(p => p.id === id);
  }

  saveProgram(programData) {
    const programs = this.getPrograms();
    if (programData.id) {
      const idx = programs.findIndex(p => p.id === programData.id);
      if (idx !== -1) programs[idx] = { ...programs[idx], ...programData };
    } else {
      programData.id = 'prog-' + Date.now().toString().slice(-4);
      programs.push(programData);
    }
    this.save(DB_KEYS.PROGRAMS, programs);
    return programData;
  }

  // --- Scholars CRUD ---
  getScholars() {
    return this.get(DB_KEYS.SCHOLARS);
  }

  getScholarById(id) {
    return this.getScholars().find(s => s.id === id);
  }

  getScholarByStudentId(studentId) {
    return this.getScholars().find(s => s.student_id.toLowerCase().trim() === studentId.toLowerCase().trim());
  }

  saveScholar(scholarData) {
    const scholars = this.getScholars();
    
    // Check Student ID Uniqueness (Validation Rule)
    const existing = scholars.find(s => s.student_id.toLowerCase().trim() === scholarData.student_id.toLowerCase().trim() && s.id !== scholarData.id);
    if (existing) {
      throw new Error(`Student ID '${scholarData.student_id}' is already registered to ${existing.full_name}.`);
    }

    if (scholarData.id) {
      const idx = scholars.findIndex(s => s.id === scholarData.id);
      if (idx !== -1) scholars[idx] = { ...scholars[idx], ...scholarData };
    } else {
      scholarData.id = 'sch-' + Date.now().toString().slice(-4);
      scholars.push(scholarData);
    }
    this.save(DB_KEYS.SCHOLARS, scholars);
    return scholarData;
  }

  updateScholarStatus(scholarId, status) {
    const scholars = this.getScholars();
    const scholar = scholars.find(s => s.id === scholarId);
    if (scholar) {
      scholar.status = status;
      this.save(DB_KEYS.SCHOLARS, scholars);
    }
  }

  // --- Submissions CRUD & Verification ---
  getSubmissions() {
    return this.get(DB_KEYS.SUBMISSIONS);
  }

  getSubmissionById(id) {
    return this.getSubmissions().find(sub => sub.id === id);
  }

  saveSubmission(submissionData) {
    const submissions = this.getSubmissions();
    if (submissionData.id) {
      const idx = submissions.findIndex(s => s.id === submissionData.id);
      if (idx !== -1) submissions[idx] = { ...submissions[idx], ...submissionData };
    } else {
      submissionData.id = 'sub-' + Date.now().toString().slice(-4);
      submissionData.submission_status = 'Pending';
      submissionData.submitted_at = new Date().toISOString().replace('T', ' ').slice(0, 16);
      submissionData.verified_by = null;
      submissionData.verified_at = null;
      submissions.push(submissionData);

      // Automatically update scholar status to 'For Verification'
      this.updateScholarStatus(submissionData.scholar_id, 'For Verification');
    }
    this.save(DB_KEYS.SUBMISSIONS, submissions);
    return submissionData;
  }

  verifySubmission(submissionId, verifierName) {
    const submissions = this.getSubmissions();
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) throw new Error("Submission record not found.");
    if (sub.submission_status === 'Verified') {
      throw new Error("BR-09 Violation: Submission is already verified.");
    }

    sub.submission_status = 'Verified';
    sub.verified_by = verifierName || 'Staff User (Admin)';
    sub.verified_at = new Date().toISOString().replace('T', ' ').slice(0, 16);

    this.save(DB_KEYS.SUBMISSIONS, submissions);
    return sub;
  }

  // --- Auth & Role User State ---
  getCurrentUser() {
    return this.get(DB_KEYS.CURRENT_USER);
  }

  setCurrentRole(role) {
    const user = this.getCurrentUser();
    user.role = role;
    if (role === 'staff') user.full_name = 'Admin Staff';
    else if (role === 'coordinator') user.full_name = 'Dr. Reyes (Coordinator)';
    else if (role === 'scholar') user.full_name = 'Maria Santos (Scholar)';
    this.save(DB_KEYS.CURRENT_USER, user);
  }
}

// Global Singleton Instance
const db = new DatabaseManager();
