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
    const raw = localStorage.getItem('healthbook_active_user');
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
        console.warn('[Healthbook] tools Permissions-Policy blocked');
        return false;
      }
    }
  } catch (e) { console.warn('[Healthbook] permissionsPolicy check failed', e); }
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
              console.warn(`[Healthbook] native register blocked for ${tool.name}: ${errName}`);
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
        console.warn(`[Healthbook] WebMCP register failed for ${tool.name}`, e);
        throw e;
      }
    })
  );
  void results;
}

async function hydrateFromLocalSnapshotIfNeeded(): Promise<void> {
  try {
    const raw = localStorage.getItem('healthbook_vault_asthma_snapshot');
    if (!raw) return;
    const blob = JSON.parse(raw) as Record<string, { conditions?: unknown[]; allergies?: unknown[]; medications?: unknown[]; labs?: unknown[]; dueCards?: unknown[]; proposals?: unknown[]; calendarEvents?: unknown[]; dangerReports?: unknown[]; questionBank?: unknown[] }>;
    let totalInjected = 0;
    for (const [patientId, bundle] of Object.entries(blob)) {
      if (!patientId || localVault.hasAnyData(patientId)) continue;
      try {
        for (const c of (bundle.conditions as unknown[]) || []) { try { await localVault.addCondition(c as never); totalInjected++; } catch {} }
        for (const a of (bundle.allergies as unknown[]) || []) { try { await localVault.addAllergy(a as never); totalInjected++; } catch {} }
        for (const m of (bundle.medications as unknown[]) || []) { try { await localVault.addMedication(m as never); totalInjected++; } catch {} }
        for (const l of (bundle.labs as unknown[]) || []) { try { await localVault.addLab(l as never); totalInjected++; } catch {} }
        for (const d of (bundle.dueCards as unknown[]) || []) { try { await (localVault as unknown as { addDueCard: (x: unknown)=>Promise<unknown> }).addDueCard(d as never); totalInjected++; } catch {} }
        for (const p of (bundle.proposals as unknown[]) || []) { try { await localVault.addProposal(p as never); totalInjected++; } catch {} }
        for (const e of (bundle.calendarEvents as unknown[]) || []) { try { await localVault.addCalendarEvent(e as never); totalInjected++; } catch {} }
        for (const r of (bundle.dangerReports as unknown[]) || []) { try { await localVault.addDangerReport(r as never); totalInjected++; } catch {} }
        for (const q of (bundle.questionBank as unknown[]) || []) { try { await localVault.addQuestion(q as never); totalInjected++; } catch {} }
      } catch (e) { console.warn('[Healthbook] snapshot inject failed for', patientId, e); }
    }
    // also hydrate doctor links if present in separate key
    try {
      const linkRaw = localStorage.getItem('healthbook_doctor_links');
      if (linkRaw) {
        const links = JSON.parse(linkRaw) as unknown[];
        for (const lk of links) {
          try { await (localVault as unknown as { addDoctorLink:(x:unknown)=>Promise<unknown> }).addDoctorLink(lk as never); } catch {}
        }
      }
    } catch {}
    if (totalInjected > 0) console.log(`[Healthbook] Hydrated ${totalInjected} asthma seed records from localStorage snapshot`);
  } catch (e) { console.warn('[Healthbook] local snapshot hydration failed', e); }
}

async function bootstrap(): Promise<void> {
  await localVault.init();
  if (!localVault.isEventBusConnected()) wireLocalVaultToEventBus(eventBus);

  // 0) Session gate: server truth requires a valid session. Stale logins
  //    (expired tokens, pre-migration local logins) are cleared to the gate —
  //    otherwise the app would open an empty vault for the wrong identity.
  //    'unknown' (offline/unconfigured) leaves state untouched.
  try {
    const { sessionState, clearSession } = await import('./core/supabase/auth.ts');
    if ((await sessionState()) === 'invalid') clearSession();
  } catch { /* ignore — auth gate handles signed-out state */ }

  // 1) Offline gap-fill cache — fills ONLY patients with zero rows (server wins).
  //    Used when Supabase is unreachable/offline; never overwrites server data.
  await hydrateFromLocalSnapshotIfNeeded();

  const storedUserId = getStoredUserId();
  if (storedUserId) {
    try {
      const { isSupabaseEnabled } = await import('./core/supabase/client.ts');
      if (isSupabaseEnabled()) {
        try {
          const { hydrateFromSupabase } = await import('./core/vault/supabaseSync.ts');
          await hydrateFromSupabase(storedUserId, localVault);
        } catch (e) { console.warn('[Healthbook] Hydration failed — empty vault, no mock seed', e); }
      }
    } catch (e) { console.warn('[Healthbook] Bootstrap hydration check failed — empty vault, no mock seed', e); }
  }
  // If no stored user but snapshot exists, pre-warm one patient so cold start still shows seeded vault availability check — keep lazy (no active user override)

  if (!isSecureContextCheck()) console.warn('[Healthbook] WebMCP requires SecureContext (https:// or localhost)');
  isToolsPolicyAllowed();

  try {
    await registerAllTools();
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'InvalidStateError') console.warn('[Healthbook] WebMCP bulk registration blocked', e);
    else console.warn('[Healthbook] WebMCP bootstrap registration failed — fallback to polyfill, still mounting', e);
    try {
      const { webMCPEngine } = await import('./core/webmcp/WebMCPEngine.ts');
      for (const tool of allWebMCPTools) try { webMCPEngine.register(tool); } catch {}
    } catch {}
  }

  const rootElement = document.getElementById('root');
  if (rootElement) ReactDOM.createRoot(rootElement).render(<React.StrictMode><App /></React.StrictMode>);
}

bootstrap().catch(async (e: unknown) => {
  console.error('[Healthbook] Bootstrap failed', e);
  if (!isSecureContextCheck()) console.warn('[Healthbook] WebMCP requires SecureContext — fallback');
  isToolsPolicyAllowed();
  try { await registerAllTools(); } catch {}
  const rootElement = document.getElementById('root');
  if (rootElement) ReactDOM.createRoot(rootElement).render(<React.StrictMode><App /></React.StrictMode>);
});
