import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { rmSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { resolveMockMode } from './src/lib/mockMode';
import { gameParamsPlugin } from './vite/gameParams';

/** Entfernt den MSW-Service-Worker aus dem Build, wenn keine Mocks ausgeliefert werden. */
function stripMockWorker(enabled: boolean): Plugin {
  return {
    name: 'strip-mock-worker',
    apply: 'build',
    closeBundle() {
      if (enabled)
        rmSync(fileURLToPath(new URL('./dist/mockServiceWorker.js', import.meta.url)), { force: true });
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const mockMode = resolveMockMode(env.VITE_USE_MOCKS, command === 'build' && mode === 'production');
  return {
    plugins: [react(), gameParamsPlugin(), stripMockWorker(mockMode === 'off')],
    define: { __MOCK_MODE__: JSON.stringify(mockMode) },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: env.VITE_BACKEND_URL || 'http://localhost:3000', changeOrigin: true },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
