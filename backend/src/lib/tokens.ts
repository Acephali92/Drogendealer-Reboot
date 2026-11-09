import { createHash, randomBytes } from 'node:crypto';

/** Generates an opaque, URL-safe refresh token (256 bit entropy). */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Refresh tokens are stored only as SHA-256 hashes so a DB leak does not expose sessions. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
