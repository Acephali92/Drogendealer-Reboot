import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { generateRefreshToken, hashRefreshToken } from '../src/lib/tokens.js';
import { serialize } from '../src/lib/serialize.js';

describe('password hashing', () => {
  it('hashes with argon2id and verifies correctly', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toContain('correct horse battery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(hash, 'wrong password')).toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'whatever')).toBe(false);
  });
});

describe('refresh tokens', () => {
  it('generates unique tokens and stable hashes', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toEqual(b);
    expect(hashRefreshToken(a)).toEqual(hashRefreshToken(a));
    expect(hashRefreshToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('serialize', () => {
  it('converts nested BigInt values to strings and keeps dates', () => {
    const date = new Date();
    expect(serialize({ cash: 10n, nested: [{ bank: 5n }], at: date, n: null })).toEqual({
      cash: '10',
      nested: [{ bank: '5' }],
      at: date,
      n: null,
    });
  });
});
