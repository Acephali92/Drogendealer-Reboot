/**
 * Catalog = goods, locations, vehicle and equipment types. All values and display names come from
 * parameters.toml (single source of truth); the DB tables only hold `id` + technical key (`slug`)
 * for foreign keys and journals (data model v2, docs/database/DATA_MODEL.md).
 */
import type { EquipmentSlot, Prisma, PrismaClient } from '@prisma/client';
import { imageFor, loc, type GameParameters, type ImageCategory } from '../../domain/index.js';

type Db = PrismaClient | Prisma.TransactionClient;

const own = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

export class CatalogMismatchError extends Error {
  constructor(public readonly problems: readonly string[]) {
    super(
      `Catalog in the database does not match parameters.toml:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
    this.name = 'CatalogMismatchError';
  }
}

/** Keys per catalog table as defined by the parameters. */
export function catalogKeys(params: GameParameters) {
  return {
    cities: [...Object.keys(params.city), ...Object.keys(params.space_location)],
    commodities: Object.keys(params.goods),
    vehicleTypes: Object.keys(params.vehicles),
    equipmentTypes: [
      ...Object.keys(params.weapons).map((slug) => ({ slug, slot: 'WEAPON' as EquipmentSlot })),
      ...Object.keys(params.armor).map((slug) => ({ slug, slot: 'ARMOR' as EquipmentSlot })),
    ],
  };
}

/**
 * Makes the catalog tables match the parameters at startup: missing keys are inserted; keys in the
 * DB that the parameters no longer define (or with a different equipment slot) abort the start,
 * because journals may reference them and their values would be unknown.
 */
export async function syncCatalog(prisma: PrismaClient, params: GameParameters): Promise<void> {
  const keys = catalogKeys(params);
  const problems: string[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.city.createMany({ data: keys.cities.map((slug) => ({ slug })), skipDuplicates: true });
    await tx.commodity.createMany({ data: keys.commodities.map((slug) => ({ slug })), skipDuplicates: true });
    await tx.vehicleType.createMany({
      data: keys.vehicleTypes.map((slug) => ({ slug })),
      skipDuplicates: true,
    });
    await tx.equipmentType.createMany({ data: keys.equipmentTypes, skipDuplicates: true });

    const unknown = async (table: string, rows: { slug: string }[], allowed: readonly string[]) => {
      const set = new Set(allowed);
      for (const r of rows)
        if (!set.has(r.slug)) problems.push(`${table} "${r.slug}" is not defined in parameters.toml`);
    };
    await unknown('city', await tx.city.findMany({ select: { slug: true } }), keys.cities);
    await unknown('commodity', await tx.commodity.findMany({ select: { slug: true } }), keys.commodities);
    await unknown(
      'vehicle type',
      await tx.vehicleType.findMany({ select: { slug: true } }),
      keys.vehicleTypes,
    );

    const slots = new Map(keys.equipmentTypes.map((e) => [e.slug, e.slot]));
    for (const e of await tx.equipmentType.findMany({ select: { slug: true, slot: true } })) {
      const expected = slots.get(e.slug);
      if (!expected) problems.push(`equipment type "${e.slug}" is not defined in parameters.toml`);
      else if (expected !== e.slot)
        problems.push(`equipment type "${e.slug}" has slot ${e.slot}, parameters say ${expected}`);
    }
  });

  if (problems.length > 0) throw new CatalogMismatchError(problems);
}

// ── API views (values from parameters, ids from the DB) ─────────────────────────────

export interface CatalogRow {
  id: string;
  slug: string;
}

export function cityView(params: GameParameters, row: CatalogRow) {
  const { c, realm } = loc(params, row.slug);
  return {
    id: row.id,
    slug: row.slug,
    name: c.name,
    realm,
    pop: c.pop,
    wealth: c.wealth,
    police: c.police,
    fuelPrice: c.fuel_price,
    spaceport: realm === 'earth' ? (params.city[row.slug]?.spaceport ?? false) : false,
  };
}

export function citySummaryView(params: GameParameters, row: CatalogRow) {
  return { id: row.id, slug: row.slug, name: loc(params, row.slug).c.name };
}

export function commodityView(params: GameParameters, row: CatalogRow) {
  if (!own(params.goods, row.slug)) throw new RangeError(`unknown good: ${row.slug}`);
  const g = params.goods[row.slug]!;
  return {
    id: row.id,
    slug: row.slug,
    name: g.name,
    realm: g.realm,
    basePrice: g.base_price,
    unitVolume: g.volume,
    image: imageFor(params, 'goods', row.slug),
  };
}

export function vehicleTypeView(params: GameParameters, row: CatalogRow) {
  if (!own(params.vehicles, row.slug)) throw new RangeError(`unknown vehicle type: ${row.slug}`);
  const v = params.vehicles[row.slug]!;
  return {
    id: row.id,
    slug: row.slug,
    name: v.name,
    price: v.price,
    speedKmh: v.speed,
    consumptionPer100Km: v.consumption,
    capacity: v.capacity,
    hide: v.hide,
    image: imageFor(params, 'vehicles', row.slug),
  };
}

const SLOT_SECTION: Record<EquipmentSlot, ImageCategory & ('weapons' | 'armor')> = {
  WEAPON: 'weapons',
  ARMOR: 'armor',
};

export function equipmentTypeView(params: GameParameters, row: CatalogRow & { slot: EquipmentSlot }) {
  const section = params[SLOT_SECTION[row.slot]];
  if (!own(section, row.slug)) throw new RangeError(`unknown ${row.slot.toLowerCase()}: ${row.slug}`);
  const e = section[row.slug]!;
  return {
    id: row.id,
    slug: row.slug,
    slot: row.slot,
    /** Display name from parameters.toml (T-117); null while an entry has none. */
    name: e.name ?? null,
    strength: e.strength,
    price: e.price,
    image: imageFor(params, SLOT_SECTION[row.slot], row.slug),
  };
}

/** Lookup helper: slug → id for a catalog table. */
export async function idsBySlug(db: Db, table: 'city' | 'commodity'): Promise<Map<string, string>> {
  const rows =
    table === 'city'
      ? await db.city.findMany({ select: { id: true, slug: true } })
      : await db.commodity.findMany({ select: { id: true, slug: true } });
  return new Map(rows.map((r) => [r.slug, r.id]));
}
