/**
 * Mock-Spieldaten. Zahlen, Anzeigenamen und Bildpfade kommen beim Build aus
 * docs/game-design/parameters.toml (Agent 2) über das virtuelle Modul `virtual:game-params`
 * (vite/gameParams.ts, ADR-020) – Mock und Backend schöpfen aus derselben Quelle.
 * Schlüssel/Slugs sind technisch und werden nie angezeigt (T-112). Geld in Cent (ADR-019),
 * Laderaum in Volumeneinheiten (T-119).
 *
 * Nur hier gepflegt (nicht Teil der Spezifikation, reine Demo): Bots und Bot-Clans.
 */
import params from 'virtual:game-params';

type Table = Record<string, unknown>;
const table = (key: string): Table => (params[key] ?? {}) as Table;
const entries = (key: string): [string, Table][] => Object.entries(table(key)) as [string, Table][];
const num = (t: Table, k: string, d = 0): number => (typeof t[k] === 'number' ? (t[k] as number) : d);
const str = (t: Table, k: string): string | null => (typeof t[k] === 'string' ? (t[k] as string) : null);
const numMap = (v: unknown): Record<string, number> =>
  Object.fromEntries(Object.entries((v ?? {}) as Table).filter(([, x]) => typeof x === 'number')) as Record<
    string,
    number
  >;

export interface CitySeed {
  slug: string;
  name: string;
  /** Einwohner in Tausend */
  pop: number;
  wealth: number;
  /** 0–1 */
  police: number;
  /** ct pro Liter */
  fuelPrice: number;
  spaceport: boolean;
  supply: Record<string, number>;
  demand: Record<string, number>;
}

/** Nur Erdstädte; Weltraumorte kommen mit dem Weltraum-Feature. */
export const CITIES: CitySeed[] = entries('city').map(([slug, c]) => ({
  slug,
  name: str(c, 'name') ?? '—',
  pop: num(c, 'pop', 100),
  wealth: num(c, 'wealth', 1),
  police: num(c, 'police', 0.5),
  fuelPrice: num(c, 'fuel_price', 185),
  spaceport: c.spaceport === true,
  supply: numMap(c.supply),
  demand: numMap(c.demand),
}));

/** Straßendistanzen in km, Schlüssel alphabetisch „a-b“ ([distances]). */
export const DISTANCES: Record<string, number> = numMap(params.distances);

export interface CommoditySeed {
  slug: string;
  name: string;
  /** Volumeneinheiten je Einheit */
  volume: number;
  /** ct pro Einheit */
  basePrice: number;
  heat: number;
  image: string | null;
}

/** Nur Erdwaren; Weltraumwaren werden erst mit dem Weltraum-Feature gehandelt. */
export const COMMODITIES: CommoditySeed[] = entries('goods')
  .filter(([, g]) => (str(g, 'realm') ?? 'earth') === 'earth')
  .map(([slug, g]) => ({
    slug,
    name: str(g, 'name') ?? '—',
    volume: num(g, 'volume', 1),
    basePrice: num(g, 'base_price', 1000),
    heat: num(g, 'heat', 1),
    image: str(g, 'image'),
  }));

export interface VehicleSeed {
  slug: string;
  name: string;
  price: number;
  speedKmh: number;
  /** Liter pro 100 km */
  consumption: number;
  /** Volumeneinheiten */
  capacity: number;
  hide: number;
  image: string | null;
}

export const VEHICLES: VehicleSeed[] = entries('vehicles').map(([slug, v]) => ({
  slug,
  name: str(v, 'name') ?? '—',
  price: num(v, 'price'),
  speedKmh: num(v, 'speed', 80),
  consumption: num(v, 'consumption', 8),
  capacity: num(v, 'capacity', 100),
  hide: num(v, 'hide', 0),
  image: str(v, 'image'),
}));

export interface EquipmentSeed {
  slug: string;
  /** null, wenn parameters.toml keinen Namen hat (wie im Vertrag) */
  name: string | null;
  slot: 'WEAPON' | 'ARMOR';
  strength: number;
  price: number;
  image: string | null;
}

const equipment = (key: 'weapons' | 'armor', slot: EquipmentSeed['slot']): EquipmentSeed[] =>
  entries(key)
    .map(([slug, e]) => ({
      slug,
      name: str(e, 'name'),
      slot,
      strength: num(e, 'strength'),
      price: num(e, 'price'),
      image: str(e, 'image'),
    }))
    .sort((a, b) => a.price - b.price);

export const EQUIPMENT: EquipmentSeed[] = [...equipment('weapons', 'WEAPON'), ...equipment('armor', 'ARMOR')];

export interface EventSeed {
  key: string;
  name: string;
  /** Wahrscheinlichkeit pro Tick und Markt */
  probability: number;
  /** Dauer in Ticks */
  duration: number;
  stockShock: number;
  supplyMult: number;
  demandMult: number;
}

export const EVENTS: EventSeed[] = entries('events').map(([key, e]) => ({
  key,
  name: str(e, 'name') ?? '—',
  probability: num(e, 'probability'),
  duration: num(e, 'duration', 36),
  stockShock: num(e, 'stock_shock', 1),
  supplyMult: num(e, 'supply_mult', 1),
  demandMult: num(e, 'demand_mult', 1),
}));

const player = table('player');
export const START = {
  cashBlack: num(player, 'start_cash_black', 200_000),
  cashWhite: num(player, 'start_cash_white', 0),
  backpackCapacity: num(player, 'backpack_capacity', 60),
  maxHealth: num(player, 'hp_max', 100),
};

const travel = table('travel');
export const TRAIN = {
  speedKmh: num(travel, 'train_speed', 120),
  centsPerKm: num(travel, 'train_price_per_km', 15),
};
export const VEHICLE_RESALE_RATE = num(travel, 'vehicle_resale_rate', 0.6);
export const CLAN_FOUNDING_COST = num(table('clans'), 'founding_cost', 5_000_000);
/** Ticks pro Stunde (F-TRV-01: 6), Sekunden pro Tick (600) */
export const TICKS_PER_HOUR = 6;
export const SECONDS_PER_TICK = 600;

/* --------------------------------------------------------- Nur Demo */

export const BOT_NAMES = [
  'Torseten',
  'Weedfried',
  'Schattenfuchs',
  'KalteHand',
  'Don_Paolo',
  'NachtSchicht',
  'Ratte_Rudi',
  'LadyKoks',
  'Hafenkind',
  'Moneyboy99',
  'StilleWasser',
  'Bahnhofsboss',
];

export const BOT_CLANS = [
  {
    name: 'Bahnhofsviertel Familie',
    tag: 'BVF',
    description: 'Die alten Hasen aus Bankfurt. Wer mitmacht, ist geschützt.',
  },
  { name: 'Hafenratten', tag: 'HFR', description: 'Fähren, Container, Lagerhallen. Wir bewegen alles.' },
  { name: 'Nordlicht Syndikat', tag: 'NLS', description: 'Leise, effizient, international.' },
];

/** Demo-Beschleunigung: 1 Mock-Tick = 30 s (im Spiel 10 min); Reisezeiten ÷ 240. */
export const MOCK_TICK_MS = 30_000;
export const TRAVEL_TIME_SCALE = 240;
/** Ereignisse sind im Spiel selten; für die Demo deutlich häufiger. */
export const EVENT_DEMO_BOOST = 20;
