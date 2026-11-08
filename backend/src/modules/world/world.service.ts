import type { PrismaClient } from '@prisma/client';
import { notFound } from '../../lib/errors.js';
import { serialize } from '../../lib/serialize.js';
import { citySelect, citySummarySelect, commoditySelect } from './world.selects.js';

const cityNotFound = (slug: string) => notFound('CITY_NOT_FOUND', `City '${slug}' does not exist`);

export async function listCities(prisma: PrismaClient) {
  const cities = await prisma.city.findMany({ select: citySelect, orderBy: { name: 'asc' } });
  return { cities };
}

export async function getCity(prisma: PrismaClient, slug: string) {
  const city = await prisma.city.findUnique({
    where: { slug },
    select: {
      ...citySelect,
      connectionsFrom: {
        select: { toCityId: true, distanceKm: true, toCity: { select: citySummarySelect } },
        orderBy: { distanceKm: 'asc' },
      },
    },
  });
  if (!city) throw cityNotFound(slug);
  const { connectionsFrom, ...rest } = city;
  return { city: { ...rest, connections: connectionsFrom } };
}

export async function getCityMarket(prisma: PrismaClient, slug: string) {
  const city = await prisma.city.findUnique({
    where: { slug },
    select: {
      ...citySummarySelect,
      marketPrices: {
        select: {
          buyPrice: true,
          sellPrice: true,
          supply: true,
          updatedAt: true,
          commodity: { select: commoditySelect },
        },
        orderBy: { commodity: { name: 'asc' } },
      },
    },
  });
  if (!city) throw cityNotFound(slug);
  const { marketPrices, ...summary } = city;
  return serialize({ city: summary, prices: marketPrices });
}

/** For every commodity: the cheapest city to buy and the best city to sell. */
export async function getMarketOverview(prisma: PrismaClient) {
  const prices = await prisma.marketPrice.findMany({
    select: {
      buyPrice: true,
      sellPrice: true,
      updatedAt: true,
      city: { select: citySummarySelect },
      commodity: { select: commoditySelect },
    },
  });

  type Price = (typeof prices)[number];
  const byCommodity = new Map<string, { commodity: Price['commodity']; bestBuy: Price; bestSell: Price }>();
  for (const p of prices) {
    const entry = byCommodity.get(p.commodity.id);
    if (!entry) {
      byCommodity.set(p.commodity.id, { commodity: p.commodity, bestBuy: p, bestSell: p });
      continue;
    }
    if (p.buyPrice < entry.bestBuy.buyPrice) entry.bestBuy = p;
    if (p.sellPrice > entry.bestSell.sellPrice) entry.bestSell = p;
  }

  const commodities = [...byCommodity.values()]
    .sort((a, b) => a.commodity.name.localeCompare(b.commodity.name))
    .map(({ commodity, bestBuy, bestSell }) => ({
      commodity,
      lowestBuy: { city: bestBuy.city, price: bestBuy.buyPrice, updatedAt: bestBuy.updatedAt },
      highestSell: { city: bestSell.city, price: bestSell.sellPrice, updatedAt: bestSell.updatedAt },
    }));
  return serialize({ commodities });
}
