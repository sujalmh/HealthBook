import React, { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  HelpCircle,
  Terminal,
  HeartPulse,
  Pill,
  FileCheck2,
  Users,
  FolderLock,
  AlertTriangle,
  LogOut,
  Plug,
} from 'lucide-react';
import { PrivacyBadge } from '@/components/common/PrivacyBadge';
import { QuestionBank } from '@/components/common/QuestionBank';
import { WebMCPInspector } from '@/components/common/WebMCPInspector';
import { ConnectWebMCPModal } from '@/components/common/ConnectWebMCPModal';
import { ModalPortal } from '@/components/common/ModalPortal';
import { ToastContainer } from '@/components/common/ToastContainer';
import { BoundingBoxViewer } from '@/components/common/BoundingBoxViewer';
import { DocumentDropzone } from '@/components/vault/DocumentDropzone';
import { FactStreamView } from '@/components/vault/FactStreamView';
import { LabStoryView } from '@/components/labstory/LabStoryView';
import { PillMapView } from '@/components/pillmap/PillMapView';
import { RxBridgeView } from '@/components/rxbridge/RxBridgeView';
import { HomeLabView } from '@/components/homelab/HomeLabView';
import { SafetyView } from '@/components/safety/SafetyView';
import { CareCircleView } from '@/components/carecircle/CareCircleView';
import { DossierView } from '@/components/dossier/DossierView';
import { CreateAccountView } from '@/components/auth/CreateAccountView';
import { SignInView } from '@/components/auth/SignInView';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

export type ActiveModule = 'vault' | 'labstory' | 'pillmap' | 'rxbridge' | 'homelab' | 'safety' | 'carecircle' | 'dossier';

export interface ActiveProfile {
  userId: string;
  name: string;
  role: string;
  isProxy: boolean;
  relationship?: string;
  onBehalfOf?: string;
  permissionLevel: 'view_only' | 'manage' | 'full';
  email?: string;
  createdAt?: string;
}

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ActiveModule>('vault');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<ActiveProfile | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [authMode, setAuthMode] = useState<'create' | 'signin'>('create');
  const [pendingCount, setPendingCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const navContainerRef = React.useRef<HTMLDivElement | null>(null);
  const navItemRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const checkScrollPositions = () => {
    const el = navContainerRef.current;
    if (!el) return;
    const sl = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(sl > 4);
    setCanScrollRight(sl < max - 4);
  };

  useEffect(() => {
    const el = navContainerRef.current;
    if (!el) return;
    checkScrollPositions();
    el.addEventListener('scroll', checkScrollPositions, { passive: true });
    window.addEventListener('resize', checkScrollPositions, { passive: true });
    return () => {
      el.removeEventListener('scroll', checkScrollPositions);
      window.removeEventListener('resize', checkScrollPositions);
    };
  }, [isHydrated, activeProfile]);

  // Auto-scroll active tab into view on change
  useEffect(() => {
    const activeEl = navItemRefs.current[activeModule];
    if (activeEl && navContainerRef.current) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
      const timer = setTimeout(checkScrollPositions, 350);
      return () => clearTimeout(timer);
    }
  }, [activeModule]);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('carecanvas_active_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.userId) {
          const normalized: ActiveProfile = {
            userId: String(parsed.userId),
            name: String(parsed.name || 'Anonymous').slice(0, 64) || 'Anonymous',
            role: parsed.role || 'patient',
            isProxy: !!parsed.isProxy,
            relationship: parsed.relationship,
            onBehalfOf: parsed.onBehalfOf,
            permissionLevel: parsed.permissionLevel || 'manage',
            email: parsed.email,
            createdAt: parsed.createdAt,
          };
          setActiveProfile(normalized);
        }
      }
    } catch {}
    setIsHydrated(true);
  }, []);

  // Unified pending/question counts — single source of truth for header badges.
  const refreshCounts = async () => {
    if (!activeProfile?.userId) {
      setPendingCount(0);
      setQuestionCount(0);
      return;
    }
    const pendingFacts = await localVault.getPendingFacts(activeProfile.userId);
    const pendingProps = await localVault.getPendingProposals(activeProfile.userId);
    const questions = await localVault.getQuestionBankItems(activeProfile.userId);
    setPendingCount(pendingFacts.length + pendingProps.length);
    setQuestionCount(questions.filter((q) => q.status === 'active').length);
  };

  useEffect(() => {
    refreshCounts();
    const u1 = eventBus.on('fact_extracted', refreshCounts);
    const u2 = eventBus.on('fact_confirmed', refreshCounts);
    const u3 = eventBus.on('proposal_submitted', refreshCounts);
    const u4 = eventBus.on('approval_resolved', refreshCounts);
    const u5 = eventBus.on('question_bank', refreshCounts);

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [activeProfile?.userId]);

  const handleCreated = (profile: any) => {
    const normalized: ActiveProfile = {
      userId: String(profile.userId),
      name: String(profile.name || 'Anonymous').slice(0, 64) || 'Anonymous',
      role: profile.role || 'patient',
      isProxy: !!profile.isProxy,
      relationship: profile.relationship,
      onBehalfOf: profile.onBehalfOf,
      permissionLevel: profile.permissionLevel || 'manage',
      email: profile.email,
      createdAt: profile.createdAt,
    };
    setActiveProfile(normalized);
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem('carecanvas_active_user');
    } catch {}
    setActiveProfile(null);
    setPendingCount(0);
    setQuestionCount(0);
    eventBus.dispatchToast({
      type: 'info',
      title: 'Signed out',
      message: 'Session cleared. Create an account or sign in again.',
    });
  };

  const handleSwitchProfile = (role: 'patient' | 'caregiver' | 'self' | 'mother' | 'child') => {
    if (!activeProfile) return;
    if (role === 'caregiver' || role === 'mother') {
      const links = (() => {
        try { return localVault.getCaregiverLinks(activeProfile.userId); } catch { return []; }
      })();
      if (links.length === 0) {
        eventBus.dispatchToast({
          type: 'info',
          title: 'No family helpers linked',
          message: 'Add a family member in Family → Manage Access before switching to proxy mode. No mock profile shown.',
        });
        return;
      }
      const baseName = activeProfile.isProxy ? activeProfile.onBehalfOf || activeProfile.name : activeProfile.name;
      const next: ActiveProfile = {
        ...activeProfile,
        name: 'Family member',
        role: 'caregiver',
        isProxy: true,
        relationship: 'son',
        onBehalfOf: baseName,
        permissionLevel: 'manage',
      };
      setActiveProfile(next);
      eventBus.dispatchToast({
        type: 'info',
        title: 'Proxy Mode Active',
        message: `Switched to ${next.name} (son) acting on behalf of ${baseName}.`,
      });
    } else if (role === 'child') {
      const links = (() => {
        try { return localVault.getCaregiverLinks(activeProfile.userId); } catch { return []; }
      })();
      if (links.length === 0) {
        eventBus.dispatchToast({
          type: 'info',
          title: 'No family helpers linked',
          message: 'Add a family member in Family → Manage Access before switching to proxy mode. No mock profile shown.',
        });
        return;
      }
      const next: ActiveProfile = {
        ...activeProfile,
        name: 'Family member',
        role: 'caregiver',
        isProxy: true,
        relationship: 'father',
        onBehalfOf: 'Child',
        permissionLevel: 'manage',
      };
      setActiveProfile(next);
      eventBus.dispatchToast({
        type: 'info',
        title: 'Proxy Mode Active',
        message: `Switched to ${next.name} acting on behalf of ${next.onBehalfOf} (child).`,
      });
    } else {
      // Back to patient — restore from stored original
      try {
        const raw = localStorage.getItem('carecanvas_active_user');
        if (raw) {
          const stored = JSON.parse(raw);
          const restored: ActiveProfile = {
            userId: String(stored.userId),
            name: String(stored.name || 'Anonymous').slice(0, 64) || 'Anonymous',
            role: 'patient',
            isProxy: false,
            relationship: undefined,
            onBehalfOf: undefined,
            permissionLevel: 'manage',
            email: stored.email,
            createdAt: stored.createdAt,
          };
          setActiveProfile(restored);
          eventBus.dispatchToast({
            type: 'info',
            title: 'Patient Profile',
            message: `Active profile: ${restored.name} (Primary Patient).`,
          });
          return;
        }
      } catch {}
      const fallback: ActiveProfile = {
        ...activeProfile,
        role: 'patient',
        isProxy: false,
        relationship: undefined,
        onBehalfOf: undefined,
        permissionLevel: 'manage',
      };
      setActiveProfile(fallback);
      eventBus.dispatchToast({
        type: 'info',
        title: 'Patient Profile',
        message: `Active profile: ${fallback.name} (Primary Patient).`,
      });
    }
  };

  const navItems = [
    { id: 'vault', label: 'My Records', shortLabel: 'Records', icon: Shield, badge: pendingCount > 0 ? `${pendingCount}` : null },
    { id: 'labstory', label: 'Lab Results', shortLabel: 'Labs', icon: Activity },
    { id: 'pillmap', label: 'My Medicines', shortLabel: 'Meds', icon: Pill },
    { id: 'rxbridge', label: 'Medicine Review', shortLabel: 'Review', icon: FileCheck2 },
    { id: 'homelab', label: 'Tests to Do', shortLabel: 'Tests', icon: HeartPulse },
    { id: 'safety', label: 'Get Help', shortLabel: 'Help', icon: AlertTriangle },
    { id: 'carecircle', label: 'Family', shortLabel: 'Family', icon: Users },
    { id: 'dossier', label: 'For My Doctor', shortLabel: 'Doctor', icon: FolderLock },
  ];

  // Semantic primary tokens — indigo light palette (tokenized, no hard hex)
  const pastelActive = 'bg-primary-light text-primary-text border-primary-border shadow-sm';
  const pastelIconActive = 'text-primary-text';
  const pastelIconIdle = 'text-muted';

  // Loading / hydration gate
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas-bg">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-label="Loading" />
      </div>
    );
  }

  // Create Account / Sign In Gate — cold start with no user must show centered auth view, not vault grids
  // Automatically signs in if auth token (carecanvas_active_user) was saved — handled by restore useEffect above
  if (!activeProfile) {
    return (
      <div className="min-h-screen flex flex-col bg-canvas-bg">
        <div className="flex-1 flex items-center justify-center p-4">
          {authMode === 'create' ? (
            <CreateAccountView onCreated={handleCreated} onSwitchToSignIn={() => setAuthMode('signin')} />
          ) : (
            <SignInView onSignedIn={handleCreated} onSwitchToCreate={() => setAuthMode('create')} />
          )}
        </div>
        <ToastContainer />
      </div>
    );
  }

  // Derive display initials for proxy switcher (generic, no hardcode)
  const patientInitial = activeProfile.isProxy && activeProfile.onBehalfOf
    ? activeProfile.onBehalfOf.slice(0, 1).toUpperCase()
    : activeProfile.name.slice(0, 1).toUpperCase();
  const patientShort = activeProfile.isProxy && activeProfile.onBehalfOf
    ? activeProfile.onBehalfOf.split(' ')[0].slice(0, 6) || 'Patient'
    : activeProfile.name.split(' ')[0].slice(0, 8) || 'Patient';

  return (
    <div className="min-h-screen bg-canvas-bg text-slate-900 flex flex-col antialiased w-full max-w-full overflow-x-hidden">
      {/* Top Application Bar — glass, soft shadow, tokenized */}
      <header className="border-b border-canvas-border bg-white/95 backdrop-blur-md sticky top-0 z-40 px-2.5 sm:px-6 py-2.5 sm:py-3 shadow-sm w-full max-w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-4">
          {/* Logo & Subtitle — refined typography, token gradient */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20 shrink-0 ring-1 ring-primary/10">
              <HeartPulse className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 truncate">CareCanvas</h1>
                <span className="text-caption px-2 py-0.5 rounded-full bg-primary-light text-primary-text font-bold border border-primary-border hidden sm:inline-flex items-center leading-none">
                  Private & Secure
                </span>
              </div>
              <p className="text-caption font-medium text-muted hidden sm:block leading-none mt-0.5">Your health, all in one place</p>
            </div>
          </div>

          {/* Center Privacy Badge — hidden on mobile to save space, visible lg */}
          <div className="hidden lg:flex items-center shrink-0">
            <PrivacyBadge patientId={activeProfile.userId} />
          </div>

          {/* Right Action Bar: Profile Switcher, Question Bank, Inspector, Sign Out */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Mobile Profile Switch Button (<sm) — dedicated 44x44px target with role & avatar indicator */}
            <button
              onClick={() => handleSwitchProfile(activeProfile.isProxy ? 'patient' : 'caregiver')}
              className="sm:hidden flex items-center justify-center min-h-[44px] min-w-[44px] px-2 rounded-xl bg-white border border-canvas-border hover:bg-canvas-muted text-slate-700 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary relative"
              aria-label={activeProfile.isProxy ? 'Switch to Patient' : 'Switch to Proxy'}
              title={activeProfile.isProxy ? `Acting as ${activeProfile.name} (Caregiver) — tap to switch to Patient` : `Acting as ${patientShort} — tap to switch to Caregiver`}
            >
              <div className="flex items-center gap-1">
                <span className="w-6 h-6 rounded-full bg-primary-light text-primary-text font-black text-xs flex items-center justify-center border border-primary-border">
                  {activeProfile.isProxy ? activeProfile.name.slice(0, 1).toUpperCase() : patientInitial}
                </span>
                <Users className="w-3.5 h-3.5 text-muted" />
              </div>
            </button>

            {/* Desktop/Tablet Segmented Switcher (>=sm) */}
            <div className="hidden sm:flex items-center bg-white rounded-xl p-1 border border-canvas-border shadow-sm text-xs min-h-[44px]">
              <button
                onClick={() => handleSwitchProfile('patient')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary min-h-[36px] flex items-center justify-center ${
                  !activeProfile.isProxy ? 'bg-primary-light text-primary-text font-bold border border-primary-border shadow-sm' : 'text-muted hover:text-slate-900 hover:bg-canvas-muted border border-transparent'
                }`}
                aria-label={`Switch to ${patientShort}`}
              >
                <span className="truncate max-w-[90px]">{patientShort}</span>
              </button>
              <button
                onClick={() => handleSwitchProfile('caregiver')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary min-h-[36px] flex items-center justify-center ${
                  activeProfile.isProxy ? 'bg-primary-light text-primary-text font-bold border border-primary-border shadow-sm' : 'text-muted hover:text-slate-900 hover:bg-canvas-muted border border-transparent'
                }`}
                aria-label="Switch to Proxy"
              >
                <span>Proxy</span>
              </button>
            </div>

            {/* Question Bank Button */}
            <button
              onClick={() => setIsQuestionBankOpen(true)}
              className="relative flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl bg-white hover:bg-canvas-muted text-slate-700 text-xs font-semibold border border-canvas-border shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Questions"
              title="Doctor Question Bank"
            >
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="hidden md:inline">Questions</span>
              {questionCount > 0 && (
                <span className="absolute -top-1 -right-1 md:static md:top-auto md:right-auto bg-amber-500 text-white font-bold text-[10px] min-w-[18px] h-4 px-1 rounded-full flex items-center justify-center shrink-0 leading-none shadow-xs">
                  {questionCount > 99 ? '99+' : questionCount}
                </span>
              )}
            </button>

            {/* Connect WebMCP Button */}
            <button
              onClick={() => setIsConnectOpen(true)}
              className="relative flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-emerald-500"
              title="Connect to WebMCP — get link & code"
              aria-label="Connect WebMCP"
            >
              <Plug className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="hidden md:inline">Connect</span>
            </button>

            {/* Activity Log Toggle */}
            <button
              onClick={() => setIsInspectorOpen(true)}
              className="relative flex items-center justify-center gap-1 sm:gap-2 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl bg-primary-light hover:brightness-95 text-primary-text text-xs font-bold border border-primary-border transition-all duration-200 shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
              title="See what's happening behind the scenes"
              aria-label="Activity"
            >
              <Terminal className="w-4 h-4 text-primary-text shrink-0" />
              <span className="hidden md:inline">Activity</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 md:static md:top-auto md:right-auto bg-rose-500 text-white text-[10px] min-w-[18px] h-4 px-1.5 rounded-full font-bold animate-pulse shrink-0 flex items-center justify-center leading-none shadow-xs">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>

            {/* Sign Out — clears localStorage and shows gate */}
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold border border-canvas-border hover:border-rose-200 shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-rose-500"
              aria-label="Sign out"
              title={`Signed in as ${activeProfile.name} — click to sign out`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Module Navigation Tabs — desktop only (bottom nav on mobile), pill active */}
      <div className="hidden md:block bg-white border-b border-canvas-border px-3 sm:px-6 shadow-sm overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id as ActiveModule)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap shrink-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? `${pastelActive}`
                    : 'text-muted hover:text-slate-900 hover:bg-canvas-muted border border-transparent'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? pastelIconActive : pastelIconIdle}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="bg-amber-500 text-white text-[10px] min-w-[20px] h-5 px-1.5 rounded-full font-bold shrink-0 flex items-center justify-center leading-none">
                    {Number(item.badge) > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area — empty vault until upload (0 facts/meds/labs) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6 pb-24 md:pb-6 overflow-x-hidden">
        {/* MODULE 0: APPROVED FACT VAULT */}
        <div className={activeModule === 'vault' ? 'block space-y-6' : 'hidden'}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Document Dropzone & Vault Stream */}
            <div className="lg:col-span-7 space-y-6">
              <DocumentDropzone patientId={activeProfile.userId} />
              <FactStreamView patientId={activeProfile.userId} />
            </div>

            {/* Right Column: Source Document Highlight Viewer — dynamic, no hardcoded doc id */}
            <div className="lg:col-span-5">
              <div className="sticky top-24">
                <BoundingBoxViewer documentId={undefined} />
              </div>
            </div>
          </div>
        </div>

        {/* MODULE 1: LABSTORY & LONGITUDINAL BIOMARKER CAUSAL ENGINE */}
        <div className={activeModule === 'labstory' ? 'block' : 'hidden'}>
          <LabStoryView patientId={activeProfile.userId} activeProfile={activeProfile} />
        </div>

        <div className={activeModule === 'pillmap' ? 'block' : 'hidden'}>
          <PillMapView patientId={activeProfile.userId} activeProfile={activeProfile} />
        </div>

        <div className={activeModule === 'rxbridge' ? 'block' : 'hidden'}>
          <RxBridgeView patientId={activeProfile.userId} activeProfile={activeProfile} />
        </div>

        {/* MODULE 4: HOMELAB REMOTE LOOP */}
        <div className={activeModule === 'homelab' ? 'block' : 'hidden'}>
          <HomeLabView patientId={activeProfile.userId} activeProfile={activeProfile} />
        </div>

        {/* MODULE 5: SAFETY ALERTS & TRIAGE */}
        <div className={activeModule === 'safety' ? 'block' : 'hidden'}>
          <SafetyView patientId={activeProfile.userId} activeProfile={activeProfile} />
        </div>

        {/* MODULE 6: FAMILY CARE CIRCLE & PROXY */}
        <div className={activeModule === 'carecircle' ? 'block' : 'hidden'}>
          <CareCircleView
            patientId={activeProfile.userId}
            activeProfile={activeProfile}
            onProfileChange={(target) => handleSwitchProfile(target)}
          />
        </div>

        {/* MODULE 7: CONTINUITY DOSSIER & LIFETIME RECORD */}
        <div className={activeModule === 'dossier' ? 'block' : 'hidden'}>
          <DossierView patientId={activeProfile.userId} activeProfile={activeProfile} />
        </div>
      </main>

      {/* Bottom Navbar — mobile polished, safe-area, 44px targets, scroll fade indicators */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-canvas-border shadow-[0_-4px_12px_rgba(0,0,0,0.06)] z-40"
        style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom, 0px))' }}
        aria-label="Mobile Navigation"
      >
        <div className="relative w-full max-w-full">
          {/* Left visual scroll fade gradient mask indicator */}
          <div
            className={`pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white via-white/80 to-transparent z-10 transition-opacity duration-200 ${
              canScrollLeft ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
          />

          {/* Right visual scroll fade gradient mask indicator */}
          <div
            className={`pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white via-white/80 to-transparent z-10 transition-opacity duration-200 ${
              canScrollRight ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
          />

          <div
            ref={navContainerRef}
            className="overflow-x-auto scrollbar-none px-2 py-1.5"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex items-center gap-1 min-w-max mx-auto w-max px-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      navItemRefs.current[item.id] = el;
                    }}
                    onClick={() => {
                      setActiveModule(item.id as ActiveModule);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`flex flex-col items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[10px] font-bold leading-none transition-all duration-200 min-w-[56px] sm:min-w-[62px] min-h-[48px] shrink-0 focus-visible:ring-2 focus-visible:ring-primary relative ${
                      isActive
                        ? 'bg-primary-light text-primary-text border border-primary-border shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-canvas-muted border border-transparent'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                  >
                    <div className="relative">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-primary-text' : 'text-slate-500'}`} />
                      {item.badge && (
                        <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[8px] min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center font-black border-2 border-white leading-none">
                          {Number(item.badge) > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] tracking-tight text-center leading-tight whitespace-nowrap">{item.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Global Modals — cohesive backdrop, responsive padding, scrollable */}
      <ModalPortal isOpen={isQuestionBankOpen} onClose={() => setIsQuestionBankOpen(false)} ariaLabel="Doctor Question Bank">
        <div className="max-w-2xl w-full mx-auto">
          <QuestionBank patientId={activeProfile.userId} onClose={() => setIsQuestionBankOpen(false)} />
        </div>
      </ModalPortal>

      <WebMCPInspector isOpen={isInspectorOpen} onClose={() => setIsInspectorOpen(false)} />
      <ConnectWebMCPModal isOpen={isConnectOpen} onClose={() => setIsConnectOpen(false)} />
      <ToastContainer />
    </div>
  );
};
