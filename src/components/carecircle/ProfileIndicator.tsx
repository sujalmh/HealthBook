import React, { useEffect, useState, useMemo } from 'react';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { calculateCompleteness } from './profileCompleteness';

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
  onClick?: () => void;
}

export const ProfileIndicator: React.FC<ProfileIndicatorProps> = ({
  activeProfile,
  pendingCount: _propPendingCount,
  className = '',
  compact = false,
  onClick,
}) => {
  const [vaultStats, setVaultStats] = useState({
    docs: 0,
    meds: 0,
    labs: 0,
    factsConfirmed: 0,
    pending: 0,
    caregiverLinks: 0,
  });

  const refreshStats = () => {
    try {
      const pid = activeProfile.userId;
      if (!pid) return;
      const docs = localVault.getDocuments(pid).length;
      const meds = localVault.getMedications(pid).length;
      const labs = localVault.getLabs(pid).length;
      const factsConfirmed = localVault.getConfirmedFacts(pid).length;
      const pendingFacts = localVault.getPendingFacts(pid).length;
      const pendingProps = localVault.getPendingProposals(pid).length;
      const caregiverLinks = localVault.getCaregiverLinks(pid).length;
      setVaultStats({
        docs,
        meds,
        labs,
        factsConfirmed,
        pending: pendingFacts + pendingProps,
        caregiverLinks,
      });
    } catch {  }
  };

  useEffect(() => {
    refreshStats();
    const bump = () => refreshStats();
    const u1 = eventBus.on('fact_confirmed', bump);
    const u2 = eventBus.on('medication_added', bump);
    const u3 = eventBus.on('lab_added', bump);
    const u4 = eventBus.on('caregiver_linked', bump);
    const u5 = eventBus.on('approval_resolved', bump);
    const u6 = eventBus.on('proposal_submitted', bump);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, [activeProfile.userId]);

  const completeness = useMemo(
    () => calculateCompleteness(activeProfile, vaultStats),
    [activeProfile.name, activeProfile.email, activeProfile.userId, vaultStats]
  );

  const initials = (activeProfile.name || 'P').trim().charAt(0).toUpperCase() || 'P';
  const roleLabel = activeProfile.isProxy
    ? `Proxy ${activeProfile.relationship ? `(${activeProfile.relationship})` : ''} → ${activeProfile.onBehalfOf || 'Patient'}`
    : activeProfile.role || 'patient';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  if (compact) {
    return (
      <div
        data-testid="profile-indicator"
        role="button"
        tabIndex={0}
        aria-label={`Profile ${activeProfile.name}, completeness ${completeness} percent, ${roleLabel}`}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={`inline-flex items-center gap-2 px-2.5 py-2 rounded-full bg-white border border-canvas-border shadow-sm text-xs font-semibold min-h-[44px] min-w-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 hover:bg-canvas-muted transition-colors ${className}`}
        title={`Profile completeness ${completeness}%`}
      >
        <span className="w-6 h-6 rounded-full bg-primary-light border border-primary-border flex items-center justify-center text-primary-text font-bold text-xs shrink-0">
          {initials}
        </span>
        <span className="hidden sm:inline font-bold text-slate-900 truncate max-w-[90px] sm:max-w-[110px]">{activeProfile.name}</span>
        <span className="hidden sm:flex items-center gap-1.5 ml-1">
          <span className="w-12 sm:w-16 h-1.5 bg-canvas-muted rounded-full overflow-hidden border border-canvas-border" role="progressbar" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
            <span
              className={`h-full block transition-all duration-500 ${completeness >= 80 ? 'bg-emerald-500' : completeness >= 40 ? 'bg-amber-500' : 'bg-rose-400'}`}
              style={{ width: `${completeness}%` }}
            />
          </span>
          <span className="text-slate-700 font-bold">{completeness}%</span>
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="profile-indicator"
      role="button"
      tabIndex={0}
      aria-label={`Profile ${activeProfile.name}, completeness ${completeness} percent, role ${roleLabel}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 rounded-xl bg-white border border-canvas-border shadow-sm min-h-[44px] min-w-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 hover:bg-canvas-muted transition-colors ${className}`}
    >
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center text-primary font-bold text-sm shrink-0">
        {initials}
      </div>
      <div className="hidden sm:block min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[110px] sm:max-w-[140px]">{activeProfile.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-16 sm:w-20 h-1.5 bg-canvas-muted rounded-full overflow-hidden border border-canvas-border" role="progressbar" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
            <div
              className={`h-full transition-all duration-500 ${completeness >= 80 ? 'bg-emerald-500' : completeness >= 40 ? 'bg-amber-500' : 'bg-rose-400'}`}
              style={{ width: `${completeness}%` }}
            />
          </div>
          <span className="text-caption font-bold text-slate-700">{completeness}%</span>
        </div>
      </div>
    </div>
  );
};

