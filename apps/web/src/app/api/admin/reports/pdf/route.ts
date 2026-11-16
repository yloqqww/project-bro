import { NextRequest, NextResponse } from 'next/server';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { buildOperationalReport } from '@/lib/operational-report';
import { createTextPdf } from '@/lib/simple-pdf';
import { writeAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  const report = await buildOperationalReport(new URL(req.url).searchParams);
  const lines = [
    `Period: ${report.range.from} to ${report.range.to}`,
    `Timezone: ${report.timezone}`,
    '',
    ...Object.entries(report.summary).map(([key, value]) => `${key}: ${value}`),
    '',
    'Appointment statuses:',
    ...Object.entries(report.appointmentStatuses).map(([key, value]) => `${key}: ${value}`),
    '',
    'Daily activity:',
    ...report.daily.map((day) => `${day.date}: ${day.appointments} appointments, ${day.queueTickets} queue tickets, ${day.encounters} encounters`),
  ];
  const pdf = createTextPdf(`${report.clinicName} - Operations Report`, lines);
  await writeAuditLog({ actor: auth.user, action: 'REPORT_EXPORT', targetType: 'OperationalReport', targetId: `${report.range.from}:${report.range.to}`, summary: `Operational PDF report exported for ${report.range.from} to ${report.range.to}.`, request: req });
  return new NextResponse(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="clinic-report-${report.range.from}-${report.range.to}.pdf"`, 'Cache-Control': 'private, no-store' } });
}
