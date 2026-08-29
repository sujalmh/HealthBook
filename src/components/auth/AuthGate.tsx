import React, { useEffect, useState } from 'react';
import { CreateAccountView, CreatedProfile } from './CreateAccountView';

interface AuthGateProps {
  children: (profile: CreatedProfile) => React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [profile, setProfile] = useState<CreatedProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('carecanvas_active_user');
      if (raw) {
        const parsed = JSON.parse(raw) as CreatedProfile;
        if (parsed?.userId) setProfile(parsed);
      }
    } catch {}
    setHydrated(true);
  }, []);

  const handleCreated = (p: CreatedProfile) => {
    setProfile(p);
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas-bg">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas-bg p-4">
        <CreateAccountView onCreated={handleCreated} />
      </div>
    );
  }

  return <>{children(profile)}</>;
};

export default AuthGate;
