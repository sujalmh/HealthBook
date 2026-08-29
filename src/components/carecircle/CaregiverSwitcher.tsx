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
      {/* Profile Switcher Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-800">Active Profile:</span>
        </div>

        <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
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

      {/* Active Proxy Mode Banner (G1-G4) */}
      {isProxy && (
        <div className="bg-gradient-to-r from-indigo-950/80 via-slate-50 to-white border border-indigo-500/40 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-lg shadow-indigo-500/5 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">
                  Caregiver Proxy Mode Active
                </span>
                <span className="px-2 py-0.2 rounded-full bg-indigo-500/20 text-indigo-200 text-[10px] font-bold border border-indigo-200 flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  Scope: {permission.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-700 font-medium pt-0.5">
                Acting on behalf of <strong className="text-white">{activeProfile.onBehalfOf || 'Smt. Shanti Devi'}</strong>.
                All approved proposals and uploaded slips will be cryptographically signed to the audit trail.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleSwitch('self')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-700 text-xs font-semibold shrink-0 border border-slate-200 transition-colors"
          >
            Exit Proxy Mode
          </button>
        </div>
      )}
    </div>
  );
};
