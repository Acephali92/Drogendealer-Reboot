/**
 * Mock-Spieldaten, abgeleitet aus docs/game-design/parameters.toml (Agent 2, v0.1.0).
 * Anzeigenamen sind satirisch-fiktiv (ADR-013); Schlüssel/Slugs sind technisch und werden
 * nie angezeigt (T-112). Geld in ganzzahligen Cent (ADR-019).
 *
 * Abweichung, bis Backend/Game Design sie klären: Die Spezifikation rechnet Laderaum in
 * Volumeneinheiten, der API-Vertrag in Gramm. Der Mock setzt 1 Volumeneinheit = VOLUME_G Gramm.
 */

export const VOLUME_G = 100;

export interface CitySeed {
  slug: string;
  name: string;
  country: string;
  /** Einwohner in Tausend */
  pop: number;
  wealth: number;
  /** 0–1 */
  police: number;
  /** ct pro Liter */
  fuelPrice: number;
  supply: Record<string, number>;
  demand: Record<string, number>;
  description: string;
}

export const CITIES: CitySeed[] = [
  { slug: 'berlin', name: 'Pleitenberg', country: 'Deutschland', pop: 3700, wealth: 1.0, police: 0.55, fuelPrice: 185, supply: { speed: 1.5, ecstasy: 1.5 }, demand: { speed: 1.4, ecstasy: 1.6 }, description: 'Arm, aber sexy. Die Clubs laufen bis Montagmittag, die Baustellen bis zum Jüngsten Gericht.' },
  { slug: 'hamburg', name: 'Schmuddelhafen', country: 'Deutschland', pop: 1850, wealth: 1.2, police: 0.65, fuelPrice: 185, supply: { kokain: 2.0, heroin: 1.5 }, demand: {}, description: 'Containerkräne, Nebel und Fischbrötchen. Was im Hafen vom Laster fällt, landet hier auf dem Markt.' },
  { slug: 'muenchen', name: 'Protzingen', country: 'Deutschland', pop: 1500, wealth: 1.6, police: 0.8, fuelPrice: 190, supply: { kokain: 0.5, gras: 0.6, haschisch: 0.7 }, demand: { kokain: 1.4 }, description: 'Lederhosen, Leasingwagen und eine Polizei, die nichts anderes zu tun hat.' },
  { slug: 'koeln', name: 'Klüngelheim', country: 'Deutschland', pop: 1080, wealth: 1.1, police: 0.6, fuelPrice: 185, supply: {}, demand: { gras: 1.3 }, description: 'Man kennt sich, man hilft sich. Das Kölsch ist klein, die Kundschaft durstig.' },
  { slug: 'frankfurt', name: 'Bankfurt', country: 'Deutschland', pop: 770, wealth: 1.5, police: 0.7, fuelPrice: 185, supply: { heroin: 1.3 }, demand: { kokain: 1.5 }, description: 'Oben Glastürme, unten Bahnhofsviertel. Hier wird Geld gewaschen, bis es quietscht.' },
  { slug: 'leipzig', name: 'Plattenhausen', country: 'Deutschland', pop: 620, wealth: 0.8, police: 0.5, fuelPrice: 180, supply: { speed: 2.5 }, demand: {}, description: 'Plattenbau-Charme und Küchenlabore. Turboflocken gibt es hier fast vom Fass.' },
  { slug: 'amsterdam', name: 'Qualmsterdam', country: 'Niederlande', pop: 900, wealth: 1.3, police: 0.3, fuelPrice: 200, supply: { gras: 3.0, haschisch: 3.0, pilze: 3.0, ecstasy: 2.0 }, demand: {}, description: 'Grachten, Fahrräder und eine Rauchwolke, die man vom Weltraum aus sieht.' },
  { slug: 'rotterdam', name: 'Containerdam', country: 'Niederlande', pop: 650, wealth: 1.0, police: 0.45, fuelPrice: 200, supply: { kokain: 2.5, heroin: 1.8 }, demand: {}, description: 'Europas größter Hafen. Ein Container mehr oder weniger fällt nicht auf.' },
];

/** Straßendistanzen in km, Schlüssel alphabetisch „a-b“ (parameters.toml [distances]). */
export const DISTANCES: Record<string, number> = {
  'amsterdam-berlin': 655, 'amsterdam-frankfurt': 440, 'amsterdam-hamburg': 465, 'amsterdam-koeln': 260,
  'amsterdam-leipzig': 650, 'amsterdam-muenchen': 830, 'amsterdam-rotterdam': 80, 'berlin-frankfurt': 545,
  'berlin-hamburg': 289, 'berlin-koeln': 575, 'berlin-leipzig': 190, 'berlin-muenchen': 585,
  'berlin-rotterdam': 700, 'frankfurt-hamburg': 490, 'frankfurt-koeln': 190, 'frankfurt-leipzig': 395,
  'frankfurt-muenchen': 395, 'frankfurt-rotterdam': 440, 'hamburg-koeln': 425, 'hamburg-leipzig': 395,
  'hamburg-muenchen': 775, 'hamburg-rotterdam': 490, 'koeln-leipzig': 500, 'koeln-muenchen': 575,
  'koeln-rotterdam': 250, 'leipzig-muenchen': 430, 'leipzig-rotterdam': 680, 'muenchen-rotterdam': 820,
};

export interface CommoditySeed {
  slug: string;
  name: string;
  description: string;
  /** Lagereinheiten pro Einheit */
  volume: number;
  /** ct pro Einheit */
  basePrice: number;
  /** Heat-Faktor */
  heat: number;
}

export const COMMODITIES: CommoditySeed[] = [
  { slug: 'gras', name: 'Grünzeug', description: 'Biologisch angebaut, behauptet zumindest der Gärtner. Der Klassiker für Einsteiger.', volume: 2, basePrice: 1000, heat: 0.5 },
  { slug: 'haschisch', name: 'Krümelbrocken', description: 'Gepresst, in Folie, mit Stempel. Reist gut und krümelt überall.', volume: 1, basePrice: 1200, heat: 0.6 },
  { slug: 'pilze', name: 'Zauberschwammerl', description: 'Aus dem Wald, aus dem Keller, aus dem Märchen. Verdirbt schneller als dir lieb ist.', volume: 2, basePrice: 1500, heat: 0.7 },
  { slug: 'speed', name: 'Turboflocken', description: 'Für Leute, die ihre Steuererklärung in zwölf Minuten machen wollen.', volume: 1, basePrice: 2000, heat: 1.0 },
  { slug: 'ecstasy', name: 'Grinsepillen', description: 'Bunte Pillen mit Logos. Am Wochenende kaum zu bekommen.', volume: 1, basePrice: 1000, heat: 1.0 },
  { slug: 'lsd', name: 'Bunte Briefmarken', description: 'Kleine Papierchen, große Reisen. Die Post weiß von nichts.', volume: 1, basePrice: 1500, heat: 1.0 },
  { slug: 'kokain', name: 'Schneegestöber', description: 'Weißes Pulver, große Margen, große Klappe. Die Bullen lieben es.', volume: 1, basePrice: 8000, heat: 1.5 },
  { slug: 'heroin', name: 'Dämmerpulver', description: 'Das härteste Geschäft der Straße. Hohe Preise, hohe Hitze.', volume: 1, basePrice: 6000, heat: 2.0 },
];

export interface VehicleSeed {
  slug: string;
  name: string;
  price: number;
  speedKmh: number;
  /** Liter pro 100 km */
  consumption: number;
  /** Volumeneinheiten */
  capacity: number;
}

export const VEHICLES: VehicleSeed[] = [
  { slug: 'kleinwagen', name: 'Kleinwagen', price: 800_000, speedKmh: 100, consumption: 6, capacity: 300 },
  { slug: 'transporter', name: 'Transporter', price: 2_500_000, speedKmh: 85, consumption: 10, capacity: 1_500 },
  { slug: 'sportwagen', name: 'Sportwagen', price: 6_000_000, speedKmh: 150, consumption: 12, capacity: 150 },
  { slug: 'lkw', name: 'LKW mit Schmuggelversteck', price: 9_000_000, speedKmh: 75, consumption: 30, capacity: 6_000 },
];

export interface EquipmentSeed {
  slug: string;
  name: string;
  description: string;
  slot: 'WEAPON' | 'ARMOR';
  strength: number;
  price: number;
  /** Nicht in der Spezifikation; nur für die Anzeige im Mock */
  weightG: number;
}

export const EQUIPMENT: EquipmentSeed[] = [
  { slug: 'messer', name: 'Klappmesser', description: 'Passt in jede Hosentasche und öffnet auch Bierflaschen.', slot: 'WEAPON', strength: 5, price: 50_000, weightG: 150 },
  { slug: 'pistole', name: 'Pistole', description: 'Handlich, laut, überzeugend. Standard auf der Straße.', slot: 'WEAPON', strength: 20, price: 300_000, weightG: 900 },
  { slug: 'mp', name: 'Maschinenpistole', description: 'Für Gespräche, die schnell zu Ende sein sollen.', slot: 'WEAPON', strength: 45, price: 1_500_000, weightG: 2_800 },
  { slug: 'sturmgewehr', name: 'Sturmgewehr', description: 'Militärisch. Fällt auf, wirkt aber.', slot: 'WEAPON', strength: 80, price: 4_000_000, weightG: 3_800 },
  { slug: 'lederjacke', name: 'Lederjacke', description: 'Sieht gut aus und hält ein Messer ab. Manchmal.', slot: 'ARMOR', strength: 5, price: 30_000, weightG: 1_500 },
  { slug: 'weste', name: 'Schutzweste', description: 'Kevlar unter dem Hoodie. Unauffällig schwitzen.', slot: 'ARMOR', strength: 15, price: 250_000, weightG: 3_000 },
  { slug: 'plattenweste', name: 'Plattenweste', description: 'Für den Fall, dass die Verhandlungen scheitern.', slot: 'ARMOR', strength: 35, price: 1_200_000, weightG: 8_000 },
];

export const BOT_NAMES = [
  'Torseten', 'Weedfried', 'Schattenfuchs', 'KalteHand', 'Don_Paolo', 'NachtSchicht',
  'Ratte_Rudi', 'LadyKoks', 'Hafenkind', 'Moneyboy99', 'StilleWasser', 'Bahnhofsboss',
];

export const BOT_CLANS = [
  { name: 'Bahnhofsviertel Familie', tag: 'BVF', description: 'Die alten Hasen aus Bankfurt. Wer mitmacht, ist geschützt.' },
  { name: 'Hafenratten', tag: 'HFR', description: 'Fähren, Container, Lagerhallen. Wir bewegen alles.' },
  { name: 'Nordlicht Syndikat', tag: 'NLS', description: 'Leise, effizient, international.' },
];

export const START = {
  cash: 200_000, // 2.000 € Schwarzgeld (player.start_cash_black)
  backpackCapacity: 60, // Volumeneinheiten ohne Fahrzeug
  maxHealth: 100,
};

export const TRAIN = { speedKmh: 120, centsPerKm: 15 };
export const CLAN_FOUNDING_COST = 5_000_000;
export const VEHICLE_RESALE_RATE = 0.6;

/** Demo-Beschleunigung: 1 Mock-Tick = 30 s (im Spiel 10 min); Reisezeiten ÷ 240. */
export const MOCK_TICK_MS = 30_000;
export const TRAVEL_TIME_SCALE = 240;
