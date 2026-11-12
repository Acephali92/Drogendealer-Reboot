export type MockMode = 'all' | 'hybrid' | 'off';

/**
 * Mock-Modus aus VITE_USE_MOCKS. Ohne Angabe: in der Entwicklung 'all',
 * in Production-Builds IMMER 'off' – ein Live-Build enthält dann keinen Mock-Code
 * und keinen Service Worker. Nur ausdrücklich gesetzt (z. B. Demo-Seite) wird gemockt.
 * Reine Funktion ohne import.meta, damit auch vite.config.ts sie nutzen kann.
 */
export function resolveMockMode(raw: string | undefined, isProd: boolean): MockMode {
  if (raw === 'all' || raw === 'hybrid' || raw === 'off') return raw;
  return isProd ? 'off' : 'all';
}
