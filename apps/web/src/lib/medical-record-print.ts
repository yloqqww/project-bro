export interface MedicalRecordPrintInput {
  id: string;
  recordNumber: string;
  patientName: string;
  patientId: string;
  doctorName: string;
  doctorSpecialty: string;
  date: string;
  time: string;
  type: string;
  status: string;
  chiefComplaint: string;
  diagnosis: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  notes: string;
  vitalSigns: {
    bloodPressure: string;
    heartRate: string;
    temperature: string;
    weight: string;
  };
  prescriptions: {
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
    eSignatureName: string | null;
    eSignatureLicense: string | null;
  }[];
  finalizedAt: string | null;
  finalizedByName: string | null;
  contentHash: string | null;
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatReadableDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function openPrintDocument(title: string, bodyHtml: string): boolean {
  if (typeof window === 'undefined') return false;
  const printWindow = window.open('', '_blank', 'width=900,height=950');
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 28px 34px;
      background: #ffffff;
      line-height: 1.5;
      font-size: 13px;
    }
    .header {
      border-bottom: 2px solid #0f766e;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .clinic-name {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .clinic-sub {
      font-size: 11px;
      color: #475569;
      margin: 2px 0 0;
    }
    .doc-badge {
      text-align: right;
      font-size: 11px;
      color: #334155;
    }
    .doc-title {
      text-align: center;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0f766e;
      margin: 14px 0 18px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 18px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      display: block;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .vital-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      text-align: center;
      background: #ffffff;
    }
    .section {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0f766e;
      margin: 0 0 6px;
    }
    .cert-body {
      font-size: 14px;
      line-height: 1.75;
      color: #1e293b;
      margin: 18px 0;
    }
    .cert-box {
      background: #f8fafc;
      border-left: 4px solid #0f766e;
      padding: 12px 16px;
      margin: 14px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #334155;
    }
    .signature-row {
      margin-top: 42px;
      display: flex;
      justify-content: flex-end;
    }
    .signature-box {
      width: 270px;
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #0f172a;
      padding-top: 6px;
      font-weight: 700;
      font-size: 13px;
    }
    .footer-note {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      font-size: 10px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .no-print {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      padding: 8px 14px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      background: #0f766e;
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-secondary {
      background: #ffffff;
      color: #334155;
    }
    @media print {
      body { padding: 14px 18px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${bodyHtml}
  <div class="no-print">
    <button class="btn btn-secondary" onclick="window.close()">Close</button>
    <button class="btn" onclick="window.print()">Print Document</button>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 200);
    });
  </script>
</body>
</html>`);
  printWindow.document.close();
  return true;
}

export function openPrintableConsultationSummary(record: MedicalRecordPrintInput): boolean {
  const rxRows = record.prescriptions.length
    ? `<table>
        <thead>
          <tr>
            <th>Medication</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Duration</th>
            <th>Instructions</th>
          </tr>
        </thead>
        <tbody>
          ${record.prescriptions
            .map(
              (rx) => `<tr>
                <td><strong>${escapeHtml(rx.medication)}</strong></td>
                <td>${escapeHtml(rx.dosage)}</td>
                <td>${escapeHtml(rx.frequency)}</td>
                <td>${escapeHtml(rx.duration)}</td>
                <td>${escapeHtml(rx.instructions || 'As directed')}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>`
    : '<p style="color:#64748b;margin:0;">No prescribed medications recorded for this encounter.</p>';

  const html = `
    <div class="header">
      <div>
        <h1 class="clinic-name">Laguna Medical Center</h1>
        <p class="clinic-sub">Outpatient Department &bull; Electronic Health Record (EHR)</p>
      </div>
      <div class="doc-badge">
        <div><strong>Record No.:</strong> ${escapeHtml(record.recordNumber)}</div>
        <div><strong>Date:</strong> ${escapeHtml(formatReadableDate(record.date))} ${escapeHtml(record.time)}</div>
        <div><strong>Status:</strong> ${escapeHtml(record.status)}</div>
      </div>
    </div>

    <div class="doc-title">Consultation Summary</div>

    <div class="meta-grid">
      <div>
        <span class="meta-label">Patient Name</span>
        <span class="meta-value">${escapeHtml(record.patientName)}</span>
      </div>
      <div>
        <span class="meta-label">Attending Physician</span>
        <span class="meta-value">${escapeHtml(record.doctorName)} (${escapeHtml(record.doctorSpecialty)})</span>
      </div>
      <div>
        <span class="meta-label">Patient ID</span>
        <span class="meta-value">${escapeHtml(record.patientId)}</span>
      </div>
      <div>
        <span class="meta-label">Encounter Type</span>
        <span class="meta-value">${escapeHtml(record.type)}</span>
      </div>
    </div>

    <div class="vitals-grid">
      <div class="vital-box">
        <span class="meta-label">Blood Pressure</span>
        <span class="meta-value">${escapeHtml(record.vitalSigns.bloodPressure || 'N/A')}</span>
      </div>
      <div class="vital-box">
        <span class="meta-label">Heart Rate</span>
        <span class="meta-value">${escapeHtml(record.vitalSigns.heartRate || 'N/A')} bpm</span>
      </div>
      <div class="vital-box">
        <span class="meta-label">Temperature</span>
        <span class="meta-value">${escapeHtml(record.vitalSigns.temperature || 'N/A')} &deg;C</span>
      </div>
      <div class="vital-box">
        <span class="meta-label">Weight</span>
        <span class="meta-value">${escapeHtml(record.vitalSigns.weight || 'N/A')} kg</span>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Subjective / Chief Complaint</h2>
      <p style="margin:0;white-space:pre-line;">${escapeHtml(record.subjective || record.chiefComplaint)}</p>
    </div>

    <div class="section">
      <h2 class="section-title">Objective Findings</h2>
      <p style="margin:0;white-space:pre-line;">${escapeHtml(record.objective || 'N/A')}</p>
    </div>

    <div class="section">
      <h2 class="section-title">Assessment / Diagnosis</h2>
      <p style="margin:0;white-space:pre-line;"><strong>${escapeHtml(record.assessment || record.diagnosis)}</strong></p>
    </div>

    <div class="section">
      <h2 class="section-title">Treatment Plan &amp; Follow-Up</h2>
      <p style="margin:0;white-space:pre-line;">${escapeHtml(record.plan || 'N/A')}</p>
    </div>

    <div class="section">
      <h2 class="section-title">Prescriptions (${record.prescriptions.length})</h2>
      ${rxRows}
    </div>

    ${
      record.notes
        ? `<div class="section">
            <h2 class="section-title">Clinical Notes</h2>
            <p style="margin:0;white-space:pre-line;">${escapeHtml(record.notes)}</p>
          </div>`
        : ''
    }

    <div class="signature-row">
      <div class="signature-box">
        <div class="signature-line">${escapeHtml(record.finalizedByName || record.doctorName)}</div>
        <div style="font-size:11px;color:#475569;">Attending Physician &bull; ${escapeHtml(record.doctorSpecialty)}</div>
      </div>
    </div>

    <div class="footer-note">
      <span>Generated: ${escapeHtml(new Date().toLocaleString('en-PH'))}</span>
      <span>${record.contentHash ? `Integrity SHA-256: ${escapeHtml(record.contentHash.slice(0, 24))}...` : 'Draft / Unfinalized Record'}</span>
    </div>
  `;

  return openPrintDocument(`Consultation Summary - ${record.recordNumber}`, html);
}

export function openPrintableMedicalCertificate(
  record: MedicalRecordPrintInput,
  options: {
    purpose: string;
    diagnosis: string;
    recommendation: string;
    restDays: string;
  }
): boolean {
  const issuedDate = formatReadableDate(new Date().toISOString());
  const visitDate = formatReadableDate(record.date);
  const restClause = options.restDays.trim()
    ? ` The patient is advised to rest for <strong>${escapeHtml(options.restDays.trim())} day(s)</strong> from the date of consultation.`
    : '';
  const licenseLine = record.prescriptions.find((rx) => rx.eSignatureLicense)?.eSignatureLicense;

  const html = `
    <div class="header">
      <div>
        <h1 class="clinic-name">Laguna Medical Center</h1>
        <p class="clinic-sub">Santa Cruz, Laguna &bull; Outpatient Department</p>
      </div>
      <div class="doc-badge">
        <div><strong>Ref No.:</strong> ${escapeHtml(record.recordNumber)}</div>
        <div><strong>Date Issued:</strong> ${escapeHtml(issuedDate)}</div>
      </div>
    </div>

    <div class="doc-title">Medical Certificate</div>

    <p class="cert-body"><strong>${escapeHtml(options.purpose || 'To Whom It May Concern')}:</strong></p>

    <p class="cert-body">
      This is to certify that <strong>${escapeHtml(record.patientName)}</strong>
      (Patient ID: <strong>${escapeHtml(record.patientId)}</strong>) was examined and treated at
      <strong>Laguna Medical Center</strong> on <strong>${escapeHtml(visitDate)}</strong>
      under the care of <strong>${escapeHtml(record.doctorName)}</strong> (${escapeHtml(record.doctorSpecialty)}).
    </p>

    <div class="cert-box">
      <div style="margin-bottom:8px;">
        <span class="meta-label">Clinical Impression / Diagnosis</span>
        <span class="meta-value">${escapeHtml(options.diagnosis || record.diagnosis)}</span>
      </div>
      <div>
        <span class="meta-label">Remarks / Medical Recommendation</span>
        <span style="font-size:13px;color:#1e293b;">
          ${escapeHtml(options.recommendation || record.plan || 'Advised rest and follow-up as needed.')}${restClause}
        </span>
      </div>
    </div>

    <p class="cert-body">
      This medical certificate is issued upon the request of the patient for whatever legal or personal purpose it may serve,
      excluding medico-legal cases unless otherwise specified.
    </p>

    <div class="signature-row">
      <div class="signature-box">
        <div class="signature-line">${escapeHtml(record.finalizedByName || record.doctorName)}</div>
        <div style="font-size:11px;color:#475569;">Attending Physician &bull; ${escapeHtml(record.doctorSpecialty)}</div>
        ${licenseLine ? `<div style="font-size:11px;color:#475569;">PRC License No.: ${escapeHtml(licenseLine)}</div>` : ''}
      </div>
    </div>

    <div class="footer-note">
      <span>Record Ref: ${escapeHtml(record.recordNumber)}</span>
      <span>Issued on ${escapeHtml(issuedDate)}</span>
    </div>
  `;

  return openPrintDocument(`Medical Certificate - ${record.patientName}`, html);
}

