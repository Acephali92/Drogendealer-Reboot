import { resolveMockMode } from './mockMode';

describe('resolveMockMode', () => {
  it('schaltet Mocks in Production-Builds standardmäßig ab', () => {
    expect(resolveMockMode(undefined, true)).toBe('off');
    expect(resolveMockMode('', true)).toBe('off');
    expect(resolveMockMode('quatsch', true)).toBe('off');
  });
  it('nutzt in der Entwicklung standardmäßig die komplette Simulation', () => {
    expect(resolveMockMode(undefined, false)).toBe('all');
  });
  it('respektiert einen expliziten Wert', () => {
    expect(resolveMockMode('hybrid', true)).toBe('hybrid');
    expect(resolveMockMode('off', false)).toBe('off');
  });
});
