import { formatCountdown, formatDuration, progressBetween, secondsUntil } from './time';

describe('time', () => {
  it('formatiert Countdowns', () => {
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(3725)).toBe('1:02:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });
  it('formatiert Dauern', () => {
    expect(formatDuration(30)).toBe('30 Sek.');
    expect(formatDuration(2700)).toBe('45 Min.');
    expect(formatDuration(3900)).toBe('1 Std. 5 Min.');
  });
  it('berechnet Restzeit und Fortschritt', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(secondsUntil('2026-01-01T00:01:00Z', now)).toBe(60);
    expect(secondsUntil('2025-12-31T00:00:00Z', now)).toBe(0);
    expect(progressBetween('2025-12-31T23:59:00Z', '2026-01-01T00:01:00Z', now)).toBeCloseTo(0.5);
  });
});
