/**
 * Bildpfade laut ADR-020: relativ zu `images/`, ohne `..`, ohne Schema, Endung .webp/.png/.svg.
 * Reine Funktion – genutzt von der App (GameImage) und vom Build-Plugin (vite/gameParams.ts).
 */
export function safeImagePath(p: unknown): string | null {
  if (typeof p !== 'string') return null;
  const s = p.trim();
  if (!s || s.startsWith('/') || s.includes('..') || s.includes('://') || s.includes('\\')) return null;
  return /^[a-z0-9_\-/.]+\.(webp|png|svg)$/i.test(s) ? s : null;
}

/** Kandidaten der Fallback-Kette als URLs: Bild → Kategorie-Platzhalter (doppelte entfernt). */
export function imageCandidates(base: string, image: unknown, fallback: unknown): string[] {
  const out: string[] = [];
  for (const p of [safeImagePath(image), safeImagePath(fallback)]) {
    if (!p) continue;
    const url = `${base.replace(/\/?$/, '/')}images/${p}`;
    if (!out.includes(url)) out.push(url);
  }
  return out;
}
