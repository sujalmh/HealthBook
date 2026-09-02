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
        const key = (env[keyName] || process.env[keyName] || '').trim();
        const existing = proxyReq.getHeader('authorization');
        if (key && (!existing || String(existing).trim().toLowerCase() === 'bearer')) {
          proxyReq.setHeader('authorization', `Bearer ${key}`);
        }
      });
    },
  });

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
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
