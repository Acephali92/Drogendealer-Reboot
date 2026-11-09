import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Schriften selbst gehostet (ADR-015: keine Google-Fonts-CDN-Aufrufe), nur Latin-Teilmenge
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
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
