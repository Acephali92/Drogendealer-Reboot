import { useQuery } from '@tanstack/react-query';

/**
 * Betreiberangaben für Impressum und Datenschutz. Sie werden zur Laufzeit aus /legal.json
 * geladen, das nur auf dem Server liegt (ADR-015, T-307). Fehlt die Datei, gelten die
 * Platzhalter aus /legal.example.json und die Seiten zeigen eine deutliche Warnung.
 */
export interface LegalConfig {
  operatorName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  phone?: string;
  contentResponsible?: string;
  hostingProvider?: string;
  supervisoryAuthority?: string;
  lastUpdated?: string;
}

async function fetchJson(path: string): Promise<LegalConfig | null> {
  try {
    const res = await fetch(path, { headers: { Accept: 'application/json' }, cache: 'no-cache' });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
    const data = (await res.json()) as Partial<LegalConfig>;
    return data.operatorName && data.email ? (data as LegalConfig) : null;
  } catch {
    return null;
  }
}

export async function loadLegalConfig(): Promise<{ config: LegalConfig; placeholder: boolean }> {
  const real = await fetchJson(`${import.meta.env.BASE_URL}legal.json`);
  if (real) return { config: real, placeholder: false };
  const example = await fetchJson(`${import.meta.env.BASE_URL}legal.example.json`);
  return {
    config: example ?? { operatorName: '—', street: '—', postalCode: '', city: '—', country: '', email: '—' },
    placeholder: true,
  };
}

export const useLegalConfig = () =>
  useQuery({ queryKey: ['legal-config'], queryFn: loadLegalConfig, staleTime: Infinity, retry: false });
