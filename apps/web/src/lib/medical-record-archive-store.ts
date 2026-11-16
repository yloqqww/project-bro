export type ArchivedRecordEntry = {
  id: string;
  patientId?: string;
  patientName?: string;
  archivedAt: string;
  archiveReason: string;
  recordSnapshot?: any;
};

const STORAGE_KEY = 'lmc_archived_medical_records_v1';

export function getArchivedRecordsMap(): Record<string, ArchivedRecordEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveArchivedRecordEntry(entry: ArchivedRecordEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getArchivedRecordsMap();
    current[entry.id] = entry;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage quota errors
  }
}

export function removeArchivedRecordEntry(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getArchivedRecordsMap();
    delete current[id];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage errors
  }
}

export function clearAllArchivedRecordEntries(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

