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
});
