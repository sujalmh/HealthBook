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
  Sparkles
} from 'lucide-react';
import { CaregiverSwitcher } from './CaregiverSwitcher';
import { ScopedPermissionsModal } from './ScopedPermissionsModal';
import { AuditLogViewer } from './AuditLogViewer';
import { MultiPatientDashboard } from './MultiPatientDashboard';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import type { LinkedCareProfile } from '@/types/carecircle';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'multi_patient' | 'audit_log'>('overview');
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [caregiverLinks, setCaregiverLinks] = useState<LinkedCareProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const loadData = () => {
    // Read-only vault loads — no per-view seeding (centralized src/core/vault/seed.ts owns baseline via main.tsx bootstrap).
    const links = localVault.getCaregiverLinks(patientId);
    setCaregiverLinks(links);

    const logs = localVault.getAuditLogs(patientId);
    setAuditLogs(logs);
  };

  // M2 Relevant-only: CareCircle listens to caregiver_linked, doctor_grant_added/revoked, audit_logged
  // proposal_status_changed / lab_* are irrelevant — spurious guard
  useEffect(() => {
    loadData();

    const guard = (p: any) => !p || !p.patientId || p.patientId === patientId || (p.details && p.details.patientId === patientId);
    const mk = (h: () => void) => (payload: any) => { if (guard(payload)) h(); };

    const u1 = eventBus.on('caregiver_linked', mk(loadData));
    const u2 = eventBus.on('audit_logged', mk(loadData));
    const u3 = eventBus.on('doctor_grant_added', mk(loadData));
    const u4 = eventBus.on('doctor_grant_revoked', mk(loadData));

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [patientId]);

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
              <h2 className="text-heading-lg text-slate-900">Family</h2>
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
          <button
            onClick={() => setIsPermissionsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
          >
            <KeyRound className="w-4 h-4" />
            <span>Manage Access</span>
          </button>
        </div>
      </div>

      {/* Profile Switcher Component (G1) */}
      <CaregiverSwitcher
        activeProfile={activeProfile}
        onProfileChange={onProfileChange}
      />

      {/* Sub-Navigation Tabs — pill, tokenized */}
      <div className="flex items-center bg-canvas-card p-1 rounded-xl border border-canvas-border text-body-sm w-fit shadow-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Family List
        </button>

        <button
          onClick={() => setActiveTab('multi_patient')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'multi_patient'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Everyone I Care For
        </button>

        <button
          onClick={() => setActiveTab('audit_log')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'audit_log'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-600 hover:text-slate-800'
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
                          {link.caregiverName?.charAt(0) || 'R'}
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

          {/* Right Column: Proxy Audit Trail Snippet */}
          <div className="lg:col-span-5 space-y-6">
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
            if (pid === 'patient-s-devi') onProfileChange('mother');
            else if (pid === 'patient-child-003') onProfileChange('child');
            else onProfileChange('self');
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
        patientId={patientId}
        onPermissionsUpdated={loadData}
      />
    </div>
  );
};
