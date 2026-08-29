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

  const handleSwitch = async (target: 'self' | 'mother' | 'child') => {
    const targetPatientId =
      target === 'self'
        ? 'self'
        : target === 'mother'
        ? 'patient-s-devi'
        : 'patient-child-003';

    try {
      await webMCPEngine.execute(
        'switch_profile',
        { targetPatientId },
        {
          patientId: target === 'self' ? 'user-raj-devi' : targetPatientId,
          activeProfile: {
            userId: activeProfile.userId,
            name: activeProfile.name,
            role: activeProfile.role as any,
            isProxy: target !== 'self',
            onBehalfOf: target === 'mother' ? 'Smt. Shanti Devi (Mother)' : target === 'child' ? 'Aarav (Child)' : undefined
          },
          vault: localVault,
          eventBus
        }
      );
    } catch (err) {
      console.error('Error switching profile:', err);
    }

    onProfileChange(target);
  };

  return (
    <div className="space-y-3">
      {/* Profile Switcher Tabs — tokenized */}
      <div className="bg-canvas-card border border-canvas-border rounded-xl p-2 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center border border-primary-border">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-body-sm font-bold text-slate-800">Active profile:</span>
        </div>

        <div className="flex items-center bg-canvas-muted p-1 rounded-xl border border-canvas-border text-body-sm">
          <button
            onClick={() => handleSwitch('self')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              !isProxy
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Self (Personal Vault)
          </button>

          <button
            onClick={() => handleSwitch('mother')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              isProxy && activeProfile.onBehalfOf?.includes('Shanti')
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Mother (S. Devi, 78)
          </button>

          <button
            onClick={() => handleSwitch('child')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              isProxy && activeProfile.onBehalfOf?.includes('Aarav')
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Child (Aarav, 8)
          </button>
        </div>
      </div>

      {/* Active Proxy Mode Banner — light, tokenized */}
      {isProxy && (
        <div className="bg-primary-light border border-primary-border rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-caption font-black text-primary uppercase tracking-wider">
                  Caregiver proxy mode active
                </span>
                <span className="px-2 py-0.5 rounded-full bg-canvas-card text-primary text-caption font-bold border border-primary-border flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  Scope: {permission.toUpperCase()}
                </span>
              </div>
              <p className="text-body-sm text-slate-700 font-medium pt-0.5">
                Acting on behalf of <strong className="text-slate-900">{activeProfile.onBehalfOf || 'Smt. Shanti Devi'}</strong>.
                All approved proposals and uploaded slips will be cryptographically signed to the audit trail.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleSwitch('self')}
            className="px-3 py-2 rounded-xl bg-canvas-card hover:bg-canvas-muted text-slate-700 text-body-sm font-semibold shrink-0 border border-canvas-border transition-colors min-h-[36px]"
          >
            Exit proxy mode
          </button>
        </div>
      )}
    </div>
  );
};
