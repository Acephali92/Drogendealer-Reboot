import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex, utf8Bytes } from '../../src/domain/index.js';

describe('pure SHA-256', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
  ])('matches the FIPS 180-4 test vector for %j', (input, hex) => {
    expect(sha256Hex(input)).toBe(hex);
  });

  it.each([
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(64),
    'x'.repeat(1000),
    'ä€😀 Grünzeug',
    'seed:1:berlin/gras:0',
  ])('matches node:crypto for %j', (input) => {
    expect(sha256Hex(input)).toBe(createHash('sha256').update(input, 'utf8').digest('hex'));
  });

  it('encodes UTF-8 like Node', () => {
    const s = 'ä€😀';
    expect(Array.from(utf8Bytes(s))).toEqual(Array.from(Buffer.from(s, 'utf8')));
  });
});
