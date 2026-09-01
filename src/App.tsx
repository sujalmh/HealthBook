import React, { useState, useEffect, useRef } from 'react';
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
  Settings,
  Layers,
} from 'lucide-react';
import { PrivacyBadge } from '@/components/common/PrivacyBadge';
import { QuestionBank } from '@/components/common/QuestionBank';
import { WebMCPInspector } from '@/components/common/WebMCPInspector';
import { ConnectWebMCPModal } from '@/components/common/ConnectWebMCPModal';
import { ModalPortal } from '@/components/common/ModalPortal';
import { ToastContainer } from '@/components/common/ToastContainer';
import { MyRecordsView } from '@/components/vault/MyRecordsView';
import { LabStoryView } from '@/components/labstory/LabStoryView';
import { PillMapView } from '@/components/pillmap/PillMapView';
import { RxBridgeView } from '@/components/rxbridge/RxBridgeView';
import { HomeLabView } from '@/components/homelab/HomeLabView';
import { SafetyView } from '@/components/safety/SafetyView';
import { CareCircleView } from '@/components/carecircle/CareCircleView';
import { DossierView } from '@/components/dossier/DossierView';
import { CreateAccountView } from '@/components/auth/CreateAccountView';
import { SignInView } from '@/components/auth/SignInView';
import { SettingsView } from '@/components/settings/SettingsView';
import { AskWhyPanel } from '@/components/ask/AskWhyPanel';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

// Merged navigation: Records+Labs → Health (4 sub-tabs), Ask (ex-Questions) centered + highlighted
// Health   = My Records (vault) + Lab Results (labstory) + Tests to Do (homelab) + For My Doctor (dossier) — 4-in-1
// Ask      = Doctor Questions (ex-Questions) — centered, amber highlight
// Medicines= My Medicines (pillmap) + Medicine Review (rxbridge)
// Help     = Get Help (safety) | Family = Family (carecircle)
// Settings stays header gear. 5-item bottom bar: Health | Medicines | Ask | Help | Family (Ask centered)
export type ActiveModule = 'health' | 'medicines' | 'ask' | 'safety' | 'family' | 'settings';
export type HealthSub = 'vault' | 'labstory' | 'homelab' | 'dossier';
export type MedicinesSub = 'pillmap' | 'rxbridge';

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
  const [activeModule, setActiveModule] = useState<ActiveModule>('health');
  const [healthSub, setHealthSub] = useState<HealthSub>('vault');
  const [medicinesSub, setMedicinesSub] = useState<MedicinesSub>('pillmap');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isMCPMenuOpen, setIsMCPMenuOpen] = useState(false);
  const mcpMenuRef = useRef<HTMLDivElement | null>(null);
  const [activeProfile, setActiveProfile] = useState<ActiveProfile | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [authMode, setAuthMode] = useState<'create' | 'signin'>('create');
  const [pendingCount, setPendingCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [isVaultBusy, setIsVaultBusy] = useState(false);
  const [askWhyPrefill, setAskWhyPrefill] = useState<{ marker?: string; query?: string } | null>(null);

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

  // Navigate to Ask from Lab Results — prefill AskWhy panel
  useEffect(() => {
    const onNavigateAsk = (payload: any) => {
      setAskWhyPrefill({ marker: payload?.marker, query: payload?.query });
      setActiveModule('ask');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const off1 = eventBus.on('navigate_ask' as any, onNavigateAsk);
    const onWindow = (e: any) => onNavigateAsk(e.detail);
    window.addEventListener('carecanvas_navigate_ask' as any, onWindow as any);
    return () => {
      off1();
      window.removeEventListener('carecanvas_navigate_ask' as any, onWindow as any);
    };
  }, []);

  // Close MCP dropdown on outside click / ESC — grouped MCP stuff for phone top bar
  useEffect(() => {
    if (!isMCPMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (mcpMenuRef.current && !mcpMenuRef.current.contains(e.target as Node)) setIsMCPMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMCPMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isMCPMenuOpen]);

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
      const firstLink = links[0];
      const derivedName = firstLink?.caregiverName?.trim() || 'Family member';
      const derivedRelationship = firstLink?.relationship || 'son';
      const derivedPermission = (firstLink?.permissionLevel as any) || 'manage';
      const next: ActiveProfile = {
        ...activeProfile,
        name: derivedName,
        role: 'caregiver',
        isProxy: true,
        relationship: derivedRelationship,
        onBehalfOf: baseName,
        permissionLevel: derivedPermission,
      };
      setActiveProfile(next);
      eventBus.dispatchToast({
        type: 'info',
        title: 'Proxy Mode Active',
        message: `Switched to ${next.name} (${derivedRelationship}) acting on behalf of ${baseName}.`,
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
      // vault-derived caregiverName — fallback to 'Family member' for legacy links
      const childLink = links.find((l) => ['daughter', 'son', 'children', 'child'].includes((l.relationship || '').toLowerCase())) || links[0];
      const derivedChildName = childLink?.caregiverName?.trim() || 'Family member';
      const derivedChildRel = childLink?.relationship || 'father';
      const derivedChildPerm = (childLink?.permissionLevel as any) || 'manage';
      const next: ActiveProfile = {
        ...activeProfile,
        name: derivedChildName,
        role: 'caregiver',
        isProxy: true,
        relationship: derivedChildRel,
        onBehalfOf: 'Child',
        permissionLevel: derivedChildPerm,
      };
      setActiveProfile(next);
      eventBus.dispatchToast({
        type: 'info',
        title: 'Proxy Mode Active',
        message: `Switched to ${next.name} acting on behalf of ${next.onBehalfOf} (${derivedChildRel}).`,
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

  // Merged nav: 5 items with Ask centered + highlighted. Health merges Records+Labs (4 sub-tabs).
  const navItems = [
    { id: 'health' as ActiveModule, label: 'Health', shortLabel: 'Health', icon: Layers, badge: pendingCount > 0 ? `${pendingCount}` : null, desc: 'Records + Labs + For Doctor' },
    { id: 'medicines' as ActiveModule, label: 'Medicines', shortLabel: 'Meds', icon: Pill, badge: null, desc: 'Weekly Box + Review' },
    { id: 'ask' as ActiveModule, label: 'Ask', shortLabel: 'Ask', icon: HelpCircle, badge: questionCount > 0 ? `${questionCount}` : null, desc: 'Doctor Questions — ask', highlight: true as const },
    { id: 'safety' as ActiveModule, label: 'Get Help', shortLabel: 'Help', icon: AlertTriangle, badge: null, desc: 'Urgent help + appointments' },
    { id: 'family' as ActiveModule, label: 'Family', shortLabel: 'Family', icon: Users, badge: null, desc: 'Trusted helpers' },
  ];

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

  // (proxy initials moved to Family page; kept for handleSwitchProfile logic)

  const handleNav = (id: ActiveModule) => {
    if (isVaultBusy) {
      eventBus.dispatchToast({ type: 'info', title: 'Please wait', message: 'We are still reading your paper. Please wait until we finish.' });
      return;
    }
    setActiveModule(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-canvas-bg text-slate-900 flex flex-col antialiased w-full max-w-full overflow-x-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-slate-900 focus:rounded-xl focus:shadow-lg focus:border focus:border-canvas-border focus:outline-none focus:ring-2 focus:ring-primary">
        Skip to main content
      </a>
      {/* Top Application Bar — glass, soft shadow, full-width */}
      <header className="border-b border-canvas-border bg-white/95 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 shadow-sm w-full">
        <div className="w-full max-w-none flex items-center justify-between gap-1.5 sm:gap-4">
          {/* Logo & Subtitle — refined typography, token gradient */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20 shrink-0 ring-1 ring-primary/10" aria-hidden="true">
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

          {/* Right Action Bar: MCP grouped, Settings, Sign Out — proxy moved to Family page, Ask centered in bottom nav */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">

            {/* MCP GROUP — phone: single dropdown grouping Connect + Activity; desktop: keep separate for space */}
            {/* Mobile MCP dropdown trigger */}
            <div className="relative sm:hidden" ref={mcpMenuRef}>
              <button
                onClick={() => setIsMCPMenuOpen((v) => !v)}
                className="relative flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold border border-slate-800 shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1"
                aria-label={`MCP tools${pendingCount > 0 ? `, ${pendingCount} pending` : ''}`}
                aria-expanded={isMCPMenuOpen}
                aria-haspopup="menu"
                title="MCP tools — Connect + Activity"
              >
                <Plug className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden="true" />
                <Terminal className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] min-w-[18px] h-4 px-1 rounded-full flex items-center justify-center font-black border-2 border-white leading-none shadow-xs">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </button>
              {isMCPMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 bg-white border border-canvas-border rounded-2xl shadow-xl p-2 z-50 animate-fade-in"
                  role="menu"
                  aria-label="MCP tools menu"
                >
                  <div className="px-3 py-2 border-b border-canvas-border mb-1">
                    <p className="text-caption font-black tracking-wider uppercase text-muted">MCP Tools</p>
                    <p className="text-caption text-muted">Connect device & view activity</p>
                  </div>
                  <button
                    role="menuitem"
                    onClick={() => { setIsConnectOpen(true); setIsMCPMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-emerald-50 text-emerald-700 text-sm font-bold transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                  >
                    <span className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                      <Plug className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-left">
                      <span className="block leading-none">Connect</span>
                      <span className="block text-caption font-medium text-muted leading-none">Link WebMCP</span>
                    </span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setIsInspectorOpen(true); setIsMCPMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary-light text-primary-text text-sm font-bold transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <span className="w-8 h-8 rounded-lg bg-primary-light border border-primary-border flex items-center justify-center shrink-0">
                      <Terminal className="w-4 h-4 text-primary-text" aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-left">
                      <span className="block leading-none">Activity</span>
                      <span className="block text-caption font-medium text-muted leading-none">Tools & logs</span>
                    </span>
                    {pendingCount > 0 && (
                      <span className="bg-rose-500 text-white text-xs min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center font-black">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Desktop: separate Connect + Activity buttons (grouped only on phone) */}
            <button
              onClick={() => setIsConnectOpen(true)}
              className="hidden sm:flex relative items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-emerald-500"
              title="Connect to WebMCP — get link & code"
              aria-label="Connect WebMCP"
            >
              <Plug className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span className="hidden md:inline">Connect</span>
            </button>

            <button
              onClick={() => setIsInspectorOpen(true)}
              className="hidden sm:flex relative items-center justify-center gap-1 sm:gap-2 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl bg-primary-light hover:brightness-95 text-primary-text text-xs font-bold border border-primary-border transition-all duration-200 shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
              title="See what's happening behind the scenes"
              aria-label={`Activity${pendingCount > 0 ? `, ${pendingCount} pending` : ''}`}
            >
              <Terminal className="w-4 h-4 text-primary-text shrink-0" aria-hidden="true" />
              <span className="hidden md:inline">Activity</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 md:static md:top-auto md:right-auto bg-rose-500 text-white text-[10px] min-w-[18px] h-4 px-1.5 rounded-full font-bold animate-pulse shrink-0 flex items-center justify-center leading-none shadow-xs">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>

            {/* Settings — header gear, not in main nav, reduces clutter */}
            <button
              onClick={() => handleNav('settings')}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold border shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary ${
                activeModule === 'settings'
                  ? 'bg-primary-light text-primary-text border-primary-border shadow-sm'
                  : 'bg-white hover:bg-canvas-muted text-slate-700 border-canvas-border'
              }`}
              aria-label="Settings"
              aria-current={activeModule === 'settings' ? 'page' : undefined}
              title="Settings"
            >
              <Settings className={`w-4 h-4 shrink-0 ${activeModule === 'settings' ? 'text-primary-text' : 'text-muted'}`} />
              <span className="hidden md:inline">Settings</span>
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

      {/* Primary Navigation — full-width, 5 items, Ask highlighted centered */}
      <nav className="hidden md:block bg-white border-b border-canvas-border px-3 sm:px-6 lg:px-8 shadow-sm" aria-label="Primary">
        <div className="w-full max-w-none flex items-center justify-center gap-1.5 py-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            const isAsk = (item as any).highlight;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id as ActiveModule)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap shrink-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  isAsk
                    ? isActive
                      ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-500 ring-offset-1 focus-visible:ring-amber-500'
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-sm focus-visible:ring-amber-500'
                    : isActive
                      ? `${pastelActive} focus-visible:ring-primary`
                      : 'text-muted hover:text-slate-900 hover:bg-canvas-muted border border-transparent focus-visible:ring-primary'
                }`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`${item.label}${item.badge ? `, ${item.badge} pending` : ''}`}
                title={item.desc}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isAsk ? (isActive ? 'text-white' : 'text-amber-600') : isActive ? pastelIconActive : pastelIconIdle}`} aria-hidden="true" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[11px] min-w-[20px] h-5 px-1.5 rounded-full font-bold shrink-0 flex items-center justify-center leading-none border ${isAsk ? (isActive ? 'bg-white text-amber-700 border-amber-600' : 'bg-amber-500 text-white border-amber-600') : 'bg-amber-500 text-white border-transparent'}`}>
                    {Number(item.badge) > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area — full-width desktop, stacked */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-none px-3 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-6 pb-24 md:pb-6 overflow-x-hidden outline-none">
        {/* GROUP: Health = Records + Labs merged (4-in-1) — My Records + Lab Results + Tests to Do + For Doctor */}
        <div className={activeModule === 'health' ? 'block space-y-4' : 'hidden'} aria-hidden={activeModule !== 'health'}>
          {/* Sub-navigation — 4 tabs, responsive grid, 44px targets, accessible */}
          <div className="bg-canvas-card border border-canvas-border rounded-2xl p-1.5 shadow-sm" role="tablist" aria-label="Health sections">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                role="tab"
                aria-selected={healthSub === 'vault'}
                aria-controls="health-vault-panel"
                id="health-vault-tab"
                onClick={() => { if (isVaultBusy) { eventBus.dispatchToast({ type: 'info', title: 'Please wait', message: 'Still reading your paper — please wait.' }); return; } setHealthSub('vault'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                  healthSub === 'vault' ? 'bg-primary-light text-primary-text border border-primary-border shadow-sm' : 'text-muted hover:text-slate-900 hover:bg-canvas-muted border border-transparent'
                }`}
              >
                <Shield className={`w-4 h-4 ${healthSub === 'vault' ? 'text-primary-text' : 'text-muted'}`} aria-hidden="true" />
                <span className="truncate">My Records</span>
                {pendingCount > 0 && healthSub !== 'vault' && (
                  <span className="bg-amber-500 text-white text-[10px] min-w-[18px] h-4 px-1 rounded-full font-bold flex items-center justify-center shrink-0">{pendingCount > 99 ? '99+' : pendingCount}</span>
                )}
              </button>
              <button
                role="tab"
                aria-selected={healthSub === 'labstory'}
                aria-controls="health-labstory-panel"
                id="health-labstory-tab"
                onClick={() => { if (isVaultBusy) { eventBus.dispatchToast({ type: 'info', title: 'Please wait', message: 'Still reading your paper — please wait.' }); return; } setHealthSub('labstory'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                  healthSub === 'labstory' ? 'bg-primary-light text-primary-text border border-primary-border shadow-sm' : 'text-muted hover:text-slate-900 hover:bg-canvas-muted border border-transparent'
                }`}
              >
                <Activity className={`w-4 h-4 ${healthSub === 'labstory' ? 'text-primary-text' : 'text-muted'}`} aria-hidden="true" />
                <span className="truncate">Lab Results</span>
              </button>
              <button
                role="tab"
                aria-selected={healthSub === 'homelab'}
                aria-controls="health-homelab-panel"
                id="health-homelab-tab"
                onClick={() => { if (isVaultBusy) { eventBus.dispatchToast({ type: 'info', title: 'Please wait', message: 'Still reading your paper — please wait.' }); return; } setHealthSub('homelab'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                  healthSub === 'homelab' ? 'bg-primary-light text-primary-text border border-primary-border shadow-sm' : 'text-muted hover:text-slate-900 hover:bg-canvas-muted border border-transparent'
                }`}
              >
                <HeartPulse className={`w-4 h-4 ${healthSub === 'homelab' ? 'text-primary-text' : 'text-muted'}`} aria-hidden="true" />
                <span className="truncate">Tests to Do</span>
              </button>
              <button
                role="tab"
                aria-selected={healthSub === 'dossier'}
                aria-controls="health-dossier-panel"
                id="health-dossier-tab"
                onClick={() => { if (isVaultBusy) { eventBus.dispatchToast({ type: 'info', title: 'Please wait', message: 'Still reading your paper — please wait.' }); return; } setHealthSub('dossier'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                  healthSub === 'dossier' ? 'bg-primary-light text-primary-text border border-primary-border shadow-sm' : 'text-muted hover:text-slate-900 hover:bg-canvas-muted border border-transparent'
                }`}
              >
                <FolderLock className={`w-4 h-4 ${healthSub === 'dossier' ? 'text-primary-text' : 'text-muted'}`} aria-hidden="true" />
                <span className="truncate">For Doctor</span>
              </button>
            </div>
            <p className="px-2 pt-1.5 text-caption text-muted hidden sm:block">Records, lab trends, tests to do, and shareable summary — one health hub.</p>
          </div>

          <div id="health-vault-panel" role="tabpanel" aria-labelledby="health-vault-tab" className={healthSub === 'vault' ? 'block space-y-6' : 'hidden'}>
            <MyRecordsView patientId={activeProfile.userId} activeProfile={activeProfile} onBusyChange={setIsVaultBusy} />
          </div>

          <div id="health-labstory-panel" role="tabpanel" aria-labelledby="health-labstory-tab" className={healthSub === 'labstory' ? 'block' : 'hidden'}>
            <LabStoryView patientId={activeProfile.userId} activeProfile={activeProfile} onBusyChange={setIsVaultBusy} />
          </div>
          <div id="health-homelab-panel" role="tabpanel" aria-labelledby="health-homelab-tab" className={healthSub === 'homelab' ? 'block' : 'hidden'}>
            <HomeLabView patientId={activeProfile.userId} activeProfile={activeProfile} />
          </div>
          <div id="health-dossier-panel" role="tabpanel" aria-labelledby="health-dossier-tab" className={healthSub === 'dossier' ? 'block' : 'hidden'}>
            <DossierView patientId={activeProfile.userId} activeProfile={activeProfile} />
          </div>
        </div>

        {/* GROUP: Medicines = Weekly Planner (pillmap) + Medicine Review (rxbridge) */}
        <div className={activeModule === 'medicines' ? 'block space-y-4' : 'hidden'} aria-hidden={activeModule !== 'medicines'}>
          <div className="bg-canvas-card border border-canvas-border rounded-2xl p-1.5 shadow-sm" role="tablist" aria-label="Medicines sections">
            <div className="flex gap-1.5">
              <button
                role="tab"
                aria-selected={medicinesSub === 'pillmap'}
                aria-controls="meds-pillmap-panel"
                id="meds-pillmap-tab"
                onClick={() => { if (isVaultBusy) { eventBus.dispatchToast({ type: 'info', title: 'Please wait', message: 'Still reading your paper — please wait.' }); return; } setMedicinesSub('pillmap'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                  medicinesSub === 'pillmap' ? 'bg-primary-light text-primary-text border border-primary-border shadow-sm' : 'text-muted hover:text-slate-900 hover:bg-canvas-muted border border-transparent'
                }`}
              >
                <Pill className={`w-4 h-4 ${medicinesSub === 'pillmap' ? 'text-primary-text' : 'text-muted'}`} aria-hidden="true" />
                <span>Weekly Planner</span>
              </button>
              <button
                role="tab"
                aria-selected={medicinesSub === 'rxbridge'}
                aria-controls="meds-rxbridge-panel"
                id="meds-rxbridge-tab"
                onClick={() => { if (isVaultBusy) { eventBus.dispatchToast({ type: 'info', title: 'Please wait', message: 'Still reading your paper — please wait.' }); return; } setMedicinesSub('rxbridge'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                  medicinesSub === 'rxbridge' ? 'bg-primary-light text-primary-text border border-primary-border shadow-sm' : 'text-muted hover:text-slate-900 hover:bg-canvas-muted border border-transparent'
                }`}
              >
                <FileCheck2 className={`w-4 h-4 ${medicinesSub === 'rxbridge' ? 'text-primary-text' : 'text-muted'}`} aria-hidden="true" />
                <span>Medicine Review</span>
              </button>
            </div>
            <p className="px-2 pt-1.5 text-caption text-muted hidden sm:block">Your weekly pill box and the hospital list that fills it — one flow.</p>
          </div>

          <div id="meds-pillmap-panel" role="tabpanel" aria-labelledby="meds-pillmap-tab" className={medicinesSub === 'pillmap' ? 'block' : 'hidden'}>
            <PillMapView patientId={activeProfile.userId} activeProfile={activeProfile} />
          </div>
          <div id="meds-rxbridge-panel" role="tabpanel" aria-labelledby="meds-rxbridge-tab" className={medicinesSub === 'rxbridge' ? 'block' : 'hidden'}>
            <RxBridgeView patientId={activeProfile.userId} activeProfile={activeProfile} />
          </div>
        </div>

        {/* SINGLE: Get Help (safety) — no sub-tabs, keeps original internal tabs */}
        <div className={activeModule === 'safety' ? 'block' : 'hidden'} aria-hidden={activeModule !== 'safety'}>
          <SafetyView patientId={activeProfile.userId} activeProfile={activeProfile} />
        </div>

        {/* SINGLE: Family (carecircle) */}
        <div className={activeModule === 'family' ? 'block' : 'hidden'} aria-hidden={activeModule !== 'family'}>
          <CareCircleView
            patientId={activeProfile.userId}
            activeProfile={activeProfile}
            onProfileChange={(target) => handleSwitchProfile(target)}
          />
        </div>

        {/* ASK — separate page (ex-Questions), renamed, centered in menu, highlighted */}
        <div className={activeModule === 'ask' ? 'block space-y-4' : 'hidden'} aria-hidden={activeModule !== 'ask'}>
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 border border-amber-600 rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white text-amber-600 border border-amber-600 flex items-center justify-center shadow-sm shrink-0" aria-hidden="true">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-white">Ask</h2>
                <p className="text-sm text-white/90 leading-snug">Your doctor visit agenda — tap Ask, review, print.</p>
              </div>
            </div>
            <span className="inline-flex self-start sm:self-auto text-caption px-3 py-1.5 rounded-full bg-white text-amber-700 font-black border border-amber-600 shadow-sm shrink-0">
              {questionCount} {questionCount === 1 ? 'question' : 'questions'} • highlighted
            </span>
          </div>
          <AskWhyPanel patientId={activeProfile.userId} initialMarker={askWhyPrefill?.marker} initialQuery={askWhyPrefill?.query} />
          <QuestionBank patientId={activeProfile.userId} asPage />
        </div>

        {/* SETTINGS — accessed via header gear */}
        <div className={activeModule === 'settings' ? 'block' : 'hidden'} aria-hidden={activeModule !== 'settings'}>
          <SettingsView />
        </div>
      </main>

      {/* Mobile Bottom Nav — 5 items grid, no scroll, 44px+ targets, safe-area, accessible */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-canvas-border shadow-[0_-4px_12px_rgba(0,0,0,0.06)] z-40"
        style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom, 0px))' }}
        aria-label="Primary mobile"
      >
        <div className="grid grid-cols-5 gap-1 px-1 py-1.5 max-w-md mx-auto items-end">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            const isAsk = (item as any).highlight;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id as ActiveModule)}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-bold leading-none transition-all duration-200 focus-visible:ring-2 focus-visible:outline-none relative ${
                  isAsk
                    ? isActive
                      ? 'bg-amber-500 text-white border-amber-600 shadow-lg min-h-[62px] -mt-1 scale-[1.03] ring-2 ring-amber-500 ring-offset-1 focus-visible:ring-amber-500'
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-sm min-h-[58px] -mt-0.5 focus-visible:ring-amber-500'
                    : isActive
                      ? 'bg-primary-light text-primary-text border border-primary-border shadow-xs min-h-[56px] focus-visible:ring-primary'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-canvas-muted border border-transparent min-h-[56px] focus-visible:ring-primary'
                }`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`${item.label}${item.badge ? `, ${item.badge} pending` : ''}`}
                title={item.desc}
              >
                <span className="relative">
                  <Icon className={`w-5 h-5 ${isAsk ? (isActive ? 'text-white' : 'text-amber-600') : isActive ? 'text-primary-text' : 'text-slate-500'}`} aria-hidden="true" />
                  {item.badge && (
                    <span className={`absolute -top-1.5 -right-2 text-[8px] min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center font-black border-2 border-white leading-none ${isAsk ? 'bg-white text-amber-700 border-amber-600' : 'bg-amber-500 text-white'}`}>
                      {Number(item.badge) > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
                <span className={`text-[10px] tracking-tight text-center leading-tight truncate w-full px-0.5 ${isAsk ? 'font-black' : ''}`}>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Global Modals */}
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
