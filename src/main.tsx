import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { localVault, wireLocalVaultToEventBus } from './core/vault/LocalVault';
import { registerAllWebMCPTools } from './tools';
import { eventBus } from './core/events/eventBus';

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

  // 4. Register all 40 WebMCP Tools across 7 Modules
  registerAllWebMCPTools();
  console.log('[CareCanvas] All 40 WebMCP tools registered into WebMCPEngine.');

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

bootstrap().catch((e) => {
  console.error('[CareCanvas] Bootstrap failed', e);
  // Fallback: still attempt to mount
  registerAllWebMCPTools();
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
});
