import React, { useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { eventBus } from '@/core/events/eventBus';
import type { CreatedProfile } from './CreateAccountView';

interface SignInViewProps {
  onSignedIn: (profile: CreatedProfile) => void;
  onSwitchToCreate: () => void;
}

export const SignInView: React.FC<SignInViewProps> = ({ onSignedIn, onSwitchToCreate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

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
      const supabaseUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL;
      const supabaseAnon = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnon) {
        try {
          const { getSupabaseClient } = await import('@/core/supabase/client');
          const client: any = getSupabaseClient();
          if (client?.auth?.signInWithPassword) {
            const res = await client.auth.signInWithPassword({ email: emailTrim, password: passwordTrim });
            if (res?.data?.user?.id) {
              const profile: CreatedProfile = {
                userId: res.data.user.id,
                name: res.data.user.user_metadata?.display_name || emailTrim.split('@')[0],
                email: emailTrim,
                role: 'patient',
                isProxy: false,
                createdAt: new Date().toISOString(),
              };
              try { localStorage.setItem('carecanvas_active_user', JSON.stringify(profile)); } catch {}
              eventBus.dispatchToast({ type: 'success', title: 'Signed in', message: `Welcome back, ${profile.name}` });
              onSignedIn(profile);
              return;
            } else if (res?.error) {
              // Fall through to local check, but show if supabase error is auth-specific
              if (res.error?.message?.toLowerCase().includes('invalid')) {
                // keep as fallback error, don't return yet
              } else {
                console.warn('[SignIn] Supabase signIn failed, trying local:', res.error?.message);
              }
            }
          }
        } catch (e) {
          console.warn('[SignIn] Supabase unavailable, trying local', e);
        }
      }

      // Local fallback: check carecanvas_users
      try {
        const raw = localStorage.getItem('carecanvas_users');
        const users: any[] = raw ? JSON.parse(raw) : [];
        const found = users.find((u) => (u.email || '').toLowerCase() === emailTrim);
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
          } catch {}
        }
        if (storedPassword !== null && storedPassword !== passwordTrim) {
          eventBus.dispatchToast({ type: 'error', title: 'Incorrect password', message: 'Password is incorrect.' });
          return;
        }
        // If no stored password (legacy optional), allow sign-in but migrate password
        const profile: CreatedProfile = {
          userId: String(found.userId),
          name: String(found.name || emailTrim.split('@')[0]),
          email: emailTrim,
          role: 'patient',
          isProxy: false,
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
        } catch {}
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20 ring-1 ring-primary/10">
          <HeartPulse className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-900">Sign In</h1>
          <p className="text-body-sm text-muted mt-1">Welcome back — sign in to continue</p>
        </div>
      </div>

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
            Password <span className="text-rose-500">*</span>
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
            aria-label="Password"
            aria-required="true"
          />
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
