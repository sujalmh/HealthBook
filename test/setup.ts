import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { localVault } from '../src/core/vault/LocalVault';
import { webMCPEngine } from '../src/core/webmcp/WebMCPEngine';

// Ensure test env flags for homeLab placeholder gating and AbortController realm
if (typeof process !== 'undefined') {
  try { (process as any).env = (process as any).env || {}; (process as any).env.VITEST = 'true'; (process as any).env.NODE_ENV = 'test'; } catch {}
}
if (typeof globalThis !== 'undefined' && typeof window !== 'undefined') {
  try {
    // Align AbortController/Signal realms between Node and jsdom window to avoid RequestInit Expected signal
    if ((window as any).AbortController) (globalThis as any).AbortController = (window as any).AbortController;
    if ((window as any).AbortSignal) (globalThis as any).AbortSignal = (window as any).AbortSignal;
  } catch {}
}

beforeEach(async () => {
  // Q2 shim jsdom only — ensure document.modelContext polyfill is available via WebMCPEngine installPolyfill guarded
  // Guard: if native registerTool present, never overwrite; otherwise ensure polyfill exists for jsdom fallback parity
  if (typeof document !== 'undefined' && !(document as any).modelContext?.registerTool) {
    // singleton webMCPEngine already installed polyfill via constructor detectAndPolyfill (installPolyfill guarded)
    // touch singleton to trigger side-effect if not yet imported
    void webMCPEngine;
    // fallback: instantiate fresh engine to install polyfill if still missing (guarded install)
    if (!(document as any).modelContext?.registerTool) {
      const { WebMCPEngine } = await import('../src/core/webmcp/WebMCPEngine');
      void new WebMCPEngine();
    }
  }
  await localVault.clearAll();
});
