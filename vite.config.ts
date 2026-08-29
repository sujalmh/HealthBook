import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // ------------------------------------------------------------------
    // Test inclusion strategy — dual verification tracks (see TEST_READY.md)
    // ------------------------------------------------------------------
    // vitest (npm test): now expanded to 149 tests — 10 files under test/unit
    //   + test/integration plus 2 tier3 integration files (cohesion + supabase)
    //   (test/tier3-integration/*.test.ts) that are written in vitest
    //   `describe/it` format (unlike the custom harness suites under
    //   test/tier* / test/e2e-flows which use createTestHarness and remain
    //   exercised via test-runner). Including tier3-integration/*.test.ts here ensures
    //   `npm test` reflects the M4 cohesion + Supabase adversarial flows while `npm run test:all`
    //   still covers the exhaustive 231-test 4-tier + E2E harness.
    // test-runner (npm run test:all / npx tsx test/test-runner.ts): full
    //   231 tests across 15 suites — Tier 1 (40 tools, 200 tests) + Tier 2
    //   boundary T2-01..T2-12 + Tier 3 INT-01..INT-12 + Tier 4 workloads
    //   (Harold Jenkins / Shanti Devi) + E2E Flows A-E.
    // Divergence: vitest = 149+ (unit + integration + tier3), test-runner
    //   = 231 (exhaustive 4-tier + E2E). Both must PASS for M7 Success Auditor.
    include: ['test/unit/**/*.test.ts', 'test/integration/**/*.test.ts', 'test/tier3-integration/**/*.test.ts'],
  },
} as any);
