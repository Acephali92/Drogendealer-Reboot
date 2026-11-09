import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/i18n';
import '@/styles/index.css';
import { App } from './App';
import { mockMode } from '@/lib/env';

async function boot() {
  if (mockMode !== 'off') {
    const { startMocks } = await import('@/mocks/browser');
    await startMocks(mockMode);
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
