import type { MockMode } from './mockMode';

export type { MockMode };

declare const __MOCK_MODE__: MockMode;

/** Zur Build-Zeit festgelegt (vite.config.ts → resolveMockMode), daher tree-shakebar. */
export const mockMode: MockMode = __MOCK_MODE__;
