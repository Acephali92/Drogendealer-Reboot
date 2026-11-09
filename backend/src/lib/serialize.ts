/**
 * Recursively converts values that JSON cannot represent (BigInt) into strings.
 * Money values are BigInt in the database and are exposed as decimal strings in the API.
 */
export type Serialized<T> = T extends bigint
  ? string
  : T extends Date
    ? Date
    : T extends Array<infer U>
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

export function serialize<T>(value: T): Serialized<T> {
  if (typeof value === 'bigint') return value.toString() as Serialized<T>;
  if (value === null || typeof value !== 'object' || value instanceof Date) {
    return value as Serialized<T>;
  }
  if (Array.isArray(value)) return value.map((v) => serialize(v)) as Serialized<T>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
  return out as Serialized<T>;
}
