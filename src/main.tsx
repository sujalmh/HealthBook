import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { localVault, wireLocalVaultToEventBus } from './core/vault/LocalVault';
import { allWebMCPTools } from './tools';
import { eventBus } from './core/events/eventBus';
import { toSpecTool } from './core/webmcp/WebMCPAdapter';
import { webMCPEngine } from './core/webmcp/WebMCPEngine';
import { isSupabaseEnabled } from './core/supabase/client';
import { hydrateFromSupabase } from './core/vault/supabaseSync';
import { sessionState, clearSession } from './core/supabase/auth';

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
          const specTool = toSpecTool(tool, webMCPEngine);
          try {
            await doc.modelContext.registerTool(specTool, { signal: controller.signal });
            try { webMCPEngine.register(tool); } catch {}
            return;
          } catch (e: unknown) {
            const errName = (e as { name?: string })?.name || '';
            if (errName === 'NotAllowedError' || errName === 'SecurityError' || errName === 'InvalidStateError') {
              console.warn(`[Healthbook] native register blocked for ${tool.name}: ${errName}`);
              try { webMCPEngine.register(tool); } catch {}
              return;
            }
            if (errName === 'AbortError') return;
            throw e;
          }
        }
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

async function bootstrap(): Promise<void> {
  await localVault.init();
  if (!localVault.isEventBusConnected()) wireLocalVaultToEventBus(eventBus);

  try {
    if ((await sessionState()) === 'invalid') clearSession();
  } catch { /* ignore — auth gate handles signed-out state */ }

  const storedUserId = getStoredUserId();
  if (storedUserId && isSupabaseEnabled()) {
    try {
      await hydrateFromSupabase(storedUserId, localVault);
    } catch (e) { console.warn('[Healthbook] Bootstrap hydration check failed', e); }
  }

  if (!isSecureContextCheck()) console.warn('[Healthbook] WebMCP requires SecureContext (https:// or localhost)');
  isToolsPolicyAllowed();

  try {
    await registerAllTools();
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'InvalidStateError') console.warn('[Healthbook] WebMCP bulk registration blocked', e);
    else console.warn('[Healthbook] WebMCP bootstrap registration failed — fallback to polyfill, still mounting', e);
    try {
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
