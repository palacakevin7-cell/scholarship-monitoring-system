/**
 * SCHOLARPULSE MAIN APPLICATION CONTROLLER (js/app.js)
 * Interactivity, UI rendering, Chart.js graphs, filter/search event listeners, and modal handling.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Application Engine
  initNavigation();
  initRoleSwitcher();
  initModals();
  initFormListeners();
  initSearchAndFilters();
  initDocsTabNav();
  
  // Initial Render & Compliance Evaluation
  ComplianceEngine.runAllComplianceEvaluations();
  refreshAllViews();

  // Initialize Mermaid diagrams if loaded
  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: true, theme: 'dark' });
  }
});

/* ==========================================================================
   VIEW ROUTER & NAVIGATION
   ========================================================================== */
function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSectionId = 'section-' + btn.getAttribute('data-target');
      switchTab(btn.getAttribute('data-target'));
    });
  });
}

function switchTab(targetName) {
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-btn[data-target="${targetName}"]`);
  if (activeNav) activeNav.classList.add('active');

  // Update sections
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const targetSection = document.getElementById(`section-${targetName}`);
  if (targetSection) targetSection.classList.add('active');

  // Refresh view specific data
  if (targetName === 'dashboard') renderDashboard();
  else if (targetName === 'scholars') renderScholarsTable();
  else if (targetName === 'programs') renderProgramsGrid();
  else if (targetName === 'submissions') renderSubmissionsTable();
  else if (targetName === 'compliance') renderComplianceView();
}

/* ==========================================================================
   ROLE AUTHENTICATION & ACCESS CONTROL (RBAC)
   ========================================================================== */
function initRoleSwitcher() {
  const select = document.getElementById('current-role-select');
  const user = db.getCurrentUser();
  if (select && user) {
    select.value = user.role || 'staff';
    updateRoleUI(user.role);
    select.addEventListener('change', (e) => {
      const newRole = e.target.value;
      db.setCurrentRole(newRole);
      updateRoleUI(newRole);
      showToast(`Role switched to ${newRole.toUpperCase()}`, 'info');
      refreshAllViews();
    });
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      document.getElementById('login-page-screen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      showToast("Signed out. Returned to Login Portal.", "info");
    });
  }
}

function updateRoleUI(role) {
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  const avatarEl = document.getElementById('user-avatar-initials');

  if (role === 'staff') {
    nameEl.textContent = 'Admin Staff';
    roleEl.textContent = 'Staff / Admin';
    avatarEl.textContent = 'AD';
  } else if (role === 'coordinator') {
    nameEl.textContent = 'Dr. Reyes';
    roleEl.textContent = 'Coordinator';
    avatarEl.textContent = 'CR';
  } else if (role === 'scholar') {
    nameEl.textContent = 'Maria Santos';
    roleEl.textContent = 'Scholar User';
    avatarEl.textContent = 'MS';
  }
}

/* ==========================================================================
   GLOBAL REFRESH & VIEW RENDERERS
   ========================================================================== */
function refreshAllViews() {
  renderDashboard();
  renderScholarsTable();
  renderProgramsGrid();
  renderSubmissionsTable();
  renderComplianceView();
  populateDropdowns();
}

/* --- 1. DASHBOARD VIEW --- */
let statusChartInstance = null;
let programChartInstance = null;

function renderDashboard() {
  const scholars = db.getScholars();
  const submissions = db.getSubmissions();

  // Metrics KPI Calculation (Requirement XI)
  const totalScholars = scholars.length;
  const pendingSubmissions = submissions.filter(s => s.submission_status === 'Pending').length;
  const verifiedSubmissions = submissions.filter(s => s.submission_status === 'Verified').length;
  const compliantScholars = scholars.filter(s => s.status === 'Compliant').length;
  const deficiencyScholars = scholars.filter(s => s.status === 'With Deficiency').length;

  document.getElementById('kpi-total-scholars').textContent = totalScholars;
  document.getElementById('kpi-pending-submissions').textContent = pendingSubmissions;
  document.getElementById('kpi-verified-submissions').textContent = verifiedSubmissions;
  document.getElementById('kpi-compliant-scholars').textContent = compliantScholars;
  document.getElementById('kpi-deficiency-scholars').textContent = deficiencyScholars;
  
  // Navbar pending badge update
  const navBadge = document.getElementById('nav-pending-badge');
  if (navBadge) navBadge.textContent = pendingSubmissions;

  // Urgent Pending Queue Table
  const pendingSubs = submissions.filter(s => s.submission_status === 'Pending');
  const tbody = document.getElementById('dashboard-pending-tbody');
  tbody.innerHTML = '';

  if (pendingSubs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">
      <i class="fa-solid fa-circle-check" style="color: var(--color-success); font-size: 1.2rem;"></i> No pending grade submissions awaiting verification.
    </td></tr>`;
  } else {
    pendingSubs.forEach(sub => {
      const scholar = db.getScholarById(sub.scholar_id);
      const program = scholar ? db.getProgramById(scholar.scholarship_id) : null;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${scholar ? scholar.student_id : 'N/A'}</code></td>
        <td><strong>${scholar ? scholar.full_name : 'Unknown Scholar'}</strong></td>
        <td><span class="badge bg-active">${program ? program.program_name : 'N/A'}</span></td>
        <td>${sub.academic_year} ${sub.semester}</td>
        <td><strong>${parseFloat(sub.gwa).toFixed(2)}</strong></td>
        <td>${sub.units_enrolled} units</td>
        <td>${sub.failed_subjects} fails / ${sub.incomplete_subjects} INC</td>
        <td><small class="text-dim">${sub.submitted_at}</small></td>
        <td>
          <button class="btn btn-sm btn-accent" onclick="verifySubmissionAction('${sub.id}')">
            <i class="fa-solid fa-check-double"></i> Verify Now
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Render Visual Charts
  renderCharts(scholars);
}

function renderCharts(scholars) {
  // Chart 1: Status Breakdown
  const statusCounts = {
    'Compliant': 0,
    'For Verification': 0,
    'With Deficiency': 0,
    'Pending Submission': 0,
    'Active': 0
  };

  scholars.forEach(s => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });

  const ctxStatus = document.getElementById('statusChart').getContext('2d');
  if (statusChartInstance) statusChartInstance.destroy();

  statusChartInstance = new Chart(ctxStatus, {
    type: 'bar',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        label: 'Scholar Count',
        data: Object.values(statusCounts),
        backgroundColor: [
          '#10b981', '#a855f7', '#ef4444', '#f59e0b', '#3b82f6'
        ],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
      }
    }
  });

  // Chart 2: Distribution by Scholarship Program
  const programs = db.getPrograms();
  const programCounts = {};
  programs.forEach(p => programCounts[p.program_name] = 0);
  scholars.forEach(s => {
    const prog = programs.find(p => p.id === s.scholarship_id);
    if (prog) programCounts[prog.program_name] = (programCounts[prog.program_name] || 0) + 1;
  });

  const ctxProgram = document.getElementById('programChart').getContext('2d');
  if (programChartInstance) programChartInstance.destroy();

  programChartInstance = new Chart(ctxProgram, {
    type: 'doughnut',
    data: {
      labels: Object.keys(programCounts),
      datasets: [{
        data: Object.values(programCounts),
        backgroundColor: ['#6366f1', '#06b6d4', '#f59e0b', '#10b981'],
        borderWidth: 2,
        borderColor: '#1e293b'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } }
      }
    }
  });
}

/* --- 2. SCHOLARS MANAGEMENT VIEW --- */
function renderScholarsTable() {
  const scholars = db.getScholars();
  const programs = db.getPrograms();
  const tbody = document.getElementById('scholars-tbody');
  tbody.innerHTML = '';

  const searchVal = document.getElementById('scholar-search-input').value.toLowerCase().trim();
  const programFilter = document.getElementById('scholar-filter-program').value;
  const statusFilter = document.getElementById('scholar-filter-status').value;

  const filtered = scholars.filter(s => {
    const matchesSearch = s.student_id.toLowerCase().includes(searchVal) || s.full_name.toLowerCase().includes(searchVal);
    const matchesProgram = programFilter === 'ALL' || s.scholarship_id === programFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesProgram && matchesStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 2rem;">
      <i class="fa-solid fa-folder-open" style="font-size: 1.5rem; display:block; margin-bottom: 0.5rem;"></i> No scholar records matched your search filter criteria.
    </td></tr>`;
    return;
  }

  filtered.forEach(s => {
    const prog = programs.find(p => p.id === s.scholarship_id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${s.student_id}</code></td>
      <td><strong>${s.full_name}</strong></td>
      <td>${s.degree_program}</td>
      <td>${s.year_level}</td>
      <td><span class="badge bg-active">${prog ? prog.program_name : 'Unassigned'}</span></td>
      <td>${getStatusBadgeHtml(s.status)}</td>
      <td>
        <button class="btn-icon" title="Edit Scholar" onclick="openEditScholarModal('${s.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="btn-icon" title="New Grade Submission" onclick="openSubmissionForScholar('${s.id}')"><i class="fa-solid fa-file-circle-plus"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* --- 3. SCHOLARSHIP PROGRAM & REQUIREMENT VIEW --- */
function renderProgramsGrid() {
  const programs = db.getPrograms();
  const container = document.getElementById('programs-grid-cards');
  container.innerHTML = '';

  programs.forEach(p => {
    const card = document.createElement('div');
    card.className = 'program-card';
    card.innerHTML = `
      <div>
        <div class="program-card-header">
          <h3 class="program-card-title">${p.program_name}</h3>
          <span class="badge ${p.active ? 'bg-compliant' : 'bg-disqualified'}">${p.active ? 'Active' : 'Inactive'}</span>
        </div>
        <ul class="program-rules-list">
          <li><i class="fa-solid fa-graduation-cap text-info"></i> GWA Requirement: <strong>&le; ${parseFloat(p.required_gwa).toFixed(2)}</strong></li>
          <li><i class="fa-solid fa-book-open text-warning"></i> Minimum Units Load: <strong>${p.min_units} Units</strong></li>
          <li><i class="fa-solid fa-ban ${p.allow_failing_grade ? 'text-warning' : 'text-danger'}"></i> Failing Grade Policy: <strong>${p.allow_failing_grade ? 'Allowed (Max 1)' : 'Strict: No Fails Allowed (0)'}</strong></li>
        </ul>
      </div>
      <div class="mt-3">
        <button class="btn btn-sm btn-secondary" onclick="openEditProgramModal('${p.id}')">
          <i class="fa-solid fa-sliders"></i> Configure Criteria
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

/* --- 4. GRADE SUBMISSIONS & VERIFICATION VIEW --- */
function renderSubmissionsTable() {
  const submissions = db.getSubmissions();
  const scholars = db.getScholars();
  const programs = db.getPrograms();
  const tbody = document.getElementById('submissions-tbody');
  tbody.innerHTML = '';

  const searchVal = document.getElementById('submission-search-input').value.toLowerCase().trim();
  const statusFilter = document.getElementById('submission-filter-status').value;
  const ayFilter = document.getElementById('submission-filter-ay').value;

  const filtered = submissions.filter(sub => {
    const scholar = scholars.find(s => s.id === sub.scholar_id);
    const scholarName = scholar ? scholar.full_name.toLowerCase() : '';
    const studentId = scholar ? scholar.student_id.toLowerCase() : '';
    
    const matchesSearch = studentId.includes(searchVal) || scholarName.includes(searchVal) || sub.semester.toLowerCase().includes(searchVal);
    const matchesStatus = statusFilter === 'ALL' || sub.submission_status === statusFilter;
    const matchesAy = ayFilter === 'ALL' || sub.academic_year === ayFilter;
    return matchesSearch && matchesStatus && matchesAy;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; color: var(--text-muted); padding: 2rem;">
      No grade submissions match the current filter.
    </td></tr>`;
    return;
  }

  filtered.forEach(sub => {
    const scholar = scholars.find(s => s.id === sub.scholar_id);
    const prog = scholar ? programs.find(p => p.id === scholar.scholarship_id) : null;
    const tr = document.createElement('tr');

    let verifBadge = `<span class="badge bg-pending"><i class="fa-solid fa-hourglass-half"></i> Pending</span>`;
    if (sub.submission_status === 'Verified') {
      verifBadge = `<span class="badge bg-compliant"><i class="fa-solid fa-circle-check"></i> Verified</span>`;
    } else if (sub.submission_status === 'Returned') {
      verifBadge = `<span class="badge bg-deficiency"><i class="fa-solid fa-rotate-left"></i> Returned</span>`;
    }

    const currentUser = db.getCurrentUser();
    const canVerify = (currentUser.role === 'staff' || currentUser.role === 'coordinator') && sub.submission_status === 'Pending';

    tr.innerHTML = `
      <td><code>${sub.id}</code></td>
      <td><strong>${scholar ? scholar.full_name : 'Unknown'}</strong><br><small class="text-dim">${scholar ? scholar.student_id : ''}</small></td>
      <td><span class="badge bg-active">${prog ? prog.program_name : 'N/A'}</span></td>
      <td>${sub.academic_year}<br><small>${sub.semester}</small></td>
      <td><strong>${parseFloat(sub.gwa).toFixed(2)}</strong></td>
      <td>${sub.units_enrolled}</td>
      <td>${sub.failed_subjects > 0 ? `<span class="text-danger font-weight-bold">${sub.failed_subjects}</span>` : '0'}</td>
      <td>${sub.incomplete_subjects > 0 ? `<span class="text-warning font-weight-bold">${sub.incomplete_subjects}</span>` : '0'}</td>
      <td>${verifBadge}</td>
      <td>${sub.verified_by ? `<small>${sub.verified_by}<br><span class="text-dim">${sub.verified_at}</span></small>` : '<em class="text-dim">—</em>'}</td>
      <td>
        ${canVerify ? `
          <button class="btn btn-sm btn-accent" onclick="verifySubmissionAction('${sub.id}')">
            <i class="fa-solid fa-check"></i> Verify
          </button>
        ` : `
          <span class="text-dim" style="font-size:0.75rem;"><i class="fa-solid fa-lock"></i> Locked</span>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* --- 5. COMPLIANCE ENGINE VIEW --- */
function renderComplianceView() {
  const reports = ComplianceEngine.runAllComplianceEvaluations();
  const tbody = document.getElementById('compliance-tbody');
  tbody.innerHTML = '';

  if (reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--text-muted); padding: 2rem;">
      No verified grade submissions have been processed for compliance yet.
    </td></tr>`;
    return;
  }

  reports.forEach(rep => {
    const tr = document.createElement('tr');
    
    let defContent = `<span class="text-success"><i class="fa-solid fa-check"></i> All Program Criteria Satisfied</span>`;
    if (!rep.isCompliant) {
      defContent = `<ul style="margin-left: 1rem; color: var(--color-danger); font-size: 0.8rem;">
        ${rep.deficiencies.map(d => `<li>${d}</li>`).join('')}
      </ul>`;
    }

    tr.innerHTML = `
      <td><strong>${rep.scholarName}</strong></td>
      <td><span class="badge bg-active">${rep.programName}</span></td>
      <td>${rep.academicYear} ${rep.semester}</td>
      <td><strong>${rep.submittedGwa.toFixed(2)}</strong> <small class="text-dim">(&le; ${rep.requiredGwa.toFixed(2)})</small></td>
      <td>${rep.submittedUnits} <small class="text-dim">(&ge; ${rep.requiredUnits})</small></td>
      <td>${rep.failedSubjects} fails / ${rep.incompleteSubjects} INC</td>
      <td>${rep.isCompliant ? `<span class="badge bg-compliant">COMPLIANT</span>` : `<span class="badge bg-deficiency">DEFICIENCY</span>`}</td>
      <td>${defContent}</td>
      <td>${getStatusBadgeHtml(rep.resultingStatus)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="reEvaluateScholar('${rep.scholarId}')">
          <i class="fa-solid fa-arrows-rotate"></i> Re-Check
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ==========================================================================
   INTERACTIVE ACTIONS & VERIFICATION
   ========================================================================== */
window.verifySubmissionAction = function(submissionId) {
  const user = db.getCurrentUser();
  if (user.role === 'scholar') {
    showToast("BR-04 Violation: Scholars are not authorized to verify grade submissions.", "danger");
    return;
  }

  try {
    const sub = db.verifySubmission(submissionId, user.full_name);
    showToast(`Submission ${sub.id} successfully verified!`, "success");
    
    // Automatically trigger compliance engine evaluation
    ComplianceEngine.runAllComplianceEvaluations();
    refreshAllViews();
  } catch (err) {
    showToast(err.message, "danger");
  }
};

window.reEvaluateScholar = function(scholarId) {
  ComplianceEngine.runAllComplianceEvaluations();
  showToast("Compliance rules re-evaluated against latest program parameters.", "info");
  renderComplianceView();
  renderScholarsTable();
  renderDashboard();
};

/* ==========================================================================
   FORM MODALS & EVENT HANDLERS
   ========================================================================== */
function initModals() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      closeModal(modalId);
    });
  });

  document.getElementById('btn-add-scholar').addEventListener('click', () => openScholarModal());
  document.getElementById('btn-add-program').addEventListener('click', () => openProgramModal());
  document.getElementById('btn-open-submission-modal').addEventListener('click', () => openSubmissionModal());
  document.getElementById('btn-new-submission').addEventListener('click', () => openSubmissionModal());
  document.getElementById('btn-run-all-compliance').addEventListener('click', () => {
    ComplianceEngine.runAllComplianceEvaluations();
    showToast("Batch compliance evaluation executed successfully!", "success");
    refreshAllViews();
  });

  document.getElementById('btn-process-renewals').addEventListener('click', () => openRenewalModal());
  document.getElementById('btn-generate-report').addEventListener('click', () => openComplianceReportModal());
  document.getElementById('btn-approve-all-renewals').addEventListener('click', () => approveAllRenewalsAction());

  document.getElementById('btn-quick-demo-seed').addEventListener('click', () => {
    db.resetToDefault();
    ComplianceEngine.runAllComplianceEvaluations();
    showToast("Database reset to default seed records!", "info");
    refreshAllViews();
  });
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function populateDropdowns() {
  const programs = db.getPrograms();
  const scholars = db.getScholars();

  // Populate Scholar Modal Program dropdown
  const scholarProgSelect = document.getElementById('scholar-input-program');
  if (scholarProgSelect) {
    scholarProgSelect.innerHTML = programs.map(p => `<option value="${p.id}">${p.program_name}</option>`).join('');
  }

  // Populate Filter Program dropdown
  const filterProgSelect = document.getElementById('scholar-filter-program');
  if (filterProgSelect) {
    filterProgSelect.innerHTML = `<option value="ALL">All Programs</option>` + programs.map(p => `<option value="${p.id}">${p.program_name}</option>`).join('');
  }

  // Populate Submission Modal Scholar dropdown
  const subScholarSelect = document.getElementById('sub-input-scholar');
  if (subScholarSelect) {
    subScholarSelect.innerHTML = scholars.map(s => `<option value="${s.id}">${s.full_name} (${s.student_id})</option>`).join('');
  }
}

function openScholarModal(scholarId = null) {
  populateDropdowns();
  const form = document.getElementById('form-scholar');
  form.reset();

  if (scholarId) {
    const s = db.getScholarById(scholarId);
    document.getElementById('modal-scholar-title').innerHTML = `<i class="fa-solid fa-user-pen"></i> Edit Scholar Record`;
    document.getElementById('scholar-form-id').value = s.id;
    document.getElementById('scholar-input-id').value = s.student_id;
    document.getElementById('scholar-input-name').value = s.full_name;
    document.getElementById('scholar-input-degree').value = s.degree_program;
    document.getElementById('scholar-input-year').value = s.year_level;
    document.getElementById('scholar-input-program').value = s.scholarship_id;
    document.getElementById('scholar-input-status').value = s.status;
  } else {
    document.getElementById('modal-scholar-title').innerHTML = `<i class="fa-solid fa-user-plus"></i> Register New Scholar`;
    document.getElementById('scholar-form-id').value = '';
  }
  openModal('modal-scholar');
}

window.openEditScholarModal = function(scholarId) {
  openScholarModal(scholarId);
};

function openProgramModal(programId = null) {
  const form = document.getElementById('form-program');
  form.reset();

  if (programId) {
    const p = db.getProgramById(programId);
    document.getElementById('modal-program-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Configure Program Rules`;
    document.getElementById('program-form-id').value = p.id;
    document.getElementById('program-input-name').value = p.program_name;
    document.getElementById('program-input-gwa').value = p.required_gwa;
    document.getElementById('program-input-units').value = p.min_units;
    document.getElementById('program-input-failing').value = p.allow_failing_grade.toString();
    document.getElementById('program-input-active').value = p.active.toString();
  } else {
    document.getElementById('modal-program-title').innerHTML = `<i class="fa-solid fa-award"></i> Add Scholarship Program`;
    document.getElementById('program-form-id').value = '';
  }
  openModal('modal-program');
}

window.openEditProgramModal = function(programId) {
  openProgramModal(programId);
};

function openSubmissionModal() {
  populateDropdowns();
  document.getElementById('form-submission').reset();
  openModal('modal-submission');
}

window.openSubmissionForScholar = function(scholarId) {
  openSubmissionModal();
  document.getElementById('sub-input-scholar').value = scholarId;
};

/* ==========================================================================
   FORM SUBMISSIONS & VALIDATIONS
   ========================================================================== */
function initFormListeners() {
  // 1. Scholar Registration Form
  document.getElementById('form-scholar').addEventListener('submit', (e) => {
    e.preventDefault();
    const studentId = document.getElementById('scholar-input-id').value.trim();
    if (!studentId) {
      showToast("Validation Error: Student ID cannot be blank.", "danger");
      return;
    }

    const scholarData = {
      id: document.getElementById('scholar-form-id').value || null,
      student_id: studentId,
      full_name: document.getElementById('scholar-input-name').value.trim(),
      degree_program: document.getElementById('scholar-input-degree').value.trim(),
      year_level: document.getElementById('scholar-input-year').value,
      scholarship_id: document.getElementById('scholar-input-program').value,
      status: document.getElementById('scholar-input-status').value
    };

    try {
      db.saveScholar(scholarData);
      closeModal('modal-scholar');
      showToast("Scholar record saved successfully!", "success");
      refreshAllViews();
    } catch (err) {
      showToast(err.message, "danger");
    }
  });

  // 2. Program Requirements Form
  document.getElementById('form-program').addEventListener('submit', (e) => {
    e.preventDefault();
    const programData = {
      id: document.getElementById('program-form-id').value || null,
      program_name: document.getElementById('program-input-name').value.trim(),
      required_gwa: parseFloat(document.getElementById('program-input-gwa').value),
      min_units: parseInt(document.getElementById('program-input-units').value, 10),
      allow_failing_grade: document.getElementById('program-input-failing').value === 'true',
      active: document.getElementById('program-input-active').value === 'true'
    };

    db.saveProgram(programData);
    closeModal('modal-program');
    showToast("Scholarship program criteria updated!", "success");
    ComplianceEngine.runAllComplianceEvaluations();
    refreshAllViews();
  });

  // 3. Semester Grade Submission Form
  document.getElementById('form-submission').addEventListener('submit', (e) => {
    e.preventDefault();
    const gwa = parseFloat(document.getElementById('sub-input-gwa').value);
    const units = parseInt(document.getElementById('sub-input-units').value, 10);
    const fails = parseInt(document.getElementById('sub-input-fails').value, 10);
    const incompletes = parseInt(document.getElementById('sub-input-incompletes').value, 10);

    // Validation Rules (Section XIII)
    if (gwa < 1.00 || gwa > 5.00) {
      showToast("Validation Error: GWA must be between 1.00 and 5.00.", "danger");
      return;
    }
    if (units < 0) {
      showToast("Validation Error: Enrolled units cannot be negative.", "danger");
      return;
    }
    if (fails < 0 || incompletes < 0) {
      showToast("Validation Error: Subject counts cannot be negative.", "danger");
      return;
    }

    const submissionData = {
      scholar_id: document.getElementById('sub-input-scholar').value,
      academic_year: document.getElementById('sub-input-ay').value,
      semester: document.getElementById('sub-input-semester').value,
      gwa: gwa,
      units_enrolled: units,
      failed_subjects: fails,
      incomplete_subjects: incompletes
    };

    db.saveSubmission(submissionData);
    closeModal('modal-submission');
    showToast("Grade submission recorded in Pending / For Verification queue!", "info");
    refreshAllViews();
  });
}

/* ==========================================================================
   SEARCH & FILTER LISTENERS
   ========================================================================== */
function initSearchAndFilters() {
  document.getElementById('scholar-search-input').addEventListener('input', renderScholarsTable);
  document.getElementById('scholar-filter-program').addEventListener('change', renderScholarsTable);
  document.getElementById('scholar-filter-status').addEventListener('change', renderScholarsTable);
  document.getElementById('btn-reset-scholar-filters').addEventListener('click', () => {
    document.getElementById('scholar-search-input').value = '';
    document.getElementById('scholar-filter-program').value = 'ALL';
    document.getElementById('scholar-filter-status').value = 'ALL';
    renderScholarsTable();
  });

  document.getElementById('submission-search-input').addEventListener('input', renderSubmissionsTable);
  document.getElementById('submission-filter-status').addEventListener('change', renderSubmissionsTable);
  document.getElementById('submission-filter-ay').addEventListener('change', renderSubmissionsTable);
}

/* ==========================================================================
   DOCUMENTATION TAB NAV (PART I)
   ========================================================================== */
function initDocsTabNav() {
  const docBtns = document.querySelectorAll('.doc-tab-btn');
  docBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      docBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.getAttribute('data-doc-target');
      document.querySelectorAll('.doc-panel').forEach(p => p.classList.remove('active'));
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
}

/* ==========================================================================
   HELPERS & BADGE UTILITIES
   ========================================================================== */
function getStatusBadgeHtml(status) {
  switch (status) {
    case 'Active': return `<span class="badge bg-active"><i class="fa-solid fa-user-check"></i> Active</span>`;
    case 'Pending Submission': return `<span class="badge bg-pending"><i class="fa-solid fa-clock"></i> Pending Submission</span>`;
    case 'For Verification': return `<span class="badge bg-verification"><i class="fa-solid fa-hourglass-half"></i> For Verification</span>`;
    case 'Compliant': return `<span class="badge bg-compliant"><i class="fa-solid fa-shield-check"></i> Compliant</span>`;
    case 'With Deficiency': return `<span class="badge bg-deficiency"><i class="fa-solid fa-triangle-exclamation"></i> With Deficiency</span>`;
    case 'Probationary': return `<span class="badge bg-probation"><i class="fa-solid fa-shield-alert"></i> Probationary</span>`;
    case 'For Renewal': return `<span class="badge bg-renewal"><i class="fa-solid fa-rotate"></i> For Renewal</span>`;
    case 'Renewed': return `<span class="badge bg-renewed"><i class="fa-solid fa-award"></i> Renewed</span>`;
    case 'Disqualified': return `<span class="badge bg-disqualified"><i class="fa-solid fa-user-xmark"></i> Disqualified</span>`;
    default: return `<span class="badge bg-active">${status}</span>`;
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'warning') icon = 'fa-triangle-exclamation';
  if (type === 'danger') icon = 'fa-circle-xmark';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ==========================================================================
   USE CASE IMPLEMENTATIONS: RENEWAL, REPORTING, & DEFICIENCY VIEW
   ========================================================================== */
function openRenewalModal() {
  const scholars = db.getScholars();
  const programs = db.getPrograms();
  const tbody = document.getElementById('renewal-tbody');
  tbody.innerHTML = '';

  const eligible = scholars.filter(s => s.status === 'Compliant' || s.status === 'For Renewal' || s.status === 'Renewed');

  if (eligible.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">
      No scholars are currently eligible for annual grant renewal.
    </td></tr>`;
  } else {
    eligible.forEach(s => {
      const prog = programs.find(p => p.id === s.scholarship_id);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${s.full_name}</strong><br><small class="text-dim">${s.student_id}</small></td>
        <td><span class="badge bg-active">${prog ? prog.program_name : 'N/A'}</span></td>
        <td>${getStatusBadgeHtml(s.status)}</td>
        <td>
          ${s.status === 'Renewed' ? `<span class="badge bg-renewed"><i class="fa-solid fa-check"></i> Grant Renewed</span>` : `
            <button class="btn btn-sm btn-accent" onclick="approveSingleRenewal('${s.id}')">
              <i class="fa-solid fa-award"></i> Approve Renewal
            </button>
          `}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  openModal('modal-renewal');
}

window.approveSingleRenewal = function(scholarId) {
  db.updateScholarStatus(scholarId, 'Renewed');
  showToast("Scholarship grant successfully renewed!", "success");
  openRenewalModal();
  refreshAllViews();
};

function approveAllRenewalsAction() {
  const scholars = db.getScholars();
  let count = 0;
  scholars.forEach(s => {
    if (s.status === 'Compliant' || s.status === 'For Renewal') {
      db.updateScholarStatus(s.id, 'Renewed');
      count++;
    }
  });
  showToast(`Annual scholarship renewals approved for ${count} eligible scholar(s)!`, "success");
  closeModal('modal-renewal');
  refreshAllViews();
}

function openComplianceReportModal() {
  const scholars = db.getScholars();
  const submissions = db.getSubmissions();
  const programs = db.getPrograms();
  const reports = ComplianceEngine.runAllComplianceEvaluations();

  const total = scholars.length;
  const compliantCount = reports.filter(r => r.isCompliant).length;
  const deficiencyCount = reports.filter(r => !r.isCompliant).length;
  const complianceRate = total > 0 ? ((compliantCount / total) * 100).toFixed(1) : '0.0';

  const modalBody = document.getElementById('report-modal-body');
  modalBody.innerHTML = `
    <div style="border-bottom: 2px solid var(--accent-primary); padding-bottom: 1rem; margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.4rem; font-weight: 800;"><i class="fa-solid fa-graduation-cap"></i> ScholarPulse Academic Compliance Report</h2>
      <p class="text-dim" style="font-size: 0.85rem;">Generated on: ${new Date().toLocaleString()} | Official University Record</p>
    </div>

    <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 1.5rem;">
      <div class="metric-card card-total" style="padding: 1rem;">
        <div class="metric-info">
          <span class="metric-title">Total Active Scholars</span>
          <span class="metric-value">${total}</span>
        </div>
      </div>
      <div class="metric-card card-compliant" style="padding: 1rem;">
        <div class="metric-info">
          <span class="metric-title">Compliance Rate</span>
          <span class="metric-value text-success">${complianceRate}%</span>
        </div>
      </div>
      <div class="metric-card card-deficiency" style="padding: 1rem;">
        <div class="metric-info">
          <span class="metric-title">With Deficiency</span>
          <span class="metric-value text-danger">${deficiencyCount}</span>
        </div>
      </div>
    </div>

    <h4 class="mb-4" style="font-weight: 700;">Program Breakdown Summary</h4>
    <div class="table-container mb-4">
      <table class="data-table">
        <thead>
          <tr>
            <th>Scholarship Program Name</th>
            <th>Required GWA</th>
            <th>Min Units</th>
            <th>Failing Grade Policy</th>
            <th>Active Scholars</th>
          </tr>
        </thead>
        <tbody>
          ${programs.map(p => {
            const count = scholars.filter(s => s.scholarship_id === p.id).length;
            return `<tr>
              <td><strong>${p.program_name}</strong></td>
              <td>&le; ${p.required_gwa.toFixed(2)}</td>
              <td>${p.min_units} units</td>
              <td>${p.allow_failing_grade ? 'Allowed (Max 1)' : 'Strict (0 Fails)'}</td>
              <td><strong>${count}</strong></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <h4 class="mb-4" style="font-weight: 700;">Detailed Scholar Compliance Audit Log</h4>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Scholar Name</th>
            <th>Submitted GWA</th>
            <th>Units</th>
            <th>Fails</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          ${reports.map(r => `
            <tr>
              <td><strong>${r.scholarName}</strong></td>
              <td>${r.submittedGwa.toFixed(2)}</td>
              <td>${r.submittedUnits}</td>
              <td>${r.failedSubjects}</td>
              <td>${r.isCompliant ? `<span class="badge bg-compliant">COMPLIANT</span>` : `<span class="badge bg-deficiency">DEFICIENCY</span>`}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  openModal('modal-report');
}

/* ==========================================================================
   AUTHENTICATION & SIGN UP HANDLERS (UC-01)
   ========================================================================== */
window.switchAuthTab = function(tab) {
  const loginBtn = document.getElementById('auth-tab-login');
  const regBtn = document.getElementById('auth-tab-register');
  const loginForm = document.getElementById('form-auth-login');
  const regForm = document.getElementById('form-auth-register');

  if (tab === 'login') {
    loginBtn.classList.add('active');
    regBtn.classList.remove('active');
    loginForm.style.display = 'block';
    regForm.style.display = 'none';
  } else {
    regBtn.classList.add('active');
    loginBtn.classList.remove('active');
    regForm.style.display = 'block';
    loginForm.style.display = 'none';
  }
};

document.getElementById('form-auth-login').addEventListener('submit', (e) => {
  e.preventDefault();
  const role = document.getElementById('auth-login-role').value;
  const email = document.getElementById('auth-login-email').value.trim();

  db.setCurrentRole(role);
  const select = document.getElementById('current-role-select');
  if (select) select.value = role;
  updateRoleUI(role);

  closeModal('modal-auth');
  showToast(`Successfully signed in as ${role.toUpperCase()} (${email})`, "success");
  refreshAllViews();
});

document.getElementById('form-auth-register').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('auth-reg-name').value.trim();
  const role = document.getElementById('auth-reg-role').value;
  const email = document.getElementById('auth-reg-email').value.trim();

  db.setCurrentRole(role);
  const user = db.getCurrentUser();
  user.full_name = name;
  db.save(DB_KEYS.CURRENT_USER, user);

  const select = document.getElementById('current-role-select');
  if (select) select.value = role;
  updateRoleUI(role);

  closeModal('modal-auth');
  showToast(`Account created successfully! Welcome, ${name}.`, "success");
  refreshAllViews();
});

/* ==========================================================================
   DEDICATED FULL-SCREEN LOGIN PAGE HANDLERS
   ========================================================================== */
window.switchPageAuthTab = function(tab) {
  const loginBtn = document.getElementById('page-auth-tab-login');
  const regBtn = document.getElementById('page-auth-tab-register');
  const loginForm = document.getElementById('page-form-login');
  const regForm = document.getElementById('page-form-register');

  if (tab === 'login') {
    loginBtn.classList.add('active');
    regBtn.classList.remove('active');
    loginForm.style.display = 'block';
    regForm.style.display = 'none';
  } else {
    regBtn.classList.add('active');
    loginBtn.classList.remove('active');
    regForm.style.display = 'block';
    loginForm.style.display = 'none';
  }
};

window.performUserLogin = function(role, emailName) {
  db.setCurrentRole(role);
  const select = document.getElementById('current-role-select');
  if (select) select.value = role;
  updateRoleUI(role);

  // Transition from Login Page Screen to Main App
  document.getElementById('login-page-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  ComplianceEngine.runAllComplianceEvaluations();
  refreshAllViews();
  showToast(`Welcome! Authenticated as ${role.toUpperCase()} (${emailName})`, "success");
};

window.quickLoginDemo = function(role) {
  let emailName = 'admin@university.edu.ph';
  if (role === 'coordinator') emailName = 'reyes@university.edu.ph';
  if (role === 'scholar') emailName = 'maria.santos@student.edu.ph';
  performUserLogin(role, emailName);
};

document.getElementById('page-form-login').addEventListener('submit', (e) => {
  e.preventDefault();
  const role = document.getElementById('page-login-role').value;
  const email = document.getElementById('page-login-email').value.trim();
  performUserLogin(role, email);
});

document.getElementById('page-form-register').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('page-reg-name').value.trim();
  const role = document.getElementById('page-reg-role').value;
  const email = document.getElementById('page-reg-email').value.trim();

  const user = db.getCurrentUser();
  user.full_name = name;
  db.save(DB_KEYS.CURRENT_USER, user);

  performUserLogin(role, email);
});
