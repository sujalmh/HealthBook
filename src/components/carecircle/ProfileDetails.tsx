import React, { useEffect, useState, useMemo } from 'react';
import { localVault } from '@/core/vault/LocalVault';
import { calculateCompleteness } from './profileCompleteness';

interface ProfileDetailsProps {
  isOpen: boolean;
  onClose: () => void;
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
}

/**
 * ProfileDetails — minimal details surface for header profile
 * Hidden by default, visible after click, dismissible via Close and Esc
 * Contains only name + avatar + bar + percent + vault counts (docs/meds/labs/helpers)
 * No sign-out per Q2
 */
export const ProfileDetails: React.FC<ProfileDetailsProps> = ({ isOpen, onClose, activeProfile }) => {
  const [vaultStats, setVaultStats] = useState({
    docs: 0,
    meds: 0,
    labs: 0,
    factsConfirmed: 0,
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
      const caregiverLinks = localVault.getCaregiverLinks(pid).length;
      setVaultStats({ docs, meds, labs, factsConfirmed, caregiverLinks });
    } catch { /* boundary */ }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshStats();
  }, [isOpen, activeProfile.userId]);

  const completeness = useMemo(
    () => calculateCompleteness(activeProfile, vaultStats),
    [activeProfile.name, activeProfile.email, activeProfile.userId, vaultStats]
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const initials = (activeProfile.name || 'P').trim().charAt(0).toUpperCase() || 'P';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        data-testid="profile-details-backdrop"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profile details"
        className="relative bg-white rounded-2xl shadow-xl border border-canvas-border p-5 w-[360px] max-w-[90vw] animate-fade-in"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-full hover:bg-canvas-muted text-slate-600 hover:text-slate-900 border border-transparent hover:border-canvas-border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <span aria-hidden="true" className="text-lg leading-none">×</span>
        </button>

        <div className="flex items-center gap-3 pr-6">
          <div className="w-10 h-10 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{activeProfile.name}</p>
            <p className="text-caption text-muted truncate">{activeProfile.role || 'patient'}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div
            className="flex-1 h-2 bg-canvas-muted rounded-full overflow-hidden border border-canvas-border"
            role="progressbar"
            aria-valuenow={completeness}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completeness"
          >
            <div
              className={`h-full transition-all duration-500 ${completeness >= 80 ? 'bg-emerald-500' : completeness >= 40 ? 'bg-amber-500' : 'bg-rose-400'}`}
              style={{ width: `${completeness}%` }}
            />
          </div>
          <span className="text-sm font-bold text-slate-700">{completeness}%</span>
        </div>
        <p className="text-caption font-medium text-muted mt-1">{completeness}% complete</p>

        <p className="text-caption text-muted mt-3 truncate">
          {vaultStats.docs} papers • {vaultStats.meds} meds • {vaultStats.labs} labs{vaultStats.caregiverLinks > 0 ? ` • ${vaultStats.caregiverLinks} helper${vaultStats.caregiverLinks === 1 ? '' : 's'}` : ''} • {vaultStats.factsConfirmed} confirmed
        </p>
      </div>
    </div>
  );
};
