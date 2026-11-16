import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { writeAuditLog } from '@/lib/audit';

const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  const patients = await prisma.patientProfile.findMany({ include: { user: { select: { email: true } }, rfidCards: { where: { status: 'ACTIVE' }, take: 1 } }, orderBy: { createdAt: 'desc' } });
  const headers = ['mrn','recordStatus','firstName','lastName','dateOfBirth','gender','bloodType','phoneNumber','email','address','city','state','zipCode','emergencyContactName','emergencyContactPhone','emergencyContactRelation','allergies','chronicConditions','cardUid'];
  const rows = patients.map((patient) => [patient.mrn, patient.status, patient.firstName, patient.lastName, patient.dateOfBirth.toISOString().slice(0, 10), patient.gender, patient.bloodType, patient.phoneNumber, patient.user.email, patient.address, patient.city, patient.state, patient.zipCode, patient.emergencyContactName, patient.emergencyContactPhone, patient.emergencyContactRelation, patient.allergies || '', patient.chronicConditions || '', patient.rfidCards[0]?.cardUid || ''].map(csv).join(','));
  await writeAuditLog({ actor: auth.user, action: 'PATIENT_EXPORT', targetType: 'PatientProfile', summary: `Exported ${patients.length} patient records to validated CSV.`, request: req });
  return new NextResponse([headers.join(','), ...rows].join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="patients-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'private, no-store' } });
}
