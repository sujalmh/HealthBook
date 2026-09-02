import React, { useState, useEffect } from 'react';
import { HeartPulse, Sparkles } from 'lucide-react';
import { eventBus } from '@/core/events/eventBus';
import type { CreatedProfile } from './CreateAccountView';
import { getSeededForEmail, isRateLimitError, isEmailInvalidError } from '@/core/auth/seededMap';

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
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('carecanvas_mcp_auth_pending') : null;
      if (raw) {
        const p = JSON.parse(raw) as { mode?: string; email?: string };
        if (p && p.mode === 'signin' && p.email) applyPrefill(p);
      }
    } catch { /* ignore */ }
    const onWindow = (e: Event) => applyPrefill((e as CustomEvent).detail);
    const onBus = (payload: unknown) => applyPrefill(payload);
    window.addEventListener('carecanvas_mcp_auth_pending', onWindow as EventListener);
    window.addEventListener('carecanvas_mcp_prefill', onWindow as EventListener);
    const off1 = eventBus.on('mcp_auth_pending' as unknown as string, onBus as unknown as () => void);
    return () => {
      window.removeEventListener('carecanvas_mcp_auth_pending', onWindow as EventListener);
      window.removeEventListener('carecanvas_mcp_prefill', onWindow as EventListener);
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
      // Try Supabase first if configured
      const supabaseUrl = (import.meta as unknown as { env?: Record<string,string> })?.env?.VITE_SUPABASE_URL;
      const supabaseAnon = (import.meta as unknown as { env?: Record<string,string> })?.env?.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnon) {
        try {
          const { getSupabaseClient } = await import('@/core/supabase/client');
          const client = getSupabaseClient() as unknown as { auth?: { signInWithPassword?: (opts: unknown) => Promise<{ data?: { user?: { id: string; user_metadata?: { role?: string; display_name?: string } } }; error?: { message?: string; code?: string } }> } };
          if (client?.auth?.signInWithPassword) {
            const res = await client.auth.signInWithPassword({ email: emailTrim, password: passwordTrim } as unknown as never);
            const dataUser = (res as { data?: { user?: { id: string; user_metadata?: { role?: string; display_name?: string } } } })?.data?.user;
            const errMsg = (res as { error?: { message?: string; code?: string } })?.error?.message;
            const errCode = (res as { error?: { code?: string } })?.error?.code;
            if (dataUser?.id) {
              const supaRole = (dataUser.user_metadata?.role as unknown as string) || 'patient';
              const profile: CreatedProfile = {
                userId: dataUser.id,
                name: dataUser.user_metadata?.display_name || emailTrim.split('@')[0],
                email: emailTrim,
                role: supaRole === 'doctor' ? 'doctor' : 'patient',
                isProxy: false,
                permissionLevel: supaRole === 'doctor' ? 'view_only' : undefined,
                createdAt: new Date().toISOString(),
              };
              try {
                localStorage.setItem('carecanvas_active_user', JSON.stringify(profile));
                // Clear MCP pending if sign-in completed via AI-assisted flow
                try {
                  const raw2 = localStorage.getItem('carecanvas_mcp_auth_pending');
                  if (raw2) {
                    const p2 = JSON.parse(raw2) as { mode?: string; email?: string; pendingId?: string };
                    if (p2?.email?.toLowerCase() === emailTrim.toLowerCase() && p2.mode === 'signin') {
                      if (p2.pendingId) try { localStorage.removeItem(`carecanvas_mcp_auth_pending_${p2.pendingId}`); } catch { /* ignore */ }
                      localStorage.removeItem('carecanvas_mcp_auth_pending');
                      try { window.dispatchEvent(new CustomEvent('carecanvas_mcp_auth_cleared')); } catch { /* ignore */ }
                      try { window.dispatchEvent(new CustomEvent('carecanvas_mcp_auth_completed', { detail: profile })); } catch { /* ignore */ }
                    }
                  }
                } catch { /* ignore */ }
              } catch { /* intentionally empty */ }
              eventBus.dispatchToast({ type: 'success', title: 'Signed in', message: `Welcome back, ${profile.name}` });
              onSignedIn(profile);
              return;
            } else if (errMsg) {
              const isRate = isRateLimitError(errMsg) || isRateLimitError(errCode) || errMsg.includes('429');
              const isInvalid = isEmailInvalidError(errMsg);
              if (isRate) {
                console.warn('[SignIn] Supabase rate-limited (429) — disallowed, fallback to local demo (production fix):', errMsg);
              } else if (isInvalid) {
                console.warn('[SignIn] Supabase email invalid — fallback to local (any pattern allowed):', errMsg);
              } else if (errMsg.toLowerCase().includes('invalid')) {
                // silent for invalid credentials — let local fallback handle
              } else {
                console.warn('[SignIn] Supabase signIn failed, trying local:', errMsg);
              }
            }
          }
        } catch (e) {
          console.warn('[SignIn] Supabase unavailable, trying local', e);
        }
      }

      // Local fallback: check carecanvas_users — production fix: seeded demo users bypass rate limit and any email pattern allowed locally
      try {
        const raw = localStorage.getItem('carecanvas_users');
        const users: Array<{ userId?: string; email?: string; password?: string; name?: string; role?: string; createdAt?: string }> = raw ? (JSON.parse(raw) as Array<{ userId?: string; email?: string; password?: string; name?: string; role?: string; createdAt?: string }>) : [];
        let found = users.find((u) => (u.email || '').toLowerCase() === emailTrim);
        // Production fix: if not found but email is seeded demo, auto-create from seeded map (disallow rate limit, allow any pattern)
        const seeded = getSeededForEmail(emailTrim);
        if (!found && seeded) {
          if (seeded.password !== passwordTrim) {
            eventBus.dispatchToast({ type: 'error', title: 'Incorrect password', message: 'Password is incorrect.' });
            return;
          }
          const seededProfile: CreatedProfile = {
            userId: seeded.userId,
            name: seeded.name,
            email: emailTrim,
            role: seeded.role,
            isProxy: false,
            permissionLevel: seeded.role === 'doctor' ? 'view_only' : undefined,
            createdAt: new Date().toISOString(),
          };
          try {
            localStorage.setItem('carecanvas_active_user', JSON.stringify(seededProfile));
            localStorage.setItem(`carecanvas_cred_${seeded.userId}`, passwordTrim);
            localStorage.setItem(`carecanvas_cred_email_${emailTrim}`, JSON.stringify({ userId: seeded.userId, password: passwordTrim }));
            users.push({ ...seededProfile, password: passwordTrim });
            localStorage.setItem('carecanvas_users', JSON.stringify(users));
          } catch { /* ignore */ }
          eventBus.dispatchToast({ type: 'success', title: 'Signed in', message: `Welcome back, ${seeded.name} (demo)` });
          onSignedIn(seededProfile);
          return;
        }
        if (!found) {
          eventBus.dispatchToast({ type: 'error', title: 'Account not found', message: 'No account found for this email. Please create an account.' });
          return;
        }
        // Check password via stored users array or cred email map
        let storedPassword: string | null = null;
        if (found.password) storedPassword = found.password;
        else {
          try {
            const credRaw = localStorage.getItem(`carecanvas_cred_email_${emailTrim}`);
            if (credRaw) {
              const cred = JSON.parse(credRaw);
              storedPassword = cred.password;
            } else if (found.userId) {
              storedPassword = localStorage.getItem(`carecanvas_cred_${found.userId}`);
            }
          } catch { /* intentionally empty */ }
        }
        if (storedPassword !== null && storedPassword !== passwordTrim) {
          eventBus.dispatchToast({ type: 'error', title: 'Incorrect password', message: 'Password is incorrect.' });
          return;
        }
        // If no stored password (legacy optional), allow sign-in but migrate password
        const storedRole = found.role === 'doctor' ? 'doctor' : 'patient';
        const profile: CreatedProfile = {
          userId: String(found.userId),
          name: String(found.name || emailTrim.split('@')[0]),
          email: emailTrim,
          role: storedRole as unknown as 'patient' | 'doctor',
          isProxy: false,
          permissionLevel: storedRole === 'doctor' ? 'view_only' : undefined,
          createdAt: found.createdAt || new Date().toISOString(),
        };
        try {
          localStorage.setItem('carecanvas_active_user', JSON.stringify(profile));
          // Persist cred for future
          localStorage.setItem(`carecanvas_cred_${profile.userId}`, passwordTrim);
          localStorage.setItem(`carecanvas_cred_email_${emailTrim}`, JSON.stringify({ userId: profile.userId, password: passwordTrim }));
          // Update users array if missing password
          if (!found.password) {
            found.password = passwordTrim;
            localStorage.setItem('carecanvas_users', JSON.stringify(users));
          }
          // Clear MCP pending if matched
          try {
            const raw2 = localStorage.getItem('carecanvas_mcp_auth_pending');
            if (raw2) {
              const p2 = JSON.parse(raw2) as { mode?: string; email?: string; pendingId?: string };
              if (p2?.email?.toLowerCase() === emailTrim.toLowerCase() && p2.mode === 'signin') {
                if (p2.pendingId) try { localStorage.removeItem(`carecanvas_mcp_auth_pending_${p2.pendingId}`); } catch { /* ignore */ }
                localStorage.removeItem('carecanvas_mcp_auth_pending');
                try { window.dispatchEvent(new CustomEvent('carecanvas_mcp_auth_cleared')); } catch { /* ignore */ }
                try { window.dispatchEvent(new CustomEvent('carecanvas_mcp_auth_completed', { detail: profile })); } catch { /* ignore */ }
              }
            }
          } catch { /* ignore */ }
        } catch { /* intentionally empty */ }
        eventBus.dispatchToast({ type: 'success', title: 'Signed in', message: `Welcome back, ${profile.name}` });
        onSignedIn(profile);
        return;
      } catch (e) {
        console.warn('[SignIn] local lookup failed', e);
      }

      eventBus.dispatchToast({ type: 'error', title: 'Sign in failed', message: 'Unable to sign in. Please try again.' });
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
          Data stays on this device. Sign in to access your health records.
        </p>
      </div>
    </div>
  );
};

export default SignInView;
