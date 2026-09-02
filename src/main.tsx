import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { localVault, wireLocalVaultToEventBus } from './core/vault/LocalVault';
import { allWebMCPTools } from './tools';
import { eventBus } from './core/events/eventBus';

const bootstrapAbortControllers = new Map<string, AbortController>();

if (typeof import.meta !== 'undefined' && (import.meta as unknown as { hot?: { dispose: (cb: () => void) => void } }).hot) {
  (import.meta as unknown as { hot: { dispose: (cb: () => void) => void } }).hot.dispose(() => {
    for (const controller of bootstrapAbortControllers.values()) {
      try { controller.abort(); } catch {}
    }
    bootstrapAbortControllers.clear();
  });
}

function getStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem('carecanvas_active_user');
    if (raw) {
      const parsed = JSON.parse(raw) as { userId?: unknown; id?: unknown };
      const pid = parsed?.userId ?? parsed?.id;
      if (typeof pid === 'string' && pid.trim()) return pid.trim();
    }
  } catch {}
  return null;
}

function isSecureContextCheck(): boolean {
  try {
    const win = window as unknown as { isSecureContext?: boolean };
    return win.isSecureContext ?? true;
  } catch { return true; }
}

function isToolsPolicyAllowed(): boolean {
  try {
    const doc = document as unknown as { permissionsPolicy?: { allowsFeature?: (f: string) => boolean } };
    if (doc.permissionsPolicy?.allowsFeature) {
      const allowed = doc.permissionsPolicy.allowsFeature('tools');
      if (!allowed) {
        console.warn('[CareCanvas] tools Permissions-Policy blocked');
        return false;
      }
    }
  } catch (e) { console.warn('[CareCanvas] permissionsPolicy check failed', e); }
  return true;
}

async function registerAllTools(): Promise<void> {
  for (const [, c] of bootstrapAbortControllers.entries()) try { c.abort(); } catch {}
  bootstrapAbortControllers.clear();
  for (const tool of allWebMCPTools) bootstrapAbortControllers.set(tool.name, new AbortController());

  const results = await Promise.allSettled(
    allWebMCPTools.map(async (tool) => {
      const controller = bootstrapAbortControllers.get(tool.name)!;
      try {
        const doc = document as unknown as { modelContext?: { registerTool?: (t: unknown, opts?: unknown) => Promise<void> } };
        if (doc.modelContext?.registerTool) {
          const { toSpecTool } = await import('./core/webmcp/WebMCPAdapter.ts');
          const { webMCPEngine } = await import('./core/webmcp/WebMCPEngine.ts');
          const specTool = toSpecTool(tool, webMCPEngine);
          try {
            await doc.modelContext.registerTool(specTool, { signal: controller.signal });
            try { webMCPEngine.register(tool); } catch {}
            return;
          } catch (e: unknown) {
            const errName = (e as { name?: string })?.name || '';
            if (errName === 'NotAllowedError' || errName === 'SecurityError' || errName === 'InvalidStateError') {
              console.warn(`[CareCanvas] native register blocked for ${tool.name}: ${errName}`);
              try { (await import('./core/webmcp/WebMCPEngine.ts')).webMCPEngine.register(tool); } catch {}
              return;
            }
            if (errName === 'AbortError') return;
            throw e;
          }
        }
        const { webMCPEngine } = await import('./core/webmcp/WebMCPEngine.ts');
        webMCPEngine.register(tool);
      } catch (e: unknown) {
        const errName = (e as { name?: string })?.name || '';
        if (errName === 'NotAllowedError' || errName === 'SecurityError' || errName === 'InvalidStateError') return;
        console.warn(`[CareCanvas] WebMCP register failed for ${tool.name}`, e);
        throw e;
      }
    })
  );
  void results;
}

async function hydrateFromLocalSnapshotIfNeeded(): Promise<void> {
  try {
    const raw = localStorage.getItem('carecanvas_vault_asthma_snapshot');
    if (!raw) return;
    const blob = JSON.parse(raw) as Record<string, { conditions?: unknown[]; allergies?: unknown[]; medications?: unknown[]; labs?: unknown[]; dueCards?: unknown[]; proposals?: unknown[]; calendarEvents?: unknown[]; dangerReports?: unknown[]; questionBank?: unknown[] }>;
    let totalInjected = 0;
    for (const [patientId, bundle] of Object.entries(blob)) {
      if (!patientId || localVault.hasAnyData(patientId)) continue;
      try {
        for (const c of (bundle.conditions as unknown[]) || []) { try { localVault.addCondition(c as never); totalInjected++; } catch {} }
        for (const a of (bundle.allergies as unknown[]) || []) { try { localVault.addAllergy(a as never); totalInjected++; } catch {} }
        for (const m of (bundle.medications as unknown[]) || []) { try { localVault.addMedication(m as never); totalInjected++; } catch {} }
        for (const l of (bundle.labs as unknown[]) || []) { try { localVault.addLab(l as never); totalInjected++; } catch {} }
        for (const d of (bundle.dueCards as unknown[]) || []) { try { (localVault as unknown as { addDueCard: (x: unknown)=>void }).addDueCard(d as never); totalInjected++; } catch {} }
        for (const p of (bundle.proposals as unknown[]) || []) { try { localVault.addProposal(p as never); totalInjected++; } catch {} }
        for (const e of (bundle.calendarEvents as unknown[]) || []) { try { localVault.addCalendarEvent(e as never); totalInjected++; } catch {} }
        for (const r of (bundle.dangerReports as unknown[]) || []) { try { localVault.addDangerReport(r as never); totalInjected++; } catch {} }
        for (const q of (bundle.questionBank as unknown[]) || []) { try { localVault.addQuestion(q as never); totalInjected++; } catch {} }
      } catch (e) { console.warn('[CareCanvas] snapshot inject failed for', patientId, e); }
    }
    // also hydrate doctor links if present in separate key
    try {
      const linkRaw = localStorage.getItem('carecanvas_doctor_links');
      if (linkRaw) {
        const links = JSON.parse(linkRaw) as unknown[];
        for (const lk of links) {
          try { (localVault as unknown as { addDoctorLink:(x:unknown)=>void }).addDoctorLink(lk as never); } catch {}
        }
      }
    } catch {}
    if (totalInjected > 0) console.log(`[CareCanvas] Hydrated ${totalInjected} asthma seed records from localStorage snapshot`);
  } catch (e) { console.warn('[CareCanvas] local snapshot hydration failed', e); }
}

async function bootstrap(): Promise<void> {
  await localVault.init();
  if (!localVault.isEventBusConnected()) wireLocalVaultToEventBus(eventBus);

  // 0) Local snapshot fallback — seeds 10 asthma patients + 2 doctors when Supabase disabled (dev localStorage-only)
  await hydrateFromLocalSnapshotIfNeeded();

  const storedUserId = getStoredUserId();
  if (storedUserId) {
    try {
      const { isSupabaseEnabled } = await import('./core/supabase/client.ts');
      if (isSupabaseEnabled()) {
        try {
          const { hydrateFromSupabase } = await import('./core/vault/supabaseSync.ts');
          await hydrateFromSupabase(storedUserId, localVault);
        } catch (e) { console.warn('[CareCanvas] Hydration failed — empty vault, no mock seed', e); }
      }
    } catch (e) { console.warn('[CareCanvas] Bootstrap hydration check failed — empty vault, no mock seed', e); }
  }
  // If no stored user but snapshot exists, pre-warm one patient so cold start still shows seeded vault availability check — keep lazy (no active user override)

  if (!isSecureContextCheck()) console.warn('[CareCanvas] WebMCP requires SecureContext (https:// or localhost)');
  isToolsPolicyAllowed();

  try {
    await registerAllTools();
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'InvalidStateError') console.warn('[CareCanvas] WebMCP bulk registration blocked', e);
    else console.warn('[CareCanvas] WebMCP bootstrap registration failed — fallback to polyfill, still mounting', e);
    try {
      const { webMCPEngine } = await import('./core/webmcp/WebMCPEngine.ts');
      for (const tool of allWebMCPTools) try { webMCPEngine.register(tool); } catch {}
    } catch {}
  }

  const rootElement = document.getElementById('root');
  if (rootElement) ReactDOM.createRoot(rootElement).render(<React.StrictMode><App /></React.StrictMode>);
}

bootstrap().catch(async (e: unknown) => {
  console.error('[CareCanvas] Bootstrap failed', e);
  if (!isSecureContextCheck()) console.warn('[CareCanvas] WebMCP requires SecureContext — fallback');
  isToolsPolicyAllowed();
  try { await registerAllTools(); } catch {}
  const rootElement = document.getElementById('root');
  if (rootElement) ReactDOM.createRoot(rootElement).render(<React.StrictMode><App /></React.StrictMode>);
});
