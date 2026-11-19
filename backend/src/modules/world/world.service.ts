import type { PrismaClient } from '@prisma/client';
import { equilibriumPrice, roundHalfUp, type GameParameters } from '../../domain/index.js';
import { notFound } from '../../lib/errors.js';
import { serialize } from '../../lib/serialize.js';
import { citySummaryView, cityView, commodityView } from '../catalog/catalog.js';
import { catalogRowSelect } from './world.selects.js';

/** Equilibrium price P* (F-ECO-07) in whole cents, commercially rounded (display value, README §2). */
const referencePrice = (params: GameParameters, cid: string, g: string): bigint =>
  roundHalfUp(equilibriumPrice(params, cid, g));

const cityNotFound = (slug: string) => notFound('CITY_NOT_FOUND', `City '${slug}' does not exist`);

/** All locations (earth cities first, then space), values from parameters.toml. */
export async function listCities(prisma: PrismaClient, params: GameParameters) {
  const rows = await prisma.city.findMany({ select: catalogRowSelect });
  const cities = rows
    .map((r) => cityView(params, r))
    .sort((a, b) => (a.realm === b.realm ? a.name.localeCompare(b.name) : a.realm === 'earth' ? -1 : 1));
  return serialize({ cities });
}

/** City details with road connections from [distances] (travel options follow with T-119). */
export async function getCity(prisma: PrismaClient, params: GameParameters, slug: string) {
  const rows = await prisma.city.findMany({ select: catalogRowSelect });
  const row = rows.find((r) => r.slug === slug);
  if (!row) throw cityNotFound(slug);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const connections = Object.entries(params.distances)
    .map(([key, distanceKm]) => {
      const [a, b] = key.split('-') as [string, string];
      const other = a === slug ? b : b === slug ? a : null;
      const target = other ? bySlug.get(other) : undefined;
      return target ? { toCityId: target.id, toCity: citySummaryView(params, target), distanceKm } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((x, y) => x.distanceKm - y.distanceKm);

  return serialize({ city: { ...cityView(params, row), connections } });
}

/**
 * Market of a city: current state per good plus the equilibrium price P* (F-ECO-07).
 * Buy/sell prices for an order follow with the trade formulas (T-103).
 */
export async function getCityMarket(prisma: PrismaClient, params: GameParameters, slug: string) {
  const city = await prisma.city.findUnique({
    where: { slug },
    select: {
      ...catalogRowSelect,
      marketStates: {
        select: {
          stock: true,
          activeEvent: true,
          eventTicksLeft: true,
          updatedAt: true,
          commodity: { select: catalogRowSelect },
        },
      },
    },
  });
  if (!city) throw cityNotFound(slug);
  const markets = city.marketStates
    .map((m) => ({
      commodity: commodityView(params, m.commodity),
      stock: m.stock,
      referencePrice: referencePrice(params, slug, m.commodity.slug),
      activeEvent: m.activeEvent,
      eventTicksLeft: m.eventTicksLeft,
      updatedAt: m.updatedAt,
    }))
    .sort((a, b) => a.commodity.name.localeCompare(b.commodity.name));
  return serialize({ city: citySummaryView(params, city), markets });
}

/** For every good: the city with the lowest and the highest equilibrium price. */
export async function getMarketOverview(prisma: PrismaClient, params: GameParameters) {
  const states = await prisma.marketState.findMany({
    select: { city: { select: catalogRowSelect }, commodity: { select: catalogRowSelect } },
  });

  type Entry = { city: { id: string; slug: string }; price: bigint };
  const byGood = new Map<string, { commodity: { id: string; slug: string }; low: Entry; high: Entry }>();
  for (const s of states) {
    const entry: Entry = {
      city: s.city,
      price: referencePrice(params, s.city.slug, s.commodity.slug),
    };
    const current = byGood.get(s.commodity.slug);
    if (!current) {
      byGood.set(s.commodity.slug, { commodity: s.commodity, low: entry, high: entry });
      continue;
    }
    if (entry.price < current.low.price) current.low = entry;
    if (entry.price > current.high.price) current.high = entry;
  }

  const commodities = [...byGood.values()]
    .map(({ commodity, low, high }) => ({
      commodity: commodityView(params, commodity),
      lowestPrice: { city: citySummaryView(params, low.city), referencePrice: low.price },
      highestPrice: { city: citySummaryView(params, high.city), referencePrice: high.price },
    }))
    .sort((a, b) => a.commodity.name.localeCompare(b.commodity.name));
  return serialize({ commodities });
}
