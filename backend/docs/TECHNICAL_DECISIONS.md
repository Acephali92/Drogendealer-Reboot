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

> **Weitergeführt in TD-018:** Mit Datenmodell v2 journalisiert derselbe Mechanismus den Marktzustand (`MarketStateChange`).

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

> **Nachtrag 2026-11-17:** `[bounds]` akzeptiert verschachtelte Pfade beliebiger Tiefe (z. B. `laundering.tiers.strawman.rate`, T-120). Aufgelöst wird nur über eigene Eigenschaften, Prototyp-Schlüssel werden nie getroffen. Seit ADR-024 passen Agent 2 und Agent 5 `schema.ts` bei neuen Schlüsseln im eigenen PR an; `validate.ts` bleibt bei Agent 3.

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

> **Nachtrag 2026-11-15:** T-117 ist in `main`; die Übergangsabbildung der deutschen Ränge ist entfernt. Es gelten nur noch die technischen Werte.

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

## TD-017 – Katalogwerte nur aus `parameters.toml`, DB hält nur Schlüssel

- **Kontext:** Waren, Orte, Fahrzeuge und Ausrüstung standen mit Werten in der DB und in `parameters.toml`. Das Risiko war doppelte Pflege. Entscheidung des Users: eine Quelle; Agent 1 hat das ausdrücklich gewünscht.
- **Entscheidung:**
  - `City`, `Commodity`, `VehicleType` und `EquipmentType` enthalten nur `id` + `slug` (+ `slot`).
  - Beim Start legt `syncCatalog()` fehlende Schlüssel an. Unbekannte Schlüssel oder ein falscher Slot brechen den Start ab.
  - Die API-Sichten (`cityView`, `commodityView` …) setzen die Werte aus `app.gameParams` zusammen.
- **Konsequenzen:**
  - Werteänderungen brauchen keine Migration, nur eine Parameteränderung.
  - Ein Schlüssel kann nicht aus `parameters.toml` entfernt werden, solange er in der DB steht; das schützt die Journale.
  - Tests verwenden echte Schlüssel.

## TD-018 – Marktzustand statt Preise speichern; Journal über Trigger

- **Kontext:** economy.md §2: Gespeichert werden Bestand S und Rauschen x (beide Float) sowie das aktive Ereignis; der Preis ist abgeleitet. GAME_ECONOMY.md §7 T-2/T-6 verlangt dazu die Ursache `NPC` und den Tick.
- **Entscheidung:** `MarketState` ersetzt `MarketPrice`, `MarketStateChange` ersetzt `MarketPriceChange`. Das Trigger-Muster aus TD-004 bleibt, erweitert um einen Tick-Kontext.
- **Konsequenzen:**
  - Historische Preise lassen sich aus Journal und Parametern rekonstruieren.
  - Bis T-103 liefert die API nur den Gleichgewichtspreis (F-ECO-07) als `referencePrice`.

## TD-019 – Geld nur über `bookMoney()`, bedingtes Update gegen Überziehung

- **Kontext:** Invariante M-1 (Projektion = Σ Journal) und ADR-023 mit den zwei Konten Bargeld und Bank.
- **Entscheidung:**
  - `bookMoney(tx, { playerId, account, amount, reason, refId })` ist der einzige Schreibweg. Er macht ein bedingtes `updateMany` (`WHERE cash >= Betrag`) und schreibt danach die Journalzeile mit `balanceAfter`.
  - Reicht das Guthaben nicht, kommt `422 INSUFFICIENT_FUNDS`, und die Transaktion wird zurückgerollt.
  - Das Startkapital wird als `START_CAPITAL` gebucht.
- **Konsequenzen:** Das Verfahren ist sicher bei gleichzeitigen Buchungen, ohne Lese-Schreib-Wettlauf. Künftige Geldbewegungen (Handel, Reisen, Wäsche) rufen nur diese Funktion auf.

## TD-020 – Kontolöschung pseudonymisiert (ADR-017)

- **Entscheidung:** Siehe `docs/database/DATA_MODEL.md` §5.
  - Gelöscht wird der `User`; der `Player` bleibt mit Pseudonym (`Gelöschter Spieler #` + 10 Hex-Zeichen von SHA-256 der Spieler-ID) und dem Status `DELETED` erhalten.
  - Das Vermögen wird über die Journale ausgebucht.
  - Ein Clan ohne Mitglieder wird aufgelöst (`dissolvedAt`), seine Kasse wird per `DISSOLUTION` ausgebucht.
- **Konsequenzen:**
  - Journale bleiben vollständig, und der Konsistenztest gilt auch nach einer Löschung.
  - Das Pseudonym lässt sich nicht auf Name oder E-Mail zurückführen.
  - Ranglisten und die Online-Liste filtern `DELETED`.

## TD-021 – Formelschicht 1:1 nach `verify.py`, Geld als `bigint`, Ereignisse im Handelspreis (T-103)

- **Kontext:** T-103 verlangt die Preisformeln als reine Funktionen, getestet gegen das Prüfskript. Nach ADR-012 importiert die Simulation sie.
- **Entscheidung:**
  - `domain/economy.ts` (F-ECO-01…09, `marketTick` nach economy.md §5) und `domain/trade.ts` (F-TRD-01…06, F-PRF-03) übernehmen `verify.py` Formel für Formel, **auch in der Reihenfolge der Multiplikationen**, damit die Floats identisch bleiben. Die Namen entsprechen der Übergangsschicht in `sim/src/model/`.
  - Zwischenwerte sind float64 wie in `verify.py`. Gerundet wird nur am Ende: `buyCost` und `sellRevenue` geben `bigint`-Cent zurück, mit `ceilCt` für Kosten und `floorCt` für Erlöse (ADR-019).
  - `marketTick` folgt den Schritten aus `inv_monte_carlo`. Das Ereignis wird mit `U(seed, t, "<stadt>/<ware>", 0)` gewürfelt, das Rauschen mit `Z(…, 1)`. Im letzten Ereignistick gelten noch dessen Multiplikatoren.
  - **Ereignisse im Handelspreis:** F-TRD-01/02 integrieren P(σ) aus F-ECO-06, also mit M_d. `buyCost` und `sellRevenue` nehmen deshalb optional `mods` an, wie die Simulation. **Bestätigt von Agent 2:** `verify.py` hat seit T-120 (PR #34) das optionale `ev_d` in `buy_cost` und `sell_revenue`. Die Golden Vectors prüfen Kauf und Verkauf während eines Ereignisses für alle Märkte centgenau. M_s wirkt nur auf S_target (F-ECO-04), nicht auf den Handelspreis.
  - `MarketMods` enthält nur die beschlossenen Ereignis-Multiplikatoren. Die Erweiterungen der Simulation ab F-ECO-10 sind Vorschläge und bleiben im Sim.
- **Konsequenzen:**
  - Die Golden Vectors bekommen den Abschnitt `formulas` mit ungerundeten Werten (BACKEND_TESTING §5). Cent-Beträge werden exakt geprüft.
  - T-104 (Tick-Job) und T-106 (Kauf und Verkauf) rufen nur noch diese Funktionen auf.
  - Die Simulation kann ihre Übergangsschicht durch Importe ersetzen. Unterschiede: Geld ist `bigint`, und `p` ist `GameParameters`.

## TD-022 – Journalkontext je Transaktion per DB-Default, fail-closed (Review #40)

- **Kontext:** Das Review von Datenmodell v2 (PR #40, `docs/database/REVIEW-v2.md`) zeigt, was für die Rekonstruktion nach ADR-010 fehlt: Journalzeilen haben keinen Tick, keinen Zusammenhang je Aktion und keine verlässliche Reihenfolge, und das Marktjournal schrieb Änderungen ohne Ursache als `UNSPECIFIED`. T-104 und T-106 würden ohne Korrektur solche Zeilen in großer Zahl erzeugen. Nach ADR-016 gibt es später keinen Reset.
- **Entscheidung** (Vorschlag aus `proposals/p1.sql`, angepasst):
  - Jede schreibende Transaktion setzt einmal `setJournalContext(tx, { tick, actor, correlationId? })`. Die Journale holen `tick`, `correlationId` und `actorType` per **DB-Default** aus diesem Kontext, `actorPlayerId` per Trigger.
  - `bookMoney()` und die übrigen `create()`-Aufrufe bleiben unverändert. Fehlt der Kontext, lehnt die DB die Zeile ab (`JOURNAL_CONTEXT_MISSING`, SQLSTATE P0001, damit Prisma die Meldung durchreicht).
  - Ein Kontext entspricht einer fachlichen Aktion: Registrierung (Akteur SYSTEM, Startkapital), Kontolöschung (Akteur PLAYER), später Handel, Tick oder Wäsche.
  - `seq` (Sequenz) ist die Reihenfolge in allen Journalen, `version` die je Markt.
  - Das Marktjournal ist fail-closed: Ursache, Tick und `correlationId` sind Pflicht, `detail` mit Pflichtschlüsseln je Ursache.
  - `currentTick()` (`src/modules/journal/context.ts`) liefert bis T-104 immer 0. T-104 ersetzt die Funktion durch `WorldTick` und fügt den FK hinzu.
  - Akteur (G-6) ist gleich mit dabei, weil er denselben Kontext nutzt und Agent 5 ihn für die Kalibrierung braucht.
- **Konsequenzen:**
  - Neue Schreibwege müssen `setJournalContext()` aufrufen; ein vergessener Aufruf fällt sofort im Test auf, nicht erst bei der Auswertung.
  - Test-Fixtures schreiben über `inJournal()`.
  - `truncateAll()` braucht `app.allow_truncate`.
  - Der Export (`formatVersion` 3) enthält den Journalkopf.
  - Für G-8 (Projektionsprüfung) ist entschieden: Kette plus aufgeschobene Prüfung, nicht Journal-first (DATA_MODEL.md §7). Umsetzung mit T-106.
