import React, { useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { eventBus } from '@/core/events/eventBus';

export interface CreatedProfile {
  userId: string;
  name: string;
  email?: string;
  role: 'patient';
  isProxy: false;
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
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      // Validation: name optional -> default Anonymous, truncate long name
      let displayName = name.trim();
      if (!displayName) displayName = 'Anonymous';
      displayName = truncateName(displayName, 64);

      let userId: string | null = null;
      let supabaseUsed = false;

      // Try Supabase Auth if configured (graceful fallback to local)
      const supabaseUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL;
      const supabaseAnon = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnon && email.trim() && password.trim()) {
        try {
          const { getSupabaseClient } = await import('@/core/supabase/client');
          const client: any = getSupabaseClient();
          if (client?.auth?.signUp) {
            const res = await client.auth.signUp({
              email: email.trim(),
              password: password.trim(),
              options: { data: { display_name: displayName } },
            });
            if (res?.data?.user?.id) {
              userId = res.data.user.id;
              supabaseUsed = true;
            } else if (res?.error) {
              // fallback to local if supabase error (e.g., offline)
              console.warn('[CreateAccount] Supabase signUp failed, fallback to local:', res.error?.message);
            }
          }
        } catch (e) {
          console.warn('[CreateAccount] Supabase unavailable, fallback to local', e);
        }
      }

      if (!userId) {
        // Local fallback
        try {
          userId = (globalThis as any).crypto?.randomUUID?.() || `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        } catch {
          userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }
      }

      const profile: CreatedProfile = {
        userId: userId!,
        name: displayName,
        email: email.trim() || undefined,
        role: 'patient',
        isProxy: false,
        createdAt: new Date().toISOString(),
      };

      // Persist active user
      try {
        localStorage.setItem('carecanvas_active_user', JSON.stringify(profile));
      } catch {}

      // Maintain users array for future sign-in
      try {
        const raw = localStorage.getItem('carecanvas_users');
        const arr: CreatedProfile[] = raw ? JSON.parse(raw) : [];
        // Avoid duplicates by userId or email
        const exists = arr.find((u) => u.userId === profile.userId || (profile.email && u.email === profile.email));
        if (!exists) {
          arr.push(profile);
          localStorage.setItem('carecanvas_users', JSON.stringify(arr));
        }
      } catch {}

      eventBus.dispatchToast({
        type: 'success',
        title: supabaseUsed ? 'Account Created' : 'Welcome to CareCanvas',
        message: supabaseUsed ? `Account created for ${displayName}` : `Account created for ${displayName}`,
      });

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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20 ring-1 ring-primary/10">
          <HeartPulse className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-900">Create Account</h1>
          <p className="text-body-sm text-muted mt-1">Your health, all in one place — private on this device</p>
        </div>
      </div>

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
            Email <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            id="cc-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="you@example.com"
            className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
            aria-label="Email"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cc-password" className="text-body-sm font-semibold text-slate-800">
            Password <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            id="cc-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••"
            className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
            aria-label="Password"
          />
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
