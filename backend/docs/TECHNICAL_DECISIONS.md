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

> **Teilweise ersetzt durch TD-012:** Die Einheit ist seit ADR-019 Cent, nicht mehr ganze Einheiten.

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

> **Ersetzt durch TD-013.** Die Spezifikation von Agent 2 (F-GLB-01) schreibt einen anderen Algorithmus vor.

- **Kontext:** Agent 6 verlangt `derive(serverSeed, tick, entityId)` und keinen `Math.random`.
- **Entscheidung:**
  - sfc32 (128-Bit-Zustand, schnell, besteht PractRand), Seed über cyrb128, 15 Aufwärmrunden.
  - `deriveRng` bildet den Seed mit Längenpräfixen, damit verschiedene Eingaben nicht denselben Seed ergeben.
  - Der Zustand lässt sich mit `state()` und `rngFromState()` sichern und fortsetzen.
- **Konsequenzen:** Der Generator ist nicht kryptografisch sicher und wird nie für Tokens verwendet (dafür `node:crypto` in `src/lib/tokens.ts`). Die Golden Values im Test frieren die Zahlenfolge ein.

## TD-008 – Rundung: Gutschriften abrunden, Belastungen aufrunden

> **Ergänzt durch TD-014** (Float-Formeln laut Game-Design-README §2).

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

## TD-012 – Geldeinheit Cent (Umsetzung von ADR-019, T-109)

- **Kontext:** Game Design (`parameters.toml`) und Frontend rechnen in Cent, der Backend-Vertrag lief in ganzen Einheiten. Agent 1 hat mit ADR-019 Cent für das ganze System festgelegt.
- **Entscheidung:** Alle Geldfelder in DB, Domain und API sind ganzzahlige Cent (`BigInt`, im JSON als String). Code und Schema bleiben unverändert, weil bisher keine Rechnung eine Einheit angenommen hat und es keine Spieler gibt. Geändert wurden Vertrag, Kommentare und Dokumentation.
- **Konsequenzen:** Parameterwerte aus `parameters.toml` werden ohne Umrechnung übernommen (T-101). Faktor-Berechnungen runden auf ganze Cent (`domain/money.ts`, TD-008).

## TD-013 – Zufall nach F-GLB-01/02 (SHA-256), reine TypeScript-Implementierung

- **Kontext:** Das Game Design (README §3, `verify.py`) legt den Zufall verbindlich fest: U = erste 8 Byte von `SHA256("seed:t:e:k")` / 2⁶⁴, Normalverteilung per Box-Muller (F-GLB-02). Testvektor EX-GLB-01: U = 0,525072, Z = −1,191398. Mein früherer RNG (TD-007) lieferte andere Zahlen.
- **Entscheidung:**
  - `src/domain/sha256.ts` implementiert SHA-256 (FIPS 180-4) ohne `node:crypto`, damit die Domain-Schicht plattformunabhängig bleibt.
  - `uniform()`/`normal()` in `src/domain/rng.ts` setzen F-GLB-01/02 um. `deriveRng(seed, tick, entity)` liefert einen Strom mit fortlaufendem `k`.
- **Konsequenzen:**
  - `uniform` ist **bitgenau** gleich `verify.py` (72 Referenzwerte, geprüft in der CI).
  - `normal` weicht in Einzelfällen um höchstens 1 ULP (≈ 2·10⁻¹⁶ relativ) ab, weil `log`/`cos`/`sqrt` in V8 und in Pythons libm nicht garantiert gleich gerundet sind. Spielentscheidungen (`U < p`) nutzen die exakte Gleichverteilung, und Geld wird mit 10⁻⁹ Toleranz gerundet. Die Abweichung ist deshalb spielrelevant nicht sichtbar. Innerhalb einer Plattform bleibt `normal` deterministisch.
  - Die alten Golden Values (TD-007) sind ungültig. Agent 6 ist informiert.

## TD-014 – Float-Formeln, Rundung erst am Ende (Game-Design-README §2)

- **Kontext:** Die Formeln von Agent 2 rechnen intern in `float64` und runden erst das Endergebnis, mit einer Toleranz von 10⁻⁹ gegen Gleitkomma-Rauschen (`ceil_ct`/`floor_ct`/`round_half_up` in `verify.py`).
- **Entscheidung:** `ceilCt`, `floorCt` und `roundHalfUp` in `src/domain/money.ts` bilden diese Helfer exakt nach und geben `bigint`-Cent zurück. Werte außerhalb des sicheren Ganzzahlbereichs (> 2⁵³) werfen einen Fehler. Für reine Ganzzahl-Rechnungen bleibt das exakte `mulDiv` (TD-008).
- **Konsequenzen:** Domain-Formeln werden 1:1 nach `verify.py` gebaut und gegen dessen Beispielwerte (EX-*) getestet (T-103).

## TD-015 – Spielparameter: Laden beim Start, vollständige Validierung, Fail-fast

- **Kontext:** `docs/game-design/parameters.toml` ist die einzige Quelle für Spielwerte (ARCHITECTURE §3, T-101).
- **Entscheidung:**
  - **Parsen:** smol-toml mit `integersAsBigInt`. So bleiben Ganzzahl- und Gleitkomma-Literale unterscheidbar, und ein Geldbetrag wie `10.5` fällt auf.
  - **Schema:** zod-Schema für die ganze Datei (`src/domain/parameters/schema.ts`) mit `.strict()` gegen Tippfehler. Geld wird zu `bigint`-Cent.
  - **Querprüfungen** (`validate.ts`): `[bounds]`, Distanztabellen, Verweise auf Waren, Berufe und Ränge, Tick-Zeit, Ordnungsbeziehungen.
  - **Laden:** `src/config/parameters.ts` lädt die Datei einmal beim Start, gibt sie tief eingefroren als `app.gameParams` weiter und bricht bei jedem Fehler mit der vollständigen Fehlerliste ab.
  - **Pfad:** per ENV `GAME_PARAMETERS_PATH`. Standard ist die Datei im Repo.
- **Konsequenzen:**
  - Eine fehlerhafte Parameterdatei kann keinen Server starten.
  - Für das Deployment (T-602) muss die Datei ins Container-Image kopiert werden.
  - Ändert Agent 2 die Parameter, schlägt die Backend-CI fehl, bis `test/golden/golden-vectors.json` neu erzeugt ist. Das ist gewollt: Jede Parameteränderung wird im Backend bewusst übernommen.
  - Parameteränderungen im Live-Betrieb treffen eine dauerhafte Welt (ADR-016). Eine Versionierung der Parameter wird später nötig.

## TD-016 – Bildfelder im Parameter-Schema (T-114a) und Übergang der Clan-Ränge (ADR-021)

- **Kontext:** ADR-020 führt optionale `image`-Felder und `[images]` mit `fallback.<kategorie>` in `parameters.toml` ein. Das strikte Schema (TD-015) würde diese Felder ablehnen. ADR-021 legt die Clan-Ränge technisch auf `GODFATHER/CONSIGLIERE/CAPO/SOLDIER/ASSOCIATE` fest; `parameters.toml` verwendet noch `PATE/SOLDAT/MITLAEUFER`, bis Agent 2 T-117 umsetzt.
- **Entscheidung:**
  - **`image`** ist optional bei Waren, Fahrzeugen, Waffen, Rüstungen, Crew und Schiffen.
    - Der Pfad muss relativ sein: kein `..`, kein führendes `/`, kein `://` und kein Backslash.
    - Erlaubte Zeichen sind `[a-z0-9_-/.]`, die Endung ist `.webp`, `.png` oder `.svg`. Das sind dieselben Regeln wie bei `safeImagePath` im Frontend.
    - Der Pfad muss im Ordner der eigenen Kategorie liegen, zum Beispiel eine Ware unter `goods/`.
  - **`[images]`** ist optional und hat das Format aus T-113 (PR #17): `base_dir` (relativer Ordner im Repo, ohne `..`), `allowed_extensions` (Teilmenge von `.webp`, `.png`, `.svg`, eindeutig) und `[images.fallback]` mit `<kategorie>` = Pfad, für den dieselben Regeln gelten. Jede Bildendung muss in `allowed_extensions` stehen.
  - Anders als das Frontend lehnt das Backend ungültige Pfade beim Start ab (Fail-fast), statt sie still zu ignorieren.
  - **Ränge:** Akzeptiert werden die Enum-Werte und **übergangsweise** die alten deutschen Werte. Letztere werden abgebildet (`PATE→GODFATHER`, `SOLDAT→SOLDIER`, `MITLAEUFER→ASSOCIATE`) und beim Start als Warnung geloggt.
  - Ein Test sichert ab, dass `CLAN_RANKS` exakt dem DB-Enum `ClanRole` entspricht.
- **Konsequenzen:**
  - Agent 2 kann T-113 (Bildpfade) eintragen, ohne dass der Start bricht.
  - Nach T-117 entfernt ein Folge-Commit `LEGACY_CLAN_RANKS`, dann gilt die strikte Prüfung.
  - Die Auslieferung der Bilder über die API ist T-114.
