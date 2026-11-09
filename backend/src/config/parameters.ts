/**
 * Loads the game parameters (docs/game-design/parameters.toml, Agent 2) at startup.
 * I/O wrapper around the pure validation in src/domain/parameters/ – fails fast with a list of
 * every problem, so a broken parameter file can never start a server (T-101).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'smol-toml';
import {
  InvalidGameParametersError,
  validateGameParameters,
  type GameParameters,
} from '../domain/parameters/index.js';

/** Repo default: <repo>/docs/game-design/parameters.toml (same depth from src/config and dist/config). */
export const DEFAULT_GAME_PARAMETERS_PATH = fileURLToPath(
  new URL('../../../docs/game-design/parameters.toml', import.meta.url),
);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Parses and validates TOML text. Integers are read as BigInt to keep int and float distinct. */
export function parseGameParameters(toml: string, source = 'game parameters'): GameParameters {
  let raw: unknown;
  try {
    raw = parse(toml, { integersAsBigInt: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new InvalidGameParametersError([{ path: '(toml syntax)', message }], source);
  }
  const result = validateGameParameters(raw);
  if (!result.ok) throw new InvalidGameParametersError(result.issues, source);
  return deepFreeze(result.params);
}

/** Reads, parses and validates the parameter file. Throws on any problem. */
export function loadGameParameters(path: string = DEFAULT_GAME_PARAMETERS_PATH): GameParameters {
  let toml: string;
  try {
    toml = readFileSync(path, 'utf8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new InvalidGameParametersError([{ path: '(file)', message }], path);
  }
  return parseGameParameters(toml, path);
}
