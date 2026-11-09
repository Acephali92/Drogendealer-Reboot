import { hash, verify, Algorithm } from '@node-rs/argon2';

// OWASP-recommended argon2id parameters (19 MiB memory, 2 iterations, 1 lane).
const OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Malformed hash → treat as mismatch instead of leaking an internal error.
    return false;
  }
}

// Precomputed hash used to keep login timing similar when the user does not exist.
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('dummy-password-for-timing-equalisation');
  return dummyHash;
}
