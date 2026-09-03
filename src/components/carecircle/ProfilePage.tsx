import React, { useEffect, useState } from 'react';
import { LogOut, Mail, CalendarDays } from 'lucide-react';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import type { ActiveProfile } from '@/App';

interface ProfilePageProps {
  activeProfile: ActiveProfile;
  onSignOut: () => void;
}

const PERMISSION_LABELS: Record<ActiveProfile['permissionLevel'], string> = {
  view_only: 'View only',
  manage: 'Can add and approve',
  full: 'Full access',
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
        caregiverLinks: localVault.getCaregiverLinks(pid).length,
      });
    } catch { /* boundary */ }
  }, [activeProfile.userId]);

  const initials = (activeProfile.name || 'P').trim().charAt(0).toUpperCase() || 'P';
  const roleLabel = ROLE_LABELS[activeProfile.role] || (activeProfile.role || 'Patient');
  const memberSince = activeProfile.createdAt
    ? new Date(activeProfile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : null;

  const handleSignOut = async () => {
    if (!confirmingSignOut) {
      setConfirmingSignOut(true);
      return;
    }
    try {
      // Consistency first: push any in-flight vault writes to the server truth.
      try {
        const { flushSync } = localVault as unknown as { flushSync?: () => Promise<{ pending: number; lastError: string | null }> };
        if (typeof flushSync === 'function') {
          const report = await flushSync();
          if (report.lastError) {
            eventBus.dispatchToast({ type: 'warning', title: 'Sync incomplete', message: 'Some changes may not have reached the server. They remain on this device.' });
          }
        }
      } catch { /* boundary */ }
      try {
        const { loadSession, supabaseSignOut, clearSession } = await import('@/core/supabase/auth.ts');
        const s = loadSession();
        if (s) await supabaseSignOut(s.access_token);
        else clearSession();
      } catch { /* boundary */ }
      try {
        localStorage.removeItem('healthbook_active_user');
      } catch { /* boundary */ }
    } catch { /* boundary */ }
    eventBus.dispatchToast({ type: 'info', title: 'Signed out', message: 'Server session ended. Your records stay safe on the server.' });
    onSignOut();
  };

  return (
    <div className="space-y-3 max-w-2xl">
      {/* Identity */}
      <section className="bg-white border border-canvas-border rounded-xl p-4 sm:p-5" aria-label="Account identity">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center text-primary-text font-bold text-lg shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-heading-lg text-slate-900 truncate">{activeProfile.name}</h2>
            <p className="text-body-sm text-muted">
              {roleLabel} • {PERMISSION_LABELS[activeProfile.permissionLevel]}
              {activeProfile.isProxy && activeProfile.onBehalfOf ? ` • for ${activeProfile.onBehalfOf}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-1.5 text-body-sm text-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
            <span className="truncate">{activeProfile.email || '— no email on file'}</span>
          </div>
          {memberSince && (
            <div className="flex items-center gap-2 min-w-0">
              <CalendarDays className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
              <span>Joined {memberSince}</span>
            </div>
          )}
        </div>
        <p className="mt-3 text-body-sm text-muted">
          {vaultStats.docs} papers • {vaultStats.meds} medicines • {vaultStats.labs} lab results
          {vaultStats.caregiverLinks > 0 ? ` • ${vaultStats.caregiverLinks} helper${vaultStats.caregiverLinks === 1 ? '' : 's'}` : ''}
        </p>
      </section>

      {/* Session */}
      <section className="bg-white border border-canvas-border rounded-xl p-4 sm:p-5" aria-label="Session">
          <p className="text-body-sm text-muted">Signed in — your records live on the secure server and sync here.</p>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
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
