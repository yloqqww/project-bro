import 'server-only';

import { prisma } from '@clinic/db';

export type PatientIdentityInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: Date | string;
  phoneNumber: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
};

function normalizeText(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizePatientIdentity(input: PatientIdentityInput) {
  return {
    normalizedFirstName: normalizeText(input.firstName.trim()),
    normalizedLastName: normalizeText(input.lastName.trim()),
    normalizedPhone: input.phoneNumber.replace(/\D/g, ''),
    normalizedAddress: normalizeText([input.address, input.city, input.state, input.zipCode].filter(Boolean).join(' ')),
  };
}

export async function nextPatientMrn(database: any = prisma, now = new Date()) {
  const rows = await database.$queryRaw<Array<{ sequenceValue: bigint }>>`SELECT nextval('patient_mrn_seq') AS "sequenceValue"`;
  const sequence = Number(rows[0].sequenceValue);
  return `LMC-${now.getUTCFullYear()}-${String(sequence).padStart(7, '0')}`;
}

export type DuplicateCandidate = {
  id: string;
  mrn: string;
  name: string;
  dateOfBirth: string;
  phoneNumber: string;
  address: string;
  score: number;
  matchLevel: 'HIGH' | 'REVIEW';
  matchedOn: string[];
};

export function comparePatientIdentity(left: any, right: any): Pick<DuplicateCandidate, 'score' | 'matchLevel' | 'matchedOn'> {
  const matchedOn: string[] = [];
  let score = 0;
  if (left.normalizedFirstName === right.normalizedFirstName && left.normalizedLastName === right.normalizedLastName) { score += 30; matchedOn.push('name'); }
  const leftBirthDate = left.dateOfBirth instanceof Date ? left.dateOfBirth.toISOString().slice(0, 10) : String(left.dateOfBirth).slice(0, 10);
  const rightBirthDate = right.dateOfBirth instanceof Date ? right.dateOfBirth.toISOString().slice(0, 10) : String(right.dateOfBirth).slice(0, 10);
  if (leftBirthDate === rightBirthDate) { score += 30; matchedOn.push('birthDate'); }
  if (left.normalizedPhone?.length >= 7 && left.normalizedPhone === right.normalizedPhone) { score += 30; matchedOn.push('phone'); }
  if (left.normalizedAddress?.length >= 5 && left.normalizedAddress === right.normalizedAddress) { score += 10; matchedOn.push('address'); }
  return { score, matchLevel: score >= 80 ? 'HIGH' : 'REVIEW', matchedOn };
}

export async function findDuplicateCandidates(database: any, input: PatientIdentityInput, excludePatientId?: string): Promise<DuplicateCandidate[]> {
  const normalized = normalizePatientIdentity(input);
  const birthDate = input.dateOfBirth instanceof Date ? input.dateOfBirth : new Date(`${input.dateOfBirth}T00:00:00.000Z`);
  const candidates = await database.patientProfile.findMany({
    where: {
      status: 'ACTIVE',
      id: excludePatientId ? { not: excludePatientId } : undefined,
      OR: [
        { normalizedPhone: normalized.normalizedPhone },
        { normalizedFirstName: normalized.normalizedFirstName, normalizedLastName: normalized.normalizedLastName },
        { dateOfBirth: birthDate, normalizedLastName: normalized.normalizedLastName },
      ],
    },
    select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true, phoneNumber: true, address: true, city: true, state: true, zipCode: true, normalizedFirstName: true, normalizedLastName: true, normalizedPhone: true, normalizedAddress: true },
    take: 25,
  });

  return candidates.map((candidate: any) => {
    const comparison = comparePatientIdentity(candidate, { ...normalized, dateOfBirth: birthDate });
    return { id: candidate.id, mrn: candidate.mrn, name: `${candidate.firstName} ${candidate.lastName}`, dateOfBirth: candidate.dateOfBirth.toISOString().slice(0, 10), phoneNumber: candidate.phoneNumber, address: [candidate.address, candidate.city, candidate.state, candidate.zipCode].filter(Boolean).join(', '), ...comparison };
  }).filter((candidate: DuplicateCandidate) => candidate.score >= 50).sort((a: DuplicateCandidate, b: DuplicateCandidate) => b.score - a.score);
}

const DEMOGRAPHIC_FIELDS = ['firstName', 'lastName', 'middleName', 'dateOfBirth', 'gender', 'phoneNumber', 'address', 'city', 'state', 'zipCode', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation'] as const;

function demographicSnapshot(value: any) {
  return Object.fromEntries(DEMOGRAPHIC_FIELDS.map((field) => [field, value[field] instanceof Date ? value[field].toISOString() : value[field] ?? null]));
}

export async function recordDemographicChange(database: any, input: { patientId: string; changedById?: string | null; source: string; reason?: string | null; before: any; after: any }) {
  const before = demographicSnapshot(input.before);
  const after = demographicSnapshot(input.after);
  const changedFields = DEMOGRAPHIC_FIELDS.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
  if (!changedFields.length) return null;
  return database.patientDemographicChange.create({ data: { patientId: input.patientId, changedById: input.changedById || null, source: input.source, reason: input.reason || null, changedFields: [...changedFields], before, after } });
}
