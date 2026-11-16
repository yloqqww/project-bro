'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Search,
  Plus,
  UserCheck,
  UserX,
  Key,
  CheckCircle2,
  Loader2,
  X as XIcon,
  AlertTriangle,
  Users,
  Eye,
  EyeOff,
  Mail,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Pencil
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/client-response';

interface Staff {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE';
  specialty?: string;
  prcLicense?: string;
  room?: string;
  contact: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export default function StaffManagement() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [toggleStatusModalOpen, setToggleStatusModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [deleteStaffModalOpen, setDeleteStaffModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    id: '',
    name: '',
    contact: '',
    role: 'RECEPTIONIST' as 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE',
    specialty: '',
    prcLicense: '',
    room: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    password: '',
  });
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Password visibility & Receipt state
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<{
    name: string;
    email: string;
    role: string;
    password: string;
    room?: string;
    emailNotice?: any;
  } | null>(null);
  
  const [deletedReceipt, setDeletedReceipt] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contact: '',
    role: 'RECEPTIONIST' as 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE',
    specialty: '',
    prcLicense: '',
    room: '',
    password: ''
  });

  const [newPassword, setNewPassword] = useState('');

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load real staff from database
  const loadStaff = async () => {
    try {
      setFetching(true);
      const res = await fetch('/api/admin/staff');
      const data = await res.json();
      if (data.success && Array.isArray(data.staff)) {
        setStaff(data.staff);
      } else {
        showToast(data.error || 'Failed to fetch staff records.', 'error');
      }
    } catch (err) {
      console.error('Error loading staff:', err);
      showToast('Error connecting to staff database.', 'error');
    } finally {
      setFetching(false);
    }
  };

  // Fetch on mount
  // loadStaff is intentionally invoked once for the initial table snapshot.
  useEffect(() => {
    loadStaff();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Initials generator
  const getInitials = (name: string) => {
    const cleanName = name.replace(/^Dr\.\s+/i, '');
    return cleanName
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatRoleLabel = (role?: string) => {
    if (role === 'RECEPTIONIST') return 'OPD';
    if (role === 'NURSE') return 'TRIAGE';
    return role || '';
  };

  const generateRandomPassword = () => {
    const specials = '!@#$%';
    const randomSpecial = specials.charAt(Math.floor(Math.random() * specials.length));
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const pwd = `Clinic${randomNum}${randomSpecial}`;
    setFormData(prev => ({ ...prev, password: pwd }));
    setShowPassword(true);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const cleanPassword = formData.password.trim();
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, password: cleanPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(getApiErrorMessage(data.error, 'Failed to create staff member.'), 'error');
        setLoading(false);
        return;
      }

      const createdStaff = data.staff;
      const submittedPassword = cleanPassword;

      showToast(`Account created! Welcome email dispatched to ${createdStaff.email}.`);
      setAddModalOpen(false);
      
      setCreatedReceipt({
        name: createdStaff.name,
        email: createdStaff.email,
        role: createdStaff.role,
        room: createdStaff.room,
        password: submittedPassword,
        emailNotice: data.emailNotice,
      });

      setFormData({
        name: '',
        email: '',
        contact: '',
        role: 'RECEPTIONIST',
        specialty: '',
        prcLicense: '',
        room: '',
        password: ''
      });
      setShowPassword(false);
      loadStaff();
    } catch (err) {
      console.error('Error adding staff:', err);
      showToast('Error creating staff account in database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setLoading(true);

    try {
      const payload: any = {
        name: editFormData.name.trim(),
        contact: editFormData.contact.trim(),
        role: editFormData.role,
        status: editFormData.status,
        specialty: editFormData.specialty.trim(),
        room: editFormData.room.trim(),
        prcLicense: editFormData.prcLicense.trim(),
      };

      if (editFormData.password && editFormData.password.trim()) {
        payload.password = editFormData.password.trim();
      }

      const res = await fetch(`/api/admin/staff/${editingStaff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(getApiErrorMessage(data.error, 'Failed to update staff details.'), 'error');
        setLoading(false);
        return;
      }

      showToast(`Matagumpay na na-update ang account ni ${editFormData.name}!`);
      setEditModalOpen(false);
      setEditingStaff(null);
      loadStaff();
    } catch (err) {
      console.error('Error updating staff:', err);
      showToast('Error updating staff details in database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedStaff) return;
    setLoading(true);
    
    try {
      const targetStatus = selectedStaff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await fetch(`/api/admin/staff/${selectedStaff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(getApiErrorMessage(data.error, 'Failed to update status.'), 'error');
        setLoading(false);
        return;
      }

      const statusText = targetStatus === 'ACTIVE' ? 'na-activate' : 'na-deactivate';
      showToast(`Account ni ${selectedStaff.name} ay ${statusText}.`);
      setToggleStatusModalOpen(false);
      setSelectedStaff(null);
      loadStaff();
    } catch (err) {
      console.error('Error toggling status:', err);
      showToast('Error updating staff status.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setLoading(true);
    
    try {
      const res = await fetch(`/api/admin/staff/${selectedStaff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(getApiErrorMessage(data.error, 'Failed to reset password.'), 'error');
        setLoading(false);
        return;
      }

      showToast(`Bagong password ay matagumpay na na-set para kay ${selectedStaff.email}.`);
      setResetPasswordModalOpen(false);
      setSelectedStaff(null);
      setNewPassword('');
    } catch (err) {
      console.error('Error resetting password:', err);
      showToast('Error updating password in database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;
    setLoading(true);

    const deletedInfo = {
      name: staffToDelete.name,
      email: staffToDelete.email,
      role: staffToDelete.role,
    };

    try {
      const res = await fetch(`/api/admin/staff/${staffToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errMsg = getApiErrorMessage(data.error, 'Hindi nabura ang kawani sa database.');
        // If already deleted from database (e.g., 404), still display receipt and refresh
        if (res.status === 404 || errMsg.includes('not found')) {
          setDeleteStaffModalOpen(false);
          setStaffToDelete(null);
          setDeletedReceipt(deletedInfo);
          showToast(`Wala na sa database ang rekord ni ${deletedInfo.name}.`, 'info');
          loadStaff();
          return;
        }

        showToast(errMsg, 'error');
        setLoading(false);
        return;
      }

      setDeleteStaffModalOpen(false);
      setStaffToDelete(null);
      setDeletedReceipt(deletedInfo);
      showToast(`Matagumpay na nabura sa database ang account ni ${deletedInfo.name}.`);
      loadStaff();
    } catch (err) {
      console.error('Error deleting staff:', err);
      showToast('Error habang binubura ang kawani sa database.', 'error');
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Staff Management</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Manage clinic personnel and doctor profiles
          </p>
        </div>

        {/* Action Button: Solid Enterprise Style (Zero Gradients) */}
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded shadow-2xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Staff</span>
        </button>
      </div>

      {/* ── FILTERS & SEARCH TOOLBAR ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div className="w-36">
            <Select 
              value={roleFilter} 
              onValueChange={(value) => setRoleFilter(value)}
            >
              <SelectTrigger className="h-8 text-sm bg-white border-slate-300 rounded">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="DOCTOR">Doctor</SelectItem>
                <SelectItem value="RECEPTIONIST">OPD</SelectItem>
                <SelectItem value="NURSE">Triage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {(searchQuery || roleFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('ALL');
              }}
              className="text-[13px] text-slate-600 hover:text-slate-900 underline font-medium px-1 self-center"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Counter */}
        <div className="text-[13px] text-slate-500 font-mono self-end sm:self-center whitespace-nowrap">
          Showing {filteredStaff.length} of {staff.length} staff members
        </div>
      </div>

      {/* ── STAFF TABLE (Primary Focus) ──────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            {/* Headers */}
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Staff Details
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Role
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Specialty / Room
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Contact
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Status
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs text-right">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Rows */}
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredStaff.map((member) => {
                const initials = getInitials(member.name);

                return (
                  <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Staff Details (Restrained Avatar, Strong Name, Subdued Email) */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{member.name}</p>
                          <p className="text-[13px] text-slate-500 font-normal">{member.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role (Subtle solid badges, zero gradients) */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {member.role === 'ADMIN' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          ADMIN
                        </span>
                      )}
                      {member.role === 'DOCTOR' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          DOCTOR
                        </span>
                      )}
                      {member.role === 'RECEPTIONIST' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          OPD
                        </span>
                      )}
                      {member.role === 'NURSE' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                          TRIAGE
                        </span>
                      )}
                    </td>

                    {/* Specialty / Room / PRC License */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {member.specialty || member.room ? (
                        <div>
                          {member.specialty && (
                            <p className="font-medium text-slate-900 text-sm">{member.specialty}</p>
                          )}
                          {member.room && (
                            <p className="text-[13px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 inline-block" />
                              <span>{member.room}</span>
                            </p>
                          )}
                          {member.prcLicense && (
                            <p className="text-xs text-slate-400 font-mono mt-0.5">PRC: {member.prcLicense}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-sm">—</span>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="py-2.5 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">
                      {member.contact}
                    </td>

                    {/* Status (Muted enterprise indicator) */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {member.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                          <span>ACTIVE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                          <span>INACTIVE</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center space-x-1.5">
                        {/* Edit Staff Details & Assignment */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStaff(member);
                            setEditFormData({
                              id: member.id,
                              name: member.name,
                              contact: member.contact || '',
                              role: member.role,
                              specialty: member.specialty || '',
                              prcLicense: member.prcLicense || '',
                              room: member.room || '',
                              status: member.status,
                              password: '',
                            });
                            setShowEditPassword(false);
                            setEditModalOpen(true);
                          }}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 hover:text-slate-900 border border-slate-300 rounded shadow-2xs transition-colors cursor-pointer"
                          title="I-edit ang account (Pangalan, Role, Silid, Specialty, Password, Contact)"
                        >
                          <Pencil className="w-3 h-3 mr-1 text-slate-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStaff(member);
                            setToggleStatusModalOpen(true);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                          title={member.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                        >
                          {member.status === 'ACTIVE' ? (
                            <UserX className="w-3.5 h-3.5 text-slate-500 hover:text-amber-700" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-slate-500 hover:text-emerald-700" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStaff(member);
                            setResetPasswordModalOpen(true);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                          title="Reset Account Password"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        {member.email !== 'admin@clinic.local' && (
                          <button
                            type="button"
                            onClick={() => {
                              setStaffToDelete(member);
                              setDeleteStaffModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-red-700 rounded hover:bg-red-50 transition-colors"
                            title="Permanenteng Burahin sa Database"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredStaff.length === 0 && (
          <div className="text-center py-10 text-sm">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-slate-700 text-sm">No staff members found</p>
            <p className="text-slate-500 mt-0.5 text-[13px]">Try adjusting your search query or role filter</p>
          </div>
        )}
      </div>

      {/* ── ADD STAFF MODAL (Enterprise Entry Form) ───────────────────── */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900">Add New Staff Member</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Enter staff details and operational credentials
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddStaff} className="space-y-3.5 py-2 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-medium text-slate-700 block mb-1">Full Name *</label>
                <Input 
                  placeholder="e.g. Dr. Jane Reynolds" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  className="h-8 text-sm border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-700 block mb-1">Email Address *</label>
                <Input 
                  type="email" 
                  placeholder="user@clinic.local" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  className="h-8 text-sm border-slate-300 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-medium text-slate-700 block mb-1">Contact Number *</label>
                <Input 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={11}
                  placeholder="09170000000" 
                  value={formData.contact}
                  onChange={(e) => setFormData({...formData, contact: e.target.value.replace(/\D/g, '').slice(0, 11)})}
                  required
                  className="h-8 text-sm border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-700 block mb-1">Role *</label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value) => setFormData({...formData, role: value as any})}
                >
                  <SelectTrigger className="h-8 text-sm border-slate-300 rounded">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEPTIONIST">OPD</SelectItem>
                    <SelectItem value="DOCTOR">Doctor</SelectItem>
                    <SelectItem value="NURSE">Triage</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conditional Fields by Role */}
            {formData.role === 'DOCTOR' && (
              <div className="p-3.5 bg-slate-50 rounded border border-slate-200 space-y-3">
                <p className="text-xs font-medium text-slate-700 uppercase tracking-wider">
                  Attending Physician Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Specialization *</label>
                    <Input 
                      placeholder="e.g. Cardiology, Pediatrics, General Medicine" 
                      value={formData.specialty}
                      onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                      required={formData.role === 'DOCTOR'}
                      className="h-8 text-sm border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">PRC License Number *</label>
                    <Input 
                      placeholder="0000000" 
                      value={formData.prcLicense}
                      onChange={(e) => setFormData({...formData, prcLicense: e.target.value})}
                      required={formData.role === 'DOCTOR'}
                      className="h-8 text-sm border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-600">Assigned Room *</label>
                    <span className="text-[11px] text-slate-400">Puwede i-type o pumili sa presets</span>
                  </div>
                  <Input 
                    placeholder="Hal. Room 101, Consultation Room 3, Cardio Suite" 
                    value={formData.room}
                    onChange={(e) => setFormData({...formData, room: e.target.value})}
                    required={formData.role === 'DOCTOR'}
                    list="clinic-rooms-list"
                    className="h-8 text-sm border-slate-300 rounded bg-white font-medium text-slate-900"
                  />
                  <datalist id="clinic-rooms-list">
                    <option value="Room 101" />
                    <option value="Room 102" />
                    <option value="Room 201" />
                    <option value="Room 202" />
                    <option value="Consultation Room 1" />
                    <option value="Consultation Room 2" />
                    <option value="Pediatrics Clinic" />
                    <option value="Cardiology Suite" />
                    <option value="Triage / ER-1" />
                  </datalist>

                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-400">Presets:</span>
                    {['Room 101', 'Room 102', 'Room 201', 'Room 202', 'Consultation Room 1'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormData({...formData, room: r})}
                        className={`px-2 py-0.5 rounded border text-[11px] font-mono transition-colors ${
                          formData.room === r 
                            ? 'bg-slate-900 text-white border-slate-900' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {formData.role === 'NURSE' && (
              <div className="p-3.5 bg-purple-50/50 rounded border border-purple-200 space-y-3">
                <p className="text-xs font-semibold text-purple-900 uppercase tracking-wider">
                  Triage Assignment & Station Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">Specialty / Triage Area *</label>
                    <Input 
                      placeholder="Hal. Triage & Vitals, Pediatrics Triage, ER / Trauma" 
                      value={formData.specialty}
                      onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                      required={formData.role === 'NURSE'}
                      className="h-8 text-sm border-slate-300 rounded bg-white"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {['Triage & Vitals', 'Vital Signs Screening', 'ER / Trauma Triage', 'Pediatrics Triage', 'General Triage'].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({...formData, specialty: s})}
                          className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${
                            formData.specialty === s
                              ? 'bg-purple-800 text-white border-purple-800'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">PRC License Number (Opsyonal)</label>
                    <Input 
                      placeholder="Hal. 0123456 (Opsyonal)" 
                      value={formData.prcLicense}
                      onChange={(e) => setFormData({...formData, prcLicense: e.target.value})}
                      className="h-8 text-sm border-slate-300 rounded bg-white font-mono"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">PRC Registration number kung mayroon</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700">Assigned Triage Station / Room *</label>
                    <span className="text-[11px] text-slate-400">Puwede i-type o pumili sa presets</span>
                  </div>
                  <Input 
                    placeholder="Hal. Triage Station 1, Vital Signs Booth, Station A, ER Bay" 
                    value={formData.room}
                    onChange={(e) => setFormData({...formData, room: e.target.value})}
                    required={formData.role === 'NURSE'}
                    className="h-8 text-sm border-slate-300 rounded bg-white font-medium text-slate-900"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-400">Presets:</span>
                    {['Triage Station 1', 'Triage Station 2', 'Station A', 'Station B', 'Vital Signs Booth', 'ER Bay'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormData({...formData, room: r})}
                        className={`px-2 py-0.5 rounded border text-[11px] font-mono transition-colors ${
                          formData.room === r 
                            ? 'bg-purple-800 text-white border-purple-800' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {formData.role === 'RECEPTIONIST' && (
              <div className="p-3.5 bg-emerald-50/50 rounded border border-emerald-200 space-y-3">
                <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                  OPD Assignment & Counter Details
                </p>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">OPD Department / Responsibility *</label>
                  <Input 
                    placeholder="Hal. OPD Counter, OPD Queue Counter, Records & Registration" 
                    value={formData.specialty}
                    onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                    required={formData.role === 'RECEPTIONIST'}
                    className="h-8 text-sm border-slate-300 rounded bg-white"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['OPD Counter', 'OPD Queue Counter', 'OPD Records & Registration', 'Admissions & Inquiries'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData({...formData, specialty: s})}
                        className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${
                          formData.specialty === s
                            ? 'bg-emerald-800 text-white border-emerald-800'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700">Assigned OPD Counter / Desk *</label>
                    <span className="text-[11px] text-slate-400">Puwede i-type o pumili sa presets</span>
                  </div>
                  <Input 
                    placeholder="Hal. OPD Counter 1, OPD Counter 2, Counter 1" 
                    value={formData.room}
                    onChange={(e) => setFormData({...formData, room: e.target.value})}
                    required={formData.role === 'RECEPTIONIST'}
                    className="h-8 text-sm border-slate-300 rounded bg-white font-medium text-slate-900"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-400">Presets:</span>
                    {['OPD Counter 1', 'OPD Counter 2', 'Counter 1', 'Counter 2', 'Counter 3'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormData({...formData, room: r})}
                        className={`px-2 py-0.5 rounded border text-[11px] font-mono transition-colors ${
                          formData.room === r 
                            ? 'bg-emerald-800 text-white border-emerald-800' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {formData.role === 'ADMIN' && (
              <div className="p-3.5 bg-slate-50 rounded border border-slate-200 space-y-3">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Administrative Unit & Office (Opsyonal)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Department / Operations</label>
                    <Input 
                      placeholder="Hal. Hospital Operations, IT & Systems" 
                      value={formData.specialty}
                      onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                      className="h-8 text-sm border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Assigned Office / Room</label>
                    <Input 
                      placeholder="Hal. Admin Office 1, IT Room" 
                      value={formData.room}
                      onChange={(e) => setFormData({...formData, room: e.target.value})}
                      className="h-8 text-sm border-slate-300 rounded bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[13px] font-medium text-slate-700">Temporary Password *</label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 transition-colors inline-flex items-center space-x-1"
                    title="Mag-generate ng random secure password"
                  >
                    <RefreshCw className="w-2.5 h-2.5 mr-1" />
                    <span>Auto-Generate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center space-x-1"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                        <span>Itago</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Ipakita</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="relative">
                <Input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="Minimum 12 characters o i-click ang Mag-generate" 
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className="h-8 text-sm border-slate-300 rounded pr-9 font-mono font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Ang password na nakasulat dito ang eksaktong ise-save sa database at matatanggap sa email ng kawani.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setAddModalOpen(false)}
                className="h-8 text-sm"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="sm"
                className="h-8 text-sm bg-slate-900 hover:bg-slate-800 text-white font-medium"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  'Create Staff Account'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── EDIT STAFF MODAL ───────────────────────────────────────── */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white border border-slate-300 rounded-lg p-6 shadow-xl">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-slate-700" />
              <span>Edit Account & Workstation</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Baguhin ang impormasyon ng account: pangalan, tungkulin (role), silid o counter, specialty, status, at password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateStaff} className="space-y-4 py-2 text-sm">
            {/* Account Email & Status Switcher Header */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px] uppercase font-semibold">Account Email (Login ID)</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{editingStaff?.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">Status:</span>
                <div className="inline-flex rounded-md border border-slate-300 p-0.5 bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, status: 'ACTIVE' })}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                      editFormData.status === 'ACTIVE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ACTIVE
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, status: 'INACTIVE' })}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                      editFormData.status === 'INACTIVE'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    INACTIVE
                  </button>
                </div>
              </div>
            </div>

            {/* Role Switcher */}
            <div>
              <label className="text-[13px] font-medium text-slate-700 block mb-1.5">
                Staff Role / Posisyon *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: 'RECEPTIONIST', label: 'OPD' },
                  { value: 'NURSE', label: 'Triage' },
                  { value: 'DOCTOR', label: 'Doctor' },
                  { value: 'ADMIN', label: 'Admin' },
                ].map((r) => {
                  const isSelected = editFormData.role === r.value;
                  const isDisabled = editingStaff?.email === 'admin@clinic.local' && r.value !== 'ADMIN';
                  return (
                    <button
                      key={r.value}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setEditFormData({ ...editFormData, role: r.value as any })}
                      className={`py-2 px-3 rounded border text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name & Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-medium text-slate-700 block mb-1">Full Name *</label>
                <Input 
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  required
                  placeholder="Hal. Dr. Roberto Santos / Maria Ramos"
                  className="h-9 text-sm border-slate-300 rounded bg-white"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-700 block mb-1">Contact Number</label>
                <Input 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={11}
                  value={editFormData.contact}
                  onChange={(e) => setEditFormData({...editFormData, contact: e.target.value.replace(/\D/g, '').slice(0, 11)})}
                  placeholder="09171234567"
                  className="h-9 text-sm border-slate-300 rounded font-mono bg-white"
                />
              </div>
            </div>

            {/* Specialty / Department */}
            <div>
              <label className="text-[13px] font-medium text-slate-700 block mb-1">
                {editFormData.role === 'DOCTOR' ? 'Medical Specialization *' :
                 editFormData.role === 'NURSE' ? 'Triage Specialty / Area *' :
                 editFormData.role === 'RECEPTIONIST' ? 'OPD Specialty / Department *' : 'Department'}
              </label>
              <Input 
                value={editFormData.specialty}
                onChange={(e) => setEditFormData({...editFormData, specialty: e.target.value})}
                placeholder="Hal. Triage / Vitals, OPD Counter, Pediatrics, General Medicine"
                className="h-9 text-sm border-slate-300 rounded bg-white"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5 text-xs">
                {(editFormData.role === 'NURSE'
                  ? ['Triage & Vitals', 'Vital Signs Screening', 'ER / Trauma Triage', 'Pediatrics Triage', 'General Triage']
                  : editFormData.role === 'RECEPTIONIST'
                  ? ['OPD Counter', 'OPD Queue Counter', 'OPD Records & Registration', 'Admissions & Inquiries']
                  : editFormData.role === 'DOCTOR'
                  ? ['General Medicine', 'Pediatrics', 'Cardiology', 'Internal Medicine', 'OB-GYN']
                  : ['Clinic Administration', 'Operations & Records']
                ).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditFormData({...editFormData, specialty: s})}
                    className={`px-2 py-0.5 rounded border text-[11px] transition-colors cursor-pointer ${
                      editFormData.specialty === s
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Assigned Room / Station */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[13px] font-medium text-slate-700">
                  {editFormData.role === 'DOCTOR' ? 'Assigned Consultation Room *' :
                   editFormData.role === 'NURSE' ? 'Assigned Triage Station / Room *' :
                   editFormData.role === 'RECEPTIONIST' ? 'Assigned OPD Counter / Desk *' : 'Assigned Office / Room'}
                </label>
                <span className="text-[11px] text-slate-400">Puwede i-type o pumili sa presets</span>
              </div>
              <Input 
                value={editFormData.room}
                onChange={(e) => setEditFormData({...editFormData, room: e.target.value})}
                placeholder="Hal. Room 101, Triage Station 1, OPD Counter 1, Station A"
                className="h-9 text-sm border-slate-300 rounded bg-white font-medium text-slate-900"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-slate-500">
                <span className="font-medium text-slate-400">Presets:</span>
                {(editFormData.role === 'NURSE'
                  ? ['Triage Station 1', 'Triage Station 2', 'Station A', 'Station B', 'Vital Signs Booth', 'ER Bay']
                  : editFormData.role === 'RECEPTIONIST'
                  ? ['OPD Counter 1', 'OPD Counter 2', 'Counter 1', 'Counter 2', 'Counter 3']
                  : editFormData.role === 'DOCTOR'
                  ? ['Room 101', 'Room 102', 'Room 201', 'Room 202', 'Consultation Room 1']
                  : ['Admin Office', 'Main Server Room', 'Operations Desk']
                ).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setEditFormData({...editFormData, room: r})}
                    className={`px-2 py-0.5 rounded border text-[11px] font-mono transition-colors cursor-pointer ${
                      editFormData.room === r 
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* PRC License if applicable */}
            {(editFormData.role === 'DOCTOR' || editFormData.role === 'NURSE') && (
              <div>
                <label className="text-[13px] font-medium text-slate-700 block mb-1">
                  PRC License Number {editFormData.role === 'DOCTOR' ? '*' : '(Opsyonal para sa Triage)'}
                </label>
                <Input 
                  value={editFormData.prcLicense}
                  onChange={(e) => setEditFormData({...editFormData, prcLicense: e.target.value})}
                  placeholder="0000000"
                  className="h-9 text-sm border-slate-300 rounded bg-white font-mono"
                />
              </div>
            )}

            {/* Optional Password Update */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-medium text-slate-700">
                  Palitan ang Password (Opsyonal)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const specials = '!@#$%';
                    const randomSpecial = specials.charAt(Math.floor(Math.random() * specials.length));
                    const randomNum = Math.floor(100000 + Math.random() * 900000);
                    const pwd = `Clinic${randomNum}${randomSpecial}`;
                    setEditFormData({ ...editFormData, password: pwd });
                    setShowEditPassword(true);
                  }}
                  className="text-xs text-blue-700 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  + Generate New Password
                </button>
              </div>
              <div className="relative">
                <Input 
                  type={showEditPassword ? 'text' : 'password'}
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({...editFormData, password: e.target.value})}
                  placeholder="Iwanang blangko kung hindi babaguhin ang password"
                  className="h-9 text-sm border-slate-300 rounded bg-white font-mono pr-20"
                />
                {editFormData.password && (
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-2 top-2 text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-0.5"
                  >
                    {showEditPassword ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Kung maglalagay ng bagong password, ipapadala ito sa email ng empleyado at gagamitin sa susunod na login.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingStaff(null);
                }}
                className="h-9 text-sm cursor-pointer"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="sm"
                className="h-9 text-sm bg-slate-900 hover:bg-slate-800 text-white font-medium cursor-pointer"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  'Save Account Changes'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── TOGGLE STATUS MODAL ─────────────────────────────────────── */}
      <Dialog open={toggleStatusModalOpen} onOpenChange={setToggleStatusModalOpen}>
        <DialogContent className="max-w-md bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              {selectedStaff?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} Staff Account
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Confirm status change for clinic personnel
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm space-y-1">
              <p className="font-medium text-slate-900">{selectedStaff?.name}</p>
              <p className="text-xs text-slate-500 font-mono">{selectedStaff?.email}</p>
              <div className="pt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  Role: {formatRoleLabel(selectedStaff?.role)}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              {selectedStaff?.status === 'ACTIVE'
                ? 'Deactivating this user will revoke immediate workstation access and disable card login.'
                : 'Activating this user will restore workstation access and enable appointment scheduling.'}
            </p>

            {selectedStaff?.email !== 'admin@clinic.local' && (
              <div className="mt-4 pt-3 border-t border-slate-200 bg-red-50/70 p-3 rounded border border-red-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-red-900">Gusto mo bang tuluyang burahin sa database?</p>
                  <p className="text-[11px] text-red-700">Permanenteng aalisin ang account at hindi na maibabalik.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    const toDel = selectedStaff;
                    setToggleStatusModalOpen(false);
                    setSelectedStaff(null);
                    setStaffToDelete(toDel);
                    setDeleteStaffModalOpen(true);
                  }}
                  className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white shrink-0 ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Burahin sa Database
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setToggleStatusModalOpen(false);
                setSelectedStaff(null);
              }}
              className="h-8 text-sm"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              size="sm"
              onClick={handleToggleStatus}
              className={`h-8 text-sm font-medium ${
                selectedStaff?.status === 'ACTIVE' 
                  ? 'bg-red-700 hover:bg-red-800 text-white' 
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                selectedStaff?.status === 'ACTIVE' ? 'Confirm Deactivation' : 'Confirm Activation'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── RESET PASSWORD MODAL ────────────────────────────────────── */}
      <Dialog open={resetPasswordModalOpen} onOpenChange={setResetPasswordModalOpen}>
        <DialogContent className="max-w-md bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900">Reset Password</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Transmit temporary credentials or password reset link
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-3 py-2 text-sm">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm space-y-0.5">
              <p className="font-medium text-slate-900">{selectedStaff?.name}</p>
              <p className="text-xs text-slate-500 font-mono">{selectedStaff?.email}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">Bagong Temporary Password *</label>
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center space-x-1"
                >
                  {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showResetPassword ? 'Itago' : 'Ipakita'}</span>
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showResetPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                  className="h-8 text-sm border-slate-300 rounded pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  tabIndex={-1}
                >
                  {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Ang bagong password na ito ay mai-se-save at awtomatikong maipapadala sa <strong>{selectedStaff?.email}</strong>.
            </p>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <Button 
                type="button"
                variant="outline" 
                size="sm"
                onClick={() => {
                  setResetPasswordModalOpen(false);
                  setSelectedStaff(null);
                  setNewPassword('');
                  setShowResetPassword(false);
                }}
                className="h-8 text-sm"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                size="sm"
                className="h-8 text-sm bg-slate-900 hover:bg-slate-800 text-white font-medium"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>Transmitting...</span>
                  </>
                ) : (
                  'Reset & Send Credentials'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── STAFF CREATED & EMAIL DISPATCH RECEIPT MODAL ───────────── */}
      <Dialog open={!!createdReceipt} onOpenChange={(open) => !open && setCreatedReceipt(null)}>
        <DialogContent className="max-w-md bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Staff Account Created & Dispatched
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Welcome notification and login credentials dispatched to staff email
            </DialogDescription>
          </DialogHeader>

          {createdReceipt && (
            <div className="space-y-3.5 py-2 text-sm">
              {createdReceipt.emailNotice?.emailSent ? (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded flex items-start space-x-2.5 text-xs text-emerald-800">
                  <Mail className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-900">Email Naipadala sa Totoong Inbox</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Ang account credentials at login URL ay naipadala sa <strong>{createdReceipt.email}</strong> via SMTP mail server.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50/90 border border-amber-200 rounded flex items-start space-x-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">Account Nilikha (Kailangan ng SMTP para sa Real Inbox)</p>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      Matagumpay na nagawa ang account sa database. Ngunit dahil wala pang <code>SMTP_USER</code> at <code>SMTP_PASS</code> sa <code>apps/web/.env</code>, hindi pa ito makakarating sa totoong Gmail/Yahoo inbox. Kopyahin muna ang password sa ibaba o i-set up ang Gmail App Password sa <code>.env</code>.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-2 font-mono">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5 font-sans">
                  <span className="text-slate-500">Kawani / Pangalan:</span>
                  <span className="font-semibold text-slate-900">{createdReceipt.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5 font-sans">
                  <span className="text-slate-500">Tungkulin (Role):</span>
                  <span className="font-semibold text-slate-900">{formatRoleLabel(createdReceipt.role)}</span>
                </div>
                {createdReceipt.room && (
                  <div className="flex justify-between border-b border-slate-200/60 pb-1.5 font-sans">
                    <span className="text-slate-500">Itinalagang Silid:</span>
                    <span className="font-semibold text-slate-900">{createdReceipt.room}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-sans">Email Address:</span>
                  <span className="text-slate-900">{createdReceipt.email}</span>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-slate-500 font-sans">Password:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 border border-slate-300 rounded text-xs">
                      {createdReceipt.password}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createdReceipt.password);
                        setCopiedPassword(true);
                        setTimeout(() => setCopiedPassword(false), 2000);
                      }}
                      className="text-slate-500 hover:text-slate-900 p-1 rounded hover:bg-slate-200 transition-colors"
                      title="Kopyahin ang password"
                    >
                      {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCreatedReceipt(null)}
                  className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium"
                >
                  Naiintindihan (Done)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DELETE STAFF PERMANENTLY MODAL ──────────────────────────── */}
      <Dialog open={deleteStaffModalOpen} onOpenChange={setDeleteStaffModalOpen}>
        <DialogContent className="max-w-md bg-white border border-red-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-red-100 pb-3">
            <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-2">
              <Trash2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-semibold text-red-900">
              Permanenteng Burahin ang Staff sa Database
            </DialogTitle>
            <DialogDescription className="text-xs text-red-600 mt-0.5 font-medium">
              Aksyon na hindi na mababawi (Permanent Database Deletion)
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-sm space-y-3">
            <div className="p-3 bg-red-50/60 border border-red-200 rounded space-y-1">
              <p className="font-semibold text-slate-900">{staffToDelete?.name}</p>
              <p className="text-xs text-slate-600 font-mono">{staffToDelete?.email}</p>
              <div className="pt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white text-slate-700 border border-slate-200">
                  Role: {formatRoleLabel(staffToDelete?.role)}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Sigurado ka ba? Kapag kinumpirma mo ito, <strong>tuluyang mabubura</strong> ang rekord ni <strong>{staffToDelete?.name}</strong> ({staffToDelete?.email}) sa PostgreSQL database kasama ang credentials nito. Hindi na ito maibabalik.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteStaffModalOpen(false);
                setStaffToDelete(null);
              }}
              className="h-8 text-sm"
              disabled={loading}
            >
              Kanselahin
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDeleteStaff}
              className="h-8 text-sm bg-red-700 hover:bg-red-800 text-white font-medium shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Binubura sa Database...</span>
                </>
              ) : (
                'Oo, Tuluyang Burahin sa Database'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── STAFF DELETED CONFIRMATION MODAL ───────────────────────── */}
      <Dialog open={!!deletedReceipt} onOpenChange={(open) => !open && setDeletedReceipt(null)}>
        <DialogContent className="max-w-md bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Matagumpay na Nabura sa Database!
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Permanently removed from PostgreSQL database
            </DialogDescription>
          </DialogHeader>

          {deletedReceipt && (
            <div className="space-y-3.5 py-2 text-sm">
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded text-xs text-emerald-950 leading-relaxed">
                Ang account para kay <strong>{deletedReceipt.name}</strong> ay <strong>tuluyan nang natanggal sa database</strong>. Hindi na ito makakapag-login at wala na ang rekord nito sa sistema.
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Pangalan:</span>
                  <span className="font-semibold text-slate-900">{deletedReceipt.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Tungkulin (Role):</span>
                  <span className="font-semibold text-slate-900">{formatRoleLabel(deletedReceipt.role)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email Address:</span>
                  <span className="text-slate-900 font-mono">{deletedReceipt.email}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setDeletedReceipt(null)}
                  className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium"
                >
                  Naiintindihan (OK)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
