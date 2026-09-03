import React, { useState, useEffect } from 'react';
import { HeartPulse, Sparkles } from 'lucide-react';
import { eventBus } from '@/core/events/eventBus';
import { supabaseSignUp, storeSession, ensureProfile, persistActiveProfile, purgeLegacyCredentialStores } from '@/core/supabase/auth';
import { hydrateFromSupabase } from '@/core/vault/supabaseSync';
import { localVault } from '@/core/vault/LocalVault';

export interface CreatedProfile {
  userId: string;
  name: string;
  email?: string;
  role: 'patient' | 'doctor';
  isProxy: false;
  permissionLevel?: 'view_only' | 'manage' | 'full';
  createdAt: string;
}

interface CreateAccountViewProps {
  onCreated: (profile: CreatedProfile) => void;
  onSwitchToSignIn?: () => void;
}

function truncateName(name: string, max = 64): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1).trimEnd() + '…';
}

export const CreateAccountView: React.FC<CreateAccountViewProps> = ({ onCreated, onSwitchToSignIn }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [isCreating, setIsCreating] = useState(false);
  const [mcpPrefill, setMcpPrefill] = useState(false);

  // MCP prefill: AI prepared name/email/role — human still types password in browser (human-only)
  useEffect(() => {
    const applyPrefill = (detail: unknown) => {
      const d = detail as { name?: string; email?: string; role?: string; mode?: string };
      if (!d) return;
      // Only apply create mode or generic prefill
      if (d.mode && d.mode !== 'create') return;
      let did = false;
      if (typeof d.email === 'string' && d.email.trim()) { setEmail(d.email.trim()); did = true; }
      if (typeof d.name === 'string' && d.name.trim()) { setName(d.name.trim().slice(0, 64)); did = true; }
      if (d.role === 'patient' || d.role === 'doctor') { setRole(d.role); did = true; }
      if (did) setMcpPrefill(true);
    };
    // Cold start: check pending storage (AI called before mount)
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('healthbook_mcp_auth_pending') : null;
      if (raw) {
        const p = JSON.parse(raw) as { mode?: string; name?: string; email?: string; role?: string };
        if (p && (p.mode === 'create' || !p.mode) && p.email) applyPrefill(p);
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

  const handleCreate = async () => {
    if (isCreating) return;
    // Required validation: email + password must be present
    const emailTrim = email.trim();
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
      eventBus.dispatchToast({ type: 'error', title: 'Password required', message: 'Please enter a password.' });
      return;
    }
    if (passwordTrim.length < 6) {
      eventBus.dispatchToast({ type: 'error', title: 'Password too short', message: 'Password must be at least 6 characters.' });
      return;
    }
    setIsCreating(true);
    try {
      // Validation: name optional -> default Anonymous, truncate long name
      let displayName = name.trim();
      if (!displayName) displayName = 'Anonymous';
      displayName = truncateName(displayName, 64);

      // Server truth: Supabase Auth creates the account. No local fallback —
      // passwords go to the server only and are never stored on this device.
      const { session, user, error } = await supabaseSignUp(emailTrim, passwordTrim, { name: displayName, role });
      if (error) {
        if (error.code === 'ACCOUNT_EXISTS') {
          eventBus.dispatchToast({ type: 'error', title: 'Account exists', message: 'An account with this email already exists. Please sign in.' });
          if (onSwitchToSignIn) onSwitchToSignIn();
          return;
        }
        const msg = error.code === 'WEAK_PASSWORD'
          ? 'Password does not meet requirements (min 6 characters).'
          : error.code === 'RATE_LIMITED'
            ? 'Too many attempts. Please wait a minute and try again.'
            : error.message || 'Unable to create account. Please try again.';
        eventBus.dispatchToast({ type: 'error', title: 'Sign-up failed', message: msg });
        return;
      }
      if (!user) {
        eventBus.dispatchToast({ type: 'error', title: 'Sign-up failed', message: 'Account creation returned no user. Please try again.' });
        return;
      }
      if (!session) {
        // Email confirmation required: account staged server-side; human confirms via email link.
        eventBus.dispatchToast({ type: 'info', title: 'Check your email', message: `Account created for ${displayName}. Please confirm via the email link, then sign in.` });
        if (onSwitchToSignIn) onSwitchToSignIn();
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
        eventBus.dispatchToast({ type: 'error', title: 'Sign-up failed', message: `Account created, but profile setup failed: ${profileError || 'unknown error'}` });
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
        await hydrateFromSupabase(userProfile.patientId, localVault);
      } catch { /* non-blocking */ }

      eventBus.dispatchToast({
        type: 'success',
        title: 'Account Created',
        message: `Account created for ${displayName}`,
      });

      // Clear MCP pending if this completion was via AI-assisted flow
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('healthbook_mcp_auth_pending');
          if (raw) {
            const p = JSON.parse(raw) as { mode?: string; email?: string };
            if (p?.email?.toLowerCase() === emailTrim.toLowerCase() && (p.mode === 'create' || !p.mode)) {
              const pid = (p as { pendingId?: string }).pendingId;
              if (pid) try { localStorage.removeItem(`healthbook_mcp_auth_pending_${pid}`); } catch { /* ignore */ }
              localStorage.removeItem('healthbook_mcp_auth_pending');
              try { window.dispatchEvent(new CustomEvent('healthbook_mcp_auth_cleared')); } catch { /* ignore */ }
              try { window.dispatchEvent(new CustomEvent('healthbook_mcp_auth_completed', { detail: profile })); } catch { /* ignore */ }
            }
          }
        }
      } catch { /* ignore */ }

      onCreated(profile);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white border border-canvas-border rounded-2xl p-6 shadow-sm">
      {/* Brand header */}
      <div className="flex flex-col items-center text-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <HeartPulse className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Create Account</h1>
            <p className="text-body-sm text-muted mt-1">Your health, all in one place — secured by your server account</p>
        </div>
      </div>

      {mcpPrefill && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex gap-2.5 text-left" data-testid="mcp-prefill-banner">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-caption font-bold text-emerald-800">AI helped fill your details</p>
            <p className="text-caption text-emerald-700 leading-snug">Name & email prefilled — please type your <strong>password</strong> below to finish. Password is never shared with AI.</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="cc-name" className="text-body-sm font-semibold text-slate-800">
            Name
          </label>
          <input
            id="cc-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Alex Morgan"
            maxLength={64}
            className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
            aria-label="Name"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cc-email" className="text-body-sm font-semibold text-slate-800">
            Email <span className="text-rose-500">*</span>
          </label>
          <input
            id="cc-email"
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
          <label htmlFor="cc-password" className="text-body-sm font-semibold text-slate-800">
            Password <span className="text-rose-500">*</span> <span className="text-caption font-normal text-muted">(human only — never shared with AI)</span>
          </label>
          <input
            id="cc-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••"
            required
            minLength={6}
            className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
            aria-label="Password — human only, never shared with AI"
            aria-required="true"
          />
          <p className="text-caption text-muted">At least 6 characters — typed securely in browser, AI cannot see this</p>
        </div>

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
          <p className="text-caption text-muted">{role === 'doctor' ? 'Doctors can view linked patient profiles via My Patients.' : 'Patients own their vault and can link doctors.'}</p>
        </div>

        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="w-full bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl px-5 py-2.5 min-h-[44px] font-bold text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 flex items-center justify-center"
          aria-label="Create Account"
        >
          {isCreating ? 'Creating…' : 'Create Account'}
        </button>

        <div className="text-center pt-2">
          <button
            onClick={() => {
              if (onSwitchToSignIn) onSwitchToSignIn();
              else
                eventBus.dispatchToast({
                  type: 'info',
                  title: 'Sign In',
                  message: 'Sign in will use your saved account on this device.',
                });
            }}
            className="text-body-sm font-semibold text-primary-text hover:text-primary-hover underline-offset-2 hover:underline min-h-[44px] px-2 inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
          >
            Sign In
          </button>
        </div>

        <p className="text-caption text-muted text-center leading-relaxed">
          Data stays on this device. You can add health papers after creating your account.
        </p>
      </div>
    </div>
  );
};

export default CreateAccountView;
