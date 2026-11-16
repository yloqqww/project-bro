import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { writeAuditLog } from '@/lib/audit';
import { findDuplicateCandidates, nextPatientMrn, normalizePatientIdentity } from '@/lib/patient-master-index';

const rowSchema = z.object({
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), gender: z.enum(['MALE','FEMALE','OTHER']),
  bloodType: z.enum(['A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE','UNKNOWN']).default('UNKNOWN'),
  phoneNumber: z.string().trim().min(7).max(30), email: z.string().trim().email().optional().or(z.literal('')),
  address: z.string().trim().min(2).max(200), city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80), zipCode: z.string().trim().min(2).max(20),
  emergencyContactName: z.string().trim().min(2).max(120), emergencyContactPhone: z.string().trim().min(7).max(30), emergencyContactRelation: z.string().trim().min(2).max(80),
  allergies: z.string().max(1000).optional().default(''), chronicConditions: z.string().max(1000).optional().default(''), cardUid: z.string().trim().regex(/^[A-F0-9]{8,32}$/).optional().or(z.literal('')),
});

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  const body = await req.json();
  if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 500) return NextResponse.json({ success: false, error: 'Import must contain 1 to 500 rows.' }, { status: 400 });
  const parsedRows: z.infer<typeof rowSchema>[] = [];
  const rowErrors: Array<{ row: number; errors: Record<string, string[] | undefined> }> = [];
  body.rows.forEach((row: unknown, index: number) => { const result = rowSchema.safeParse(row); if (result.success) parsedRows.push(result.data); else rowErrors.push({ row: index + 2, errors: result.error.flatten().fieldErrors }); });
  if (rowErrors.length) return NextResponse.json({ success: false, error: 'CSV validation failed. No records were imported.', rowErrors }, { status: 400 });
  const normalizedPhones = parsedRows.map((row) => row.phoneNumber.replace(/\D/g, ''));
  const emails = parsedRows.map((row) => row.email?.toLowerCase()).filter(Boolean) as string[];
  const cards = parsedRows.map((row) => row.cardUid).filter(Boolean) as string[];
  if (new Set(normalizedPhones).size !== normalizedPhones.length || new Set(emails).size !== emails.length || new Set(cards).size !== cards.length) return NextResponse.json({ success: false, error: 'Duplicate phone, email, or RFID values exist inside the CSV.' }, { status: 409 });
  const [existingPatients, existingUsers, existingCards] = await Promise.all([prisma.patientProfile.findMany({ where: { status: 'ACTIVE' }, select: { phoneNumber: true } }), prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } }), prisma.rfidCard.findMany({ where: { cardUid: { in: cards } }, select: { cardUid: true } })]);
  const existingPhones = new Set(existingPatients.map((item) => item.phoneNumber.replace(/\D/g, '')));
  if (normalizedPhones.some((phone) => existingPhones.has(phone)) || existingUsers.length || existingCards.length) return NextResponse.json({ success: false, error: 'One or more phone, email, or RFID values already exist. No records were imported.' }, { status: 409 });
  for (const row of parsedRows) {
    const candidates = await findDuplicateCandidates(prisma, { ...row, dateOfBirth: row.dateOfBirth });
    if (candidates.some((candidate) => candidate.matchLevel === 'HIGH')) return NextResponse.json({ success: false, error: `Possible duplicate detected for ${row.firstName} ${row.lastName}. No records were imported.`, candidates }, { status: 409 });
  }
  await prisma.$transaction(async (tx) => {
    for (const row of parsedRows) {
      const password = await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12);
      const email = row.email || `patient.${crypto.randomUUID()}@clinic.local`;
      const user = await tx.user.create({ data: { email: email.toLowerCase(), password, role: 'PATIENT' } });
      const patient = await tx.patientProfile.create({ data: { mrn: await nextPatientMrn(tx), userId: user.id, firstName: row.firstName, lastName: row.lastName, dateOfBirth: new Date(`${row.dateOfBirth}T00:00:00Z`), gender: row.gender, bloodType: row.bloodType, phoneNumber: row.phoneNumber, address: row.address, city: row.city, state: row.state, zipCode: row.zipCode, ...normalizePatientIdentity({ ...row, dateOfBirth: row.dateOfBirth }), emergencyContactName: row.emergencyContactName, emergencyContactPhone: row.emergencyContactPhone, emergencyContactRelation: row.emergencyContactRelation, allergies: row.allergies || null, chronicConditions: row.chronicConditions || null } });
      if (row.cardUid) await tx.rfidCard.create({ data: { cardUid: row.cardUid, patientId: patient.id } });
    }
  });
  await writeAuditLog({ actor: auth.user, action: 'PATIENT_IMPORT', targetType: 'PatientProfile', summary: `Imported ${parsedRows.length} validated patient records.`, request: req, metadata: { count: parsedRows.length } });
  return NextResponse.json({ success: true, imported: parsedRows.length });
}
