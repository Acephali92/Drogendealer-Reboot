# Technische Entscheidungen (Backend)

> Verantwortlich: Agent 3. Hier stehen **backend-interne** Entscheidungen. Architekturentscheidungen mit Wirkung über das Backend hinaus sind ADRs in [`DECISIONS.md`](../../DECISIONS.md) (Agent 1); hier wird nur auf sie verwiesen.
> Format: Kontext → Entscheidung → Konsequenzen. Neue Einträge kommen unten dazu, bestehende werden nicht umgeschrieben, sondern als „ersetzt durch TD-xxx“ markiert.

## TD-001 – Fastify, Prisma, zod, Vitest

- **Kontext:** Der Stack ist durch ADR-007 vorgegeben.
- **Entscheidung:** Fastify 5 mit `fastify-plugin` für die Decorators (`prisma`, `authenticate`), zod 4 für die Validierung in den Routen, Prisma 6 als ORM, Vitest für die Tests.
- **Konsequenzen:** Die Validierung passiert explizit per `schema.parse()` in der Route statt über Fastify-JSON-Schemas. Eine generierte OpenAPI-Spezifikation (ADR-011, zurückgestellt) würde später eine Typ-Provider-Anbindung brauchen.

## TD-002 – Refresh-Tokens: opak, gehasht, rotierend, Erkennung wiederverwendeter Tokens

- **Entscheidung:**
  - Das Refresh-Token besteht aus 32 Zufallsbytes (base64url). In der DB liegt nur sein SHA-256-Hash.
  - Jeder Refresh widerruft das alte Token (bedingtes `updateMany … revokedAt: null`, schützt vor Race Conditions) und gibt ein neues aus.
  - Wird ein bereits widerrufenes Token vorgelegt, werden alle Sitzungen des Kontos widerrufen.
- **Konsequenzen:** Ein Datenbank-Leak gibt keine nutzbaren Tokens preis. Clients müssen nach jedem Refresh das neue Token speichern.

## TD-003 – Geld als BigInt, im JSON als String

- **Kontext:** Die Welt läuft dauerhaft (ADR-016), Vermögen können über 2⁵³ wachsen.
- **Entscheidung:** `BigInt` in DB und Domain. Ausgabe über `serialize()` als Dezimalstring in ganzen Einheiten (keine Cent).
- **Konsequenzen:** Das Frontend rechnet mit Strings oder BigInt. Raw-SQL-Ergebnisse (`$queryRaw`) liefern BigInt, sie müssen ebenfalls serialisiert werden.

## TD-004 – Preisjournal per DB-Trigger mit transaktionslokalem Kontext

- **Kontext:** Jede Preisänderung muss rekonstruierbar sein (T-105, ADR-010), auch wenn Code am Service vorbei schreibt.
- **Entscheidung:**
  - Ein `AFTER INSERT OR UPDATE`-Trigger auf `MarketPrice` schreibt `MarketPriceChange`.
  - Ursache und Referenz kommen per `set_config(..., true)` aus der laufenden Transaktion (`setPriceChangeContext`).
  - Ein `BEFORE UPDATE OR DELETE`-Trigger macht das Journal unveränderlich.
- **Konsequenzen:**
  - Preisänderungen sollten innerhalb von `prisma.$transaction` mit gesetztem Kontext laufen, sonst lautet die Ursache `UNSPECIFIED`.
  - `TRUNCATE` umgeht den Schutz (bewusst, für Tests).
  - Für weitere Journale ist dasselbe Muster vorgeschlagen (D-2).

## TD-005 – Migrationen per `migrate diff` + Handkorrektur, kein `reset`

- **Kontext:** `prisma migrate dev` fragt bei Warnungen interaktiv nach. `migrate reset` ist für KI-Agenten gesperrt, und die Welt wird nie zurückgesetzt (ADR-016).
- **Entscheidung:** Ablauf laut [DATA_MODELS §5](DATA_MODELS.md#5-migrationen-erstellen-arbeitsablauf). Umbenennungen als `RENAME`, Enum-Umbauten mit Werte-Mapping. Tests verwenden `migrate deploy` und `TRUNCATE`.
- **Konsequenzen:** Jede Migration wird gelesen, bevor sie angewendet wird. Die CI prüft den Drift gegen eine Shadow-DB.

## TD-006 – Domain-Schicht `src/domain/`, durch Lint erzwungen

- **Kontext:** ARCHITECTURE §3 und ADR-012: Die Regeln müssen ohne I/O laufen, damit die Simulation sie importieren kann.
- **Entscheidung:**
  - Eigener Ordner `src/domain/`.
  - ESLint verbietet dort Imports von Prisma, Fastify, `node:*` und den Anwendungsschichten sowie `Date.now`, `new Date()`, `Math.random` und `process`.
  - Ergebnisvertrag: `CommandResult<W> = { world, events }`. Abgelehnte Aktionen werfen `DomainError(code)`.
- **Konsequenzen:** Der Service lädt den Zustand, ruft die Regel auf und schreibt Ergebnis und Events in einer Transaktion. Signaturänderungen werden mit Agent 6 abgestimmt.

## TD-007 – RNG: cyrb128-Seed + sfc32, abgeleitete Streams pro Entität

- **Kontext:** Agent 6 verlangt `derive(serverSeed, tick, entityId)` und keinen `Math.random`.
- **Entscheidung:**
  - sfc32 (128-Bit-Zustand, schnell, besteht PractRand), Seed über cyrb128, 15 Aufwärmrunden.
  - `deriveRng` bildet den Seed mit Längenpräfixen, damit verschiedene Eingaben nicht denselben Seed ergeben.
  - Der Zustand lässt sich mit `state()` und `rngFromState()` sichern und fortsetzen.
- **Konsequenzen:** Der Generator ist nicht kryptografisch sicher und wird nie für Tokens verwendet (dafür `node:crypto` in `src/lib/tokens.ts`). Die Golden Values im Test frieren die Zahlenfolge ein.

## TD-008 – Rundung: Gutschriften abrunden, Belastungen aufrunden

- **Kontext:** Exploit-Katalog von Agent 6: Rundungsgewinne durch das Aufteilen von Orders.
- **Entscheidung:**
  - Alle Faktor-Berechnungen laufen über `domain/money.ts`. Die Rechnung ist exakt (`mulDiv` auf BigInt), Faktoren werden als Festkomma mit 9 Nachkommastellen dargestellt.
  - `creditAmount()` rundet ab, `debitAmount()` rundet auf.
- **Konsequenzen:** Aufteilen bringt nie einen Vorteil (Test in `money.test.ts`). Gleitkommazahlen kommen in Geldbeträgen nicht vor.

## TD-009 – Spielzeit nur über `TickClock`

- **Kontext:** Spielzeit und Serverzeit sollen nicht unkontrolliert vermischt werden.
- **Entscheidung:**
  - Ticks werden ausschließlich über `TickClock { epochMs, tickLengthMs }` aus der Serverzeit berechnet. Die Domain bekommt `now` übergeben.
  - Verpasste Ticks bestimmt `dueTicks()` und arbeitet sie der Reihe nach ab.
  - Epoch und Tick-Länge kommen aus Parametern bzw. Konfiguration.
- **Konsequenzen:** Der Tick-Scheduler (T-104) braucht eine persistente „letzter verarbeiteter Tick“-Information (`WorldTick`, Review Agent 5).

## TD-010 – TypeScript auf 6.0 gepinnt

- **Kontext:** TypeScript 7 (nativer Compiler) wird von `typescript-eslint` noch nicht unterstützt (Peer-Bereich `<6.1.0`).
- **Entscheidung:** `typescript ~6.0.3`, bis `typescript-eslint` TS 7 unterstützt.
- **Konsequenzen:** Ein späteres Upgrade ist eine eigene Änderung mit vollständigem CI-Lauf.

## TD-011 – Konfiguration ausschließlich über Umgebungsvariablen

- **Kontext:** ADR-014: Hosting auf eigenem Server mit Docker Compose, Secrets nur als ENV.
- **Entscheidung:** `src/config/env.ts` ist die einzige Stelle, die `process.env` liest (zod-validiert). Der Rest bekommt die Werte übergeben.
- **Konsequenzen:** Container-Images sind umgebungsneutral. Spielparameter sind keine ENV-Werte, sie kommen aus `parameters.toml` (T-101).
