/**
 * Domain layer: pure, deterministic game rules without I/O.
 * Imported by the backend services and by the balancing simulation (sim/, ADR-012).
 * Lint rules in eslint.config.js enforce that nothing in here touches DB, HTTP, Node APIs,
 * wall-clock time or Math.random.
 */
export * from './rng.js';
export * from './money.js';
export * from './time.js';
export * from './types.js';
