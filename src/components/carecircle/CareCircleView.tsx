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
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-100 tracking-tight">Family</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                Trusted helpers
              </span>
            </div>
            <p className="text-xs text-slate-400">
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

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Family List
        </button>

        <button
          onClick={() => setActiveTab('multi_patient')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'multi_patient'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Everyone I Care For
        </button>

        <button
          onClick={() => setActiveTab('audit_log')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'audit_log'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
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
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-100">People Who Can Help</h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  {caregiverLinks.length} helper{caregiverLinks.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-3">
                {caregiverLinks.map((link) => (
                  <div
                    key={link.linkId}
                    className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
                        {link.caregiverName?.charAt(0) || 'R'}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-100">{link.caregiverName}</h4>
                          <span className="text-slate-400 text-[11px]">({link.relationship})</span>
                        </div>
                        <span className="inline-block px-2 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 uppercase">
                          Tier: {link.permissionLevel || 'MANAGE'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsPermissionsModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors"
                    >
                      Edit Scopes
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Proxy Audit Trail Snippet */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-100">Recent Activity</h3>
                </div>
                <button
                  onClick={() => setActiveTab('audit_log')}
                  className="text-xs text-sky-400 hover:underline font-semibold"
                >
                  View All
                </button>
              </div>

              <div className="space-y-2.5">
                {auditLogs.slice(0, 4).map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-slate-950 rounded-2xl p-3 border border-slate-800/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-slate-300 font-medium">
                      <span className="text-sky-400 font-mono text-[10px] uppercase">
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      By {entry.performedBy?.userName}
                      {entry.performedBy?.onBehalfOf ? ` on behalf of ${entry.performedBy.onBehalfOf}` : ''}
                    </p>
                  </div>
                ))}
              </div>
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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
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
