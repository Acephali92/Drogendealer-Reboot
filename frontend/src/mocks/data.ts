/**
 * Mock-Spieldaten. Zahlen, Anzeigenamen und Bildpfade kommen beim Build aus
 * docs/game-design/parameters.toml (Agent 2) über das virtuelle Modul `virtual:game-params`
 * (vite/gameParams.ts, ADR-020) – Mock und Backend schöpfen aus derselben Quelle.
 * Schlüssel/Slugs sind technisch und werden nie angezeigt (T-112). Geld in Cent (ADR-019).
 *
 * Nur hier gepflegt (nicht Teil der Spezifikation, reine Demo-Würze):
 * Stadtbeschreibungen, Länder, Warenbeschreibungen, Bots, Bot-Clans.
 *
 * Offen (siehe docs/frontend/API-CONTRACT.md): Die Spezifikation rechnet Laderaum in
 * Volumeneinheiten, der API-Vertrag in Gramm. Der Mock setzt 1 Volumeneinheit = VOLUME_G Gramm.
 */
import params from 'virtual:game-params';

export const VOLUME_G = 100;

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

/* ------------------------------------------------------------- Demo-Würze */

const CITY_FLAVOR: Record<string, { country: string; description: string }> = {
  berlin: {
    country: 'Deutschland',
    description:
      'Arm, aber sexy. Die Clubs laufen bis Montagmittag, die Baustellen bis zum Jüngsten Gericht.',
  },
  hamburg: {
    country: 'Deutschland',
    description:
      'Containerkräne, Nebel und Fischbrötchen. Was im Hafen vom Laster fällt, landet hier auf dem Markt.',
  },
  muenchen: {
    country: 'Deutschland',
    description: 'Lederhosen, Leasingwagen und eine Polizei, die nichts anderes zu tun hat.',
  },
  koeln: {
    country: 'Deutschland',
    description: 'Man kennt sich, man hilft sich. Das Kölsch ist klein, die Kundschaft durstig.',
  },
  frankfurt: {
    country: 'Deutschland',
    description: 'Oben Glastürme, unten Bahnhofsviertel. Hier wird Geld gewaschen, bis es quietscht.',
  },
  leipzig: {
    country: 'Deutschland',
    description: 'Plattenbau-Charme und Küchenlabore. Turboflocken gibt es hier fast vom Fass.',
  },
  amsterdam: {
    country: 'Niederlande',
    description: 'Grachten, Fahrräder und eine Rauchwolke, die man vom Weltraum aus sieht.',
  },
  rotterdam: {
    country: 'Niederlande',
    description: 'Europas größter Hafen. Ein Container mehr oder weniger fällt nicht auf.',
  },
};

const GOODS_FLAVOR: Record<string, string> = {
  gras: 'Biologisch angebaut, behauptet zumindest der Gärtner. Der Klassiker für Einsteiger.',
  haschisch: 'Gepresst, in Folie, mit Stempel. Reist gut und krümelt überall.',
  pilze: 'Aus dem Wald, aus dem Keller, aus dem Märchen. Verdirbt schneller als dir lieb ist.',
  speed: 'Für Leute, die ihre Steuererklärung in zwölf Minuten machen wollen.',
  ecstasy: 'Bunte Pillen mit Logos. Am Wochenende kaum zu bekommen.',
  lsd: 'Kleine Papierchen, große Reisen. Die Post weiß von nichts.',
  kokain: 'Weißes Pulver, große Margen, große Klappe. Die Bullen lieben es.',
  heroin: 'Das härteste Geschäft der Straße. Hohe Preise, hohe Hitze.',
};

/**
 * Waffen und Schutz haben in parameters.toml (noch) kein `name`-Feld. Bis Agent 2 es ergänzt,
 * nutzt der Mock diese Namen – nie den Schlüssel (T-112).
 */
const EQUIPMENT_NAMES: Record<string, { name: string; description: string; weightG: number }> = {
  messer: {
    name: 'Klappmesser',
    description: 'Passt in jede Hosentasche und öffnet auch Bierflaschen.',
    weightG: 150,
  },
  pistole: {
    name: 'Pistole',
    description: 'Handlich, laut, überzeugend. Standard auf der Straße.',
    weightG: 900,
  },
  mp: {
    name: 'Maschinenpistole',
    description: 'Für Gespräche, die schnell zu Ende sein sollen.',
    weightG: 2_800,
  },
  sturmgewehr: { name: 'Sturmgewehr', description: 'Militärisch. Fällt auf, wirkt aber.', weightG: 3_800 },
  lederjacke: {
    name: 'Lederjacke',
    description: 'Sieht gut aus und hält ein Messer ab. Manchmal.',
    weightG: 1_500,
  },
  weste: {
    name: 'Schutzweste',
    description: 'Kevlar unter dem Hoodie. Unauffällig schwitzen.',
    weightG: 3_000,
  },
  plattenweste: {
    name: 'Plattenweste',
    description: 'Für den Fall, dass die Verhandlungen scheitern.',
    weightG: 8_000,
  },
};

/* ------------------------------------------------- Aus parameters.toml */

export interface CitySeed {
  slug: string;
  name: string;
  country: string | null;
  /** Einwohner in Tausend */
  pop: number;
  wealth: number;
  /** 0–1 */
  police: number;
  /** ct pro Liter */
  fuelPrice: number;
  supply: Record<string, number>;
  demand: Record<string, number>;
  description: string | null;
}

export const CITIES: CitySeed[] = entries('city').map(([slug, c]) => ({
  slug,
  name: str(c, 'name') ?? '—',
  country: CITY_FLAVOR[slug]?.country ?? null,
  pop: num(c, 'pop', 100),
  wealth: num(c, 'wealth', 1),
  police: num(c, 'police', 0.5),
  fuelPrice: num(c, 'fuel_price', 185),
  supply: numMap(c.supply),
  demand: numMap(c.demand),
  description: CITY_FLAVOR[slug]?.description ?? null,
}));

/** Straßendistanzen in km, Schlüssel alphabetisch „a-b“ ([distances]). */
export const DISTANCES: Record<string, number> = numMap(params.distances);

export interface CommoditySeed {
  slug: string;
  name: string;
  description: string | null;
  /** Lagereinheiten pro Einheit */
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
    description: GOODS_FLAVOR[slug] ?? null,
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
  image: string | null;
}

export const VEHICLES: VehicleSeed[] = entries('vehicles').map(([slug, v]) => ({
  slug,
  name: str(v, 'name') ?? '—',
  price: num(v, 'price'),
  speedKmh: num(v, 'speed', 80),
  consumption: num(v, 'consumption', 8),
  capacity: num(v, 'capacity', 100),
  image: str(v, 'image'),
}));

export interface EquipmentSeed {
  slug: string;
  name: string;
  description: string | null;
  slot: 'WEAPON' | 'ARMOR';
  strength: number;
  price: number;
  weightG: number | null;
  image: string | null;
}

const equipment = (key: 'weapons' | 'armor', slot: EquipmentSeed['slot']): EquipmentSeed[] =>
  entries(key).map(([slug, e]) => ({
    slug,
    name: str(e, 'name') ?? EQUIPMENT_NAMES[slug]?.name ?? '—',
    description: str(e, 'description') ?? EQUIPMENT_NAMES[slug]?.description ?? null,
    slot,
    strength: num(e, 'strength'),
    price: num(e, 'price'),
    weightG: EQUIPMENT_NAMES[slug]?.weightG ?? null,
    image: str(e, 'image'),
  }));

export const EQUIPMENT: EquipmentSeed[] = [...equipment('weapons', 'WEAPON'), ...equipment('armor', 'ARMOR')];

const player = table('player');
export const START = {
  cash: num(player, 'start_cash_black', 200_000),
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
