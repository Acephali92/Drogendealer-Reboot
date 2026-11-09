export type MockMode = 'all' | 'hybrid' | 'off';
const raw = import.meta.env.VITE_USE_MOCKS;
export const mockMode: MockMode = raw === 'hybrid' || raw === 'off' ? raw : 'all';
