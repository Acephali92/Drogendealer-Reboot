/**
 * Platzhalter-Spieldaten für den Mock-Server.
 * Werden ersetzt, sobald Agent 2 `parameters.toml` und Agent 3 die Seeds liefert.
 * Geld in Cent, Gewicht in Gramm.
 */

export interface CitySeed {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  techLevel: number;
  policeStrength: number;
  population: number;
  description: string;
}

export const CITIES: CitySeed[] = [
  { slug: 'altea', name: 'Altea', country: 'Spanien', lat: 38.6, lon: -0.05, techLevel: 2, policeStrength: 25, population: 22000, description: 'Weiße Häuser, blaue Kuppel, Touristen mit zu viel Bargeld.' },
  { slug: 'amiens', name: 'Amiens', country: 'Frankreich', lat: 49.89, lon: 2.3, techLevel: 3, policeStrength: 40, population: 134000, description: 'Ruhige Kathedralenstadt. Gerade deshalb fällt hier keiner auf.' },
  { slug: 'amsterdam', name: 'Amsterdam', country: 'Niederlande', lat: 52.37, lon: 4.9, techLevel: 5, policeStrength: 30, population: 870000, description: 'Grachten, Coffeeshops und ein Hafen, der niemals schläft.' },
  { slug: 'athen', name: 'Athen', country: 'Griechenland', lat: 37.98, lon: 23.73, techLevel: 3, policeStrength: 35, population: 664000, description: 'Unter der Akropolis wird mehr gehandelt als Oliven.' },
  { slug: 'barcelona', name: 'Barcelona', country: 'Spanien', lat: 41.39, lon: 2.17, techLevel: 4, policeStrength: 45, population: 1620000, description: 'Partyhauptstadt am Mittelmeer. Die Nachfrage ist riesig.' },
  { slug: 'basel', name: 'Basel', country: 'Schweiz', lat: 47.56, lon: 7.59, techLevel: 5, policeStrength: 70, population: 178000, description: 'Pharma-Labore und Banken. Diskretion hat ihren Preis.' },
  { slug: 'belfast', name: 'Belfast', country: 'Nordirland', lat: 54.6, lon: -5.93, techLevel: 3, policeStrength: 55, population: 345000, description: 'Rau, ehrlich, verschwiegen. Wer redet, verliert.' },
  { slug: 'berlin', name: 'Berlin', country: 'Deutschland', lat: 52.52, lon: 13.4, techLevel: 5, policeStrength: 50, population: 3700000, description: 'Arm, aber sexy. Die Clubs laufen bis Montagmittag.' },
  { slug: 'coventry', name: 'Coventry', country: 'England', lat: 52.41, lon: -1.51, techLevel: 3, policeStrength: 45, population: 345000, description: 'Industriestadt mit kurzen Wegen nach London.' },
  { slug: 'frankfurt', name: 'Frankfurt', country: 'Deutschland', lat: 50.11, lon: 8.68, techLevel: 5, policeStrength: 60, population: 760000, description: 'Banken oben, Bahnhofsviertel unten. Hier wird Geld gewaschen.' },
  { slug: 'madrid', name: 'Madrid', country: 'Spanien', lat: 40.42, lon: -3.7, techLevel: 4, policeStrength: 50, population: 3300000, description: 'Die Nacht beginnt um Mitternacht. Das Geschäft auch.' },
  { slug: 'portsmouth', name: 'Portsmouth', country: 'England', lat: 50.82, lon: -1.09, techLevel: 3, policeStrength: 40, population: 208000, description: 'Fährhafen zum Kontinent. Ideal für größere Ladungen.' },
];

export interface CommoditySeed {
  slug: string;
  name: string;
  description: string;
  illegal: boolean;
  unitWeightG: number;
  /** Basispreis pro Einheit in Cent */
  basePrice: number;
}

export const COMMODITIES: CommoditySeed[] = [
  { slug: 'gras', name: 'Gras', description: 'Grünes Gold aus dem Gewächshaus. Der Klassiker für Einsteiger.', illegal: true, unitWeightG: 1, basePrice: 900 },
  { slug: 'haschisch', name: 'Haschisch', description: 'Gepresst, in Folie, mit Stempel. Reist gut und riecht wenig.', illegal: true, unitWeightG: 1, basePrice: 1100 },
  { slug: 'amphetamine', name: 'Amphetamine', description: 'Aus Küchenlaboren übereifriger Chemiestudenten. Hält die Nacht am Laufen.', illegal: true, unitWeightG: 1, basePrice: 3500 },
  { slug: 'ecstasy', name: 'Ecstasy', description: 'Bunte Pillen mit Logos. Am Wochenende kaum zu bekommen.', illegal: true, unitWeightG: 1, basePrice: 1500 },
  { slug: 'lsd', name: 'LSD', description: 'Kleine Papierchen, große Reisen. Leicht, aber begehrt.', illegal: true, unitWeightG: 1, basePrice: 1200 },
  { slug: 'angel-dust', name: 'Angel Dust', description: 'Starkes Zeug mit hohem Suchtpotenzial. Nichts für Anfänger.', illegal: true, unitWeightG: 1, basePrice: 5100 },
  { slug: 'crack', name: 'Crack', description: 'Gestrecktes Kokain, billig im Einkauf, schnell verkauft.', illegal: true, unitWeightG: 1, basePrice: 2500 },
  { slug: 'kokain', name: 'Kokain', description: 'Weißes Pulver, große Margen, große Risiken.', illegal: true, unitWeightG: 1, basePrice: 8000 },
  { slug: 'heroin', name: 'Heroin', description: 'Das härteste Geschäft der Straße. Hohe Preise, hohe Hitze.', illegal: true, unitWeightG: 1, basePrice: 6500 },
];

export interface VehicleSeed {
  slug: string;
  name: string;
  price: number;
  capacityG: number;
  speedKmh: number;
  licenseClass: number;
}

export const VEHICLES: VehicleSeed[] = [
  { slug: 'motorroller', name: 'Motorroller', price: 120_000, capacityG: 20_000, speedKmh: 60, licenseClass: 1 },
  { slug: 'rostlaube', name: 'Rostlaube', price: 450_000, capacityG: 240_500, speedKmh: 90, licenseClass: 1 },
  { slug: 'kombi', name: 'Familienkombi', price: 1_800_000, capacityG: 600_000, speedKmh: 120, licenseClass: 2 },
  { slug: 'sportwagen', name: 'Sportwagen', price: 9_500_000, capacityG: 150_000, speedKmh: 220, licenseClass: 3 },
  { slug: 'transporter', name: 'Transporter', price: 4_200_000, capacityG: 1_500_000, speedKmh: 110, licenseClass: 3 },
  { slug: 'lkw', name: 'Sattelzug', price: 18_000_000, capacityG: 8_000_000, speedKmh: 80, licenseClass: 4 },
];

export interface EquipmentSeed {
  slug: string;
  name: string;
  description: string;
  slot: 'WEAPON' | 'ARMOR';
  attack: number;
  defense: number;
  price: number;
  weightG: number;
}

export const EQUIPMENT: EquipmentSeed[] = [
  { slug: 'schlagring', name: 'Schlagring', description: 'Passt in jede Hosentasche. Überzeugt in jedem Gespräch.', slot: 'WEAPON', attack: 3, defense: 0, price: 4_500, weightG: 200 },
  { slug: 'baseballschlaeger', name: 'Baseballschläger', description: 'Für den Sport gekauft, nie einen Ball getroffen.', slot: 'WEAPON', attack: 6, defense: 0, price: 9_000, weightG: 900 },
  { slug: 'pistole-9mm', name: 'Pistole 9 mm', description: 'Handliche Halbautomatik. Standard auf der Straße.', slot: 'WEAPON', attack: 14, defense: 0, price: 30_200, weightG: 800 },
  { slug: 'pumpgun', name: 'Pumpgun', description: 'Laut, kurz, eindeutig.', slot: 'WEAPON', attack: 24, defense: 0, price: 207_000, weightG: 2_000 },
  { slug: 'sturmgewehr', name: 'Sturmgewehr', description: 'Militärisch. Fällt auf, wirkt aber.', slot: 'WEAPON', attack: 38, defense: 0, price: 1_250_000, weightG: 3_800 },
  { slug: 'panzerfaust', name: 'Panzerfaust', description: 'Für Probleme mit Fahrzeugen.', slot: 'WEAPON', attack: 22, defense: 0, price: 415_000, weightG: 20_000 },
  { slug: 'scharfschuetzengewehr', name: 'Scharfschützengewehr', description: 'Riesiges Kaliber, riesige Reichweite.', slot: 'WEAPON', attack: 53, defense: 0, price: 8_838_000, weightG: 7_500 },
  { slug: 'lederjacke', name: 'Lederjacke', description: 'Sieht gut aus und hält ein Messer ab. Manchmal.', slot: 'ARMOR', attack: 0, defense: 4, price: 25_000, weightG: 1_500 },
  { slug: 'schutzweste', name: 'Schutzweste', description: 'Kevlar unter dem Hoodie.', slot: 'ARMOR', attack: 0, defense: 15, price: 180_000, weightG: 3_000 },
];

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
  { name: 'Bahnhofsviertel Familie', tag: 'BVF', description: 'Die alten Hasen aus Frankfurt. Wer mitmacht, ist geschützt.' },
  { name: 'Hafenratten', tag: 'HFR', description: 'Fähren, Container, Lagerhallen. Wir bewegen alles.' },
  { name: 'Nordlicht Syndikat', tag: 'NLS', description: 'Leise, effizient, international.' },
];

/** Startwerte für neue Spieler. */
export const START = {
  cash: 3_000_000, // 30.000 €
  pocketCapacityG: 2_000,
  starterVehicle: 'rostlaube',
  maxHealth: 100,
};

/** Simulation: 1 Mock-Tick = 30 s Echtzeit (im echten Spiel 10 min). */
export const MOCK_TICK_MS = 30_000;
/** Reisezeit-Faktor: Echtzeit wird für die Demo um diesen Faktor beschleunigt. */
export const TRAVEL_TIME_SCALE = 240;
/** Spritkosten in Cent pro km. */
export const FUEL_CENTS_PER_KM = 12;
/** Geschwindigkeit ohne eigenes Fahrzeug (Fernbus). */
export const BUS_SPEED_KMH = 70;
