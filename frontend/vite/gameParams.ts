/**
 * Vite-Plugin: liest docs/game-design/parameters.toml (Agent 2) beim Build ein (ADR-020, T-115).
 *
 * - `virtual:game-images`  → Kategorie-Platzhalter aus `[images] fallback.<kategorie>`.
 *                             Klein, wird auch im Production-Build genutzt.
 * - `virtual:game-params`  → Spielparameter für den Mock-Server (Namen, Bildpfade, Preise …),
 *                             damit Mock und Backend aus derselben Quelle schöpfen.
 *                             Wird nur vom Mock-Code importiert (nicht im Production-Build).
 *
 * Kein Bildpfad und kein Anzeigename steht im Frontend-Code.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { parse } from 'smol-toml';
import type { Plugin } from 'vite';
import { safeImagePath } from '../src/lib/imagePath';

export const PARAMS_PATH = fileURLToPath(new URL('../../docs/game-design/parameters.toml', import.meta.url));

export const IMAGE_CATEGORIES = ['goods', 'vehicles', 'weapons', 'armor', 'crew', 'ships'] as const;

const IMAGES_ID = 'virtual:game-images';
const PARAMS_ID = 'virtual:game-params';

type Table = Record<string, unknown>;

export function readParams(path = PARAMS_PATH): Table {
  return parse(readFileSync(path, 'utf8')) as Table;
}

export function imageFallbacks(params: Table): Record<string, string | null> {
  const fallback = ((params.images as Table | undefined)?.fallback ?? {}) as Table;
  return Object.fromEntries(IMAGE_CATEGORIES.map((c) => [c, safeImagePath(fallback[c])]));
}

export function gameParamsPlugin(path = PARAMS_PATH): Plugin {
  return {
    name: 'game-params',
    resolveId(id) {
      if (id === IMAGES_ID || id === PARAMS_ID) return '\0' + id;
      return null;
    },
    load(id) {
      if (id !== '\0' + IMAGES_ID && id !== '\0' + PARAMS_ID) return null;
      this.addWatchFile(path);
      const params = readParams(path);
      if (id === '\0' + IMAGES_ID) {
        return `export const imageFallbacks = ${JSON.stringify(imageFallbacks(params))};`;
      }
      return `export default ${JSON.stringify(params)};`;
    },
  };
}
