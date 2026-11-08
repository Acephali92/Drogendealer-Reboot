# ARCHITECTURE.md – Zielarchitektur

> Verantwortlich: Agent 1 (Project Director). Änderungen nur über einen ADR in [DECISIONS.md](DECISIONS.md).

## 1. Überblick

Reines Browser-Spiel ohne Backend. Die Spiellogik ist strikt von Darstellung und Persistenz
getrennt, damit sie deterministisch und vollständig unit-testbar ist.

```
┌──────────────┐     Commands      ┌──────────────┐
│      ui      │ ────────────────► │     core     │
│ (DOM, Input) │ ◄──────────────── │ (reine Logik)│
└──────────────┘    GameState      └──────┬───────┘
        │                                 │ nutzt Typen/Daten
        ▼                                 ▼
┌──────────────┐                   ┌──────────────┐
│ persistence  │ ── GameState ───► │   content    │
│(LocalStorage)│                   │ (Spieldaten) │
└──────────────┘                   └──────────────┘
```

Grundlegende Entscheidungen: ADR-002 (Stack), ADR-003 (Core/UI-Trennung), ADR-004 (Persistenz), ADR-005 (Tests).

## 2. Module

| Modul | Pfad | Verantwortung | Darf importieren |
|-------|------|---------------|------------------|
| `core` | `src/core/` | Spielregeln, State-Übergänge, Preismodell, Ereignisse, RNG | `content` (nur Typen & Daten) |
| `content` | `src/content/` | Datendefinitionen: Waren, Orte, Ereignisse, Balancing-Konstanten | nichts (nur eigene Typen) |
| `ui` | `src/ui/` | Rendering, Eingaben, Bildschirme | `core`, `content` |
| `persistence` | `src/persistence/` | Speichern/Laden, Schema-Versionierung, Migration | `core` (Typen) |
| `main` | `src/main.ts` | Bootstrapping, Verdrahtung der Module | alle |

### Abhängigkeitsregeln (verbindlich)
- `core` importiert **niemals** `ui`, `persistence`, DOM-APIs, `window`, `localStorage`, `Date.now()` oder `Math.random()`.
- `content` enthält keine Logik außer reinen Hilfsfunktionen zur Validierung.
- Zyklen zwischen Modulen sind verboten. Durchsetzung per ESLint (`import/no-restricted-paths` o. ä., Task T-002).

## 3. State-Fluss

```
nextState = reduce(state, command, rng)
```

- `GameState` ist ein serialisierbares, unveränderliches Objekt (plain JSON).
- Spieleraktionen sind **Commands** (diskriminierte Union), z. B.
  `{ type: 'buy', itemId, quantity }`, `{ type: 'sell', ... }`, `{ type: 'travel', locationId }`, `{ type: 'repayDebt', amount }`.
- `reduce` ist eine reine Funktion. Ungültige Commands liefern ein Ergebnis mit Fehlercode statt einer Exception:
  `type CommandResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: CommandError }`.
- Zufall ausschließlich über einen **seeded RNG**, dessen Zustand Teil des `GameState` ist → gleiche Seeds + gleiche Commands = gleiches Spiel (Replays, reproduzierbare Tests).

## 4. Datenmodelle (Skizze, finalisiert in T-005)

```ts
type ItemId = string;
type LocationId = string;

interface ItemDef      { id: ItemId; name: string; minPrice: number; maxPrice: number; volatility: number; }
interface LocationDef  { id: LocationId; name: string; travelCost: number; itemIds: ItemId[]; }
interface EventDef     { id: string; weight: number; /* Bedingungen + Effekt-Beschreibung */ }

interface Market       { locationId: LocationId; prices: Record<ItemId, number>; }

interface Player {
  cash: number;
  debt: number;
  capacity: number;
  inventory: Record<ItemId, number>;
  locationId: LocationId;
}

interface GameState {
  schemaVersion: number;
  day: number;
  maxDays: number;
  player: Player;
  market: Market;
  rngState: number;
  log: GameEvent[];
  status: 'running' | 'finished';
}
```

Geldbeträge werden als **ganze Zahlen** (kleinste Einheit) gespeichert – keine Floats.

## 5. Verzeichnisstruktur (Ziel)

```
/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts
│   ├── core/          # reducer, commands, market, events, rng, scoring
│   ├── content/       # items.ts, locations.ts, events.ts, balance.ts
│   ├── ui/            # screens/, components/, styles/
│   └── persistence/   # save.ts, migrations.ts
└── tests/
    ├── core/
    └── persistence/
```

## 6. Qualitätskriterien

- TypeScript `strict: true`, keine `any` ohne Begründungskommentar.
- ESLint + Prettier, im CI erzwungen.
- Vitest: `src/core` ≥ 90 % Zeilenabdeckung; jeder Command hat Positiv- und Negativtests.
- CI (GitHub Actions): `lint`, `typecheck`, `test`, `build` müssen grün sein, bevor Agent 1 einen PR freigibt.

## 7. Schnittstellenverträge zwischen Agenten

| Schnittstelle | Anbieter | Nutzer | Vertrag |
|---------------|----------|--------|---------|
| `reduce(state, command, rng)` | `core` | `ui` | Signatur & Command-Typen aus `src/core/commands.ts` |
| `createNewGame(seed, config)` | `core` | `ui`, `main` | liefert gültigen Start-`GameState` |
| Content-Typen | `content` | `core` | `ItemDef`, `LocationDef`, `EventDef` |
| `save/load(state)` | `persistence` | `ui`, `main` | versioniertes JSON, Migration bei alter `schemaVersion` |

Änderungen an diesen Verträgen erfordern Abstimmung über Agent 1 (Breaking Change → ADR).
