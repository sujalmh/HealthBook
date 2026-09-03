import React, { useEffect, useState, useCallback } from 'react';
import { HeartPulse, ShieldCheck, LogIn, UserPlus, X } from 'lucide-react';
import { eventBus } from '@/core/events/eventBus';
import { supabaseSignUp, supabaseSignIn, storeSession, ensureProfile, persistActiveProfile, purgeLegacyCredentialStores } from '@/core/supabase/auth';
import { hydrateFromSupabase } from '@/core/vault/supabaseSync';
import { localVault } from '@/core/vault/LocalVault';

interface PendingAuth {
  pendingId: string;
  mode: 'create' | 'signin';
  name?: string;
  email: string;
  role?: string;
  userId?: string;
  timestamp?: string;
}

function truncateName(name: string, max = 64): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1).trimEnd() + '…';
}

function getPending(): PendingAuth | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('healthbook_mcp_auth_pending');
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingAuth;
    if (p?.email && p?.pendingId && (p.mode === 'create' || p.mode === 'signin')) return p;
  } catch { /* ignore */ }
  return null;
}

function clearPending() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('healthbook_mcp_auth_pending');
      if (raw) {
        try {
          const p = JSON.parse(raw) as PendingAuth;
          if (p?.pendingId) localStorage.removeItem(`healthbook_mcp_auth_pending_${p.pendingId}`);
        } catch { /* ignore */ }
      }
      localStorage.removeItem('healthbook_mcp_auth_pending');
    }
  } catch { /* ignore */ }
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('healthbook_mcp_auth_cleared'));
    }
  } catch { /* ignore */ }
}

export const MCPAuthBridge: React.FC = () => {
  const [pending, setPending] = useState<PendingAuth | null>(() => getPending());
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [isBusy, setIsBusy] = useState(false);
  const [mode, setMode] = useState<'create' | 'signin'>('create');

  const isSignedIn = (() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('healthbook_active_user');
        if (raw) {
          const p = JSON.parse(raw);
          return !!p?.userId;
        }
      }
    } catch { /* ignore */ }
    return false;
  })();

  const refresh = useCallback(() => {
    const p = getPending();
    if (p) {
      setPending(p);
      setMode(p.mode);
      setName(p.name || '');
      setEmail(p.email || '');
      setRole(p.role === 'doctor' ? 'doctor' : 'patient');
      setPassword('');
    } else {
      setPending(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onPending = (e: Event) => {
      const detail = (e as CustomEvent).detail as PendingAuth | undefined;
      if (detail?.pendingId) {
        setPending(detail);
        setMode(detail.mode);
        setName(detail.name || '');
        setEmail(detail.email || '');
        setRole(detail.role === 'doctor' ? 'doctor' : 'patient');
        setPassword('');
      } else {
        refresh();
      }
    };
    const onClear = () => setPending(null);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'healthbook_mcp_auth_pending' || e.key === null) refresh();
    };

    // eventBus pending
    const off1 = eventBus.on('mcp_auth_pending' as unknown as string, onPending as unknown as () => void);
    // window events
    window.addEventListener('healthbook_mcp_auth_pending', onPending as EventListener);
    window.addEventListener('healthbook_mcp_auth_cleared', onClear as EventListener);
    window.addEventListener('healthbook_mcp_prefill', onPending as EventListener);
    window.addEventListener('storage', onStorage as unknown as EventListener);

    return () => {
      off1();
      window.removeEventListener('healthbook_mcp_auth_pending', onPending as EventListener);
      window.removeEventListener('healthbook_mcp_auth_cleared', onClear as EventListener);
      window.removeEventListener('healthbook_mcp_prefill', onPending as EventListener);
      window.removeEventListener('storage', onStorage as unknown as EventListener);
    };
  }, [refresh]);

  // Also watch localStorage polling for jsdom fallback
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = getPending();
      if (p?.pendingId !== pending?.pendingId) refresh();
      if (!p && pending) setPending(null);
    }, 1500);
    return () => window.clearInterval(id);
  }, [pending, refresh]);

  const handleClose = useCallback(() => {
    clearPending();
    setPending(null);
    setPassword('');
    eventBus.dispatchToast({ type: 'info', title: 'Cancelled', message: 'AI-assisted sign-up cancelled. You can still create an account manually.' });
  }, []);

  const handleCreate = async () => {
    if (isBusy) return;
    const emailTrim = email.trim().toLowerCase();
    const passwordTrim = password.trim();
    if (!emailTrim) {
      eventBus.dispatchToast({ type: 'error', title: 'Email required', message: 'Please enter your email address.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      eventBus.dispatchToast({ type: 'error', title: 'Invalid email', message: 'Please enter a valid email address.' });
      return;
    }
    if (!passwordTrim) {
      eventBus.dispatchToast({ type: 'error', title: 'Password required', message: 'Please type your password in the secure password field. Password is never shared with AI.' });
      return;
    }
    if (passwordTrim.length < 6) {
      eventBus.dispatchToast({ type: 'error', title: 'Password too short', message: 'Password must be at least 6 characters.' });
      return;
    }
    setIsBusy(true);
    try {
      let displayName = name.trim();
      if (!displayName) displayName = 'Anonymous';
      displayName = truncateName(displayName, 64);

      // Server truth: Supabase Auth only. No local fallback —
      // passwords go to the server and are never stored on this device.
      const { session, user, error } = await supabaseSignUp(emailTrim, passwordTrim, { name: displayName, role });
      if (error) {
        if (error.code === 'ACCOUNT_EXISTS') {
          eventBus.dispatchToast({ type: 'error', title: 'Account exists', message: 'An account with this email already exists. Please sign in.' });
          return;
        }
        eventBus.dispatchToast({ type: 'error', title: 'Sign-up failed', message: error.message || 'Unable to create account.' });
        return;
      }
      if (!user || !session) {
        if (!session && user) {
          eventBus.dispatchToast({ type: 'info', title: 'Check your email', message: `Account created for ${displayName}. Confirm via the email link, then sign in.` });
          clearPending();
          setPending(null);
          setPassword('');
          return;
        }
        eventBus.dispatchToast({ type: 'error', title: 'Sign-up failed', message: 'Account creation failed. Please try again.' });
        return;
      }
      storeSession(session);
      const { profile: userProfile, error: profileError } = await ensureProfile({
        token: session.access_token,
        authUserId: user.id,
        email: emailTrim,
        name: displayName,
        role,
      });
      if (profileError || !userProfile) {
        eventBus.dispatchToast({ type: 'error', title: 'Sign-up failed', message: `Profile setup failed: ${profileError || 'unknown error'}` });
        return;
      }
      purgeLegacyCredentialStores();
      const profile = {
        userId: userProfile.patientId,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        isProxy: false as const,
        permissionLevel: userProfile.role === 'doctor' ? 'view_only' : undefined,
        createdAt: new Date().toISOString(),
      };
      persistActiveProfile(userProfile);
      try {
        await hydrateFromSupabase(userProfile.patientId, localVault);
      } catch { /* non-blocking */ }

      eventBus.dispatchToast({
        type: 'success',
        title: 'Account Created',
        message: `Account created for ${displayName} — signed in.`,
      });

      // Notify App.tsx to hydrate
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('healthbook_mcp_auth_completed', { detail: profile }));
          window.dispatchEvent(new CustomEvent('healthbook_auth_completed', { detail: profile }));
        }
      } catch { /* ignore */ }
      try {
        eventBus.emit('mcp_auth_completed' as unknown as string, profile as unknown as never);
      } catch { /* ignore */ }

      clearPending();
      setPending(null);
      setPassword('');

      // Also reload-ish via event — App will pick up via storage or custom event
      // For cold start, App's gate will close and show main content via state update
      // Dispatch a storage event fallback
      try {
        if (typeof window !== 'undefined') {
          // Force App to re-read by dispatching a synthetic storage event
          window.dispatchEvent(new StorageEvent('storage', { key: 'healthbook_active_user', newValue: JSON.stringify(profile) } as unknown as StorageEventInit));
        }
      } catch { /* ignore */ }

      // If still on gate (no activeProfile), do a gentle reload to let App hydrate
      setTimeout(() => {
        try {
          if (typeof window !== 'undefined' && !document.querySelector('[data-testid="mcp-bridge-success"]')) {
            // No need to reload if App already updated via event — but ensure
            const raw = localStorage.getItem('healthbook_active_user');
            if (raw) window.location.reload();
          }
        } catch { /* ignore */ }
      }, 400);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignIn = async () => {
    if (isBusy) return;
    const emailTrim = email.trim().toLowerCase();
    const passwordTrim = password.trim();
    if (!emailTrim) {
      eventBus.dispatchToast({ type: 'error', title: 'Email required', message: 'Please enter your email.' });
      return;
    }
    if (!passwordTrim) {
      eventBus.dispatchToast({ type: 'error', title: 'Password required', message: 'Please type your password in the secure password field. Password is never shared with AI.' });
      return;
    }
    setIsBusy(true);
    try {
      // Server truth: Supabase Auth only. No local fallback.
      const { session, error } = await supabaseSignIn(emailTrim, passwordTrim);
      if (error || !session) {
        const msg = error?.code === 'INVALID_CREDENTIALS'
          ? 'Incorrect email or password.'
          : error?.code === 'EMAIL_NOT_CONFIRMED'
            ? 'Please confirm your email, then sign in.'
            : error?.code === 'RATE_LIMITED'
              ? 'Too many attempts. Please wait a minute and try again.'
              : error?.message || 'Unable to sign in. Please try again.';
        eventBus.dispatchToast({ type: 'error', title: 'Sign in failed', message: msg });
        return;
      }
      storeSession(session);
      const authUser = session.user;
      const serverRole = authUser.user_metadata?.role === 'doctor' ? 'doctor' : 'patient';
      const { profile: userProfile, error: profileError } = await ensureProfile({
        token: session.access_token,
        authUserId: authUser.id,
        email: emailTrim,
        name: authUser.user_metadata?.display_name || emailTrim.split('@')[0],
        role: serverRole as 'patient' | 'doctor',
      });
      if (profileError || !userProfile) {
        eventBus.dispatchToast({ type: 'error', title: 'Sign in failed', message: `Signed in, but profile setup failed: ${profileError || 'unknown error'}` });
        return;
      }
      purgeLegacyCredentialStores();
      const profile = {
        userId: userProfile.patientId,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        isProxy: false as const,
        permissionLevel: userProfile.role === 'doctor' ? 'view_only' : undefined,
        createdAt: new Date().toISOString(),
      };
      persistActiveProfile(userProfile);
      try {
        await hydrateFromSupabase(userProfile.patientId, localVault);
      } catch { /* non-blocking */ }
        eventBus.dispatchToast({ type: 'success', title: 'Signed in', message: `Welcome back, ${profile.name}` });
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('healthbook_mcp_auth_completed', { detail: profile }));
          }
        } catch { /* ignore */ }
        clearPending();
        setPending(null);
        setPassword('');
        setTimeout(() => { try { window.location.reload(); } catch { /* ignore */ } }, 300);
        return;
    } finally {
      setIsBusy(false);
    }
  };

  // Only show modal when pending exists AND user is already signed in (gate handles cold start)
  // For cold start, we still want to highlight but not duplicate — gate view prefills, so bridge can be hidden when not signed in.
  // However to ensure onboarding easier, we show bridge also when not signed in if gate not handling? Decide: hide when not signed in.
  const shouldShowModal = !!pending && isSignedIn;

  // Also show in cold start if pending exists but gate is hidden? Check if activeProfile missing — then gate is visible, so skip modal.
  // If pending exists and isSignedIn===false, don't show modal (let gate handle). But ensure prefill dispatched.
  if (!pending) return null;

  // If not signed in, don't render modal — gate view will prefill via window event
  // Instead just render a subtle banner? We return null and rely on gate.
  // But we keep a tiny toast already dispatched, so no modal needed.
  if (!isSignedIn) {
    // Still render a small non-blocking indicator that AI prepared sign-up — handled via toast, no modal.
    return null;
  }

  // Signed-in case: show modal to complete second account / switch
  const isCreate = mode === 'create';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label={isCreate ? 'Complete account creation' : 'Complete sign in'}>
      <div className="w-full max-w-md bg-white border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-slate-900 truncate">{isCreate ? 'Complete Sign-Up' : 'Complete Sign-In'}</h2>
              <p className="text-caption text-muted leading-snug">AI prepared your details — please type your password to finish</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-canvas-muted text-muted hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-caption font-bold text-amber-800">Password is human-only</p>
            <p className="text-caption text-amber-700 leading-snug">Your password is never shared with AI. Type it securely in the password field below.</p>
          </div>
        </div>

        <div className="space-y-4">
          {isCreate && (
            <div className="space-y-1.5">
              <label htmlFor="mcp-bridge-name" className="text-body-sm font-semibold text-slate-800">Name</label>
              <input
                id="mcp-bridge-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
                placeholder="e.g. Alex Morgan"
                className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                aria-label="Name"
              />
              <p className="text-caption text-muted">AI prefilled — you can edit</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="mcp-bridge-email" className="text-body-sm font-semibold text-slate-800">
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              id="mcp-bridge-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
              aria-label="Email"
              aria-required="true"
            />
            <p className="text-caption text-muted">AI prefilled — verify it is correct</p>
          </div>

          {isCreate && (
            <div className="space-y-1.5">
              <label className="text-body-sm font-semibold text-slate-800">I am a</label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Role">
                <button
                  type="button"
                  role="radio"
                  aria-checked={role === 'patient'}
                  onClick={() => setRole('patient')}
                  className={`px-3 py-2.5 rounded-xl text-sm font-bold border min-h-[44px] transition-colors ${role === 'patient' ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-700 border-canvas-border hover:bg-canvas-muted'}`}
                >
                  Patient
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={role === 'doctor'}
                  onClick={() => setRole('doctor')}
                  className={`px-3 py-2.5 rounded-xl text-sm font-bold border min-h-[44px] transition-colors ${role === 'doctor' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-700 border-canvas-border hover:bg-canvas-muted'}`}
                >
                  Doctor
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="mcp-bridge-password" className="text-body-sm font-semibold text-slate-800">
              Password <span className="text-rose-500">*</span> <span className="text-caption font-normal text-muted">(human only)</span>
            </label>
            <input
              id="mcp-bridge-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') isCreate ? handleCreate() : handleSignIn(); }}
              placeholder="••••••••"
              required
              minLength={6}
              autoFocus
              className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-xl text-sm text-slate-900 placeholder:text-muted focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 min-h-[44px] bg-amber-50/30"
              aria-label="Password — human only, never shared with AI"
              aria-required="true"
            />
            <p className="text-caption text-amber-700 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 shrink-0" /> Secure browser field — AI cannot see this
            </p>
            {isCreate && <p className="text-caption text-muted">At least 6 characters</p>}
          </div>

          <button
            onClick={isCreate ? handleCreate : handleSignIn}
            disabled={isBusy}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl px-5 py-2.5 min-h-[44px] font-bold text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 flex items-center justify-center gap-2"
            aria-label={isCreate ? 'Create Account' : 'Sign In'}
            data-testid="mcp-bridge-submit"
          >
            {isBusy ? (
              'Please wait…'
            ) : isCreate ? (
              <>
                <UserPlus className="w-4 h-4" /> Create Account
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Sign In
              </>
            )}
          </button>

          <button
            onClick={handleClose}
            className="w-full bg-white hover:bg-canvas-muted text-slate-700 border border-canvas-border rounded-xl px-5 py-2.5 min-h-[44px] font-bold text-sm transition-colors"
          >
            Cancel
          </button>

          <div className="text-center pt-1">
            <p className="text-caption text-muted leading-relaxed">
              {isCreate
                ? 'Records live on the secure server. AI helped fill name & email — you finish with password.'
                : 'AI helped find your account — you finish by typing your password.'}
            </p>
            <p className="text-caption text-muted mt-1" data-testid="mcp-bridge-success" hidden>Bridge ready</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCPAuthBridge;
