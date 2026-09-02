import React, { useEffect, useMemo, useState } from 'react';
import { LogOut, Mail, ShieldCheck, CalendarDays, User as UserIcon, KeyRound } from 'lucide-react';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { calculateCompleteness } from './profileCompleteness';
import type { ActiveProfile } from '@/App';

interface ProfilePageProps {
  activeProfile: ActiveProfile;
  onSignOut: () => void;
}

const PERMISSION_LABELS: Record<ActiveProfile['permissionLevel'], string> = {
  view_only: 'View only — can look, cannot approve',
  manage: 'Manage — can add and approve on your behalf',
  full: 'Full — owns this account',
};

const ROLE_LABELS: Record<string, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  caregiver: 'Family caregiver',
  self: 'Patient',
  mother: 'Family caregiver',
  child: 'Family caregiver',
};

/**
 * ProfilePage — full-page profile opened from the header profile chip.
 * Account identity, access/permissions, vault data summary, and sign out.
 * Replaces the old ProfileDetails modal.
 */
export const ProfilePage: React.FC<ProfilePageProps> = ({ activeProfile, onSignOut }) => {
  const [vaultStats, setVaultStats] = useState({
    docs: 0,
    meds: 0,
    labs: 0,
    factsConfirmed: 0,
    caregiverLinks: 0,
  });
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  useEffect(() => {
    try {
      const pid = activeProfile.userId;
      if (!pid) return;
      setVaultStats({
        docs: localVault.getDocuments(pid).length,
        meds: localVault.getMedications(pid).length,
        labs: localVault.getLabs(pid).length,
        factsConfirmed: localVault.getConfirmedFacts(pid).length,
        caregiverLinks: localVault.getCaregiverLinks(pid).length,
      });
    } catch { /* boundary */ }
  }, [activeProfile.userId]);

  const completeness = useMemo(
    () => calculateCompleteness(activeProfile, vaultStats),
    [activeProfile.name, activeProfile.email, activeProfile.userId, vaultStats]
  );

  const initials = (activeProfile.name || 'P').trim().charAt(0).toUpperCase() || 'P';
  const roleLabel = ROLE_LABELS[activeProfile.role] || (activeProfile.role || 'Patient');
  const memberSince = activeProfile.createdAt
    ? new Date(activeProfile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const handleSignOut = () => {
    if (!confirmingSignOut) {
      setConfirmingSignOut(true);
      return;
    }
    try {
      localStorage.removeItem('carecanvas_active_user');
    } catch { /* boundary */ }
    eventBus.dispatchToast({ type: 'info', title: 'Signed out', message: 'This device no longer holds an active session. Your data stays on it.' });
    onSignOut();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Identity */}
      <section className="bg-white border border-canvas-border rounded-xl p-4 sm:p-5" aria-label="Account identity">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center text-primary-text font-bold text-xl shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-heading-lg text-slate-900 truncate">{activeProfile.name}</h2>
            <p className="text-body-sm text-muted">
              {roleLabel}
              {activeProfile.isProxy && activeProfile.onBehalfOf
                ? ` — acting on behalf of ${activeProfile.onBehalfOf}`
                : ''}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-body-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            <dt className="sr-only">Email</dt>
            <dd className="truncate text-slate-800">{activeProfile.email || '— no email on file'}</dd>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            <dt className="sr-only">Member since</dt>
            <dd className="text-slate-800">{memberSince ? `Joined ${memberSince}` : 'Joining date not recorded'}</dd>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <UserIcon className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            <dt className="sr-only">User ID</dt>
            <dd className="truncate font-mono text-xs text-slate-600">{activeProfile.userId}</dd>
          </div>
        </dl>
      </section>

      {/* Access & permissions */}
      <section className="bg-white border border-canvas-border rounded-xl p-4 sm:p-5" aria-label="Access and permissions">
        <h3 className="text-heading-md text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary-text" aria-hidden="true" />
          Access &amp; permissions
        </h3>
        <div className="mt-3 space-y-2.5 text-body-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted">Role</span>
            <span className="font-semibold text-slate-800 text-right">{roleLabel}</span>
          </div>
          {activeProfile.isProxy && (
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted">Acting on behalf of</span>
              <span className="font-semibold text-slate-800 text-right">
                {activeProfile.onBehalfOf || '—'}
                {activeProfile.relationship ? ` (${activeProfile.relationship})` : ''}
              </span>
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted">Permission level</span>
            <span className={`font-semibold text-right ${activeProfile.permissionLevel === 'view_only' ? 'text-amber-800' : 'text-slate-800'}`}>
              {PERMISSION_LABELS[activeProfile.permissionLevel]}
            </span>
          </div>
        </div>
      </section>

      {/* Your data */}
      <section className="bg-white border border-canvas-border rounded-xl p-4 sm:p-5" aria-label="Your data">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-heading-md text-slate-900">Your data</h3>
          <span className="text-body-sm font-semibold text-slate-700">{completeness}% complete</span>
        </div>
        <div
          className="mt-3 h-2 bg-canvas-muted rounded-full overflow-hidden border border-canvas-border"
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
        <p className="mt-3 text-body-sm text-muted">
          {vaultStats.docs} papers • {vaultStats.meds} medicines • {vaultStats.labs} lab results • {vaultStats.factsConfirmed} confirmed facts
          {vaultStats.caregiverLinks > 0 ? ` • ${vaultStats.caregiverLinks} family helper${vaultStats.caregiverLinks === 1 ? '' : 's'}` : ''}
        </p>
      </section>

      {/* Session */}
      <section className="bg-white border border-canvas-border rounded-xl p-4 sm:p-5" aria-label="Session">
        <h3 className="text-heading-md text-slate-900 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary-text" aria-hidden="true" />
          Session
        </h3>
        <p className="mt-2 text-body-sm text-muted">
          You are signed in on this device. Your health data stays on this device — signing out does not delete it.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={handleSignOut}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-body-sm font-semibold min-h-[44px] transition-colors focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 focus-visible:outline-none ${
              confirmingSignOut
                ? 'bg-rose-700 text-white hover:bg-rose-800'
                : 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-50'
            }`}
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            {confirmingSignOut ? 'Tap again to confirm sign out' : 'Sign out'}
          </button>
          {confirmingSignOut && (
            <button
              type="button"
              onClick={() => setConfirmingSignOut(false)}
              className="text-body-sm font-semibold text-slate-600 hover:text-slate-900 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none rounded-lg px-2"
            >
              Cancel
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
