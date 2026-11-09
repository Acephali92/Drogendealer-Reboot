import { createState, type MockState } from './engine';

const KEY = 'dd-mock-state-v1';
let state: MockState | null = null;

export function getState(): MockState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockState;
      if (parsed.version === 1) state = parsed;
    }
  } catch {
    /* Speicher nicht verfügbar – frischer Zustand */
  }
  state ??= createState(Date.now(), Math.floor(Math.random() * 1e9));
  return state;
}

export function saveState() {
  if (!state) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignorieren */
  }
}

/** Setzt die simulierte Welt zurück (Konto → Entwickler-Optionen). */
export function resetState() {
  state = createState(Date.now(), Math.floor(Math.random() * 1e9));
  saveState();
}
