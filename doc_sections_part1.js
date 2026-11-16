const { Paragraph, TextRun, AlignmentType } = require('docx');
const { h1, h2, h3, p, bullet, callout, createTable, THEME } = require('./doc_helpers');

function getPart1Children() {
  const children = [];

  // TITLE PAGE - Verbatim Instructor SAD Requirement
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 800, after: 200 },
    children: [
      new TextRun({
        text: "WEB AND MOBILE-BASED CLINIC APPOINTMENT AND MEDICAL RECORD MANAGEMENT SYSTEM USING ARDUINO RFID PATIENT CARD",
        bold: true,
        size: 28,
        color: '000000',
        font: THEME.fontFamily
      })
    ]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 300 },
    children: [
      new TextRun({
        text: "Integrated System Design, Testing, Implementation, and Project Management",
        bold: true,
        size: 24,
        color: '000000',
        font: THEME.fontFamily
      })
    ]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 50, after: 600 },
    children: [
      new TextRun({
        text: "Finals — Activity #2: Modules XIII–XVII\nCourse: Systems Analysis and Design",
        italics: false,
        size: 22,
        color: '000000',
        font: THEME.fontFamily
      })
    ]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({ text: "Submitted by:\n", bold: true, size: 22, color: '000000', font: THEME.fontFamily }),
      new TextRun({ text: "Ludovice, Jaylord R.\nEvangelista, Tina Zaire P.\nBagayan, Lloyd M.\n", size: 22, color: '000000', font: THEME.fontFamily }),
      new TextRun({ text: "BSIT — Group 1 / Section #757\n\n", bold: true, size: 22, color: '000000', font: THEME.fontFamily }),
      new TextRun({ text: "Submitted to:\n", bold: true, size: 22, color: '000000', font: THEME.fontFamily }),
      new TextRun({ text: "MS. MARJORIE I. ABONITE, MSIT\n", bold: true, size: 24, color: '000000', font: THEME.fontFamily }),
      new TextRun({ text: "Course Instructor, Systems Analysis and Design\n\n", size: 21, italics: false, color: '000000', font: THEME.fontFamily }),
      new TextRun({ text: "Date of Submission: November 21, 2026", bold: true, size: 22, color: '000000', font: THEME.fontFamily })
    ]
  }));

  // PAGE BREAK
  children.push(new Paragraph({ pageBreakBefore: true }));

  // PRELIMINARY PAGES
  children.push(h1("Table of Contents"));
  const tocEntries = [
    "Section 1. Approved System Overview and Design Basis",
    "   1.1 Problem Addressed and Project Context",
    "   1.2 System Objectives and Theoretical Basis (IPSO)",
    "   1.3 The Five Approved User Roles and Responsibilities",
    "   1.4 Project Scope and Approved Exclusions",
    "   1.5 System Alignment Statement (Chapters I, II, III & Activities 2, 4)",
    "   1.6 Validated Requirements Register (FR-01 to FR-15 and NFR-01 to NFR-07)",
    "Section 2. Architecture and Infrastructure (Module XIII)",
    "   2.1 Architecture Comparison and Selection",
    "   2.2 Chosen System Architecture (Hybrid N-Tier Cloud-Edge)",
    "   2.3 System Architecture Diagram and Step-by-Step Flow",
    "   2.4 Physical Data Flow Diagram (Physical DFD Level 0 and Level 1)",
    "   2.5 Hardware, Hosting, and Network Infrastructure Plan",
    "Section 3. UI/UX, Forms, Outputs, and Prototype (Module XIV)",
    "   3.1 User-Task Analysis for the Five Approved Roles",
    "   3.2 Step-by-Step Critical Workflow and Wireframes",
    "   3.3 Form Specifications and Field Rules",
    "   3.4 Output and Report Specifications (Tickets, Prescriptions, MedCert, TV)",
    "   3.5 Accessibility Plan (WCAG 2.2 Level AA)",
    "   3.6 Usability Heuristic Evaluation Findings (Nielsen Norman Group)",
    "Section 4. Database Design, Security, and Audit Trails (Module XV)",
    "   4.1 Physical Database Schema Architecture (34 Prisma Models)",
    "   4.2 Data Dictionary of Key Persistent Entities",
    "   4.3 Database DDL SQL Script Extracts",
    "   4.4 Security Roles and Permissions Matrix (RBAC)",
    "   4.5 STRIDE Security Threat Analysis",
    "   4.6 System Audit Logs and Activity Tracking",
    "Section 5. System Testing Strategies and Results (Module XVI)",
    "   5.1 Test Plan, Quality Gates, and ISO/IEC 25010:2023 Alignment",
    "   5.2 Complete Test Cases (16 Unit, Integration, System, and UAT Cases)",
    "   5.3 Automated Testing Results Summary (Vitest / Jest)",
    "   5.4 User Acceptance Testing (UAT) and Defect Management Log",
    "Section 6. Implementation, Conversion, and Change Management",
    "   6.1 System Conversion Strategy (Parallel Run for 2 Weeks)",
    "   6.2 Step-by-Step Cutover Plan and Offline Rollback Protocol",
    "   6.3 Stakeholder Training Curriculum and Modality Matrix",
    "   6.4 Business Continuity and Disaster Recovery Targets (RPO / RTO)",
    "Section 7. Project Management in SAD (Module XVII)",
    "   7.1 Work Breakdown Structure (WBS - 6 Major Deliverables)",
    "   7.2 Master Project Schedule and Gantt Milestones",
    "   7.3 Critical Path Method (CPM) Network Analysis and Float Calculations",
    "   7.4 Program Evaluation and Review Technique (PERT 3-Point Estimates)",
    "   7.5 Agile Tracking, Definition of Done (DoD), and Retrospective",
    "Section 8. Maintenance and Post-Implementation Review (PIR)",
    "   8.1 The Four Types of Software Maintenance in SAD",
    "   8.2 Post-Implementation Review (PIR) Plan and Operational KPIs",
    "Section 9. Requirements Traceability and System Readiness",
    "   9.1 Master Requirements Traceability Matrix (RTM)",
    "   9.2 Formal System Readiness and Go-Live Statement",
    "Section 10. References and Peer Cross-Review",
    "   10.1 Academic and Technical References",
    "   10.2 Group Member Contribution and Peer Review Sign-Off"
  ];
  tocEntries.forEach(item => children.push(p(item, { size: 21 })));

  children.push(new Paragraph({ pageBreakBefore: true }));

  // SECTION 1
  children.push(h1("Section 1. Approved System Overview and Design Basis"));
  children.push(callout(
    "Approved Capstone Title",
    "Web and Mobile-Based Clinic Appointment and Medical Record Management System using Arduino RFID Patient Card"
  ));
  
  children.push(h2("1.1 Problem Addressed and Project Context"));
  children.push(p("As established in Chapter I (Introduction) and Chapter II (Review of Related Literature), primary healthcare delivery in outpatient clinics and rural health units in Laguna faces operational bottlenecks caused by manual, paper-driven workflows. Receptionists manually log incoming patients in logbooks, pull out paper charts from filing cabinets, and issue handwritten appointment slips."));
  children.push(p("This manual workflow causes three major problems:"));
  children.push(bullet("1. Frequent Loss and Misplacement of Records: Patients misplace paper clinic cards or forget previous consultation dates. When folders are misfiled, staff must pause the check-in line to search or create duplicate charts, fragmenting the patient's continuous medical history."));
  children.push(bullet("2. Prolonged Waiting Times: Waiting areas become overcrowded because patients must travel to the clinic early in the morning and wait several hours without knowing if the doctor is available or if consultation quotas are exhausted."));
  children.push(bullet("3. Lack of Legible, Traceable Medical Records: Handwritten doctor notes and prescriptions (Reseta) can be difficult to read, increasing the risk of medication errors. Furthermore, manual paper files lack audit logs, making it impossible to track unauthorized record access."));

  children.push(h2("1.2 System Objectives and Theoretical Basis"));
  children.push(p("To resolve these problems, this project provides a unified web and mobile healthcare platform connected to an Arduino RFID reader. Grounded in the Input-Process-Storage-Output (IPSO) framework described in Chapter II:"));
  children.push(bullet("Input: Patient demographics, doctor schedules, appointment requests, vital signs, clinical SOAP observations, and RFID card UIDs."));
  children.push(bullet("Process: Identity validation, duplicate detection, MRN assignment, slot checking, queue prioritization, RFID-assisted lookup, and digital prescription creation."));
  children.push(bullet("Storage: Centralized PostgreSQL database preserving user accounts, patient master records, appointments, queues, triage findings, medical records, and audit logs."));
  children.push(bullet("Output: Queue tickets with scannable QR codes, live waiting room TV display with audio callouts, digital medical records, and printable prescriptions."));
  children.push(p("Core Rule: The permanent Medical Record Number (MRN) is the authoritative patient identifier. The RFID card serves only as an assisted lookup key during check-in; no medical data is ever stored on the card chip."));

  children.push(h2("1.3 The Five Approved User Roles and Responsibilities"));
  children.push(p("In strict alignment with Chapter II, Activity #2 (DFD), Chapter III (Methodology), and Activity #4 (Integrated UML), the system defines exactly five (5) user roles:"));

  children.push(createTable(
    ["Role Name", "Clinic Implementation", "Core Responsibilities in the System", "Access Boundary"],
    [
      ["Patient", "Registered Clinic Patient", "Views doctor schedules; requests, confirms, cancels, or reschedules appointments; taps card at kiosk; views live queue and downloads own prescriptions.", "Limited strictly to own personal profile, own appointments, and own care summaries."],
      ["Administrator", "System Administrator", "Manages user accounts, assigns system roles, configures doctor schedules and clinic rules, issues RFID cards, and reviews audit logs.", "Full administrative access to governance, accounts, schedules, and audit records; no silent deletion of clinical history."],
      ["OPD", "Receptionist / Desk Staff", "Registers new patients, checks for duplicates, assigns permanent MRNs, assists with appointments, checks in walk-ins and scheduled arrivals, and links RFID cards.", "Access to registration, patient search, appointment calendar, and check-in queue management."],
      ["Triage", "Nurse / Triage Officer", "Reviews incoming queue; measures and records vital signs (BP, pulse, temp, weight, height, pain score); assigns priority status (Standard, Senior/PWD, Urgent).", "Access to triage intake screen, vital signs recording, and queue priority dispatch."],
      ["Doctor", "Attending Physician", "Calls the next queued patient; reviews historical medical charts; documents Subjective, Objective, Assessment, and Plan (SOAP) notes; authors digital prescriptions.", "Full access to patient clinical encounters, medical history, SOAP documentation, and prescription authoring."]
    ],
    [16, 18, 38, 28]
  ));

  children.push(h2("1.4 Project Scope and Approved Exclusions"));
  children.push(p("Approved Scope: Patient web self-service booking, doctor schedule management, contactless RFID check-in, real-time waiting room TV queue display, triage vital signs entry with automatic BMI calculation, structured SOAP clinical charting, and digital PDF prescription generation with verification QR codes."));
  children.push(p("Approved Exclusions (from Chapter I and Chapter III):"));
  children.push(bullet("1. Online Payment Gateways: Excluded; consultation fees remain over-the-counter manual clinic transactions."));
  children.push(bullet("2. Direct Cellular SMS Hardware: Excluded; alerts are handled through web dashboards and in-app notifications to prevent gateway operational costs."));
  children.push(bullet("3. Pharmacy Retail POS & Inventory: Excluded; system generates prescriptions but does not track medicine retail sales or pharmacy shelf stock."));
  children.push(bullet("4. Direct Diagnostic Telemetry: Excluded; lab and ECG readings are manually typed into the SOAP chart by the doctor."));
  children.push(bullet("5. Biometric Scanning: Excluded; patient identification relies on the physical RFID card paired with nurse photo/identity confirmation."));

  children.push(h2("1.5 System Alignment Statement"));
  children.push(p("This document integrates Modules XIII through XVII and strictly follows the approved documentation baseline:"));
  children.push(bullet("Chapter I: Establishes the clinic background, problem context, objectives, and hardware/software scope."));
  children.push(bullet("Chapter II & Activity #2: Defines the IPSO theoretical framework, the 5 external entities (Patient, Administrator, OPD, Triage, Doctor), DFD processes 1.0 to 5.0, and data stores D1 to D6."));
  children.push(bullet("Chapter III & Activity #4: Supplies the complete 15-item functional requirements register (FR-01 to FR-15), 7 non-functional requirements (NFR-01 to NFR-07), and the full Requirements Traceability Matrix."));

  children.push(h2("1.6 Validated Requirements Register"));
  children.push(createTable(
    ["Req ID", "Functional Requirement Description", "Role / Owner", "Source Reference", "Design and Testing Implication"],
    [
      ["FR-01", "Register patient account and verify unique identity fields.", "Patient & Admin", "Ch. III Table 8 / Act 2 FR2", "Validates name and birthdate; rejects duplicate MRNs. Tested in TC-01."],
      ["FR-02", "Authenticate securely and enforce role-based authorization.", "All Roles", "Ch. III Table 8 / Act 2 FR3", "NextAuth.js session controls; unauthorized routes denied. Tested in TC-02."],
      ["FR-03", "Maintain permitted patient profile and contact information.", "Patient & Admin", "Ch. III Table 8 / Act 2 FR2", "Profile editing with phone format validation and audit trail. Tested in TC-03."],
      ["FR-04", "Request, confirm, reschedule, or cancel clinic appointments.", "Patient & OPD", "Ch. III Table 8 / Act 2 FR1", "Calendar slot validation prevents double-booking. Tested in TC-04."],
      ["FR-05", "Check in appointment or walk-in and create one active queue ticket.", "OPD (Receptionist)", "Ch. III Table 8 / Act 2 FR5", "Creates single active ticket; blocks duplicate check-in. Tested in TC-05."],
      ["FR-06", "Assign and process queue priority order (Standard, PWD, Urgent).", "OPD & Triage", "Ch. III Table 8 / Act 2 FR6", "Queue sorting follows priority rules; overrides logged. Tested in TC-06."],
      ["FR-07", "Look up patient record using Arduino RFID card UID tap.", "OPD & Kiosk", "Ch. III Table 8 / Act 2 FR8", "Scans UID in <= 2s; maps to server MRN token. Tested in TC-07."],
      ["FR-08", "Display live queue numbers on waiting room TV with privacy.", "Patient & Staff", "Ch. III Table 8 / Act 2 FR5", "WebSocket refreshes TV in <= 5s; hides clinical data. Tested in TC-08."],
      ["FR-09", "Open authorized consultation context from assigned queue.", "Doctor", "Ch. III Table 8 / Act 2 FR7", "Only assigned physician can open patient chart; logged. Tested in TC-09."],
      ["FR-10", "Create and save structured SOAP clinical notes.", "Doctor", "Ch. III Table 8 / Act 2 FR7", "Validates Subjective, Objective, Assessment, and Plan fields. Tested in TC-10."],
      ["FR-11", "Finalize and preserve medical record using amendment tracking.", "Doctor & Admin", "Ch. III Table 8 / Act 2 FR7", "Finalized records cannot be deleted; amendments audited. Tested in TC-11."],
      ["FR-12", "Generate digital prescription and patient care summary.", "Doctor & Patient", "Ch. III Table 8 / Act 2 FR7", "PDFKit creates prescription with QR code verification. Tested in TC-12."],
      ["FR-13", "Create, deactivate, and assign approved user roles.", "Administrator", "Ch. III Table 8 / Act 2 FR3", "Role changes require admin session; updates logged. Tested in TC-13."],
      ["FR-14", "Record immutable audit logs for security and data events.", "Administrator", "Ch. III Table 8 / Act 2 FR3", "Trigger saves actor, action, timestamp, and target IP. Tested in TC-14."],
      ["FR-15", "Allow patient self-service to view appointment and care summaries.", "Patient", "Ch. III Table 8 / Act 2 FR1", "Patients access only their own records; clean error states. Tested in TC-15."],
      ["NFR-01", "Performance: Page and API actions complete in <= 2 seconds.", "All Users", "Ch. III Table 9 (ISO 25010)", "Indexed database queries ensure fast sub-second response."],
      ["NFR-02", "Security: Enforce TLS 1.3 encryption and bcrypt password hashing.", "System", "Ch. III Table 9 (ISO 25010)", "Enforced via Supabase SSL and NextAuth salted hashing."],
      ["NFR-03", "Reliability & Recovery: RPO < 1 hour and RTO < 30 minutes.", "System", "Ch. III Table 9 (ISO 25010)", "Automated database backups and transaction rollback protection."],
      ["NFR-04", "Usability & Accessibility: WCAG 2.2 AA keyboard and contrast rules.", "All Users", "Ch. III Table 9 (ISO 25010)", "Keyboard navigable forms and high-contrast readable layouts."]
    ],
    [10, 32, 16, 16, 26]
  ));

  // PAGE BREAK
  children.push(new Paragraph({ pageBreakBefore: true }));

  // SECTION 2
  children.push(h1("Section 2. Architecture and Infrastructure (Module XIII)"));
  children.push(h2("2.1 Architecture Comparison and Selection"));
  children.push(p("To select the most reliable design for the clinic, four common architectures were compared:"));

  children.push(createTable(
    ["Approach", "Application to Approved System", "Key Advantages", "Key Limitations", "Suitability"],
    [
      ["Traditional Client-Server", "Installing software on one local desktop PC inside the clinic office.", "Fast on local LAN; works during external internet outages.", "Patients cannot book appointments from home; data is lost if the PC fails.", "Unsuitable for online patient access."],
      ["N-Tier (Multi-Tier) Architecture", "Dividing system into Presentation Layer (Next.js/React Native), Logic Layer (API), and Data Layer (PostgreSQL).", "Clean separation of responsibilities, easy to maintain, strong security boundaries.", "Requires well-defined API contracts between frontend and backend.", "Highly Suitable (Selected as Core System Architecture)."],
      ["Microservices Architecture", "Splitting every function (Auth, Queue, EMR, Notes) into independent micro-servers.", "Individual services can scale independently.", "Extremely complex to build, test, and manage for a small clinic team.", "Unsuitable (Over-engineering for clinic scope)."],
      ["Cloud-Based Deployment (PaaS/BaaS)", "Hosting the web application on Vercel and the database on Supabase cloud.", "Zero local server maintenance, automatic backups, 99.9% uptime, accessible anywhere.", "Requires active internet; monthly cost after free usage limits.", "Highly Suitable (Selected as Production Hosting Model)."]
    ],
    [15, 23, 23, 23, 16]
  ));

  children.push(h2("2.2 Chosen System Architecture (Hybrid N-Tier Cloud-Edge)"));
  children.push(p("The project adopts a Hybrid N-Tier Cloud-Edge Architecture:"));
  children.push(bullet("1. Edge Layer (Clinic Entrance): Arduino Uno equipped with an RC522 RFID reader connects via USB serial to a kiosk station. When a card is tapped, the kiosk program sends the card UID securely to the cloud API."));
  children.push(bullet("2. Presentation Layer: Next.js 16 handles desktop browsers for OPD Receptionists, Triage Nurses, Doctors, and Waiting Room TVs. React Native (Expo) provides the patient mobile app."));
  children.push(bullet("3. Application Logic Layer: Server Actions and Next.js API route handlers validate inputs, check user roles, enforce business rules, and manage transactions."));
  children.push(bullet("4. Data Layer: A centralized PostgreSQL database hosted on Supabase stores all tables, with encrypted file storage for PDF prescriptions and certificates."));

  children.push(h2("2.3 System Architecture Diagram and Step-by-Step Flow"));
  children.push(callout(
    "Architecture Component Overview",
    "Tier 1 (Edge Devices): Kiosk Station with Arduino RC522 Reader, OPD PC, Triage PC, Doctor Workstation, Waiting Room Smart TV, and Patient Smartphone.\n" +
    "Tier 2 (Cloud Application): Vercel Edge Serverless Platform, Next.js 16 App Router, NextAuth.js Role Authorization, and Prisma ORM 5.22.\n" +
    "Tier 3 (Cloud Data & Services): Supabase PostgreSQL Database, Supabase Encrypted S3 Storage, Pusher WebSocket Gateway, and SMTP Mail Service."
  ));

  children.push(h3("Step-by-Step Transaction Flow: RFID Tap to Queue Callout"));
  children.push(bullet("Step 1: Patient arrives at the clinic and taps their Mifare Classic 1K RFID card on the kiosk scanner."));
  children.push(bullet("Step 2: Arduino firmware reads the 4-byte UID (e.g., 'E24A8B19') and sends it over USB serial to the kiosk helper software."));
  children.push(bullet("Step 3: Kiosk sends an authenticated HTTPS request to /api/queue/checkin."));
  children.push(bullet("Step 4: Server queries the RfidCard table, matches the patient's MRN, verifies identity, and checks for today's appointment."));
  children.push(bullet("Step 5: Server creates a new QueueTicket record (e.g. Ticket #A-024) with status 'WAITING_FOR_TRIAGE'."));
  children.push(bullet("Step 6: Server broadcasts a WebSocket event to the 'clinic-queue' channel."));
  children.push(bullet("Step 7: The Waiting Room TV updates immediately and plays a voice announcement: 'Now calling Ticket A-024 to Triage Desk'."));

  children.push(h2("2.4 Physical Data Flow Diagram (Physical DFD)"));
  children.push(p("The Physical DFD directly corresponds to the approved processes in Activity #2 (DFD) and Chapter III (Methodology):"));
  children.push(bullet("External Entities: Patient, Administrator, OPD (Receptionist), Triage (Nurse), Doctor."));
  children.push(bullet("Physical Processes (Matching Activity #2 DFD Level 0 & Level 1):"));
  children.push(bullet("   - 1.0 Manage Patient Registration and RFID Retrieval: Validates identity, assigns permanent MRN, and links RFID card to D2.", 1));
  children.push(bullet("   - 2.0 Manage Doctor Schedules and Appointments: Updates doctor slots in D3; handles patient appointment requests.", 1));
  children.push(bullet("   - 3.0 Manage Clinic Check-In and Consultation Queue: Processes arrival; saves queue ticket in D4; notifies TV display.", 1));
  children.push(bullet("   - 4.0 Manage Triage and Medical Consultation (Decomposed into Subprocesses 4.1 to 4.4):", 1));
  children.push(bullet("        * 4.1 Retrieve Patient and Encounter Information from D2 and D4.", 2));
  children.push(bullet("        * 4.2 Record Triage and Vital Signs into D4.", 2));
  children.push(bullet("        * 4.3 Record Doctor Consultation (SOAP notes) into D5.", 2));
  children.push(bullet("        * 4.4 Record Prescription and Follow-Up into D5.", 2));
  children.push(bullet("   - 5.0 Manage Users, Access and Audit: Manages staff logins in D1 and writes immutable activity logs to D6.", 1));
  children.push(bullet("Physical Data Stores (Matching Activity #2 DFD D1 to D6):"));
  children.push(bullet("   - D1: User Accounts & Roles (Login credentials, role permissions)"));
  children.push(bullet("   - D2: Patient Profiles & RFID Records (Demographics, permanent MRN, RFID links)"));
  children.push(bullet("   - D3: Doctor Schedules & Appointments (Doctor availability, booking transactions)"));
  children.push(bullet("   - D4: Queue & Triage Records (Queue tickets, priority status, vital signs)"));
  children.push(bullet("   - D5: Electronic Medical Records (SOAP notes, prescriptions, care summaries)"));
  children.push(bullet("   - D6: Audit Logs (System actions, timestamps, actor IDs, security events)"));

  children.push(h2("2.5 Hardware, Hosting, and Network Infrastructure Plan"));
  children.push(createTable(
    ["Infrastructure Element", "Hardware / Technology Setup", "Purpose and Justification", "Testing and Monitoring Method"],
    [
      ["Client Devices", "Kiosk PC (Intel N100, 8GB RAM), OPD Desktop, Triage Tablet, Doctor PC, 55\" Waiting Room TV, Patient Smartphone.", "Provides specialized interfaces tailored to each clinical workflow and user role.", "Cross-browser testing on Chrome, Edge, and Android/iOS viewports."],
      ["Web Application Hosting", "Vercel Cloud Platform (Serverless Node.js edge network).", "Auto-scales during morning check-in surges; zero manual server maintenance.", "Monitored via Vercel analytics and automated uptime ping checks."],
      ["Database Hosting", "Supabase Managed PostgreSQL on AWS Asia Pacific (Singapore).", "Low-latency connection (<45ms) to the Philippines with automated replication.", "Monitored via Supabase Studio metrics and connection pool tracking."],
      ["Network & Backup", "Primary: 100 Mbps Clinic Fiber Internet; Backup: 4G/5G mobile WiFi gateway.", "Guarantees continuous uptime for card check-in and live TV queue display.", "Automatic dual-WAN failover router tested weekly."],
      ["Document Storage", "Supabase Encrypted Cloud Storage (S3-compatible).", "Stores digital prescription PDFs and medical certificates securely.", "Tested via upload integrity checks and time-limited download links."],
      ["Backup and Monitoring", "Daily automated PostgreSQL logical backups and Write-Ahead Logging (WAL).", "Guarantees recovery targets (RPO < 1h, RTO < 30min) in case of system failure.", "Monthly test restore rehearsal on a separate sandbox database."]
    ],
    [15, 27, 33, 25]
  ));

  return children;
}

module.exports = { getPart1Children };
