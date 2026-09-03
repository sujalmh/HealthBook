import React, { useState, useEffect } from 'react';
import { HeartPulse, Sparkles } from 'lucide-react';
import { eventBus } from '@/core/events/eventBus';
import { supabaseSignIn, storeSession, ensureProfile, persistActiveProfile, purgeLegacyCredentialStores } from '@/core/supabase/auth';
import { hydrateFromSupabase } from '@/core/vault/supabaseSync';
import { localVault } from '@/core/vault/LocalVault';
import type { CreatedProfile } from './CreateAccountView';

interface SignInViewProps {
  onSignedIn: (profile: CreatedProfile) => void;
  onSwitchToCreate: () => void;
}

export const SignInView: React.FC<SignInViewProps> = ({ onSignedIn, onSwitchToCreate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [mcpPrefill, setMcpPrefill] = useState(false);

  // MCP prefill: AI prepared email — human still types password in browser (human-only)
  useEffect(() => {
    const applyPrefill = (detail: unknown) => {
      const d = detail as { email?: string; mode?: string };
      if (!d || typeof d.email !== 'string' || !d.email.trim()) return;
      if (d.mode && d.mode !== 'signin') return;
      setEmail(d.email.trim().toLowerCase());
      setMcpPrefill(true);
    };
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('healthbook_mcp_auth_pending') : null;
      if (raw) {
        const p = JSON.parse(raw) as { mode?: string; email?: string };
        if (p && p.mode === 'signin' && p.email) applyPrefill(p);
      }
    } catch { /* ignore */ }
    const onWindow = (e: Event) => applyPrefill((e as CustomEvent).detail);
    const onBus = (payload: unknown) => applyPrefill(payload);
    window.addEventListener('healthbook_mcp_auth_pending', onWindow as EventListener);
    window.addEventListener('healthbook_mcp_prefill', onWindow as EventListener);
    const off1 = eventBus.on('mcp_auth_pending' as unknown as string, onBus as unknown as () => void);
    return () => {
      window.removeEventListener('healthbook_mcp_auth_pending', onWindow as EventListener);
      window.removeEventListener('healthbook_mcp_prefill', onWindow as EventListener);
      off1();
    };
  }, []);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    const emailTrim = email.trim().toLowerCase();
    const passwordTrim = password.trim();
    if (!emailTrim) {
      eventBus.dispatchToast({ type: 'error', title: 'Email required', message: 'Please enter your email.' });
      return;
    }
    if (!passwordTrim) {
      eventBus.dispatchToast({ type: 'error', title: 'Password required', message: 'Please enter your password.' });
      return;
    }
    setIsSigningIn(true);
    try {
      // Server truth: Supabase Auth is the only identity provider. No local fallback —
      // passwords are verified server-side and never stored on this device.
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
      const profile: CreatedProfile = {
        userId: userProfile.patientId,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        isProxy: false,
        permissionLevel: userProfile.role === 'doctor' ? 'view_only' : undefined,
        createdAt: new Date().toISOString(),
      };
      persistActiveProfile(userProfile);
      try {
        if (userProfile.role === 'doctor') {
          const { hydrateDoctorLinksFromSupabase, hydratePatientsForDoctor } = await import('@/core/vault/supabaseSync');
          const links = await hydrateDoctorLinksFromSupabase(userProfile.patientId, userProfile.email, localVault);
          if (links.length > 0) {
            await hydratePatientsForDoctor(links.map((l) => l.patientId), localVault);
          }
        } else {
          await hydrateFromSupabase(userProfile.patientId, localVault);
        }
      } catch { /* non-blocking */ }
      try {
        const raw2 = localStorage.getItem('healthbook_mcp_auth_pending');
        if (raw2) {
          const p2 = JSON.parse(raw2) as { mode?: string; email?: string; pendingId?: string };
          if (p2?.email?.toLowerCase() === emailTrim.toLowerCase() && p2.mode === 'signin') {
            if (p2.pendingId) try { localStorage.removeItem(`healthbook_mcp_auth_pending_${p2.pendingId}`); } catch { /* ignore */ }
            localStorage.removeItem('healthbook_mcp_auth_pending');
            try { window.dispatchEvent(new CustomEvent('healthbook_mcp_auth_cleared')); } catch { /* ignore */ }
            try { window.dispatchEvent(new CustomEvent('healthbook_mcp_auth_completed', { detail: profile })); } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
      eventBus.dispatchToast({ type: 'success', title: 'Signed in', message: `Welcome back, ${profile.name}` });
      onSignedIn(profile);
      return;

      // No local fallback: Supabase Auth is the only identity provider (server truth).
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSignIn();
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white border border-canvas-border rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col items-center text-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <HeartPulse className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Sign In</h1>
          <p className="text-body-sm text-muted mt-1">Welcome back — sign in to continue</p>
        </div>
      </div>

      {mcpPrefill && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex gap-2.5 text-left" data-testid="mcp-prefill-banner-signin">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-caption font-bold text-emerald-800">AI helped find your account</p>
            <p className="text-caption text-emerald-700 leading-snug">Email prefilled — please type your <strong>password</strong> below to sign in. Password is never shared with AI.</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="si-email" className="text-body-sm font-semibold text-slate-800">
            Email <span className="text-rose-500">*</span>
          </label>
          <input
            id="si-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="you@example.com"
            required
            className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
            aria-label="Email"
            aria-required="true"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="si-password" className="text-body-sm font-semibold text-slate-800">
            Password <span className="text-rose-500">*</span> <span className="text-caption font-normal text-muted">(human only — never shared with AI)</span>
          </label>
          <input
            id="si-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••"
            required
            className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
            aria-label="Password — human only, never shared with AI"
            aria-required="true"
          />
          <p className="text-caption text-muted">Typed securely in browser — AI cannot see this</p>
        </div>

        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="w-full bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl px-5 py-2.5 min-h-[44px] font-bold text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 flex items-center justify-center"
          aria-label="Sign In"
        >
          {isSigningIn ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="text-center pt-2">
          <button
            onClick={onSwitchToCreate}
            className="text-body-sm font-semibold text-primary-text hover:text-primary-hover underline-offset-2 hover:underline min-h-[44px] px-2 inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
          >
            Create Account
          </button>
        </div>

        <p className="text-caption text-muted text-center leading-relaxed">
          Your records live on the secure server. Sign in to access them.
        </p>
      </div>
    </div>
  );
};

export default SignInView;
