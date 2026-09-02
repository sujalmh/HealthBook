import React, { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Stethoscope, Trash2, Mail, KeyRound } from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import type { DoctorPatientLink } from '@/types/carecircle';

interface DoctorLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  onLinksUpdated?: () => void;
}

export const DoctorLinkModal: React.FC<DoctorLinkModalProps> = ({ isOpen, onClose, patientId, onLinksUpdated }) => {
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [permissionLevel, setPermissionLevel] = useState<'view_only' | 'manage' | 'full'>('view_only');
  const [scope, setScope] = useState<'full_dossier' | 'snapshot_only' | 'labs_and_meds'>('full_dossier');
  const [authToken, setAuthToken] = useState('token_auth_valid_8923');
  const [isLinking, setIsLinking] = useState(false);
  const [links, setLinks] = useState<DoctorPatientLink[]>(() => localVault.getDoctorLinksForPatient(patientId));
  const [activeTab, setActiveTab] = useState<'manage' | 'link'>('manage');

  useEffect(() => {
    if (isOpen) {
      setLinks(localVault.getDoctorLinksForPatient(patientId));
    }
  }, [isOpen, patientId]);

  // refresh on doctor_linked/revoked
  useEffect(() => {
    if (!isOpen) return;
    const refresh = () => setLinks(localVault.getDoctorLinksForPatient(patientId));
    const u1 = eventBus.on('doctor_linked', (p: any) => { if (!p?.patientId || p.patientId === patientId) refresh(); });
    const u2 = eventBus.on('doctor_revoked', (p: any) => { if (!p?.patientId || p.patientId === patientId) refresh(); });
    return () => { u1(); u2(); };
  }, [isOpen, patientId]);

  if (!isOpen) return null;

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doctorEmail.trim())) {
      eventBus.dispatchToast({ type: 'warning', title: 'Email required', message: 'Please enter a valid doctor email.' });
      return;
    }
    if (!doctorName.trim() || doctorName.trim().length < 2) {
      eventBus.dispatchToast({ type: 'warning', title: 'Name required', message: 'Doctor name at least 2 characters.' });
      return;
    }
    setIsLinking(true);
    try {
      const res = await webMCPEngine.execute('link_doctor', {
        patientId,
        doctorEmail: doctorEmail.trim().toLowerCase(),
        doctorName: doctorName.trim(),
        specialty: specialty.trim() || undefined,
        permissionLevel,
        scope,
        authToken,
      });
      if (res.success) {
        eventBus.dispatchToast({ type: 'success', title: 'Doctor linked', message: `Dr. ${doctorName} linked with ${permissionLevel} access.` });
        setDoctorEmail(''); setDoctorName(''); setSpecialty('');
        setLinks(localVault.getDoctorLinksForPatient(patientId));
        if (onLinksUpdated) onLinksUpdated();
        setActiveTab('manage');
      } else {
        eventBus.dispatchToast({ type: 'error', title: 'Link failed', message: res.error?.message || 'Failed to link doctor.' });
      }
    } catch (err: any) {
      eventBus.dispatchToast({ type: 'error', title: 'Link error', message: err.message || 'Failed to link.' });
    } finally {
      setIsLinking(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    try {
      const res = await webMCPEngine.execute('revoke_doctor_link', { linkId, patientId });
      if (res.success) {
        eventBus.dispatchToast({ type: 'info', title: 'Doctor access revoked', message: 'Doctor access has been revoked.' });
        setLinks(localVault.getDoctorLinksForPatient(patientId));
        if (onLinksUpdated) onLinksUpdated();
      }
    } catch (e: any) {
      eventBus.dispatchToast({ type: 'error', title: 'Revoke failed', message: e.message || 'Failed to revoke.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-canvas-card border border-canvas-border rounded-2xl max-w-xl w-full shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-canvas-border gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-sm shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-heading-md text-slate-900 truncate">My Doctors</h3>
              <p className="text-body-sm text-muted line-clamp-1">Link doctors to your profile — scoped access</p>
            </div>
          </div>
          <button onClick={onClose} className="w-11 h-11 rounded-xl bg-canvas-muted hover:bg-canvas-border text-muted hover:text-slate-900 flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]" aria-label="Close doctor link modal">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-6 pt-4">
          <div className="flex items-center bg-canvas-muted p-1 rounded-xl border border-canvas-border text-body-sm">
            <button onClick={() => setActiveTab('manage')} className={`flex-1 py-2.5 rounded-xl font-bold transition-all min-h-[44px] ${activeTab==='manage' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800'}`}>
              Linked Doctors ({links.length})
            </button>
            <button onClick={() => setActiveTab('link')} className={`flex-1 py-2.5 rounded-xl font-bold transition-all min-h-[44px] ${activeTab==='link' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800'}`}>
              + Link Doctor
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'manage' ? (
            links.length === 0 ? (
              <div className="bg-canvas-muted rounded-xl p-6 text-center space-y-3 border border-canvas-border">
                <div className="w-10 h-10 rounded-xl bg-canvas-card text-muted flex items-center justify-center mx-auto border border-canvas-border">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <p className="text-body-sm font-bold text-slate-900">No doctors linked yet</p>
                <p className="text-body-sm text-muted">Link your doctor so they can view your health record.</p>
                <button onClick={() => setActiveTab('link')} className="inline-flex items-center gap-1.5 text-body-sm text-emerald-700 font-bold hover:underline"><UserPlus className="w-3.5 h-3.5" /> Link a doctor</button>
              </div>
            ) : (
              <div className="space-y-3">
                {links.map((link) => (
                  <div key={link.linkId} className="bg-canvas-muted rounded-xl p-4 border border-canvas-border flex items-center justify-between gap-3 text-body-sm">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 truncate">{link.doctorName}</span>
                        {link.specialty && <span className="text-muted text-caption">• {link.specialty}</span>}
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-caption font-bold border border-emerald-200 uppercase">{link.permissionLevel}</span>
                      </div>
                      <p className="text-muted text-caption font-mono truncate">{link.doctorEmail}</p>
                      <p className="text-muted text-caption">Scope: {link.scope} • {new Date(link.linkedDate).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => handleRevoke(link.linkId)} className="p-2 rounded-xl bg-canvas-card hover:bg-rose-50 text-muted hover:text-rose-700 border border-canvas-border hover:border-rose-200 transition-colors shrink-0" title="Revoke doctor access">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <form onSubmit={handleLink} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Doctor Email *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type="email" value={doctorEmail} onChange={(e) => setDoctorEmail(e.target.value)} placeholder="dr.chen@hospital.org" required className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 min-h-[44px]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Doctor Name *</label>
                <input type="text" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Dr. Chen" required minLength={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 min-h-[44px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Specialty</label>
                <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Nephrology, Cardiology..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 min-h-[44px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Permission Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['view_only','manage','full'] as const).map((tier) => (
                    <button key={tier} type="button" onClick={() => setPermissionLevel(tier)} className={`p-3 rounded-xl border text-xs font-bold uppercase min-h-[44px] ${permissionLevel===tier ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {tier.replace('_',' ')}
                    </button>
                  ))}
                </div>
                <p className="text-caption text-muted">view_only = read record • manage = can propose changes • full = full access</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Data Scope</label>
                <select value={scope} onChange={(e) => setScope(e.target.value as unknown as typeof scope)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 min-h-[44px]">
                  <option value="full_dossier">Full Dossier (labs, meds, notes)</option>
                  <option value="snapshot_only">Emergency Snapshot Only</option>
                  <option value="labs_and_meds">Labs & Meds Only</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Authorization Token</label>
                <input type="text" value={authToken} onChange={(e) => setAuthToken(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono min-h-[44px]" placeholder="Patient consent token" />
              </div>
              <button type="submit" disabled={isLinking} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold min-h-[44px]">
                <UserPlus className="w-4 h-4" />
                <span>{isLinking ? 'Linking...' : 'Link Doctor'}</span>
              </button>
            </form>
          )}

          {activeTab === 'manage' && links.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5 text-caption">
              <div className="font-bold text-amber-800 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> How doctor access works</div>
              <p className="text-amber-700 leading-relaxed">Linked doctors can view your record via <strong>view_patient_as_doctor</strong> tool and <em>My Patients</em> dashboard. Revoke anytime — access is immediate.</p>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-canvas-border bg-canvas-muted flex items-center justify-end">
          <button onClick={onClose} className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-canvas-card hover:bg-canvas-muted text-slate-700 text-body-sm font-semibold border border-canvas-border min-h-[44px]">Close</button>
        </div>
      </div>
    </div>
  );
};