import React, { useEffect, useState, useMemo } from 'react';
import { Users, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

interface ProfileIndicatorProps {
  activeProfile: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
    relationship?: string;
    onBehalfOf?: string;
    permissionLevel?: 'view_only' | 'manage' | 'full';
    email?: string;
  };
  pendingCount?: number;
  className?: string;
  compact?: boolean;
}

/**
 * ProfileIndicator — vault-derived completeness indicator
 * Uses real vault/profile data (not mock patient_profiles.ts).
 * Shows profile completeness % derived from vault data + profile fields.
 * Visible in header near logo or Family page.
 */
export const ProfileIndicator: React.FC<ProfileIndicatorProps> = ({
  activeProfile,
  pendingCount: propPendingCount,
  className = '',
  compact = false,
}) => {
  const [vaultStats, setVaultStats] = useState({
    docs: 0,
    meds: 0,
    labs: 0,
    factsConfirmed: 0,
    pending: 0,
    caregiverLinks: 0,
  });
  const [version, setVersion] = useState(0);

  const refreshStats = () => {
    try {
      const pid = activeProfile.userId;
      if (!pid) return;
      const docs = (() => {
        try {
          return localVault.getDocuments(pid).length;
        } catch {
          return 0;
        }
      })();
      const meds = (() => {
        try {
          return localVault.getMedications(pid).length;
        } catch {
          return 0;
        }
      })();
      const labs = (() => {
        try {
          return localVault.getLabs(pid).length;
        } catch {
          return 0;
        }
      })();
      const factsConfirmed = (() => {
        try {
          return localVault.getConfirmedFacts(pid).length;
        } catch {
          try {
            return localVault.getFacts(pid).filter((f: any) => f.status === 'confirmed').length;
          } catch {
            return 0;
          }
        }
      })();
      const pendingFacts = (() => {
        try {
          return localVault.getPendingFacts(pid).length;
        } catch {
          return 0;
        }
      })();
      const pendingProps = (() => {
        try {
          return localVault.getPendingProposals(pid).length;
        } catch {
          return 0;
        }
      })();
      const caregiverLinks = (() => {
        try {
          return localVault.getCaregiverLinks(pid).length;
        } catch {
          return 0;
        }
      })();
      setVaultStats({
        docs,
        meds,
        labs,
        factsConfirmed,
        pending: pendingFacts + pendingProps,
        caregiverLinks,
      });
    } catch {}
  };

  useEffect(() => {
    refreshStats();
    const bump = () => {
      refreshStats();
      setVersion((v) => v + 1);
    };
    const u1 = eventBus.on('fact_added' as any, bump);
    const u2 = eventBus.on('fact_extracted' as any, bump);
    const u3 = eventBus.on('fact_confirmed' as any, bump);
    const u4 = eventBus.on('fact_status_changed' as any, bump);
    const u5 = eventBus.on('medication_added' as any, bump);
    const u6 = eventBus.on('lab_added' as any, bump);
    const u7 = eventBus.on('caregiver_linked' as any, bump);
    const u8 = eventBus.on('approval_resolved' as any, bump);
    const u9 = eventBus.on('proposal_submitted' as any, bump);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
      u8();
      u9();
    };
  }, [activeProfile.userId, version]);

  // completeness derived from real vault/profile data — not mock
  const completeness = useMemo(() => {
    let score = 0;
    const max = 100;
    // Profile fields (25)
    if (activeProfile.name && activeProfile.name.trim().length > 1 && activeProfile.name !== 'Anonymous') score += 12;
    if (activeProfile.email && activeProfile.email.includes('@')) score += 8;
    else if (activeProfile.userId) score += 5; // has userId
    // vault-derived signals (75)
    if (vaultStats.docs > 0) score += 15;
    if (vaultStats.meds > 0) score += 20;
    if (vaultStats.labs > 0) score += 20;
    if (vaultStats.factsConfirmed > 0) score += 15;
    if (vaultStats.caregiverLinks > 0) score += 5;
    // cap
    if (score > max) score = max;
    // empty vault no mock indicator — should be low, not 100
    // ensure at least 5% if profile exists
    if (score < 5 && activeProfile.userId) score = 5;
    return Math.round(score);
  }, [activeProfile.name, activeProfile.email, activeProfile.userId, vaultStats]);

  const pendingDisplay = propPendingCount !== undefined ? propPendingCount : vaultStats.pending;
  const initials = (activeProfile.name || 'P').trim().charAt(0).toUpperCase() || 'P';
  const roleLabel = activeProfile.isProxy
    ? `Proxy ${activeProfile.relationship ? `(${activeProfile.relationship})` : ''} → ${activeProfile.onBehalfOf || 'Patient'}`
    : activeProfile.role || 'patient';
  const permissionLabel = activeProfile.permissionLevel || 'manage';

  if (compact) {
    return (
      <div
        data-testid="profile-indicator"
        aria-label={`Profile completeness ${completeness} percent, ${roleLabel}, ${permissionLabel}`}
        className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white border border-canvas-border shadow-sm text-xs font-semibold ${className}`}
        title={`Profile completeness derived from vault: ${vaultStats.docs} docs, ${vaultStats.meds} meds, ${vaultStats.labs} labs, ${vaultStats.factsConfirmed} confirmed`}
      >
        <span className="w-6 h-6 rounded-full bg-primary-light border border-primary-border flex items-center justify-center text-primary-text font-black text-xs shrink-0">
          {initials}
        </span>
        <span className="hidden sm:inline font-bold text-slate-900 truncate max-w-[90px]">{activeProfile.name}</span>
        <span className="h-4 w-px bg-canvas-border hidden sm:block" aria-hidden="true" />
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${completeness >= 80 ? 'bg-emerald-500' : completeness >= 40 ? 'bg-amber-500' : 'bg-rose-400'}`} aria-hidden="true" />
          <span className="text-slate-700">{completeness}%</span>
        </span>
        <span className="text-caption text-muted hidden md:inline">complete</span>
      </div>
    );
  }

  return (
    <div
      data-testid="profile-indicator"
      aria-label={`Profile completeness ${completeness} percent, role ${roleLabel}, permission ${permissionLabel}`}
      className={`flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 rounded-xl bg-white border border-canvas-border shadow-sm ${className}`}
    >
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center text-primary font-bold text-sm shrink-0">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[110px] sm:max-w-[140px]">{activeProfile.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-light text-primary-text border border-primary-border font-bold uppercase tracking-wider hidden sm:inline-flex items-center gap-1">
            <Shield className="w-3 h-3" aria-hidden="true" />
            {permissionLabel}
          </span>
          {activeProfile.isProxy && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold hidden sm:inline-flex">
              proxy
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="w-16 sm:w-20 h-1.5 bg-canvas-muted rounded-full overflow-hidden border border-canvas-border" role="progressbar" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
            <div
              className={`h-full transition-all duration-500 ${completeness >= 80 ? 'bg-emerald-500' : completeness >= 40 ? 'bg-amber-500' : 'bg-rose-400'}`}
              style={{ width: `${completeness}%` }}
            />
          </div>
          <span className="text-caption font-bold text-slate-700">{completeness}% complete</span>
          {pendingDisplay > 0 && (
            <span className="text-caption px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold border border-amber-600">
              {pendingDisplay} pending
            </span>
          )}
        </div>
        <p className="text-caption text-muted hidden sm:block leading-none mt-0.5 truncate">
          {vaultStats.docs} papers • {vaultStats.meds} meds • {vaultStats.labs} labs {vaultStats.caregiverLinks > 0 ? `• ${vaultStats.caregiverLinks} helper${vaultStats.caregiverLinks === 1 ? '' : 's'}` : ''} {activeProfile.isProxy ? `• proxy ${activeProfile.relationship || ''}` : ''}
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        {completeness >= 80 ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
        ) : completeness >= 40 ? (
          <Users className="w-4 h-4 text-amber-500" aria-hidden="true" />
        ) : (
          <AlertCircle className="w-4 h-4 text-muted" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};
