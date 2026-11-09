/**
 * Deterministischer Zufall F-GLB-01/02 (docs/game-design/README.md §3).
 * Quelle ist seit PR #14 die Backend-Domain (ADR-012): Die Simulation verwendet dieselbe
 * Implementierung wie der Spielserver, kein eigener Nachbau mehr.
 */
export { normal, uniform } from '../../backend/src/domain/rng.js';
