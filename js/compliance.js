/**
 * ACADEMIC COMPLIANCE EVALUATION ENGINE (js/compliance.js)
 * Implements business rules BR-05, BR-06, BR-07, and Module 5 compliance evaluation logic.
 */

class ComplianceEngine {
  /**
   * Evaluates a single verified grade submission against scholar's scholarship program criteria.
   * @param {Object} submission - The grade submission record
   * @param {Object} scholar - The scholar record
   * @param {Object} program - The assigned scholarship program record
   * @returns {Object} Evaluation report containing pass/fail, deficiencies list, and resulting status.
   */
  static evaluateSubmission(submission, scholar, program) {
    if (!submission || submission.submission_status !== 'Verified') {
      return {
        isCompliant: false,
        status: 'For Verification',
        deficiencies: ['Submission is not yet verified by authorized staff (BR-05)'],
        evaluationCode: 'UNVERIFIED'
      };
    }

    if (!program) {
      return {
        isCompliant: false,
        status: 'With Deficiency',
        deficiencies: ['Scholar is not assigned to an active scholarship program (BR-01)'],
        evaluationCode: 'NO_PROGRAM'
      };
    }

    const deficiencies = [];
    const gwa = parseFloat(submission.gwa);
    const units = parseInt(submission.units_enrolled, 10);
    const fails = parseInt(submission.failed_subjects, 10);
    const incompletes = parseInt(submission.incomplete_subjects, 10);

    // Rule 1: GWA Threshold Check (Philippine Grading Scale: 1.00 is highest, 3.00 passing, 5.00 failing)
    // GWA must be <= program.required_gwa
    if (gwa > program.required_gwa) {
      deficiencies.push(`GWA (${gwa.toFixed(2)}) exceeds maximum allowed threshold (${program.required_gwa.toFixed(2)}) for ${program.program_name}.`);
    }

    // Rule 2: Minimum Enrolled Units Check
    if (units < program.min_units) {
      deficiencies.push(`Enrolled units (${units}) is below minimum requirement (${program.min_units} units).`);
    }

    // Rule 3: Failing Grade Policy Check
    if (!program.allow_failing_grade && fails > 0) {
      deficiencies.push(`Scholar incurred ${fails} failing subject(s). Policy strictly disallows failing grades.`);
    } else if (program.allow_failing_grade && fails > 1) {
      deficiencies.push(`Scholar incurred ${fails} failing subjects. Policy allows maximum of 1 failing subject under conditional review.`);
    }

    // Rule 4: Incomplete Subject Warning Check
    if (incompletes > 0) {
      deficiencies.push(`Scholar has ${incompletes} unresolved incomplete (INC) subject(s).`);
    }

    const isCompliant = deficiencies.length === 0;
    const finalStatus = isCompliant ? 'Compliant' : 'With Deficiency';

    return {
      submissionId: submission.id,
      scholarId: scholar.id,
      scholarName: scholar.full_name,
      programName: program.program_name,
      academicYear: submission.academic_year,
      semester: submission.semester,
      submittedGwa: gwa,
      requiredGwa: program.required_gwa,
      submittedUnits: units,
      requiredUnits: program.min_units,
      failedSubjects: fails,
      incompleteSubjects: incompletes,
      isCompliant: isCompliant,
      deficiencies: deficiencies,
      resultingStatus: finalStatus,
      evaluatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };
  }

  /**
   * Executes batch compliance evaluation across all scholars with verified submissions.
   */
  static runAllComplianceEvaluations() {
    const scholars = db.getScholars();
    const submissions = db.getSubmissions();
    const programs = db.getPrograms();
    const reports = [];

    scholars.forEach(scholar => {
      const program = programs.find(p => p.id === scholar.scholarship_id);
      
      // Find latest verified submission for scholar
      const scholarSubs = submissions
        .filter(sub => sub.scholar_id === scholar.id && sub.submission_status === 'Verified')
        .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

      if (scholarSubs.length > 0) {
        const latestSub = scholarSubs[0];
        const evalReport = this.evaluateSubmission(latestSub, scholar, program);
        reports.push(evalReport);

        // Update DB scholar status dynamically
        db.updateScholarStatus(scholar.id, evalReport.resultingStatus);
      } else {
        // If scholar has pending submission, keep status 'For Verification', else 'Pending Submission'
        const hasPending = submissions.some(sub => sub.scholar_id === scholar.id && sub.submission_status === 'Pending');
        if (hasPending) {
          db.updateScholarStatus(scholar.id, 'For Verification');
        } else if (scholar.status === 'Compliant' || scholar.status === 'With Deficiency') {
          // keep existing if set
        } else {
          db.updateScholarStatus(scholar.id, 'Pending Submission');
        }
      }
    });

    return reports;
  }
}
