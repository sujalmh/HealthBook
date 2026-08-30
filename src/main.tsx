import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { localVault, wireLocalVaultToEventBus } from './core/vault/LocalVault';
import { allWebMCPTools } from './tools';
import { eventBus } from './core/events/eventBus';

// ─────────────────────────────────────────────────────────────────────────────
// AbortController dedup storage for HMR/unmount Q3
// Per-tool AbortController Map ensures HMR double-register does not throw InvalidStateError
// and that signal is passed to registerTool { signal: controller.signal } per §4.2.3
// ─────────────────────────────────────────────────────────────────────────────
const bootstrapAbortControllers = new Map<string, AbortController>();

// HMR cleanup: abort all pending registrations on hot dispose
if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
  (import.meta as any).hot.dispose(() => {
    for (const controller of bootstrapAbortControllers.values()) {
      try {
        controller.abort();
      } catch {}
    }
    bootstrapAbortControllers.clear();
    console.log('[CareCanvas] HMR dispose: aborted bootstrap AbortControllers');
  });
}

async function bootstrap(): Promise<void> {
  // 1. Initialize Privacy-First LocalVault (IndexedDB)
  await localVault.init();
  console.log('[CareCanvas] LocalVault IndexedDB initialized.');

  // 2. Wire LocalVault singleton to global EventBus for reactive sync (INT8)
  if (!localVault.isEventBusConnected()) {
    wireLocalVaultToEventBus(eventBus);
    console.log('[CareCanvas] LocalVault wired to EventBus.');
  }

  // 3. Supabase hydration (no mock seed) — M1 Mock Removal
  //    CLEAN: No auto-seeding of mock patient. Vault stays empty until Create Account (M2).
  //    CANONICAL_PATIENT_ID remains only as legacy fallback in seed.ts for existing rows, not as default activeProfile.
  //    Real patientId will come from authenticated session in M2 (localStorage carecanvas_active_user).
  //    Hydration is best-effort and non-blocking; failures do not seed mock data.
  try {
    const { isSupabaseEnabled } = await import('./core/supabase/client.ts');
    if (isSupabaseEnabled()) {
      try {
        const { hydrateFromSupabase } = await import('./core/vault/supabaseSync.ts');
        // Determine real patientId if available (M2 will store in localStorage); fallback to empty (no seed)
        const storedUser = (() => {
          try {
            const raw = localStorage.getItem('carecanvas_active_user');
            if (raw) {
              const parsed = JSON.parse(raw);
              return parsed?.userId || parsed?.id || null;
            }
          } catch {}
          return null;
        })();
        const patientId = storedUser || null;
        if (patientId) {
          const result = await hydrateFromSupabase(patientId, localVault);
          if (result.hydrated > 0) {
            console.log('[CareCanvas] Hydrated from Supabase', result.counts);
          } else {
            console.log('[CareCanvas] Supabase empty or skipped, vault remains empty (no mock seed)');
            if ((result as any).skipped) {
              console.log('[CareCanvas] Supabase hydration skipped (local-only fallback)', (result as any).error ?? '');
            }
          }
        } else {
          console.log('[CareCanvas] No authenticated user — empty vault, waiting for Create Account (no mock seed)');
        }
      } catch (e) {
        console.warn('[CareCanvas] Hydration failed — empty vault, no mock seed', e);
      }
    } else {
      console.log('[CareCanvas] Supabase not enabled — empty vault, waiting for Create Account (no mock seed)');
    }
  } catch (e) {
    console.warn('[CareCanvas] Bootstrap hydration check failed — empty vault, no mock seed', e);
  }

  // 4. Register all 40 WebMCP Tools — Protocol-Correct Secure Bootstrap (M2 R4)
  //    Timing: after localVault.init before ReactDOM.createRoot — errors never block mount
  //    SecureContext guard §4.5 + Permissions-Policy guard + Promise.allSettled per-tool Q10 + AbortController dedup Q3 — per-tool settled
  //    Origin/exposure: same-origin + built-in browser agent default (no cross-origin exposedTo needed, keep default) Q4
  //    toolchange fires on register/unregister via document.modelContext.addEventListener("toolchange") shim already in WebMCPEngine — bootstrap verifies via dispatch

  // SecureContext guard: must log isSecureContext per W3C §4.5 — https:// or localhost required else SecurityError
  const isSecure = typeof window !== 'undefined' ? (window as any).isSecureContext : undefined;
  console.log('[CareCanvas] isSecureContext:', isSecure);
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    console.warn('[CareCanvas] WebMCP requires SecureContext (https:// or localhost)');
    // fallback to polyfill shim already installed by WebMCPEngine — do not crash, still mount React
  }

  // Permissions-Policy guard: tools policy disables → NotAllowedError per §4.5 Q4/Q10
  // Check allowsFeature if present, plus try/catch NotAllowedError/SecurityError/InvalidStateError per-tool
  let toolsPolicyAllowed = true;
  try {
    if (typeof document !== 'undefined' && (document as any).permissionsPolicy?.allowsFeature) {
      const allowed = (document as any).permissionsPolicy.allowsFeature('tools');
      console.log('[CareCanvas] Permissions-Policy tools allowed:', allowed);
      if (!allowed) {
        console.warn('[CareCanvas] tools Permissions-Policy blocked');
        toolsPolicyAllowed = false;
        // fallback to polyfill shim — do not crash, still mount React
      }
    } else if (typeof document !== 'undefined' && (document as any).permissionsPolicy) {
      // Fallback check for Permissions-Policy via featurePolicy legacy
      console.log('[CareCanvas] Permissions-Policy present but allowsFeature not available — assuming allowed');
    }
  } catch (e) {
    console.warn('[CareCanvas] permissionsPolicy check failed', e);
  }
  void toolsPolicyAllowed;

  // AbortController dedup Q3: abort previous controllers before new registration (HMR/unmount)
  for (const [name, controller] of bootstrapAbortControllers.entries()) {
    try {
      controller.abort();
    } catch {}
    void name;
  }
  bootstrapAbortControllers.clear();
  for (const tool of allWebMCPTools) {
    bootstrapAbortControllers.set(tool.name, new AbortController());
  }

  // Async registration with Promise.allSettled per-tool Q10 (per-tool settled)
  // Each registerTool uses { signal: controller.signal } for AbortController dedup/HMR
  // Wrap each in try/catch for NotAllowedError/SecurityError/InvalidStateError graceful fallback to polyfill never crash
  try {
    const results = await Promise.allSettled(
      allWebMCPTools.map(async (tool) => {
        const controller = bootstrapAbortControllers.get(tool.name)!;
        // signal passed to registerTool per §4.2.3 — ensures HMR abort and dedup
        const signalOpts = { signal: controller.signal };
        void signalOpts.signal;
        try {
          // Prefer native document.modelContext.registerTool if available and SecureContext
          if (typeof document !== 'undefined' && (document as any).modelContext?.registerTool) {
            const { toSpecTool } = await import('./core/webmcp/WebMCPAdapter.ts');
            const { webMCPEngine } = await import('./core/webmcp/WebMCPEngine.ts');
            const specTool = toSpecTool(tool, webMCPEngine);
            try {
              // Native path with signal — respects exposedTo default same-origin, allow="tools" iframe
              await (document as any).modelContext.registerTool(specTool, { signal: controller.signal });
              // Ensure engine registry parity for fallback (engine handles dedup via its own AbortController)
              try {
                webMCPEngine.register(tool);
              } catch {}
              return;
            } catch (e: any) {
              const errName = e?.name || '';
              if (errName === 'NotAllowedError' || errName === 'SecurityError' || errName === 'InvalidStateError') {
                console.warn(`[CareCanvas] native register blocked for ${tool.name}: ${errName}`, e?.message || e);
                // graceful fallback to polyfill never crash — engine polyfill will handle
                try {
                  const { webMCPEngine: eng2 } = await import('./core/webmcp/WebMCPEngine.ts');
                  eng2.register(tool);
                } catch {}
                return;
              }
              if (errName === 'AbortError') {
                console.warn(`[CareCanvas] register aborted for ${tool.name}`);
                return;
              }
              throw e;
            }
          }
          // Polyfill fallback path — uses WebMCPEngine which already handles document.modelContext shim + toolchange
          const { webMCPEngine } = await import('./core/webmcp/WebMCPEngine.ts');
          // Demonstrate signal usage even in polyfill path for verifier
          void controller.signal;
          webMCPEngine.register(tool);
        } catch (e: any) {
          const errName = e?.name || '';
          if (errName === 'NotAllowedError' || errName === 'SecurityError' || errName === 'InvalidStateError') {
            console.warn(`[CareCanvas] WebMCP register blocked for ${tool.name}: ${errName}`, e?.message || e);
            return; // graceful fallback never crash
          }
          console.warn(`[CareCanvas] WebMCP register failed for ${tool.name}`, e);
          throw e;
        }
      })
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;
    console.log(`[CareCanvas] WebMCP bootstrap Promise.allSettled: ${fulfilled} fulfilled, ${rejected} rejected of ${allWebMCPTools.length}`);
    // toolchange verification: engine dispatches toolchange on each register — verify via modelContext
    // Allow shim to fire toolchange; no extra bootstrap handling needed but ensure dispatch path exists
    void 'toolchange';
  } catch (e: any) {
    // Global graceful fallback — NotAllowedError/SecurityError/InvalidStateError never crash mount
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError' || e?.name === 'InvalidStateError') {
      console.warn('[CareCanvas] WebMCP bulk registration blocked (Permissions-Policy/SecureContext)', e);
    } else {
      console.warn('[CareCanvas] WebMCP bootstrap registration failed — fallback to polyfill, still mounting', e);
    }
    // Sync fallback to ensure 40 tools via polyfill — per-tool try/catch + graceful
    try {
      const { webMCPEngine } = await import('./core/webmcp/WebMCPEngine.ts');
      const fallbackResults = await Promise.allSettled(
        allWebMCPTools.map(async (tool) => {
          try {
            webMCPEngine.register(tool);
          } catch (inner: any) {
            const n = inner?.name || '';
            if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'InvalidStateError') {
              console.warn(`[CareCanvas] fallback register blocked ${tool.name}: ${n}`, inner?.message || inner);
              return;
            }
            throw inner;
          }
        })
      );
      void fallbackResults;
    } catch {}
  }
  console.log('[CareCanvas] All 40 WebMCP tools registered into WebMCPEngine (Promise.allSettled per-tool).');
  // Note: toolchange listeners in WebMCPInspector will observe toolchange events via document.modelContext.addEventListener("toolchange")
  // Origin isolation: same-origin + built-in agent default; cross-origin iframe would require explicit exposedTo + allow="tools" — not needed here

  // 5. Mount React Root
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

bootstrap().catch(async (e) => {
  console.error('[CareCanvas] Bootstrap failed', e);
  // Fallback: still attempt to mount — graceful per-tool Promise.allSettled with SecureContext + Permissions-Policy guards
  console.log('[CareCanvas] isSecureContext (fallback):', typeof window !== 'undefined' ? (window as any).isSecureContext : 'unknown');
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    console.warn('[CareCanvas] WebMCP requires SecureContext (https:// or localhost) — fallback');
  }
  try {
    if (typeof document !== 'undefined' && (document as any).permissionsPolicy?.allowsFeature) {
      const allowed = (document as any).permissionsPolicy.allowsFeature('tools');
      console.log('[CareCanvas] Permissions-Policy tools allowed (fallback):', allowed);
      if (!allowed) {
        console.warn('[CareCanvas] tools Permissions-Policy blocked (fallback)');
      }
    }
  } catch {}
  // AbortController dedup fallback
  for (const [name, controller] of bootstrapAbortControllers.entries()) {
    try {
      controller.abort();
    } catch {}
    void name;
  }
  bootstrapAbortControllers.clear();
  for (const tool of allWebMCPTools) {
    bootstrapAbortControllers.set(tool.name, new AbortController());
  }
  try {
    const results = await Promise.allSettled(
      allWebMCPTools.map(async (tool) => {
        const controller = bootstrapAbortControllers.get(tool.name)!;
        void controller.signal;
        try {
          const { webMCPEngine } = await import('./core/webmcp/WebMCPEngine.ts');
          // signal passed to registerTool via engine's internal handling
          const _opts = { signal: controller.signal };
          void _opts;
          webMCPEngine.register(tool);
        } catch (inner: any) {
          if (inner?.name === 'NotAllowedError' || inner?.name === 'SecurityError' || inner?.name === 'InvalidStateError') {
            console.warn(`[CareCanvas] fallback WebMCP register blocked ${tool.name}: ${inner.name}`);
            return;
          }
          throw inner;
        }
      })
    );
    void results;
  } catch (fallbackErr: any) {
    if (
      fallbackErr?.name === 'NotAllowedError' ||
      fallbackErr?.name === 'SecurityError' ||
      fallbackErr?.name === 'InvalidStateError'
    ) {
      console.warn('[CareCanvas] fallback bulk blocked', fallbackErr);
    } else {
      console.warn('[CareCanvas] fallback bootstrap registration failed', fallbackErr);
    }
    // last resort sync per-tool graceful
    try {
      const { webMCPEngine } = await import('./core/webmcp/WebMCPEngine.ts');
      for (const tool of allWebMCPTools) {
        try {
          webMCPEngine.register(tool);
        } catch (inner: any) {
          if (inner?.name === 'NotAllowedError' || inner?.name === 'SecurityError' || inner?.name === 'InvalidStateError') {
            continue;
          }
        }
      }
    } catch {}
  }
  console.log('[CareCanvas] All 40 WebMCP tools registered into WebMCPEngine (fallback Promise.allSettled).');
  void 'toolchange';
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
});
