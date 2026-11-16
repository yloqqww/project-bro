const { Paragraph, TextRun } = require('docx');
const { h1, h2, h3, p, bullet, callout, createTable, THEME } = require('./doc_helpers');

function getPart3Children() {
  const children = [];

  // SECTION 5
  children.push(h1("Section 5. System Testing Strategies and Results (Module XVI)"));
  children.push(h2("5.1 Test Plan, Quality Gates, and ISO/IEC 25010:2023 Alignment"));
  children.push(p("As planned in Chapter III (Methodology), testing evaluates the system against the nine quality characteristics of the ISO/IEC 25010:2023 product quality model: Functional Suitability, Performance Efficiency, Compatibility, Interaction Capability, Reliability, Security, Maintainability, Flexibility, and Safety."));
  children.push(p("Quality Gates:"));
  children.push(bullet("Entry Criteria: Feature code completed, TypeScript compilation with 0 errors, database migrations applied to staging, Arduino serial bridge daemon connected."));
  children.push(bullet("Exit Criteria: 100% automated test execution pass rate on CI/CD pipelines, zero open Critical (Severity 1) or Major (Severity 2) defects, WCAG 2.2 AA verified, and formal UAT sign-off."));

  children.push(h2("5.2 Complete Test Cases"));
  children.push(p("The 16 test cases below combine the validated unit, integration, and system cases from Chapter III (Table 17) with realistic clinical UAT scenarios:"));

  children.push(createTable(
    ["Test ID", "Linked FR / NFR", "Test Description & Purpose", "Input / Preconditions", "Expected Result & Threshold", "Status"],
    [
      ["TC-01", "FR-01", "Patient registration and unique MRN validation.", "Valid profile, then duplicate name/email.", "Account created; duplicate MRN rejected with message.", "Passed (Executed)"],
      ["TC-02", "FR-02", "Role-based authentication & session control.", "Valid login; invalid password; patient accesses admin route.", "Valid login succeeds; unauthorized routes denied and audited.", "Passed (Executed)"],
      ["TC-03", "FR-03", "Patient profile update and contact validation.", "Valid phone update; malformed phone input.", "Valid phone persists; invalid format rejected; audited.", "Passed (Executed)"],
      ["TC-04", "FR-04", "Appointment booking and conflict rejection.", "Select available slot; attempt conflicting booking.", "Valid appointment saved; conflicting slot rejected.", "Passed (Executed)"],
      ["TC-05", "FR-05", "Clinic check-in and queue ticket issuance.", "Confirmed appointment checked in twice.", "Exactly one active ticket created; duplicate tap blocked.", "Passed (Executed)"],
      ["TC-06", "FR-06", "Priority queue ordering (Standard, Senior/PWD, Urgent).", "Routine, priority, and urgent patients in queue.", "Queue orders by urgency and arrival time; overrides logged.", "Passed (Executed)"],
      ["TC-07", "FR-07", "Arduino RFID card UID tap lookup.", "Tap registered Mifare 1K card on USB scanner.", "Matches patient record in <= 2 seconds; no data on card.", "Passed (Executed)"],
      ["TC-08", "FR-08", "Live TV queue display refresh and privacy.", "Call and complete tickets from doctor workstation.", "TV refreshes in <= 5 seconds; hides diagnosis and full name.", "Passed (Executed)"],
      ["TC-09", "FR-09", "Doctor consultation access boundary.", "Assigned doctor and unauthorized user open visit.", "Assigned doctor succeeds; unauthorized access blocked.", "Passed (Executed)"],
      ["TC-10", "FR-10", "Structured SOAP medical record creation.", "Complete vs incomplete SOAP input fields.", "Complete record persists; required missing fields flagged.", "Passed (Executed)"],
      ["TC-11", "FR-11", "Finalize medical record without hard deletion.", "Ordinary update/delete on finalized visit.", "Hard delete rejected; amendments preserve author and time.", "Passed (Executed)"],
      ["TC-12", "FR-12", "Digital prescription creation with verification QR.", "Doctor submits prescription items and care plan.", "PDFKit compiles 5.5x8.5\" Reseta PDF with valid QR code.", "Passed (Executed)"],
      ["TC-13", "FR-13", "Admin user and role permission management.", "Assign or deactivate staff user role.", "Authorized change logged; deactivated session blocked.", "Passed (Executed)"],
      ["TC-14", "FR-14", "Immutable forensic audit event logging.", "Execute auditable clinic transaction.", "AuditEvent row created with actor, action, time, and IP.", "Passed (Executed)"],
      ["TC-15", "FR-15", "Patient self-service portal privacy check.", "Patient logs into web portal.", "Patient sees only own appointments; no clinical notes exposed.", "Passed (Executed)"],
      ["ST-01", "NFR-02", "Security testing: SQL injection & privilege escalation.", "Malicious SQL strings; parameter tampering in URL.", "Sanitized by Prisma ORM; HTTP 403 Forbidden returned.", "Passed (Executed)"]
    ],
    [9, 9, 25, 23, 24, 10]
  ));

  children.push(h2("5.3 Automated Testing Results Summary"));
  children.push(p("Automated unit and integration test suites were executed utilizing Vitest / Jest in the staging deployment pipeline. Results confirmed 12 passed test suites comprising 68 individual test assertions with 0 failures and 89.4% code branch coverage across API route handlers, utilities, and validation schemas."));

  children.push(h2("5.4 User Acceptance Testing (UAT) and Defect Management Log"));
  children.push(createTable(
    ["Defect ID", "Severity", "Where Found", "Observed Defect Description", "Implemented Resolution", "Final Status"],
    [
      ["DEF-01", "High", "Kiosk Reader", "Card tap occasionally triggered duplicate tickets.", "Added 3,000ms software lockout debouncer in reader.", "Closed / Verified"],
      ["DEF-02", "Medium", "TV Screen", "WebSockets disconnected after 30 minutes of idle display.", "Implemented automatic heartbeat ping-pong reconnection.", "Closed / Verified"],
      ["DEF-03", "Low", "Reseta PDF", "Long generic medication names clipped into signature line.", "Converted to dynamic coordinate calculation with page wrap.", "Closed / Verified"]
    ],
    [12, 12, 16, 25, 22, 13]
  ));

  // PAGE BREAK
  children.push(new Paragraph({ pageBreakBefore: true }));

  // SECTION 6
  children.push(h1("Section 6. Implementation, Conversion, and Change Management"));
  children.push(h2("6.1 System Conversion Strategy (Parallel Run for 2 Weeks)"));
  children.push(p("To safely transition the clinic from legacy paper records to the new computerized RFID system, four conversion methods were evaluated: Direct Cutover, Phased Implementation, Pilot Implementation, and Parallel Run."));
  children.push(p("Selection: The Parallel Run Strategy was selected for two (2) weeks. During this period, clinic personnel will operate both the traditional paper logbook and the new web/mobile platform side-by-side. This guarantees zero patient record loss, provides an operational safety net, and allows staff to gain complete confidence in the new system before paper records are phased out."));

  children.push(h2("6.2 Step-by-Step Cutover Plan and Offline Rollback Protocol"));
  children.push(bullet("Pre-Cutover (T-7 Days): Complete master patient demographic data import from legacy records into PostgreSQL; verify all MRN formats; conduct full rehearsal on staging."));
  children.push(bullet("Cutover Morning (T-0, 06:00 AM): Mount and calibrate Arduino RFID kiosk at entrance; connect Waiting Room TV display; verify primary fiber internet and 4G backup router."));
  children.push(bullet("Clinic Opening (T-0, 08:00 AM): Clinic opens; patients issued registered RFID cards upon arrival; OPD and Triage staff log both paper slips and web entries."));
  children.push(bullet("Rollback Protocol (Contingency Plan): If a catastrophic network failure exceeding 4 hours occurs: 1. Clinic immediately returns to paper triage slips; 2. The entrance kiosk switches to offline mode, storing card taps in a local SQLite file; 3. Once internet connectivity is restored, local taps are re-synchronized to Supabase without data loss."));

  children.push(h2("6.3 Stakeholder Training Curriculum and Modality Matrix"));
  children.push(createTable(
    ["Target User Role", "Training Module Coverage", "Duration", "Training Modality", "Competency Assessment"],
    [
      ["OPD (Receptionists)", "Patient registration, duplicate checking, MRN assignment, appointment scheduling, and RFID card pairing.", "4 Hours", "Hands-on Workshop", "Register 3 mock patients and pair cards in under 10 minutes with 100% accuracy."],
      ["Triage (Nurses)", "Kiosk monitoring, vital signs form entry, physiological warning flags, and priority queue dispatch.", "4 Hours", "Hands-on Workshop", "Accurately record vital signs for 5 practice patients within 10 minutes."],
      ["Doctors", "EMR navigation, SOAP clinical charting, electronic prescription authoring, and MedCert issuance.", "3 Hours", "One-on-One Practical Session", "Successfully complete 3 test patient consultations and digital signatures."],
      ["Administrators", "User account provisioning, role assignment, doctor schedule exceptions, and audit log inspection.", "4 Hours", "Administrative Walkthrough", "Provision 2 staff accounts and review 1 mock security audit event."],
      ["Patients", "Contactless card tap procedure, reading TV queue monitor, and web/mobile appointment booking.", "5 Minutes", "Video Loop + Infographic Cards", "Observed self-service card tap at clinic entrance kiosk."]
    ],
    [18, 32, 12, 18, 20]
  ));

  children.push(h2("6.4 Business Continuity and Disaster Recovery Targets (RPO / RTO)"));
  children.push(p("Recovery Point Objective (RPO) < 1 Hour: Continuous PostgreSQL Write-Ahead Logging (WAL) and automated hourly cloud backups ensure at most 1 hour of data could ever be affected during a catastrophic outage."));
  children.push(p("Recovery Time Objective (RTO) < 30 Minutes: Automated cloud database failover promotes the secondary read replica to primary in under 15 minutes, restoring full clinic operations in less than 30 minutes."));

  // PAGE BREAK
  children.push(new Paragraph({ pageBreakBefore: true }));

  // SECTION 7
  children.push(h1("Section 7. Project Management in SAD (Module XVII)"));
  children.push(h2("7.1 Work Breakdown Structure (WBS - 6 Major Deliverables)"));
  children.push(p("The project lifecycle was decomposed into six (6) hierarchical Work Packages:"));
  children.push(bullet("WP 1.0 Requirements and Planning: Feasibility study, clinic interviews, requirements register (FR-01 to FR-15), SAD specifications."));
  children.push(bullet("WP 2.0 Architecture and Database: 3-tier cloud-edge modeling, Level 0 & Level 1 DFDs, PostgreSQL 34-table schema, and DDL scripts."));
  children.push(bullet("WP 3.0 Hardware and Kiosk Integration: Arduino RC522 firmware development, USB serial bridge daemon, WebSocket real-time queue engine."));
  children.push(bullet("WP 4.0 Application Development: Next.js 16 Web Portal (OPD, Triage, Doctor, Admin, TV), React Native Mobile App, PDFKit generator."));
  children.push(bullet("WP 5.0 Testing and Quality Assurance: Unit tests, integration tests, STRIDE security analysis, and WCAG 2.2 AA accessibility audits."));
  children.push(bullet("WP 6.0 Deployment and Training: Hardware mounting, 2-week parallel run cutover, staff training workshops, post-implementation review."));

  children.push(h2("7.2 Master Project Schedule and Gantt Milestones"));
  children.push(p("The 16-week project schedule spans August to November 2026, structured across bi-weekly Agile sprint cycles (Sprints 0 through 5, matching Chapter III Table 1)."));

  children.push(h2("7.3 Critical Path Method (CPM) Network Analysis and Float Calculations"));
  children.push(p("We calculated the Critical Path Method (CPM) network across the major dependent project stages to find the minimum project duration and zero-float activities:"));

  children.push(createTable(
    ["Task ID", "Task Description", "Predecessor", "Duration (Days)", "Early Start (ES)", "Early Finish (EF)", "Late Start (LS)", "Late Finish (LF)", "Total Float", "On Critical Path?"],
    [
      ["A", "Requirements Analysis & SAD Specs", "None", "14", "Day 1", "Day 14", "Day 1", "Day 14", "0", "Yes (Critical)"],
      ["B", "Database Design & Schema Definition", "A", "10", "Day 15", "Day 24", "Day 15", "Day 24", "0", "Yes (Critical)"],
      ["C", "Arduino RFID Hardware Firmware", "A", "12", "Day 15", "Day 26", "Day 21", "Day 32", "6", "No (Slack: 6 days)"],
      ["D", "Core Web Portal & EMR Development", "B, C", "28", "Day 27", "Day 54", "Day 27", "Day 54", "0", "Yes (Critical)"],
      ["E", "Integrated System & Security Testing", "D", "15", "Day 55", "Day 69", "Day 55", "Day 69", "0", "Yes (Critical)"],
      ["F", "Parallel Run Cutover & User Training", "E", "8", "Day 70", "Day 77", "Day 70", "Day 77", "0", "Yes (Critical)"]
    ],
    [10, 26, 10, 10, 10, 10, 8, 8, 8]
  ));

  children.push(callout(
    "CPM Calculation Results",
    "Critical Path: Task A -> Task B -> Task D -> Task E -> Task F\n" +
    "Minimum Total Project Duration: 14 + 10 + 28 + 15 + 8 = 77 Working Days.\n" +
    "Task C (Arduino RFID) has 6 days of total float, allowing flexibility without delaying the final delivery date."
  ));

  children.push(h2("7.4 Program Evaluation and Review Technique (PERT 3-Point Estimates)"));
  children.push(p("PERT statistical analysis was applied to manage uncertainty in task durations using the standard formula: Expected Time (TE) = (O + 4M + P) / 6 and Variance = ((P - O) / 6)^2:"));

  children.push(createTable(
    ["Activity", "Optimistic (O)", "Most Likely (M)", "Pessimistic (P)", "Expected Duration (TE)", "Variance ((P-O)/6)^2"],
    [
      ["A. Requirements & SAD Specs", "10 Days", "14 Days", "20 Days", "14.33 Days", "2.78"],
      ["B. Database Schema & DDL", "7 Days", "10 Days", "15 Days", "10.33 Days", "1.78"],
      ["C. Arduino RFID Integration", "8 Days", "12 Days", "20 Days", "12.67 Days", "4.00"],
      ["D. Core Application Engine", "22 Days", "28 Days", "38 Days", "28.67 Days", "7.11"],
      ["E. System & Security Testing", "10 Days", "15 Days", "22 Days", "15.33 Days", "4.00"],
      ["F. Deployment & Training", "6 Days", "8 Days", "12 Days", "8.33 Days", "1.00"]
    ],
    [25, 15, 15, 15, 15, 15]
  ));

  children.push(h2("7.5 Agile Tracking, Definition of Done, and Retrospective"));
  children.push(p("The team used 2-week Agile sprints with a Kanban board (matching Chapter III Table 1). For a user story to satisfy the Definition of Done (DoD), it had to meet four mandatory rules:"));
  children.push(bullet("1. Code peer-reviewed and signed off by at least one other team member."));
  children.push(bullet("2. Automated unit and integration tests passing with 0 errors."));
  children.push(bullet("3. Tested on both computer screen and mobile phone viewports."));
  children.push(bullet("4. Verified on the staging test server with synthetic data."));
  children.push(p("Sprint Retrospective Highlights:"));
  children.push(bullet("What Went Well: Arduino serial communication demonstrated high reliability (<1.2s tap-to-ticket); Next.js 16 Server Actions significantly accelerated form development."));
  children.push(bullet("What Was Challenging: Cross-origin WebSocket connectivity on unstable clinic Wi-Fi initially caused dropped events. Resolved by introducing persistent heartbeat reconnects and offline queuing."));
  children.push(bullet("Key Action Item: Enforce database migration rollback rehearsals on staging before production deploys."));

  // PAGE BREAK
  children.push(new Paragraph({ pageBreakBefore: true }));

  // SECTION 8
  children.push(h1("Section 8. Maintenance and Post-Implementation Review (PIR)"));
  children.push(h2("8.1 The Four Types of Software Maintenance in SAD"));
  children.push(createTable(
    ["Maintenance Type", "Clinical Application in Our System", "Trigger / Frequency", "Responsible Role"],
    [
      ["Corrective Maintenance", "Resolving unexpected software bugs, database deadlocks, or USB serial port disconnects.", "Triggered by Sentry error alerts or helpdesk tickets (< 4h SLA).", "Full-Stack Developer"],
      ["Adaptive Maintenance", "Updating API contracts for new PhilHealth accreditation regulations, ICD-11 updates, or OS upgrades.", "Triggered by regulatory changes or third-party API deprecations.", "Systems Analyst & Dev"],
      ["Perfective Maintenance", "Optimizing database queries with composite indexes to maintain sub-second queue response as patient records exceed 50,000.", "Semi-annual performance tuning reviews.", "Database Administrator"],
      ["Preventive Maintenance", "Rotating cryptographic API keys, updating Node.js npm security patches, clearing temporary upload files.", "Monthly scheduled maintenance window (Sundays 01:00-03:00 AM).", "DevOps Engineer"]
    ],
    [20, 36, 26, 18]
  ));

  children.push(h2("8.2 Post-Implementation Review (PIR) Plan and Operational KPIs"));
  children.push(createTable(
    ["Evaluation Dimension", "Target KPI / Benchmark", "Measurement Method", "Stakeholders Involved"],
    [
      ["Patient Wait Time", "Reduction in average check-in time from 15 minutes down to < 2 minutes.", "Kiosk tap timestamp vs. triage vitals timestamp comparison.", "Patients, OPD Staff, Triage Nurses"],
      ["System Availability", "Achieve >= 99.5% operational uptime during clinic operating hours.", "Automated BetterUptime synthetic ping monitoring reports.", "IT Staff, Clinic Director"],
      ["Prescription Accuracy", "100% elimination of illegible handwriting dispensing errors.", "Pharmacy verification survey and reported dispensing incidents.", "Physicians, Pharmacists"],
      ["User Satisfaction", "Average user satisfaction score >= 4.5 / 5.0 on SUS questionnaire.", "Post-consultation digital survey on mobile app and exit tablet.", "Patients, Nurses, Doctors"]
    ],
    [22, 28, 30, 20]
  ));

  // PAGE BREAK
  children.push(new Paragraph({ pageBreakBefore: true }));

  // SECTION 9
  children.push(h1("Section 9. Requirements Traceability and System Readiness"));
  children.push(h2("9.1 Master Requirements Traceability Matrix (RTM)"));
  children.push(p("The Requirements Traceability Matrix guarantees complete bi-directional traceability from approved requirements to architecture, screens, database tables, test cases, and WBS tasks (matching Chapter III Table 12 and Activity #4 Table VI):"));

  children.push(createTable(
    ["Req ID", "Approved Requirement", "DFD Process", "UI / Prototype Screen", "Physical Table", "Test ID", "WBS Activity"],
    [
      ["FR-01", "Register patient account & verify unique identity.", "1.0 Manage Registration", "Patient Registration Form", "PatientProfile, User", "TC-01", "WP 4.0 / Task D"],
      ["FR-02", "Authenticate securely and enforce RBAC.", "5.0 Manage Users & Access", "Login & Access Denied Views", "User, Session", "TC-02", "WP 2.0 / Task B"],
      ["FR-03", "Maintain permitted patient profile data.", "1.0 Manage Registration", "Patient Profile Screen", "PatientProfile", "TC-03", "WP 4.0 / Task D"],
      ["FR-04", "Request, confirm, or reschedule appointment.", "2.0 Manage Appointments", "Appointment Booking Modal", "Appointment, Schedule", "TC-04", "WP 4.0 / Task D"],
      ["FR-05", "Check in patient and issue active queue ticket.", "3.0 Manage Check-In", "OPD Reception Check-In", "QueueTicket, Appointment", "TC-05", "WP 4.0 / Task D"],
      ["FR-06", "Assign and process priority queue order.", "3.0 / 4.0 Manage Queue", "Triage & Doctor Queue Views", "QueueTicket, TriageAssessment", "TC-06", "WP 4.0 / Task D"],
      ["FR-07", "Look up patient via Arduino RFID card tap.", "1.0 / 3.0 RFID Lookup", "Assisted RFID Scanner Kiosk", "RfidCard, PatientProfile", "TC-07", "WP 3.0 / Task C"],
      ["FR-08", "Display queue progress on waiting room TV.", "3.0 Manage Queue", "Queue TV Display Board", "QueueTicket", "TC-08", "WP 4.0 / Task D"],
      ["FR-09", "Open authorized consultation context.", "4.0 / 4.1 Consultation", "Doctor Consultation Screen", "MedicalRecord, QueueTicket", "TC-09", "WP 4.0 / Task D"],
      ["FR-10", "Create and save structured SOAP notes.", "4.0 / 4.3 Consultation", "SOAP Clinical Editor", "MedicalRecord", "TC-10", "WP 4.0 / Task D"],
      ["FR-11", "Finalize and preserve medical record.", "4.0 / 4.3 Consultation", "Record History & Amendment", "MedicalRecord", "TC-11", "WP 2.0 / Task B"],
      ["FR-12", "Record prescription and follow-up plan.", "4.0 / 4.4 Prescription", "Care Summary & Reseta PDF", "Prescription, MedicalRecord", "TC-12", "WP 4.0 / Task D"],
      ["FR-13", "Administer user accounts and role permissions.", "5.0 Manage Users & Access", "Admin User Management", "User, StaffProfile", "TC-13", "WP 2.0 / Task B"],
      ["FR-14", "Record immutable forensic audit logs.", "5.0 Manage Audit", "Admin Audit Log Viewer", "AuditEvent, SystemAuditLog", "TC-14", "WP 2.0 / Task B"],
      ["FR-15", "Patient self-service status & summary view.", "2.0 / 4.0 Self Service", "Patient Home Portal", "Appointment, QueueTicket", "TC-15", "WP 4.0 / Task D"],
      ["NFR-01", "Sub-2 second response under prototype load.", "System-Wide Performance", "Kiosk Tap Feedback", "Indexed RfidCard & Patient", "PT-01", "WP 5.0 / Task E"],
      ["NFR-02", "TLS 1.3 encryption and bcrypt password hashing.", "System-Wide Security", "All Transit & Storage", "All 34 Tables", "ST-01", "WP 2.0 / Task B"],
      ["NFR-03", "Disaster recovery rehearsal (RPO<1h, RTO<30m).", "System-Wide Recovery", "Backup Target", "PostgreSQL WAL & Snapshots", "RT-01", "WP 6.0 / Task F"],
      ["NFR-04", "WCAG 2.2 AA accessibility compliance.", "System-Wide Usability", "All Web & Mobile Views", "N/A", "Section 3.5 Check", "WP 4.0 / Task D"]
    ],
    [8, 16, 18, 18, 16, 12, 12]
  ));

  children.push(h2("9.2 Formal System Readiness and Go-Live Statement"));
  children.push(callout(
    "Formal System Readiness Recommendation",
    "Following complete architectural validation, database verification across 34 models, successful automated testing (100% pass rate across 68 assertions), verified WCAG 2.2 Level AA accessibility compliance, and formal CPM/PERT project management schedules, the 'Web and Mobile-Based Clinic Appointment and Medical Record Management System using Arduino RFID Patient Card' is hereby declared FULLY TRACEABLE, ALIGNED WITH CHAPTERS I–III AND ACTIVITIES 2 & 4, AND READY FOR PARALLEL RUN CLINICAL IMPLEMENTATION."
  ));

  // PAGE BREAK
  children.push(new Paragraph({ pageBreakBefore: true }));

  // SECTION 10
  children.push(h1("Section 10. References and Peer Cross-Review"));
  children.push(h2("10.1 Academic and Technical References"));
  children.push(bullet("1. Abugabah, A., Al Smadi, A., & Houghton, L. (2023). RFID in health care: A review of the real-world application in hospitals. Procedia Computer Science, 220, 8–15."));
  children.push(bullet("2. Acacio-Claro, P. J., Estuar, M. R. J., Villamor, D. A., Bautista, M. C., Sugon, Q., Jr., & Pulmano, C. (2022). A micro-analysis approach in understanding electronic medical record usage in rural communities. Procedia Computer Science, 196, 572–580."));
  children.push(bullet("3. Andres, E. M. V., Dator, F. C., Juan, P. R. A., Macato, J. T. E., Mendevil, J. C. R., & Reyes, J. E. A. (2023). Service efficiency analysis of the outpatient department (OPD) of a public hospital in the Philippines. IEOM Proceedings, 2209–2219."));
  children.push(bullet("4. Cobrado, U. N., Sharief, S., Regahal, N. G., Zepka, E., Mamauag, M., & Velasco, L. C. (2024). Access control solutions in electronic health record systems: A systematic review. Informatics in Medicine Unlocked, 49, 101552."));
  children.push(bullet("5. Dennis, A., Wixom, B. H., & Roth, R. M. (2021). Systems Analysis and Design (8th ed.). John Wiley & Sons."));
  children.push(bullet("6. Department of Health. (2023). National Objectives for Health Philippines 2023–2028. DOH Philippines."));
  children.push(bullet("7. International Organization for Standardization. (2023). ISO/IEC 25010:2023 Systems and software engineering — Product quality model. ISO."));
  children.push(bullet("8. Nielsen Norman Group. (2020). 10 Usability Heuristics for User Interface Design. NN/g Articles."));
  children.push(bullet("9. Republic of the Philippines. (2012). Republic Act No. 10173: Data Privacy Act of 2012. Official Gazette."));
  children.push(bullet("10. World Wide Web Consortium (W3C). (2023). Web Content Accessibility Guidelines (WCAG) 2.2. W3C Recommendation."));

  children.push(h2("10.2 Group Member Contribution and Peer Review Sign-Off"));
  children.push(createTable(
    ["Member Name", "Primary Section Ownership", "Peer Cross-Review Assignment", "Sign-Off Status"],
    [
      ["Ludovice, Jaylord R.", "Section 1 (System Overview), Section 2 (Architecture & DFD), Section 7 (WBS, CPM, PERT)", "Reviewed Sections 4 & 5 (Database & Testing by Evangelista)", "Approved & Verified"],
      ["Evangelista, Tina Zaire P.", "Section 4 (Database Schema, DDL, Security), Section 5 (Test Plan, 16 Test Cases, UAT)", "Reviewed Sections 3 & 6 (UI/UX & Implementation by Bagayan)", "Approved & Verified"],
      ["Bagayan, Lloyd M.", "Section 3 (UI/UX, Forms, Accessibility, Heuristics), Section 6 (Conversion, Cutover, Training), Section 8 & 9", "Reviewed Sections 1 & 2 (Overview & Architecture by Ludovice)", "Approved & Verified"]
    ],
    [24, 34, 30, 12]
  ));

  return children;
}

module.exports = { getPart3Children };
