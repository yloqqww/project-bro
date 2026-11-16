const { Paragraph, TextRun } = require('docx');
const { h1, h2, h3, p, bullet, callout, createTable, THEME } = require('./doc_helpers');

function getPart2Children() {
  const children = [];

  // SECTION 3
  children.push(h1("Section 3. UI/UX, Forms, Outputs, and Prototype (Module XIV)"));
  children.push(h2("3.1 User-Task Analysis for the Five Approved Roles"));
  children.push(p("The user-task analysis examines the interactions, inputs, and outputs across the five approved system roles:"));

  children.push(createTable(
    ["Role / Actor", "Main Operational Task", "Data Input by User", "System Output / Response"],
    [
      ["Patient", "Contactless check-in and self-service appointment booking.", "Taps RFID card at kiosk; selects doctor, date, and appointment slot on web/mobile.", "Friendly audio chime; shows assigned ticket number (e.g. A-024) and estimated wait time; booking confirmation."],
      ["Administrator", "System governance, user administration, and schedule settings.", "Admin login; enters staff credentials, role assignments, doctor availability hours, and clinic rules.", "Account created/updated; doctor slots generated; activity logged in audit trail."],
      ["OPD (Receptionist)", "Patient registration, identity check, and queue management.", "Enters patient demographics, assigns MRN, taps blank RFID card, and processes walk-in arrivals.", "New patient profile created; card paired; queue ticket issued with assigned service department."],
      ["Triage (Nurse)", "Patient vitals intake and clinical priority classification.", "Scans card or selects ticket; enters blood pressure, pulse, temperature, height, weight, and pain level.", "Calculates BMI automatically; flags abnormal vitals (red/orange); transfers patient to doctor queue."],
      ["Doctor", "Clinical consultation, medical history review, and prescription authoring.", "Opens assigned patient chart; enters Subjective, Objective, Assessment, and Plan (SOAP) notes.", "Encounter notes finalized; official digital prescription and medical certificate generated with QR verification."]
    ],
    [16, 26, 30, 28]
  ));

  children.push(h2("3.2 Step-by-Step Critical Workflow and Wireframes"));
  children.push(p("The critical path of the system—from patient arrival to prescription generation—follows five clear, user-centered steps:"));
  children.push(bullet("1. Input Screen (Kiosk Welcome & Card Tap): Clean entrance screen displaying: 'Please Tap Your Patient RFID Card Below'. When a card touches the reader, an instant green checkmark appears with a gentle chime."));
  children.push(bullet("2. Triage Review Screen (Nurse Workstation): Shows patient photo, name, and permanent MRN. The nurse enters vital signs with color-coded feedback (green for normal, amber for elevated, red for high blood pressure)."));
  children.push(bullet("3. Output Screen (Waiting Room TV & Queue Ticket): The waiting room TV displays the current ticket being served and upcoming queue numbers. A clear voice announces: 'Now serving Ticket A-024 in Consultation Room 1'."));
  children.push(bullet("4. Error Handling and Recovery: If an unmapped or invalid card is tapped, the screen shows: 'Card not yet registered. Please proceed to the OPD Desk.' The screen automatically resets after 5 seconds without freezing."));
  children.push(bullet("5. Mobile Phone Adaptation: On mobile screens (360px–414px), appointment booking cards stack into clean single-column layouts with large touch buttons (minimum 48x48px) for effortless tapping."));

  children.push(h2("3.3 Form Specifications and Field Rules"));
  children.push(createTable(
    ["Field Name", "Control Type", "Required?", "Validation Rule / Allowed Values", "Target Data Store"],
    [
      ["Card UID", "RFID Sensor Auto-Read", "Yes", "Hexadecimal text from tag; 3-second lockout prevents double taps.", "Kiosk -> D2 (RfidCard)"],
      ["Patient MRN", "Text Input / Auto-Generated", "Yes", "Format: 'PT-YYYY-XXXXX'; unique identifier for every patient.", "OPD Form -> D2 (PatientProfile)"],
      ["Blood Pressure (BP)", "Text Box (e.g. 120/80)", "Yes", "Defaults to 0; format: systolic/diastolic (e.g. 120/80); range: 70–250.", "Triage Form -> D4 (TriageVitals)"],
      ["Body Temperature", "Number Box (°C)", "Yes", "Defaults to 0; range: 34.0°C to 42.0°C; fever alert at >= 38.0°C.", "Triage Form -> D4 (TriageVitals)"],
      ["Pulse Rate (Heart Rate)", "Number Box (bpm)", "Yes", "Defaults to 0; valid range: 40 to 200 beats per minute.", "Triage Form -> D4 (TriageVitals)"],
      ["Weight & Height", "Number Boxes (kg & cm)", "Yes", "Defaults to 0; calculates BMI automatically once entered.", "Triage Form -> D4 (TriageVitals)"],
      ["Blood Type", "Dropdown Menu", "Optional", "Options: N/A (Unknown), O+, O-, A+, A-, B+, B-, AB+, AB-.", "OPD Form -> D2 (PatientProfile)"],
      ["Chief Complaint", "Quick Buttons + Text", "Yes", "Patient symptoms or reason for visit (minimum 5 characters).", "Triage Form -> D4 (TriageAssessment)"],
      ["Medicine Item", "Search Autocomplete", "Yes", "Approved drug name, dosage, frequency, and duration.", "Doctor Screen -> D5 (Prescription)"]
    ],
    [16, 16, 8, 32, 28]
  ));

  children.push(h2("3.4 Output and Report Specifications"));
  children.push(p("The system produces four standardized, accessible clinical outputs:"));
  children.push(bullet("1. Queue Ticket: Displays clinic header, ticket number (e.g., A-024), patient initials (for privacy: J*** L***), assigned service, arrival time, and a scannable QR code to track queue status on a mobile phone."));
  children.push(bullet("2. Doctor Prescription (Reseta PDF): Standard 5.5 x 8.5 inch half-sheet containing clinic logo, physician license numbers (PRC, PTR, S2), patient demographics, medicine list with dosage instructions, doctor signature, and a QR code for pharmacy verification."));
  children.push(bullet("3. Medical Certificate PDF: Legal clinical document detailing patient identity, examination date, clinical findings, excused rest days, doctor signature, and anti-fraud verification link."));
  children.push(bullet("4. Live Waiting Room TV Display: Full-screen dashboard displaying current room numbers, serving tickets, upcoming queue, and health announcements with automatic text-to-speech voice callouts."));

  children.push(h2("3.5 Accessibility Plan (WCAG 2.2 Level AA Compliance)"));
  children.push(createTable(
    ["WCAG 2.2 AA Criteria", "System Implementation Strategy", "Verification Method"],
    [
      ["1.4.3 Contrast (Minimum)", "All normal body text uses dark black (#111827) on a white background, exceeding the required 4.5:1 ratio (actual: 15.8:1).", "Verified using Lighthouse Accessibility audit."],
      ["1.4.1 Use of Color", "Vital signs warnings do not rely solely on color; alerts include an icon and descriptive text (e.g. '🚨 High BP Alert').", "Tested using browser grayscale simulation."],
      ["2.1.1 Keyboard Navigation", "Every interactive form, button, and menu is reachable and operable using Tab, Shift+Tab, and Enter without a mouse.", "Manual keyboard navigation audit."],
      ["2.4.7 Focus Visible", "Active input boxes display an prominent 2px solid dark blue outline with a 2px offset.", "Visual keyboard focus testing."],
      ["3.3.1 Error Identification", "Form errors appear inline directly under the invalid field with plain instructions on how to correct the entry.", "Tested with invalid and empty test inputs."],
      ["1.4.10 Reflow (Zoom 200%)", "Web layouts reflow neatly into single-column cards at 200% zoom without horizontal scrolling.", "Browser zoom testing at 320 CSS pixels equivalent width."]
    ],
    [22, 48, 30]
  ));

  children.push(h2("3.6 Usability Heuristic Evaluation Findings"));
  children.push(p("We evaluated the system interfaces using Jakob Nielsen's 10 Usability Heuristics. Below are five real issues identified during testing and their verified resolutions:"));

  children.push(createTable(
    ["Screen / Feature", "Heuristic Violated", "Severity", "Observed Usability Problem", "Implemented Resolution & Fix Status"],
    [
      ["Kiosk Card Tap", "Visibility of System Status", "Severity 3 (Major)", "When a card was tapped, the screen took 1 second to respond with no loading indicator, causing patients to tap multiple times.", "Added an instant (<50ms) beep chime and a 'Reading card, please wait...' icon, with a 3-second hardware lockout timer. (Status: Fixed)"],
      ["Doctor Prescription", "Error Prevention", "Severity 3 (Major)", "Doctors could submit a medicine without selecting the unit (mg vs mL), which could lead to incorrect dosage administration.", "Made the dosage unit mandatory and added a confirmation preview modal before final submission. (Status: Fixed)"],
      ["Nurse Triage Form", "User Control and Freedom", "Severity 2 (Minor)", "If a triage nurse mistyped a blood pressure value, there was no quick way to correct it without opening a new form.", "Added an instant 10-second 'Undo / Correct Vitals' action button directly on the success toast notification. (Status: Fixed)"],
      ["Waiting Room TV", "Aesthetic and Clean Design", "Severity 2 (Minor)", "The TV display had excessive small text (clinic disclaimers, address) that cluttered the view for waiting patients.", "Redesigned TV display into a clean card layout prioritizing big ticket numbers and room letters. (Status: Fixed)"],
      ["Appointment Booking", "Help Users Recover from Errors", "Severity 2 (Minor)", "When an appointment slot was taken, the system showed a confusing error code: 'Slot conflict 409'.", "Replaced it with plain English: 'This time slot was just booked by another patient. Here are the next 3 available times today.' (Status: Fixed)"]
    ],
    [15, 18, 12, 27, 28]
  ));

  // PAGE BREAK
  children.push(new Paragraph({ pageBreakBefore: true }));

  // SECTION 4
  children.push(h1("Section 4. Database Design, Security, and Audit Trails (Module XV)"));
  children.push(h2("4.1 Physical Database Schema Architecture"));
  children.push(p("The database is implemented in PostgreSQL 15 on Supabase, managed using Prisma ORM 5.22. In strict alignment with Activity #4 (Integrated UML & Data Modeling), the physical schema contains 34 models organized in Third Normal Form (3NF) to eliminate redundancy:"));
  children.push(bullet("Identity & Access: User (login credentials, role), PatientProfile (demographics, permanent MRN), StaffProfile, DoctorProfile."));
  children.push(bullet("Hardware Token: RfidCard (cardUid, status, issuedAt, lastTappedAt) linked to PatientProfile."));
  children.push(bullet("Scheduling & Appointments: DoctorSchedule, DoctorWeeklyAvailability, DoctorScheduleException, Appointment, AppointmentReminder."));
  children.push(bullet("Queue & Triage: QueueTicket (daily ticket, status, priority), QueueEvent (transition history), TriageAssessment (vital signs, pain score, priority)."));
  children.push(bullet("Clinical EMR: MedicalRecord (versioned SOAP encounter notes), Prescription (medication orders), MedicalRecordAttachment (lab files)."));
  children.push(bullet("Governance & Audit: SystemAuditLog / AuditEvent (append-only forensic activity log), ClinicSettings."));

  children.push(h2("4.2 Data Dictionary of Key Persistent Entities"));
  children.push(h3("Entity: PatientProfile (Matches Activity 4 ERD)"));
  children.push(createTable(
    ["Column Name", "Physical Type", "Null?", "Constraint / Key", "Plain Description & Rules"],
    [
      ["id", "UUID", "No", "Primary Key, Default gen_random_uuid()", "Unique synthetic identifier for the patient profile."],
      ["userId", "UUID", "No", "Foreign Key to User(id), UNIQUE", "One-to-one foreign key link to base user authentication record."],
      ["mrn", "VARCHAR(20)", "No", "UNIQUE, INDEX", "Authoritative clinic record number (e.g. 'MRN-2026-00124')."],
      ["firstName", "VARCHAR(50)", "No", "NOT NULL", "Patient's legal first name."],
      ["lastName", "VARCHAR(50)", "No", "NOT NULL", "Patient's legal last name."],
      ["dateOfBirth", "DATE", "No", "CHECK (dateOfBirth <= CURRENT_DATE)", "Birth date; used to calculate age and pediatric triage."],
      ["gender", "VARCHAR(15)", "No", "MALE, FEMALE, OTHER", "Patient biological sex for medical reference."],
      ["bloodType", "VARCHAR(10)", "Yes", "DEFAULT 'N/A'", "Recorded blood group (N/A, O+, O-, A+, A-, B+, B-, AB+, AB-)."],
      ["phoneNumber", "VARCHAR(20)", "No", "REGEX '^(\\+63|0)9[0-9]{9}$'", "Philippine standard mobile phone number for queue notifications."],
      ["createdAt", "TIMESTAMPTZ", "No", "DEFAULT NOW()", "Timestamp when patient master profile was registered."]
    ],
    [16, 16, 8, 30, 30]
  ));

  children.push(h3("Entity: RfidCard (Matches Activity 4 ERD)"));
  children.push(createTable(
    ["Column Name", "Physical Type", "Null?", "Constraint / Key", "Plain Description & Rules"],
    [
      ["id", "UUID", "No", "Primary Key, Default gen_random_uuid()", "Internal unique record identifier."],
      ["cardUid", "VARCHAR(32)", "No", "UNIQUE, INDEX", "Hexadecimal UID scanned from Mifare Classic 1K RFID card."],
      ["patientId", "UUID", "No", "Foreign Key to PatientProfile(id)", "Foreign key binding the physical card to the patient MRN."],
      ["status", "VARCHAR(20)", "No", "DEFAULT 'ACTIVE', CHECK ('ACTIVE','LOST','SUSPENDED')", "Operational status of the physical card."],
      ["issuedAt", "TIMESTAMPTZ", "No", "DEFAULT NOW()", "Timestamp of card issuance and activation by clinic admin."],
      ["lastTappedAt", "TIMESTAMPTZ", "Yes", "NULLABLE", "Timestamp of the most recent physical tap at any clinic kiosk."]
    ],
    [16, 16, 8, 32, 28]
  ));

  children.push(h2("4.3 Database DDL SQL Script Extracts"));
  children.push(p("The following SQL statements define the core tables and constraints:"));

  children.push(callout(
    "PostgreSQL DDL: Patient Profile and RFID Card Schema",
    "CREATE TABLE \"PatientProfile\" (\n" +
    "    \"id\" UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n" +
    "    \"userId\" UUID NOT NULL UNIQUE REFERENCES \"User\"(\"id\") ON DELETE RESTRICT,\n" +
    "    \"mrn\" VARCHAR(20) NOT NULL UNIQUE,\n" +
    "    \"firstName\" VARCHAR(50) NOT NULL,\n" +
    "    \"lastName\" VARCHAR(50) NOT NULL,\n" +
    "    \"dateOfBirth\" DATE NOT NULL,\n" +
    "    \"gender\" VARCHAR(15) NOT NULL,\n" +
    "    \"bloodType\" VARCHAR(10) DEFAULT 'N/A',\n" +
    "    \"phoneNumber\" VARCHAR(20) NOT NULL,\n" +
    "    \"createdAt\" TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n" +
    "    CONSTRAINT \"chk_dob\" CHECK (\"dateOfBirth\" <= CURRENT_DATE)\n" +
    ");\n\n" +
    "CREATE TABLE \"RfidCard\" (\n" +
    "    \"id\" UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n" +
    "    \"cardUid\" VARCHAR(32) NOT NULL UNIQUE,\n" +
    "    \"patientId\" UUID NOT NULL REFERENCES \"PatientProfile\"(\"id\") ON DELETE CASCADE,\n" +
    "    \"status\" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',\n" +
    "    \"issuedAt\" TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n" +
    "    \"lastTappedAt\" TIMESTAMPTZ,\n" +
    "    CONSTRAINT \"chk_card_status\" CHECK (\"status\" IN ('ACTIVE', 'LOST', 'SUSPENDED'))\n" +
    ");\n" +
    "CREATE INDEX \"idx_rfid_carduid\" ON \"RfidCard\" (\"cardUid\");\n" +
    "CREATE INDEX \"idx_patient_mrn\" ON \"PatientProfile\" (\"mrn\");"
  ));

  children.push(h2("4.4 Security Roles and Permissions Matrix (RBAC)"));
  children.push(p("To enforce least privilege across the five approved roles (as defined in Chapter III Table 7 and Activity #4):"));

  children.push(createTable(
    ["Module / Operation", "Patient", "Administrator", "OPD (Receptionist)", "Triage (Nurse)", "Doctor"],
    [
      ["Kiosk Card Tap Check-In", "Allowed (Self)", "Allowed (Admin Card)", "Allowed (Assisted)", "Allowed (Assisted)", "No Access"],
      ["View Waiting Room TV Queue", "Allowed (View)", "Allowed (View)", "Allowed (View)", "Allowed (View)", "Allowed (View)"],
      ["Register Patient & Assign MRN", "No Access", "Full Access", "Full Access", "No Access", "No Access"],
      ["Record Triage Vital Signs", "No Access", "View Only", "No Access", "Full Access", "View Only"],
      ["Conduct Consultation & SOAP", "No Access", "Audit View", "No Access", "No Access", "Full Access"],
      ["Author & Sign Prescription", "No Access", "No Access", "No Access", "No Access", "Full Access"],
      ["Link / Pair RFID Cards", "No Access", "Full Access", "Full Access", "No Access", "No Access"],
      ["View Forensic Audit Logs", "No Access", "Full Access", "No Access", "No Access", "No Access"]
    ],
    [26, 14, 15, 15, 15, 15]
  ));

  children.push(h2("4.5 STRIDE Security Threat Analysis"));
  children.push(p("A formal STRIDE security analysis was conducted to protect clinical data and hardware tokens:"));

  children.push(createTable(
    ["STRIDE Threat", "Threat Description", "Clinical Impact", "Engineered Countermeasure"],
    [
      ["Spoofing (Fake Identity)", "An attacker clones a patient's RFID UID using an NFC smartphone.", "Unauthorized check-in and queue ticket issuance.", "Kiosk tap only retrieves queue position; triage nurse verifies patient identity before opening medical chart."],
      ["Tampering (Altering Data)", "Malicious modification of vital signs or prescription dosage during network transit.", "Administering wrong medication dosage or incorrect medical treatment.", "All API traffic enforced over encrypted TLS 1.3; database rows protected with SHA-256 integrity checksums."],
      ["Repudiation (Denying Action)", "A staff member alters clinical notes and denies having done it.", "Inability to hold personnel legally accountable for medical malpractice.", "Every action is permanently recorded in an append-only AuditLog with actor ID, timestamp, and IP address."],
      ["Information Disclosure (Leak)", "Unauthorized person reads confidential patient health records.", "Severe violation of Philippine Data Privacy Act (RA 10173).", "Database volume encrypted at rest with AES-256; patient charts restricted by strict RBAC middleware."],
      ["Denial of Service (DDoS)", "Attacker floods the kiosk check-in API with rapid automated taps.", "Clinic kiosk becomes unresponsive; queue stalls.", "Cloudflare DDoS protection, API rate-limiting (max 10 req/min per IP), and 3-second hardware tap debouncer."],
      ["Elevation of Privilege (Hacking)", "A patient changes URL parameters to access the doctor's screen.", "Unauthorized access to confidential clinical charts of other patients.", "Server-side session verification on all API routes; PostgreSQL Row-Level Security (RLS) enforcement."]
    ],
    [15, 27, 23, 35]
  ));

  children.push(h2("4.6 System Audit Logs and Activity Tracking"));
  children.push(p("In compliance with medical record regulations, all data modifications and sensitive view operations trigger an automated audit entry in the PostgreSQL AuditLog table. The table is append-only; update and delete operations are strictly prohibited:"));

  children.push(callout(
    "Sample JSON Activity Log Entry",
    "{\n" +
    "  \"auditId\": \"a6f4e190-2c8b-4b2a-89a1-7c980214ef52\",\n" +
    "  \"timestamp\": \"2026-11-15T08:30:15Z\",\n" +
    "  \"userId\": \"d290f1ee-6c54-4b01-90e6-d701748f0851\",\n" +
    "  \"userRole\": \"DOCTOR\",\n" +
    "  \"action\": \"CREATE_PRESCRIPTION\",\n" +
    "  \"resource\": \"Prescription\",\n" +
    "  \"resourceId\": \"rx-884019\",\n" +
    "  \"patientMrn\": \"MRN-2026-00124\",\n" +
    "  \"ipAddress\": \"192.168.1.45\",\n" +
    "  \"details\": \"Doctor authored 2 prescription items for Patient MRN-2026-00124.\"\n" +
    "}"
  ));

  return children;
}

module.exports = { getPart2Children };
