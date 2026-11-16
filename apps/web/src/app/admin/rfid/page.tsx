'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X as XIcon,
  Plus,
  RotateCcw
} from 'lucide-react';

interface RFIDCard {
  id: string;
  uid: string;
  patientId: string;
  patient: string;
  issued: string;
  status: 'ACTIVE' | 'REVOKED' | 'LOST' | 'EXPIRED';
  expiresAt: string | null;
}

interface PatientOption {
  id: string;
  name: string;
  patientNo: string;
}

export default function RFIDRegistry() {
  const [cards, setCards] = useState<RFIDCard[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignment, setAssignment] = useState({ cardUid: '', patientId: '', expiresAt: '', replaceExisting: false });
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<RFIDCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const getErrorMessage = (data: any, fallback: string) =>
    typeof data?.error === 'string' ? data.error : data?.error?.message || fallback;

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const loadRegistry = useCallback(async () => {
    try {
      setLoading(true);
      const [cardsResponse, patientsResponse] = await Promise.all([
        fetch('/api/admin/rfid'),
        fetch('/api/patients'),
      ]);
      const [cardsData, patientsData] = await Promise.all([cardsResponse.json(), patientsResponse.json()]);
      if (!cardsResponse.ok) throw new Error(getErrorMessage(cardsData, 'Failed to load RFID cards.'));
      if (!patientsResponse.ok) throw new Error(getErrorMessage(patientsData, 'Failed to load patients.'));
      setCards(Array.isArray(cardsData.cards) ? cardsData.cards : []);
      setPatients(Array.isArray(patientsData.patients) ? patientsData.patients : []);
    } catch (err) {
      console.error('Error fetching RFID registry:', err);
      showToast(err instanceof Error ? err.message : 'Failed to load RFID registry.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry]);

  const handleAssignCard = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/admin/rfid', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cardUid: assignment.cardUid,
          patientId: assignment.patientId,
          replaceExisting: assignment.replaceExisting,
          ...(assignment.expiresAt ? { expiresAt: new Date(`${assignment.expiresAt}T23:59:59.999Z`).toISOString() } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, 'Failed to assign RFID card.'));

      setAssignModalOpen(false);
      setAssignment({ cardUid: '', patientId: '', expiresAt: '', replaceExisting: false });
      showToast(`Card ${data.card.uid} was assigned successfully.`);
      await loadRegistry();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign RFID card.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateCardStatus = async (card: RFIDCard, status: 'ACTIVE' | 'REVOKED' | 'LOST', reason?: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/rfid', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cardUid: card.uid, status, ...(reason ? { reason } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, 'Failed to update RFID card.'));

      showToast(`Card ${card.uid} is now ${status.toLowerCase()}.`);
      await loadRegistry();
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update RFID card.', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeCard = async () => {
    if (!selectedCard) return;
    const updated = await updateCardStatus(selectedCard, 'REVOKED', 'Revoked by administrator');
    if (updated) {
      setRevokeModalOpen(false);
      setSelectedCard(null);
    }
  };

  const handleMarkLost = async () => {
    if (!selectedCard) return;
    const updated = await updateCardStatus(selectedCard, 'LOST', 'Reported lost by administrator');
    if (updated) {
      setRevokeModalOpen(false);
      setSelectedCard(null);
    }
  };

  const handleReactivateCard = async (card: RFIDCard) => {
    await updateCardStatus(card, 'ACTIVE');
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* ── TOAST NOTIFICATION BANNER ───────────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center space-x-2 px-3.5 py-2 bg-slate-900 border border-slate-700 text-white rounded text-xs shadow-lg animate-fade-in">
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'info' && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          <span className="font-medium">{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">RFID Registry</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Assign, replace, revoke, and reactivate patient cards
          </p>
        </div>

        <Button type="button" size="sm" onClick={() => setAssignModalOpen(true)} className="self-start sm:self-auto">
          <Plus className="mr-1.5 h-4 w-4" />
          Assign Card
        </Button>
      </div>

      {/* ── NAVIGATION TABS ─────────────────────────────────────────── */}
      <div className="flex items-center space-x-1 border-b border-slate-200">
        <div className="px-3.5 py-2 text-sm font-medium border-b-2 -mb-px border-slate-900 text-slate-900 inline-flex items-center space-x-2">
          <CreditCard className="w-4 h-4" />
          <span>Physical RFID Cards</span>
          <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">
            {cards.length}
          </span>
        </div>
      </div>

      {/* ── TAB 1: PHYSICAL RFID CARDS ──────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              {/* Table Headers */}
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                    Card UID
                  </th>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                    Assigned Patient
                  </th>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                    Date Issued
                  </th>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                    Status
                  </th>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* Table Rows */}
              <tbody className="divide-y divide-slate-200 bg-white">
                {cards.map((card) => (
                  <tr key={card.uid} className="hover:bg-slate-50/80 transition-colors">
                    {/* Card UID (Technical Monospace Badge) */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        {card.uid}
                      </span>
                    </td>

                    {/* Assigned Patient */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="font-medium text-slate-900 text-sm">
                        {card.patient}
                      </span>
                    </td>

                    {/* Date Issued */}
                    <td className="py-2.5 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">
                      {card.issued}
                    </td>

                    {/* Status (Subtle solid state indicators) */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {card.status === 'ACTIVE' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                          <span>ACTIVE</span>
                        </span>
                      )}
                      {card.status === 'REVOKED' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                          <span>REVOKED</span>
                        </span>
                      )}
                      {card.status === 'LOST' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 inline-block" />
                          <span>LOST</span>
                        </span>
                      )}
                      {card.status === 'EXPIRED' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block" />
                          <span>EXPIRED</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {card.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCard(card);
                            setRevokeModalOpen(true);
                          }}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded transition-colors"
                          title="Revoke RFID Card"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Revoke Card</span>
                        </button>
                      ) : card.status !== 'EXPIRED' ? (
                        <button
                          type="button"
                          onClick={() => void handleReactivateCard(card)}
                          disabled={loading}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reactivate</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Expired</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      {/* ── TAB 2: HARDWARE STATIONS ─────────────────────────────────── */}
      {/* ── REVOKE CARD MODAL (Administrative Confirmation) ──────────── */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-md bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900">Assign RFID Card</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Register a physical card to a patient. Existing active cards require explicit replacement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAssignCard} className="space-y-4 py-4">
            <label className="block text-sm font-medium text-slate-700">
              Patient
              <select
                required
                value={assignment.patientId}
                onChange={(event) => setAssignment({ ...assignment, patientId: event.target.value })}
                className="mt-1 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Select a patient</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>{patient.patientNo} - {patient.name}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Card UID
              <input
                required
                value={assignment.cardUid}
                onChange={(event) => setAssignment({ ...assignment, cardUid: event.target.value.toUpperCase() })}
                pattern="[A-Fa-f0-9]{8}"
                maxLength={8}
                placeholder="A1B2C3D4"
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 font-mono text-sm uppercase"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Expiration date (optional)
              <input
                type="date"
                value={assignment.expiresAt}
                min={new Date().toISOString().split('T')[0]}
                onChange={(event) => setAssignment({ ...assignment, expiresAt: event.target.value })}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm"
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={assignment.replaceExisting}
                onChange={(event) => setAssignment({ ...assignment, replaceExisting: event.target.checked })}
                className="mt-0.5 h-4 w-4"
              />
              Revoke and replace the patient&apos;s current active card
            </label>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setAssignModalOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Assign Card
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeModalOpen} onOpenChange={setRevokeModalOpen}>
        <DialogContent className="max-w-md bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Revoke Physical RFID Card
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              This action will immediately disable the RFID card and prevent any future check-ins
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-sm space-y-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Card UID:</span>
                <span className="font-mono text-xs font-medium text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  {selectedCard?.uid}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Assigned Patient:</span>
                <span className="font-medium text-slate-900">{selectedCard?.patient}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Issue Date:</span>
                <span className="text-slate-700 font-mono text-xs">{selectedCard?.issued}</span>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
              <span className="font-medium block">Standard Administrative Reasons:</span>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                <li>Card lost, damaged, or unreturned upon discharge</li>
                <li>Patient reported physical card missing</li>
                <li>Suspicious workstation tap or replacement issuance</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              onClick={() => {
                setRevokeModalOpen(false);
                setSelectedCard(null);
              }}
              className="h-8 text-sm"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkLost}
              className="h-8 border-amber-300 text-amber-800 hover:bg-amber-50"
              disabled={loading}
            >
              Mark Lost
            </Button>
            <Button 
              type="button"
              size="sm"
              onClick={handleRevokeCard}
              className="h-8 text-sm bg-red-700 hover:bg-red-800 text-white font-medium inline-flex items-center space-x-1.5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Revoking Card...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  <span>Confirm Revocation</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
