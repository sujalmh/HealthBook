import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  UserPlus,
  KeyRound,
  FileCheck2,
  Lock,
  UserCheck,
  Activity,
  Layers,
  Settings,
  Sparkles,
  Stethoscope
} from 'lucide-react';
import { CaregiverSwitcher } from './CaregiverSwitcher';
import { ScopedPermissionsModal } from './ScopedPermissionsModal';
import { AuditLogViewer } from './AuditLogViewer';
import { MultiPatientDashboard } from './MultiPatientDashboard';
import { ProfileIndicator } from './ProfileIndicator';
import { DoctorLinkModal } from '../doctor/DoctorLinkModal';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { resolvePatientId as deriveCarePatientId } from '@/components/common/resolvePatientId';
import type { LinkedCareProfile, DoctorPatientLink } from '@/types/carecircle';
import type { AuditLogEntry } from '@/types/vault';

interface CareCircleViewProps {
  patientId: string;
  activeProfile: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
    relationship?: string;
    onBehalfOf?: string;
    permissionLevel?: 'view_only' | 'manage' | 'full';
  };
  onProfileChange: (target: 'self' | 'mother' | 'child') => void;
}

export const CareCircleView: React.FC<CareCircleViewProps> = ({
  patientId,
  activeProfile,
  onProfileChange
}) => {
  const effectivePatientId = deriveCarePatientId(patientId, activeProfile.userId);
  const [activeTab, setActiveTab] = useState<'overview' | 'multi_patient' | 'audit_log'>('overview');
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [caregiverLinks, setCaregiverLinks] = useState<LinkedCareProfile[]>([]);
  const [doctorLinks, setDoctorLinks] = useState<DoctorPatientLink[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const loadData = () => {
    // Read-only vault loads — effectivePatientId for isolation, reflects AI-derived timeline citations
    const links = effectivePatientId ? localVault.getCaregiverLinks(effectivePatientId) : [];
    setCaregiverLinks(links);
    const dLinks = effectivePatientId ? localVault.getDoctorLinksForPatient(effectivePatientId) : [];
    setDoctorLinks(dLinks);

    const logs = effectivePatientId ? localVault.getAuditLogs(effectivePatientId) : [];
    setAuditLogs(logs);
  };

  // M2 Relevant-only: CareCircle listens to caregiver_linked, doctor_grant_added/revoked, doctor_linked/revoked, audit_logged
  // proposal_status_changed / lab_* are irrelevant — spurious guard; reflects new facts via dossier audit
  useEffect(() => {
    loadData();

    const guard = (p: unknown) => {
      if (!p || typeof p !== 'object') return true;
      const obj = p as { patientId?: unknown; details?: { patientId?: unknown } };
      if (typeof obj.patientId !== 'string') return true;
      if (obj.patientId === effectivePatientId) return true;
      if (obj.details && typeof obj.details.patientId === 'string' && obj.details.patientId === effectivePatientId) return true;
      return !obj.patientId;
    };
    const mk = (h: () => void) => (payload: unknown) => { if (guard(payload)) h(); };

    const u1 = eventBus.on('caregiver_linked', mk(loadData));
    const u2 = eventBus.on('audit_logged', mk(loadData));
    const u3 = eventBus.on('doctor_grant_added', mk(loadData));
    const u4 = eventBus.on('doctor_grant_revoked', mk(loadData));
    const u5 = eventBus.on('doctor_linked', mk(loadData));
    const u6 = eventBus.on('doctor_revoked', mk(loadData));

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, [effectivePatientId]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header — tokenized */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center border border-primary-border shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Family</h2>
              <span className="text-caption px-2 py-0.5 rounded-full bg-primary-light text-primary-text font-bold border border-primary-border">
                Trusted helpers
              </span>
            </div>
            <p className="text-body-sm text-muted">
              Family and caregivers who can help — see who has access and what they did.
            </p>
          </div>
        </div>

        {/* View Mode Navigation */}
        <div className="flex items-center gap-2.5">
          {activeProfile.role !== 'doctor' && (
            <button
              onClick={() => setIsDoctorModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Stethoscope className="w-4 h-4" />
              <span>My Doctors ({doctorLinks.length})</span>
            </button>
          )}
          <button
            onClick={() => setIsPermissionsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-sm"
          >
            <KeyRound className="w-4 h-4" />
            <span>Manage Access</span>
          </button>
        </div>
      </div>

      {/* Profile indicator — vault-derived completeness in Family where active profile visible */}
      <div className="bg-white border border-canvas-border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">Profile status — completeness</h3>
          <span className="text-caption px-2 py-0.5 rounded-full bg-primary-light text-primary-text border border-primary-border font-bold">vault-derived</span>
        </div>
        <ProfileIndicator activeProfile={activeProfile} />
        <p className="text-caption text-muted mt-2">Derived from real vault/profile (not mock): papers, meds, labs, confirmed facts. Empty vault shows low completeness, not mock helper.</p>
      </div>

      {/* Profile Switcher Component (G1) */}
      <CaregiverSwitcher
        activeProfile={activeProfile}
        onProfileChange={onProfileChange}
      />

      {/* Sub-Navigation Tabs — pill, tokenized */}
      <div className="flex items-center gap-1 bg-canvas-muted p-1 rounded-xl border border-canvas-border text-body-sm max-w-full overflow-x-auto scrollbar-none shadow-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap min-h-[36px] ${
            activeTab === 'overview'
              ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
              : 'text-muted hover:text-slate-900 border border-transparent'
          }`}
        >
          Family List
        </button>

        <button
          onClick={() => setActiveTab('multi_patient')}
          className={`px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap min-h-[36px] ${
            activeTab === 'multi_patient'
              ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
              : 'text-muted hover:text-slate-900 border border-transparent'
          }`}
        >
          Everyone I Care For
        </button>

        <button
          onClick={() => setActiveTab('audit_log')}
          className={`px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap min-h-[36px] ${
            activeTab === 'audit_log'
              ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
              : 'text-muted hover:text-slate-900 border border-transparent'
          }`}
        >
          History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Active Linked Caregivers */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-canvas-border pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  <h3 className="text-heading-md text-slate-900">People who can help</h3>
                </div>
                <span className="text-caption text-muted">
                  {caregiverLinks.length} helper{caregiverLinks.length === 1 ? '' : 's'}
                </span>
              </div>

              {caregiverLinks.length === 0 ? (
                <div className="bg-canvas-muted rounded-xl p-6 text-center border border-canvas-border">
                  <Users className="w-8 h-8 text-muted-light mx-auto mb-2" />
                  <p className="text-body-sm font-semibold text-slate-900">No helpers yet</p>
                  <p className="text-body-sm text-muted">Add a family member who helps with your health.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {caregiverLinks.map((link) => (
                    <div
                      key={link.linkId}
                      className="bg-canvas-muted rounded-xl p-4 border border-canvas-border flex items-center justify-between gap-3 text-body-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center font-bold text-sm border border-primary-border">
                          {link.caregiverName?.charAt(0) || 'F'}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900">{link.caregiverName}</h4>
                            <span className="text-muted text-caption">({link.relationship})</span>
                          </div>
                          <span className="inline-block px-2 py-0.5 rounded-full bg-primary-light text-primary-text text-caption font-bold border border-primary-border uppercase">
                            Tier: {link.permissionLevel || 'MANAGE'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setIsPermissionsModalOpen(true)}
                        className="px-3 py-2 rounded-xl bg-canvas-card hover:bg-canvas-muted text-slate-700 text-body-sm font-semibold border border-canvas-border transition-colors min-h-[36px]"
                      >
                        Edit scopes
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Proxy Audit Trail + My Doctors */}
          <div className="lg:col-span-5 space-y-6">
            {/* My Doctors — patient links doctors (RBAC doctor ↔ patient) */}
            {activeProfile.role !== 'doctor' && (
              <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-canvas-border pb-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-heading-md text-slate-900">My Doctors</h3>
                  </div>
                  <button onClick={() => setIsDoctorModalOpen(true)} className="text-body-sm text-emerald-700 hover:underline font-semibold">Manage</button>
                </div>
                {doctorLinks.length === 0 ? (
                  <div className="bg-canvas-muted rounded-xl p-6 text-center border border-canvas-border">
                    <Stethoscope className="w-8 h-8 text-muted-light mx-auto mb-2" />
                    <p className="text-body-sm font-semibold text-slate-900">No doctors linked</p>
                    <p className="text-body-sm text-muted">Link your doctor for remote review.</p>
                    <button onClick={() => setIsDoctorModalOpen(true)} className="inline-flex items-center gap-1.5 text-body-sm text-emerald-700 font-bold hover:underline mt-2"><UserPlus className="w-3.5 h-3.5" /> Link a doctor</button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {doctorLinks.slice(0,3).map((d) => (
                      <div key={d.linkId} className="bg-canvas-muted rounded-xl p-3 border border-canvas-border flex items-center justify-between gap-2 text-body-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-200 shrink-0">{d.doctorName.charAt(0)}</div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{d.doctorName} <span className="text-caption text-muted">• {d.specialty || 'Doctor'}</span></p>
                            <p className="text-caption text-muted font-mono truncate">{d.doctorEmail}</p>
                          </div>
                        </div>
                        <span className="text-caption px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold uppercase shrink-0">{d.permissionLevel}</span>
                      </div>
                    ))}
                    {doctorLinks.length > 3 && <p className="text-caption text-muted text-center">+ {doctorLinks.length - 3} more — tap Manage to see all</p>}
                  </div>
                )}
              </div>
            )}
            <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-canvas-border pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-clinical-emerald" />
                  <h3 className="text-heading-md text-slate-900">Recent activity</h3>
                </div>
                <button
                  onClick={() => setActiveTab('audit_log')}
                  className="text-body-sm text-accent hover:underline font-semibold"
                >
                  View all
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="bg-canvas-muted rounded-xl p-6 text-center border border-canvas-border">
                  <Activity className="w-8 h-8 text-muted-light mx-auto mb-2" />
                  <p className="text-body-sm text-muted">No recent activity.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {auditLogs.slice(0, 4).map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-canvas-muted rounded-xl p-3 border border-canvas-border text-body-sm space-y-1"
                    >
                      <div className="flex items-center justify-between text-slate-700 font-medium">
                        <span className="text-accent font-mono text-caption uppercase">
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-caption text-muted font-mono">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-muted text-body-sm">
                        By {entry.performedBy?.userName}
                        {entry.performedBy?.onBehalfOf ? ` on behalf of ${entry.performedBy.onBehalfOf}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'multi_patient' ? (
        <MultiPatientDashboard
          onSelectPatient={(pid) => {
            if (!pid) { onProfileChange('self'); return; }
            try {
              const links = localVault.getCaregiverLinks(patientId);
              const found = links.find((l) => l.linkId === pid);
              if (found?.relationship?.toLowerCase().includes('child')) onProfileChange('child');
              else onProfileChange('mother');
            } catch { onProfileChange('mother'); }
          }}
        />
      ) : (
        <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm">
          <AuditLogViewer logs={auditLogs} />
        </div>
      )}

      {/* Permissions Modal */}
      <ScopedPermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        patientId={effectivePatientId}
        onPermissionsUpdated={loadData}
      />
      <DoctorLinkModal
        isOpen={isDoctorModalOpen}
        onClose={() => setIsDoctorModalOpen(false)}
        patientId={effectivePatientId}
        onLinksUpdated={loadData}
      />
    </div>
  );
};
