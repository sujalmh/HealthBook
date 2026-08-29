import React from 'react';
import {
  Users,
  UserCheck,
  Shield,
  ShieldAlert,
  ArrowRightLeft,
  ChevronDown,
  CheckCircle2,
  Lock,
  Eye,
  KeyRound
} from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

interface CaregiverSwitcherProps {
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

export const CaregiverSwitcher: React.FC<CaregiverSwitcherProps> = ({
  activeProfile,
  onProfileChange
}) => {
  const isProxy = !!activeProfile.isProxy;
  const permission = activeProfile.permissionLevel || 'manage';

  // Derive linked family members from vault — vault-derived, no hardcoded Mother/Child mocks.
  const linkedFamily = (() => {
    try {
      const all = localVault.getCaregiverLinks(activeProfile.userId);
      return all;
    } catch { return []; }
  })();

  const handleSwitch = async (target: 'self' | string) => {
    // target 'self' or linkId for dynamic family member
    if (target === 'self') {
      try {
        await webMCPEngine.execute(
          'switch_profile',
          { targetPatientId: 'self' },
          {
            patientId: activeProfile.userId,
            activeProfile: {
              userId: activeProfile.userId,
              name: activeProfile.name,
              role: activeProfile.role as any,
              isProxy: false,
              onBehalfOf: undefined
            },
            vault: localVault,
            eventBus
          }
        );
      } catch (err) {
        console.error('Error switching profile:', err);
      }
      onProfileChange('self');
      return;
    }
    // dynamic family target — find the linked profile by linkId
    const link = linkedFamily.find((l) => l.linkId === target);
    if (!link) {
      // No linked family yet — show guidance instead of mock (fixes #3).
      eventBus.dispatchToast({
        type: 'info',
        title: 'No family member',
        message: 'No linked family member found. Add one in Family → Manage Access.',
      });
      return;
    }
    const onBehalf = link.caregiverName || link.patientName || 'Family member';
    try {
      await webMCPEngine.execute(
        'switch_profile',
        { targetPatientId: link.linkId },
        {
          patientId: link.linkId,
          activeProfile: {
            userId: activeProfile.userId,
            name: activeProfile.name,
            role: activeProfile.role as any,
            isProxy: true,
            onBehalfOf: onBehalf
          },
          vault: localVault,
          eventBus
        }
      );
    } catch (err) {
      console.error('Error switching profile:', err);
    }
    // Map to legacy mother/child callbacks for compatibility — use first link as 'mother' if needed
    const legacyTarget = (link.relationship === 'child' ? 'child' : 'mother') as 'mother' | 'child';
    onProfileChange(legacyTarget);
  };

  return (
    <div className="space-y-3">
      {/* Profile Switcher Tabs — vault-derived, tokenized */}
      <div className="bg-canvas-card border border-canvas-border rounded-xl p-2 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center border border-primary-border">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-body-sm font-bold text-slate-800">Active profile:</span>
        </div>

        <div className="flex items-center gap-1 bg-canvas-muted p-1 rounded-xl border border-canvas-border text-body-sm overflow-x-auto scrollbar-none max-w-full">
          <button
            onClick={() => handleSwitch('self')}
            className={`px-3 py-2 rounded-lg font-bold transition-all whitespace-nowrap min-h-[40px] ${
              !isProxy
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Self (Personal Vault)
          </button>

          {linkedFamily.length === 0 ? (
            <span className="px-3 py-2 text-caption text-muted">No linked family — add via Manage Access</span>
          ) : (
            linkedFamily.map((link) => {
              const label = link.caregiverName || link.patientName || 'Family member';
              const rel = link.relationship ? ` (${link.relationship})` : '';
              const isActive = isProxy && activeProfile.onBehalfOf === label;
              return (
                <button
                  key={link.linkId}
                  onClick={() => handleSwitch(link.linkId)}
                  className={`px-3 py-2 rounded-lg font-bold transition-all whitespace-nowrap min-h-[40px] ${
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {label}{rel}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Active Proxy Mode Banner — light, tokenized */}
      {isProxy && (
        <div className="bg-primary-light border border-primary-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-caption font-black text-primary uppercase tracking-wider">
                  Caregiver proxy mode active
                </span>
                <span className="px-2 py-0.5 rounded-full bg-canvas-card text-primary text-caption font-bold border border-primary-border flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  Scope: {permission.toUpperCase()}
                </span>
              </div>
              <p className="text-body-sm text-slate-700 font-medium pt-0.5">
                Acting on behalf of <strong className="text-slate-900">{activeProfile.onBehalfOf || 'Patient'}</strong>.
                All approved proposals and uploaded slips will be cryptographically signed to the audit trail.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleSwitch('self')}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-canvas-card hover:bg-canvas-muted text-slate-700 text-body-sm font-semibold shrink-0 border border-canvas-border transition-colors min-h-[44px] flex items-center justify-center"
          >
            Exit proxy mode
          </button>
        </div>
      )}
    </div>
  );
};
