import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Supabase dev proxy — enables local `npm run dev` to treat Supabase as enabled
// without requiring a real DB connection. In production, Vercel's `api/supabase.ts`
// handles the same route with `pg` and DATABASE_URL. This keeps `isSupabaseEnabled()`
// true in dev (VITE_SUPABASE_URL present) and avoids 404 for /api/supabase/*.
function supabaseDevProxy() {
  return {
    name: 'supabase-dev-proxy',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url || !req.url.startsWith('/api/supabase')) {
          return next();
        }
        // Handle CORS preflight
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, X-Requested-With, Prefer');
        res.setHeader('Access-Control-Max-Age', '86400');
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }
        const url = req.url || '';
        const method = (req.method || 'GET').toUpperCase();
        // Parse table from /api/supabase/rest/v1/<table>
        const tableMatch = url.match(/\/rest\/v1\/([^\/\?]+)/);
        const table = tableMatch ? tableMatch[1] : new URL(url, 'http://localhost').searchParams.get('table');

        if (method === 'GET') {
          // For dev, return empty array (no persisted rows yet) — still considered enabled
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          return res.end(JSON.stringify([]));
        }
        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
          let body = '';
          req.on('data', (chunk: any) => (body += chunk));
          req.on('end', () => {
            try {
              const parsed = body ? JSON.parse(body) : {};
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              // Echo back the record as if upsert succeeded
              const record = parsed && typeof parsed === 'object' ? parsed : {};
              // If body is the record itself, return it; if it has table wrapper, unwrap
              const ret = (record as any).payload ? (record as any) : record;
              res.end(JSON.stringify(ret));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e?.message || String(e) }));
            }
          });
          return;
        }
        if (method === 'DELETE') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true }));
        }
        res.statusCode = 405;
        res.end(JSON.stringify({ error: `method ${method} not allowed` }));
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env so process.env gets DATABASE_URL etc. for server middleware
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (!(process.env as any)[k]) (process.env as any)[k] = v;
  }
  return {
  plugins: [react(), supabaseDevProxy()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/ai-proxy': {
        target: 'https://opencode.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai-proxy/, ''),
      },
      '/api/ocr-proxy': {
        target: 'https://api.mistral.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ocr-proxy/, ''),
      },
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
  };
});
