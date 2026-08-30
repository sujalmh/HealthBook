import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { localVault } from '../src/core/vault/LocalVault';
import { webMCPEngine } from '../src/core/webmcp/WebMCPEngine';

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
