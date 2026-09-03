import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // prefix '' loads every var from .env files (incl. server-only AI_API_KEY)
  const env = loadEnv(mode, process.cwd(), '');

  // Local dev has no serverless runtime — inject the server-only key when the
  // browser (which never sees AI_API_KEY) calls the AI/OCR proxies.
  const withServerAuth = (keyName: string): ProxyOptions => ({
    target: 'https://opencode.ai',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/ai-proxy/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        const key = (
          env[keyName] ||
          process.env[keyName] ||
          env.AI_API_KEY ||
          process.env.AI_API_KEY ||
          env.VITE_AI_API_KEY ||
          process.env.VITE_AI_API_KEY ||
          env.OPENAI_API_KEY ||
          process.env.OPENAI_API_KEY ||
          ''
        ).trim();
        const existing = proxyReq.getHeader('authorization');
        if (key && (!existing || String(existing).trim().toLowerCase() === 'bearer')) {
          proxyReq.setHeader('authorization', `Bearer ${key}`);
        }
      });
    },
  });

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_AI_API_KEY': JSON.stringify(
        (env.VITE_AI_API_KEY || process.env.VITE_AI_API_KEY || env.AI_API_KEY || process.env.AI_API_KEY || env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim()
      ),
      'import.meta.env.VITE_OCR_API_KEY': JSON.stringify(
        (env.VITE_OCR_API_KEY || process.env.VITE_OCR_API_KEY || env.OCR_API_KEY || process.env.OCR_API_KEY || env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY || '').trim()
      ),
      'import.meta.env.VITE_EXA_API_KEY': JSON.stringify(
        (env.VITE_EXA_API_KEY || process.env.VITE_EXA_API_KEY || env.EXA_API_KEY || process.env.EXA_API_KEY || '').trim()
      ),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        (env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || env.SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        (env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || process.env.SUPABASE_KEY || '').trim()
      ),
      'import.meta.env.VITE_AI_ENABLED': JSON.stringify('true'),
      'import.meta.env.VITE_AI_BASE_URL': JSON.stringify(
        (env.VITE_AI_BASE_URL || process.env.VITE_AI_BASE_URL || 'https://opencode.ai/zen/go/v1/responses').trim()
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              return 'vendor';
            }
            if (id.includes('core/supabase') || id.includes('core/vault/supabaseSync')) {
              return 'supabase';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    server: {
      proxy: {
        '/api/ai-proxy': withServerAuth('AI_API_KEY'),
        '/api/ocr-proxy': {
          target: 'https://api.mistral.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ocr-proxy/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const key = (env.OCR_API_KEY || env.MISTRAL_API_KEY || process.env.OCR_API_KEY || '').trim();
              const existing = proxyReq.getHeader('authorization');
              if (key && (!existing || String(existing).trim().toLowerCase() === 'bearer')) {
                proxyReq.setHeader('authorization', `Bearer ${key}`);
              }
            });
          },
        },
        '/api/exa-proxy': {
          target: 'https://api.exa.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/exa-proxy/, ''),
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./test/setup.ts'],
      include: ['test/unit/**/*.test.ts', 'test/integration/**/*.test.ts', 'test/tier3-integration/**/*.test.ts'],
    },
  };
});
