import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { localVault, wireLocalVaultToEventBus } from './core/vault/LocalVault';
import { registerAllWebMCPTools } from './tools';
import { eventBus } from './core/events/eventBus';
import { seedIfEmpty, CANONICAL_PATIENT_ID } from './core/vault/seed.ts';

async function bootstrap(): Promise<void> {
  // 1. Initialize Privacy-First LocalVault (IndexedDB)
  await localVault.init();
  console.log('[CareCanvas] LocalVault IndexedDB initialized.');

  // 2. Wire LocalVault singleton to global EventBus for reactive sync (INT8)
  if (!localVault.isEventBusConnected()) {
    wireLocalVaultToEventBus(eventBus);
    console.log('[CareCanvas] LocalVault wired to EventBus.');
  }

  // 3. Supabase hydration with local seed fallback (M3)
  //    - If Supabase is enabled (env DATABASE_URL present), hydrate first.
  //    - If hydrated>0 skip seed (vault already has remote data, idempotent).
  //    - Else (skipped / hydrated===0 / error / offline) fall back to seedIfEmpty (single source, idempotent).
  //    - If Supabase is not enabled (missing DATABASE_URL), local-only path: seedIfEmpty only.
  //    - All errors are non-blocking; hydration before React mount with fallback so mount always succeeds.
  //    - wireLocalVaultToEventBus remains wired above; App.tsx hidden wrappers untouched (cohesion preserved).
  try {
    const { isSupabaseEnabled } = await import('./core/supabase/client.ts');
    if (isSupabaseEnabled()) {
      try {
        const { hydrateFromSupabase } = await import('./core/vault/supabaseSync.ts');
        const result = await hydrateFromSupabase(CANONICAL_PATIENT_ID, localVault);
        if (result.hydrated > 0) {
          console.log('[CareCanvas] Hydrated from Supabase', result.counts);
        } else {
          // Fallback to seed if empty (no remote rows) or skipped (REST not configured / local-only mode)
          const seedRes = seedIfEmpty(localVault, CANONICAL_PATIENT_ID);
          if (seedRes.seeded) {
            console.log(`[CareCanvas] Seeded canonical patient ${CANONICAL_PATIENT_ID}`, seedRes.counts, seedRes.inserted);
          } else {
            console.log(`[CareCanvas] Seed skipped (${seedRes.reason}) for ${CANONICAL_PATIENT_ID}`, seedRes.counts);
          }
          if (result.skipped) {
            console.log('[CareCanvas] Supabase hydration skipped (local-only fallback)', result.error ?? '');
          } else if (result.hydrated === 0) {
            console.log('[CareCanvas] Supabase empty, seeded locally');
          }
        }
      } catch (e) {
        console.warn('[CareCanvas] Hydration failed, falling back to seed', e);
        try {
          const seedRes = seedIfEmpty(localVault, CANONICAL_PATIENT_ID);
          if (seedRes.seeded) {
            console.log(`[CareCanvas] Seeded canonical patient ${CANONICAL_PATIENT_ID}`, seedRes.counts, seedRes.inserted);
          } else {
            console.log(`[CareCanvas] Seed skipped (${seedRes.reason}) for ${CANONICAL_PATIENT_ID}`, seedRes.counts);
          }
        } catch (se) {
          console.warn('[CareCanvas] Seed failed — continuing without baseline', se);
        }
      }
    } else {
      // Local-only fallback: env missing => seed directly (graceful)
      try {
        const result = seedIfEmpty(localVault, CANONICAL_PATIENT_ID);
        if (result.seeded) {
          console.log(`[CareCanvas] Seeded canonical patient ${CANONICAL_PATIENT_ID}`, result.counts, result.inserted);
        } else {
          console.log(`[CareCanvas] Seed skipped (${result.reason}) for ${CANONICAL_PATIENT_ID}`, result.counts);
        }
      } catch (e) {
        console.warn('[CareCanvas] Seed failed — continuing without baseline', e);
      }
    }
  } catch (e) {
    console.warn('[CareCanvas] Bootstrap hydration check failed — falling back to seed', e);
    try {
      const result = seedIfEmpty(localVault, CANONICAL_PATIENT_ID);
      if (result.seeded) {
        console.log(`[CareCanvas] Seeded canonical patient ${CANONICAL_PATIENT_ID}`, result.counts, result.inserted);
      } else {
        console.log(`[CareCanvas] Seed skipped (${result.reason}) for ${CANONICAL_PATIENT_ID}`, result.counts);
      }
    } catch (se) {
      console.warn('[CareCanvas] Seed failed — continuing without baseline', se);
    }
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
