/** Reference values exported from docs/game-design/tools/verify.py (scripts/export-golden-vectors.py). */
import { readFileSync } from 'node:fs';

export interface GoldenRngRow {
  seed: string;
  tick: number;
  entity: string;
  k: number;
  uniform: number;
  normal: number;
}

export interface GoldenVectors {
  sources: Record<string, string>;
  examples: Record<string, Record<string, unknown>>;
  parameters: Record<string, unknown>;
  rng: GoldenRngRow[];
}

export const golden: GoldenVectors = JSON.parse(
  readFileSync(new URL('../golden/golden-vectors.json', import.meta.url), 'utf8'),
);

export const PARAMETERS_TOML = readFileSync(
  new URL('../../../docs/game-design/parameters.toml', import.meta.url),
  'utf8',
);
