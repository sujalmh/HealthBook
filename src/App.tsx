import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Plug,
  Settings,
  Layers,
  Stethoscope,
} from 'lucide-react';
import { PrivacyBadge } from '@/components/common/PrivacyBadge';
import { QuestionBank } from '@/components/common/QuestionBank';
import { WebMCPInspector } from '@/components/common/WebMCPInspector';
import { ConnectWebMCPModal } from '@/components/common/ConnectWebMCPModal';
import { ProfileIndicator } from '@/components/carecircle/ProfileIndicator';
import { ProfileDetails } from '@/components/carecircle/ProfileDetails';
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
import { MCPAuthBridge } from '@/components/auth/MCPAuthBridge';
import { SettingsView } from '@/components/settings/SettingsView';
import { AskWhyPanel } from '@/components/ask/AskWhyPanel';
import { GroundedInsightsPanel } from '@/components/search/GroundedInsightsPanel';
import { DoctorDashboard } from '@/components/doctor/DoctorDashboard';
import { DoctorPatientView } from '@/components/doctor/DoctorPatientView';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { isViewOnly as isViewOnlyUtil } from '@/core/rbac/canAccess';

// Merged navigation: Records+Labs → Health (4 sub-tabs), Ask (ex-Questions) centered + highlighted
// Health   = My Records (vault) + Lab Results (labstory) + Tests to Do (homelab) + For My Doctor (dossier) — 4-in-1
// Ask      = Doctor Questions (ex-Questions) — centered, amber highlight
// Medicines= My Medicines (pillmap) + Medicine Review (rxbridge)
// Help     = Get Help (safety) | Family = Family (carecircle)
// Settings stays header gear. 5-item bottom bar: Health | Medicines | Ask | Help | Family (Ask centered)
// Doctor  = My Patients dashboard when role === 'doctor' (RBAC doctor ↔ patient linking)
export type ActiveModule = 'health' | 'medicines' | 'ask' | 'safety' | 'family' | 'settings' | 'doctor';
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
  const [doctorSelectedPatientId, setDoctorSelectedPatientId] = useState<string | null>(null);
  const [isProfileDetailsOpen, setIsProfileDetailsOpen] = useState(false);

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
    } catch { /* intentionally empty */ }
    setIsHydrated(true);
  }, []);

  // MCP auth bridge: AI prepared sign-up/sign-in (human-only password) — switch gate view and hydrate profile on completion
  useEffect(() => {
    const onPending = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { mode?: string };
        if (!activeProfile && detail?.mode === 'create') setAuthMode('create');
        else if (!activeProfile && detail?.mode === 'signin') setAuthMode('signin');
      } catch { /* ignore */ }
    };
    const onCompleted = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as Partial<ActiveProfile>;
        if (detail?.userId) {
          const normalized: ActiveProfile = {
            userId: String(detail.userId),
            name: String(detail.name || 'Anonymous').slice(0, 64) || 'Anonymous',
            role: (detail.role as string) || 'patient',
            isProxy: !!detail.isProxy,
            relationship: detail.relationship,
            onBehalfOf: detail.onBehalfOf,
            permissionLevel: (detail.permissionLevel as ActiveProfile['permissionLevel']) || 'manage',
            email: detail.email,
            createdAt: detail.createdAt,
          };
          setActiveProfile(normalized);
        } else {
          // Fallback: re-read from localStorage
          const raw = localStorage.getItem('carecanvas_active_user');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.userId) handleCreated(parsed);
          }
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('carecanvas_mcp_auth_pending', onPending as EventListener);
    window.addEventListener('carecanvas_mcp_prefill', onPending as EventListener);
    window.addEventListener('carecanvas_mcp_auth_completed', onCompleted as EventListener);
    window.addEventListener('carecanvas_auth_completed', onCompleted as EventListener);
    const off1 = eventBus.on('mcp_auth_pending' as unknown as string, onPending as unknown as () => void);
    const off2 = eventBus.on('mcp_auth_completed' as unknown as string, onCompleted as unknown as () => void);
    return () => {
      window.removeEventListener('carecanvas_mcp_auth_pending', onPending as EventListener);
      window.removeEventListener('carecanvas_mcp_prefill', onPending as EventListener);
      window.removeEventListener('carecanvas_mcp_auth_completed', onCompleted as EventListener);
      window.removeEventListener('carecanvas_auth_completed', onCompleted as EventListener);
      off1();
      off2();
    };
  }, [activeProfile]);

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

  useEffect(() => {
    const onNavigateAsk = (payload: unknown) => {
      const obj = payload as { marker?: string; query?: string };
      setAskWhyPrefill({ marker: obj?.marker, query: obj?.query });
      setActiveModule('ask');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const off1 = eventBus.on('navigate_ask' as unknown as string, onNavigateAsk as unknown as () => void);
    const onWindow = (e: Event) => onNavigateAsk((e as CustomEvent).detail);
    window.addEventListener('carecanvas_navigate_ask', onWindow as EventListener);
    return () => {
      off1();
      window.removeEventListener('carecanvas_navigate_ask', onWindow as EventListener);
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

  const handleCreated = (profile: unknown) => {
    const p = profile as Partial<ActiveProfile> & { userId?: unknown; name?: unknown; role?: unknown; isProxy?: unknown };
    const normalized: ActiveProfile = {
      userId: String(p.userId),
      name: String((p.name as string) || 'Anonymous').slice(0, 64) || 'Anonymous',
      role: (p.role as string) || 'patient',
      isProxy: !!p.isProxy,
      relationship: p.relationship,
      onBehalfOf: p.onBehalfOf,
      permissionLevel: (p.permissionLevel as ActiveProfile['permissionLevel']) || 'manage',
      email: p.email,
      createdAt: p.createdAt,
    };
    setActiveProfile(normalized);
  };

  const handleSwitchProfile = (role: 'patient' | 'caregiver' | 'self' | 'mother' | 'child') => {
    if (!activeProfile) return;
    const getLinks = () => {
      try { return localVault.getCaregiverLinks(activeProfile.userId); } catch { return []; }
    };
    const needProxy = role === 'caregiver' || role === 'mother' || role === 'child';
    if (needProxy) {
      const links = getLinks();
      if (links.length === 0) {
        eventBus.dispatchToast({ type: 'info', title: 'No family helpers linked', message: 'Add a family member in Family → Manage Access before switching to proxy mode. No mock profile shown.' });
        return;
      }
      const isChild = role === 'child';
      const link = isChild ? (links.find((l) => ['daughter', 'son', 'children', 'child'].includes((l.relationship || '').toLowerCase())) || links[0]) : links[0];
      const baseName = activeProfile.isProxy ? activeProfile.onBehalfOf || activeProfile.name : activeProfile.name;
      const derivedName = link?.caregiverName?.trim() || 'Family member';
      const derivedRel = link?.relationship || (isChild ? 'father' : 'son');
      const derivedPerm = (link?.permissionLevel as unknown as ActiveProfile['permissionLevel']) || 'manage';
      const next: ActiveProfile = { ...activeProfile, name: derivedName, role: 'caregiver', isProxy: true, relationship: derivedRel, onBehalfOf: isChild ? 'Child' : baseName, permissionLevel: derivedPerm };
      setActiveProfile(next);
      eventBus.dispatchToast({ type: 'info', title: 'Proxy Mode Active', message: isChild ? `Switched to ${next.name} acting on behalf of ${next.onBehalfOf} (${derivedRel}).` : `Switched to ${next.name} (${derivedRel}) acting on behalf of ${baseName}.` });
      return;
    }
    try {
      const raw = localStorage.getItem('carecanvas_active_user');
      if (raw) {
        const stored = JSON.parse(raw) as { userId?: string; name?: string; email?: string; createdAt?: string };
        const restored: ActiveProfile = { userId: String(stored.userId), name: String(stored.name || 'Anonymous').slice(0, 64) || 'Anonymous', role: 'patient', isProxy: false, relationship: undefined, onBehalfOf: undefined, permissionLevel: 'manage', email: stored.email, createdAt: stored.createdAt };
        setActiveProfile(restored);
        eventBus.dispatchToast({ type: 'info', title: 'Patient Profile', message: `Active profile: ${restored.name} (Primary Patient).` });
        return;
      }
    } catch {}
    const fallback: ActiveProfile = { ...activeProfile, role: 'patient', isProxy: false, relationship: undefined, onBehalfOf: undefined, permissionLevel: 'manage' };
    setActiveProfile(fallback);
    eventBus.dispatchToast({ type: 'info', title: 'Patient Profile', message: `Active profile: ${fallback.name} (Primary Patient).` });
  };

  const isDoctor = activeProfile?.role === 'doctor';
  // doctors sign in with permissionLevel:'view_only' by design (read-only across patient vaults) —
  // the caregiver "ask primary holder" degraded banner does not apply to them
  const isViewOnly = isViewOnlyUtil(activeProfile as unknown as { permissionLevel?: string }) && !isDoctor;
  const viewOnlyTooltip = 'View-only: cannot approve — ask primary holder';
  const isPatient = activeProfile?.role === 'patient' || !isDoctor;

  // Auto-switch doctor to doctor module on login
  useEffect(() => {
    if (activeProfile?.role === 'doctor' && activeModule !== 'doctor') {
      setActiveModule('doctor');
      setDoctorSelectedPatientId(null);
    } else if (activeProfile?.role === 'patient' && activeModule === 'doctor') {
      setActiveModule('health');
    }
  }, [activeProfile?.role]);

  // Merged nav: 5 items with Ask centered + highlighted. Health merges Records+Labs (4 sub-tabs).
  // Gated per role/tier: view_only shows disabled tooltip but remains visible for read
  // Doctor role gets My Patients as primary nav (RBAC doctor ↔ patient)
  const navItems = isDoctor
    ? [
        { id: 'doctor' as ActiveModule, label: 'My Patients', shortLabel: 'Patients', icon: Stethoscope, badge: null, desc: 'Patients who linked you — doctor access' },
        { id: 'family' as ActiveModule, label: 'Family', shortLabel: 'Family', icon: Users, badge: null, desc: 'Family helpers (caregiver links)' },
        { id: 'settings' as ActiveModule, label: 'Settings', shortLabel: 'Settings', icon: Settings, badge: null, desc: 'Settings' },
      ]
    : [
        { id: 'health' as ActiveModule, label: 'Health', shortLabel: 'Health', icon: Layers, badge: pendingCount > 0 ? `${pendingCount}` : null, desc: isViewOnly ? viewOnlyTooltip : 'Records + Labs + For Doctor' },
        { id: 'medicines' as ActiveModule, label: 'Medicines', shortLabel: 'Meds', icon: Pill, badge: null, desc: isViewOnly ? viewOnlyTooltip : 'Weekly Box + Review' },
        { id: 'ask' as ActiveModule, label: 'Ask', shortLabel: 'Ask', icon: HelpCircle, badge: questionCount > 0 ? `${questionCount}` : null, desc: isViewOnly ? viewOnlyTooltip : 'Doctor Questions — ask', highlight: true as const },
        { id: 'safety' as ActiveModule, label: 'Get Help', shortLabel: 'Help', icon: AlertTriangle, badge: null, desc: isViewOnly ? viewOnlyTooltip : 'Urgent help + appointments' },
        { id: 'family' as ActiveModule, label: 'Family', shortLabel: 'Family', icon: Users, badge: null, desc: isViewOnly ? viewOnlyTooltip : 'Trusted helpers' },
      ];

  const askContextFacts = useMemo(() => {
    try {
      if (!activeProfile?.userId) return '';
      const meds = localVault.getMedications(activeProfile.userId) || [];
      const labs = localVault.getLabs(activeProfile.userId) || [];
      const lastLab = labs.length ? `${labs[labs.length - 1]?.marker ?? ''} ${labs[labs.length - 1]?.normalizedValue ?? ''}` : '';
      const medStr = meds.length ? `Meds: ${meds.slice(0, 3).map((m) => (m as unknown as { genericName?: string; name?: string }).genericName || (m as unknown as { name?: string }).name).join(', ')}` : '';
      return [lastLab, medStr].filter(Boolean).join(' | ');
    } catch { return ''; }
  }, [activeProfile?.userId]);

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
        <MCPAuthBridge />
        <ToastContainer />
      </div>
    );
  }

  const handleNav = (id: ActiveModule) => {
    if (isVaultBusy) {
      eventBus.dispatchToast({ type: 'info', title: 'Please wait', message: 'We are still reading your paper. Please wait until we finish.' });
      return;
    }
    // R8 global RBAC gate — view_only read-only degraded not blank, manage onBehalfOf, full admin
    const perm = activeProfile?.permissionLevel;
    if (perm === 'view_only') {
      // Show degraded toast but still allow navigation for read-only viewing (not blank)
      // Sensitive module deep gates inside SafetyView/TriagePanel will block write actions with PERMISSION_DENIED
      eventBus.dispatchToast({ type: 'info', title: 'View-only', message: 'View-only: cannot approve — ask primary holder (PERMISSION_DENIED)' });
      // Fall through to still setActiveModule for read-only degraded view — not blank
    }
    setActiveModule(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-canvas-bg text-slate-900 flex flex-col antialiased w-full max-w-full overflow-x-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-slate-900 focus:rounded-xl focus:shadow-lg focus:border focus:border-canvas-border focus:outline-none focus:ring-2 focus:ring-primary">
        Skip to main content
      </a>
      {/* Top Application Bar — solid, bordered; no glass or blur */}
      <header className="border-b border-canvas-border bg-white sticky top-0 z-40 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 w-full">
        <div className="w-full max-w-none flex items-center justify-between gap-1.5 sm:gap-4">
          {/* Logo & Subtitle — flat clinical-teal mark, serif wordmark */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary flex items-center justify-center shrink-0" aria-hidden="true">
              <HeartPulse className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-sm sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap leading-none">CareCanvas</h1>
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

          {/* Right Action Bar: MCP grouped, Settings, Profile (top right) — proxy moved to Family page, Ask centered in bottom nav */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">

            {/* MCP single Connect — header single entry, tools & logs nested inside Connect modal */}
            {/* Mobile single Connect (grouped trigger simplified to single Connect) */}
            <button
              onClick={() => setIsConnectOpen(true)}
              className="flex sm:hidden relative items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold border border-slate-800 shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1"
              aria-label={`Connect${pendingCount > 0 ? `, ${pendingCount} pending` : ''}`}
              title="Connect to WebMCP — tools & logs inside"
            >
              <Plug className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden="true" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] min-w-[18px] h-4 px-1 rounded-full flex items-center justify-center font-bold border-2 border-white leading-none shadow-xs">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>

            {/* Desktop single Connect with pending badge preserved */}
            <button
              onClick={() => setIsConnectOpen(true)}
              className="hidden sm:flex relative items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-emerald-500"
              title="Connect to WebMCP — tools & logs inside"
              aria-label={`Connect${pendingCount > 0 ? `, ${pendingCount} pending` : ''}`}
            >
              <Plug className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span className="hidden md:inline">Connect</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 md:static md:top-auto md:right-auto bg-rose-500 text-white text-[10px] min-w-[18px] h-4 px-1.5 rounded-full font-bold shrink-0 flex items-center justify-center leading-none shadow-xs">
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

            {/* Profile indicator — vault-derived completeness, top right after Settings, visible 375+1024, click reveals details */}
            <ProfileIndicator activeProfile={activeProfile} onClick={() => setIsProfileDetailsOpen(true)} />
          </div>
        </div>
      </header>

      {/* Primary Navigation — full-width, 5 items, Ask highlighted centered */}
      <nav className="hidden md:block bg-white border-b border-canvas-border px-3 sm:px-6 lg:px-8 shadow-sm" aria-label="Primary">
        <div className="w-full max-w-none flex items-center justify-center gap-1.5 py-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            const isAsk = (item as unknown as { highlight?: boolean }).highlight;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id as ActiveModule)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap shrink-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  isAsk
                    ? isActive
                      ? 'bg-amber-500 text-white border border-amber-600 focus-visible:ring-amber-500'
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
        {/* R8 global RBAC direct bypass gate — view_only read-only degraded not blank, not hidden */}
        {isViewOnly && (
          <div
            data-testid="viewonly-banner"
            title="View-only: cannot approve — ask primary holder"
            className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-amber-800 text-sm font-semibold shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
            <span>View-only: cannot approve — ask primary holder (PERMISSION_DENIED) — read-only degraded</span>
          </div>
        )}
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

        {/* DOCTOR: My Patients dashboard + patient record access (RBAC doctor ↔ patient) */}
        <div className={activeModule === 'doctor' ? 'block space-y-4' : 'hidden'} aria-hidden={activeModule !== 'doctor'}>
          {isDoctor ? (
            doctorSelectedPatientId ? (
              <DoctorPatientView
                patientId={doctorSelectedPatientId}
                doctorId={activeProfile.userId}
                doctorProfile={activeProfile}
                onBack={() => setDoctorSelectedPatientId(null)}
              />
            ) : (
              <DoctorDashboard
                doctorId={activeProfile.userId}
                doctorProfile={activeProfile}
                onSelectPatient={(pid) => setDoctorSelectedPatientId(pid)}
              />
            )
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-2">
              <Stethoscope className="w-8 h-8 text-amber-600 mx-auto" />
              <p className="text-body-sm font-bold text-amber-800">Doctor access only</p>
              <p className="text-body-sm text-amber-700">This view is available when signed in as a doctor. Create a doctor account or sign in with a doctor email.</p>
            </div>
          )}
        </div>

        {/* ASK — separate page (ex-Questions). Quiet agenda header: amber rule marks it
            as the visit-prep flow; the count is enough emphasis, no gradient billboard. */}
        <div className={activeModule === 'ask' ? 'block space-y-4' : 'hidden'} aria-hidden={activeModule !== 'ask'}>
          <div className="border border-canvas-border border-l-4 border-l-amber-500 rounded-lg bg-white px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-heading-lg text-slate-900">Ask</h2>
                <p className="text-body-sm text-muted leading-snug">Your doctor visit agenda — add questions, review, print.</p>
              </div>
            </div>
            <span className="inline-flex self-start sm:self-auto text-caption px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
              {questionCount} {questionCount === 1 ? 'question' : 'questions'}
            </span>
          </div>
          <AskWhyPanel patientId={activeProfile.userId} initialMarker={askWhyPrefill?.marker} initialQuery={askWhyPrefill?.query} />
          {activeModule === 'ask' && (
            <GroundedInsightsPanel
              patientId={activeProfile.userId}
              initialQuery=""
              contextFacts={askContextFacts}
              mode="general"
            />
          )}
          <QuestionBank patientId={activeProfile.userId} asPage />
        </div>

        {/* SETTINGS — accessed via header gear */}
        <div className={activeModule === 'settings' ? 'block' : 'hidden'} aria-hidden={activeModule !== 'settings'}>
          <SettingsView />
        </div>
      </main>

      {/* Mobile Bottom Nav — grid cols adapt to role (patient 5 vs doctor 3), no scroll, 44px+ targets, safe-area, accessible */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-canvas-border shadow-[0_-4px_12px_rgba(0,0,0,0.06)] z-40"
        style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom, 0px))' }}
        aria-label="Primary mobile"
      >
        <div className={`grid gap-1 px-1 py-1.5 max-w-md mx-auto items-end ${navItems.length === 3 ? 'grid-cols-3' : navItems.length === 4 ? 'grid-cols-4' : 'grid-cols-5'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            const isAsk = (item as unknown as { highlight?: boolean }).highlight;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id as ActiveModule)}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-bold leading-none transition-all duration-200 focus-visible:ring-2 focus-visible:outline-none relative ${
                  isAsk
                    ? isActive
                      ? 'bg-amber-500 text-white border border-amber-600 min-h-[56px] focus-visible:ring-amber-500'
                      : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 min-h-[56px] focus-visible:ring-amber-500'
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
                    <span className={`absolute -top-1.5 -right-2 text-[8px] min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center font-bold border-2 border-white leading-none ${isAsk ? 'bg-white text-amber-700 border-amber-600' : 'bg-amber-500 text-white'}`}>
                      {Number(item.badge) > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
                <span className={`text-[10px] tracking-tight text-center leading-tight truncate w-full px-0.5 ${isAsk ? 'font-bold' : ''}`}>{item.shortLabel}</span>
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
      <ProfileDetails isOpen={isProfileDetailsOpen} onClose={() => setIsProfileDetailsOpen(false)} activeProfile={activeProfile} />
      <MCPAuthBridge />
      <ToastContainer />
    </div>
  );
};
