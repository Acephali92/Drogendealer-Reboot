# Review Datenmodell v2: Lücken bei der Nachvollziehbarkeit

> **Status:** Input, keine Entscheidung. Nach ADR-022 verantwortet Agent 3 das Datenmodell. Dieses Review stammt aus der früheren Database-Architect-Session („Agent 5“), auf Wunsch des Product Owners. Agent 3 übernimmt die Vorschläge, ändert sie oder verwirft sie; Agent 1 entscheidet bei Bedarf.
> **Geprüfter Stand:** `main` @ a2485ab: `backend/prisma/schema.prisma`, Migration `20261112120000_data_model_v2`, [`DATA_MODEL.md`](DATA_MODEL.md).
> **Maßstab:** ADR-010. Jede wirtschaftliche Änderung muss jederzeit rekonstruierbar sein, z. B. warum ein Marktpreis gestiegen ist.

## 0. Zusammenfassung

v2 setzt die Grundlage richtig um. Die Geld-, Waren-, Handels-, Markt- und Clankassen-Journale sind per Trigger append-only. Bargeld und Bank sind getrennt (ADR-023). Die Löschung pseudonymisiert und lässt die Journale vollständig. Der Katalog kommt aus `parameters.toml`. Die eigenen Invarianten M-1, I-1, K-1 und P-1 halten auch mit den Daten aus den Backend-Tests (§3).

Für eine **vollständige Rekonstruktion** fehlen vor allem vier Dinge:

1. **Zeitachse und Reihenfolge.** Nur das Marktjournal kennt einen Tick, und der ist nullable. Keine Journalzeile hat eine verlässliche Reihenfolge. Innerhalb einer Transaktion ist `createdAt` gleich, und die cuid ist keine garantierte Reihenfolge. Das ist im Selbsttest real aufgetreten (§3).
2. **Zusammenhang.** Die Zeilen einer Aktion (Handel, Geld, Ware, Markt; Wäsche-Paar; Clan-Einzahlung) sind nur über den Freitext `refId` verbunden.
3. **Vollständigkeit der Ursachen.** Das Marktjournal akzeptiert Änderungen ohne Ursache (`UNSPECIFIED`). Für Wäsche und Polizeikontrollen (ADR-023, T-121) gibt es kein Journal mit Wahrscheinlichkeit und Wurf. Es ist nicht festgehalten, welche Parameterfassung zu welchem Zeitpunkt galt.
4. **Wahl und Kassensperre** (ADR-018, T-309): Beides ist noch nicht modelliert.

Alle P1-Vorschläge liegen ausführbar in [`proposals/p1.sql`](proposals/p1.sql) und sind mit [`proposals/selftest.sql`](proposals/selftest.sql) auf PostgreSQL 16 getestet (§3). Der Kern ist **ein Journalkontext pro Transaktion**: Die neuen Spalten holen Tick, Korrelation und Akteur als DB-Default aus diesem Kontext. `bookMoney()` und die übrigen `create()`-Aufrufe bleiben unverändert. Pro Transaktion kommt nur ein Aufruf `set_journal_context(...)` dazu, und ohne Kontext schlägt die Buchung fehl, statt still ohne Tick gespeichert zu werden.

| ID   | Befund                                                    | Prio | blockiert           | Vorschlag                                                       |
| ---- | --------------------------------------------------------- | ---- | ------------------- | --------------------------------------------------------------- |
| G-1  | Kein Tick an Geld/Ware/Handel/Clankasse, Markt-Tick nullable | P1 | T-104, Balancing    | `tick` an allen Journalen, Tabelle `WorldTick`                  |
| G-2  | Zeilen einer Aktion nicht verbunden                       | P1   | T-106, T-121, T-309 | `correlationId` an allen Journalen                              |
| G-3  | Marktjournal fail-open, keine Version, Ursache unvollständig | P1 | T-104, T-106        | fail-closed, `version`, `detail`, `newEventTicksLeft`           |
| G-3b | Keine verlässliche Reihenfolge in allen Journalen         | P1   | Prüfbarkeit         | `seq` (Identity)                                                |
| G-3c | `TRUNCATE` umgeht den Append-only-Schutz                  | P2   | –                   | Statement-Trigger mit Freigabe für Tests                        |
| G-4  | Kein Journal für Wäsche und Kontrollen                    | P1   | T-121               | `LaunderingEntry`, `GameEvent` mit p und U                      |
| G-5  | Wahl, Kandidaten, Stimmen, Kassensperre fehlen            | P1   | T-309               | `ClanBallot*`, `ClanMembershipEvent`, Sperr-Trigger             |
| G-6  | Akteur fehlt (Spieler, NPC, System)                       | P2   | Balancing, Anti-Cheat | `actorType`, `actorPlayerId`                                  |
| G-7  | Gültige `parameters.toml` je Zeitpunkt unbekannt          | P2   | Preisrekonstruktion | `ParameterSet`, über `WorldTick` verknüpft                      |
| G-8  | Projektion = Journal nur per Konvention (`bookMoney`)     | P2   | –                   | Ketten-Trigger + aufgeschobene Projektionsprüfung               |
| G-9  | Fahrzeuge und Ausrüstung ohne Besitzjournal               | P2   | ADR-023 Notkredit, F-GLB-03 | `AssetEvent`                                            |
| G-10 | Namen gelöschter Spieler können in Ticker/Kampflog stehen; Löschstatus nicht als Constraint | P2 | ADR-017 | IDs statt Namen; CHECK `DELETED ⇔ userId NULL` |
| G-11 | Keine Idempotenz für Spielzüge                            | P3   | C-5                 | `CommandLog`                                                    |
| G-12 | IP/User-Agent ohne Löschfrist; keine Session-Hashes       | P3   | T-605 (Release-Blocker) | Frist + `LoginSession` mit HMAC                             |
| G-13 | Archivierung: Checkpoints ohne Prüfsumme                  | P3   | T-507               | Hash über archivierte Journalzeilen                             |
| G-14 | Keine Vermögens-Schnappschüsse, keine Zeitraum-Ranglisten | P3   | T-508, F-CMB-06     | `NetWorthSnapshot`, `RankingEntry`                              |

---

## 1. P1-Befunde

### G-1 Zeitachse

**Befund.**
- `MoneyTransaction`, `InventoryMovement`, `TradeTransaction` und `ClanTreasuryTransaction` haben nur `createdAt` (`schema.prisma:292`, `:342`, `:366`, `:533`).
- `MarketStateChange.tick` ist `Int?` (`schema.prisma:242`).
- Simulation (ADR-012) und Live-Daten laufen in Ticks (1 Tick = 10 min). Die Geldbilanz pro Tick (`GAME_ECONOMY.md` §6) und die Tick-Reihenfolge (game-design README §4) lassen sich ohne Tick nur über Uhrzeiten schätzen.
- T-104 braucht ohnehin eine Tick-Tabelle (`BACKEND_ARCHITECTURE.md` §5).

**Vorschlag.**
- `WorldTick(tick PK, startedAt, finishedAt, parameterSetHash, seedFingerprint)`. `seedFingerprint` ist der SHA-256 des Seeds; der Seed selbst ist geheim (README §3).
- `tick Int NOT NULL` mit FK auf `WorldTick` an allen Journalen. Spieleraktionen zwischen zwei Ticks tragen den zuletzt begonnenen Tick.

```prisma
tick Int @default(dbgenerated("(journal_context('app.tick'::text))::integer"))
```

### G-2 Zusammengehörige Buchungen

**Befund.**
- Ein Kauf erzeugt 4 Zeilen in 4 Journalen.
- Wäsche erzeugt 2 Geldzeilen (`DATA_MODEL.md` §4), eine Clan-Einzahlung je eine Zeile auf Spieler- und Clanseite (ADR-018).
- Verbunden sind sie nur über `refId String?` (`schema.prisma:241`, `:299`, `:349`, `:542`). Dessen Inhalt ist nicht festgelegt und nicht prüfbar.
- Die Aussage „Umbuchungen erzeugen kein Geld“ ist so nicht maschinell prüfbar.

**Vorschlag.**
- `correlationId uuid NOT NULL` an allen Journalen, eine pro fachlicher Aktion. Wert per Default aus dem Journalkontext.
- `refId` bleibt für den fachlichen Bezug.
- Neue Prüfungen: [`proposals/invariants-p1.sql`](proposals/invariants-p1.sql)
  - X-03: Handel vollständig
  - X-04: Clan-Umbuchungen ergeben in Summe 0
  - X-05/X-06: Wäsche
  - X-07: Beute erzeugt kein Geld

### G-3 Marktjournal

**Befund** (Migration v2, Zeilen 337–375):

1. **fail-open:** Ein UPDATE ohne `setMarketChangeContext()` wird mit `UNSPECIFIED` und `tick = NULL` journalisiert. Ein vergessener Aufruf fällt so erst bei der Auswertung auf.
2. **Reihenfolge:** Es gibt keine Version. Sortiert werden kann nur nach `createdAt` (`clock_timestamp()`, Millisekunden) und `id` (`gen_random_uuid()`). Zwei Änderungen in derselben Millisekunde, z. B. NPC-Fluss und Tick-Schritt desselben Marktes, sind nicht sicher zu ordnen.
3. **Erklärung unvollständig:** Die Zwischenwerte der Formel fehlen: S_target, Z, NPC-Menge q, beim Ereignis Schock und Dauer. Ohne sie lässt sich nur sagen, *dass* sich der Bestand geändert hat, aber nicht nachrechnen, *warum*. Die Restdauer des Ereignisses wird nie geschrieben, weil reine Countdowns zu Recht übersprungen werden.
4. **Bezug untypisiert:** Für `TRADE` ist `refId` nicht Pflicht.

**Vorschlag** (`p1.sql` §4):
- Der Trigger bricht ohne Ursache oder Tick ab.
- `MarketState.version` zählt automatisch hoch; im Journal gilt `unique(cityId, commodityId, version)`.
- Neue Spalten `detail jsonb` (aus `app.market_change_detail`), `newEventTicksLeft` und `correlationId`.
- CHECK: `TRADE` ⇒ `refId`. `UNSPECIFIED` ist verboten.

**Hinweis zu Preisen:** v2 speichert bewusst keine Preise (`DATA_MODEL.md` §3). Mit G-3 und G-7 lässt sich jeder Preis exakt nachrechnen: Zustand aus der Version plus Parameterfassung aus `WorldTick`.

### G-3b Reihenfolge in allen Journalen

**Befund.**
- Innerhalb einer Prisma-Transaktion haben alle Zeilen dasselbe `createdAt` (`now()`). Die cuid wird im Client erzeugt und ist nur in einem Prozess näherungsweise aufsteigend.
- Der Selbsttest hat das reproduziert: Eine Saldo-Kette, die nach `(createdAt, id)` geordnet ist, meldete bei korrekten Buchungen falsche Verstöße.
- Die Invarianten in [`invariants.sql`](invariants.sql) sind deshalb reihenfolgeunabhängig formuliert.

**Vorschlag.**
- `seq BigInt @default(autoincrement()) @unique` an allen Journalen.
- Damit sind Ketten streng prüfbar (X-11, X-12) und „letzter Saldo“ ist eindeutig.
- Nebeneffekt: `seq` ist ein guter Partitions- bzw. Archivschlüssel (G-13).

### G-4 Wäsche und Kontrollen (ADR-023, T-121)

**Befund.**
- ADR-023 verlangt, jede Wäsche und jede Beschlagnahme zu journalisieren.
- v2 hat dafür nur die Gründe `LAUNDERING` und `CONFISCATION` im Geldjournal.
- Es fehlen:
  - die Methode (Glücksspiel bis Offshore) und der schwankende Kurs
  - bei der Kontrolle die Wahrscheinlichkeit p und der Wurf U (F-GLB-01: Ereignis ⇔ U < p)
  - was beschlagnahmt wurde
- Ohne p und U lässt sich eine Kontrolle für Support und Cheat-Analyse nicht nachprüfen (README §3: „Jede Zufallsentscheidung muss reproduzierbar sein“).

**Vorschlag** (`p1.sql` §7):
- `LaunderingEntry(method, cashIn, bankCredit, rate, probability?, roll?, detected)`.
- `GameEvent(type, city?, commodity?, player?, probability, roll, occurred, params)` für Kontrollen, Marktereignisse, Razzien und Banden.
- CHECK: `roll < probability ⇔ occurred`.
- Die Folgebuchungen tragen dieselbe `correlationId`.

### G-5 Wahl und Kassensperre (ADR-018, T-309)

**Befund.**
- Es gibt keine Tabellen für Wahl und Misstrauensvotum.
- `ClanMember` hält nur den aktuellen Rang. Die Gleichstandsregel (Rang, dann Mitgliedsdauer) und „neue Mitglieder sind nicht wahlberechtigt“ (clans.md F-CLN-08) brauchen aber festgeschriebene Werte zum Wahlbeginn.
- Die Auszahlungssperre ist nicht als Bedingung prüfbar.
- Bei der Löschung des Paten entsteht heute keine Wahl. `DATA_MODEL.md` §5 vermerkt das als offen.

**Vorschlag** (`p1.sql` §8):
- `ClanBallot` (ELECTION | NO_CONFIDENCE, Anlass, Zeitraum, Ergebnis, `resolution`). Partieller Unique-Index: höchstens eine offene Wahl je Art und Clan.
- `ClanBallotCandidate` (Rang, Mitgliedsdauer) und `ClanBallotVoter`, beide beim Öffnen festgeschrieben.
- `ClanBallotVote` append-only. Es zählt die letzte Stimme je Wähler (View `ClanBallotTally`). Damit sind geänderte Stimmen nachvollziehbar.
- Trigger-Prüfungen für Stimmen: nur Wahlberechtigte, nur Kandidaten, nur bei offener Wahl.
- Trigger `clan_payout_lock`: `PAYOUT`, `UPGRADE`, `DISTRICT` und `WAR` mit Betrag < 0 werden bei offener Wahl abgelehnt. Einzahlungen, Steuern und die Auflösung laufen weiter. Dazu `clan_payouts_locked(clanId)` für Service und UI.
- `ClanMembershipEvent` (FOUNDED/JOINED/LEFT/KICKED/ROLE_CHANGED/DISSOLVED) als Historie.
- Stimmen gelöschter Spieler bleiben als Zeilen erhalten (FK `Restrict`).

**Offene Frage an Agent 2:** Zählt die Stimme eines Wählers, der während der Wahl sein Konto löscht?

---

## 2. P2/P3-Befunde

- **G-3c TRUNCATE:** Der Append-only-Trigger greift nicht bei `TRUNCATE` (bewusst für `test/helpers.ts:29`). Vorschlag: ein Statement-Trigger, der `TRUNCATE` nur erlaubt, wenn die Sitzung `app.allow_truncate = 'on'` gesetzt hat. `truncateAll()` setzt das vorher.
- **G-6 Akteur:** Es ist nicht erkennbar, wer eine Buchung ausgelöst hat. Beispiele: Beute aus PvP oder von NPC-Kurieren, Beschlagnahme durch das System, Admin-Korrektur. Das Balancing braucht die Unterscheidung NPC und Spieler (ADR-016, T-506). Vorschlag:
  - `actorType` (PLAYER | NPC | SYSTEM | ADMIN) und `actorPlayerId?`, aus dem Journalkontext
  - CHECK: `PLAYER ⇔ actorPlayerId`
  - NPCs bekommen keine Spielerzeile; sie sind über `actorType` und `GameEvent` unterscheidbar.
- **G-7 Parameterfassung:** `ParameterSet(hash, version, content)`, append-only. Beim Start wird der Hash von `parameters.toml` berechnet und bei Bedarf eingetragen; `WorldTick` verweist darauf. Spielwerte werden dadurch nicht doppelt gepflegt (Katalogprinzip aus `DATA_MODEL.md` §1); es ist nur festgehalten, welche Fassung wann galt.
- **G-8 Projektion:** `bookMoney()` ist sauber gebaut: bedingtes Update, dann Journal. Die DB verhindert aber kein direktes `player.update({ cash })`. Vorschlag (`p1.sql` §5), ohne Änderung an `bookMoney()`:
  - Ein BEFORE-INSERT-Trigger prüft `balanceAfter = letzter Saldo + amount` (Kette).
  - Ein aufgeschobener Constraint-Trigger prüft beim COMMIT: Projektion = letzter `balanceAfter`.
  - Dasselbe gilt für die Clankasse.
  - Neue Geldbuchungen für gelöschte Spieler sind gesperrt, außer `ACCOUNT_DELETION`.
- **G-9 Besitzjournal:** Fahrzeuge und Ausrüstung werden ohne Spur gekauft, verkauft oder bei der Löschung entfernt (`account.service.ts:133-134`). ADR-023 knüpft den Notkredit an „alle Waffen und alle Fahrzeuge bis auf eines verkauft“, und F-GLB-03 bewertet Sachwerte zum Kaufpreis. Vorschlag: `AssetEvent(playerId, kind, typeKey, assetId, change ACQUIRED|SOLD|DESTROYED|CONFISCATED|LOOTED|FORFEITED, bookValue, Journalkopf)`, ohne FK auf das Objekt.
- **G-10 Löschung:**
  - (a) `DELETED ⇔ userId IS NULL` und `DELETED ⇔ deletedAt` sollten als CHECK gelten (`p1.sql` §9). Dafür muss `forfeitPlayer()` `userId: null` im selben Update setzen (`user: { disconnect: true }`), nicht erst über das spätere `user.delete`.
  - (b) `TickerEvent.message` (`schema.prisma:608`) und `Combat.log` (`:462`) sollten nur Spieler-IDs speichern und Namen beim Lesen auflösen. Sonst bleiben Klarnamen gelöschter Spieler im Text stehen (ADR-017).
- **G-11 CommandLog:** Idempotenz-Schlüssel je Spielzug (C-5), `unique(playerId, idempotencyKey)`, mit Tick und Zeitstempeln. Das hilft zugleich der Bot-Erkennung.
- **G-12 T-605:** `RefreshToken.ip/userAgent` (`schema.prisma:56-57`) haben keine Frist. Vorschlag zur Entscheidung durch den Product Owner:
  - Klartext 7 Tage, danach `NULL` (Job).
  - Für Zweitaccount- und Bot-Erkennung eine `LoginSession` nur mit HMAC-Hashes (Server-Secret), Frist 30 Tage, bei Kontolöschung entfernt.
- **G-13 T-507:** Das Konzept aus `DATA_MODEL.md` §6 passt. Ergänzung: Saldo-Schnappschüsse an der Archivgrenze sollten einen SHA-256 über die archivierten Zeilen tragen (nach `seq` geordnet). So lässt sich später beweisen, dass das Archiv unverändert ist.
- **G-14 T-508:** Ein täglicher `NetWorthSnapshot(playerId, tick, netWorth, Bestandteile)` dient den Zeitraum-Ranglisten (ADR-016) und dem 7-Tage-Höchstwert aus F-CMB-06. Abgeschlossene Ranglisten werden als unveränderliche `RankingEntry(period, periodStart, category, playerId, value, rank)` gespeichert.

---

## 3. Prüfung

Getestet auf PostgreSQL 16 mit einer frischen Datenbank, auf die `prisma migrate deploy` (main @ a2485ab) angewendet wurde.

| Prüfung | Ergebnis |
| ------- | -------- |
| [`invariants.sql`](invariants.sql) auf v2 nach `journals`-, `account`- (inkl. 2 gelöschter Spieler) und `world`-Tests | 0 Verstöße |
| `p1.sql` auf v2 | läuft fehlerfrei |
| `proposals/selftest.sql`: 15 erwartete Ablehnungen (u. a. fehlender Kontext, Kettenbruch, direkter `cash`-Update, Kassensperre, zweite Wahl, Nichtwahlberechtigter, falscher Wurf, Löschstatus ohne `userId = NULL`) | alle wie erwartet |
| `invariants.sql` + `invariants-p1.sql` nach dem Szenario | 0 Verstöße; Manipulation an den Triggern vorbei wird erkannt |
| Backend-Tests (`npm test`) auf main ohne p1 | 346 bestanden |
| Backend-Tests mit p1 | erwartete Fehler: Registrierung bucht Startkapital ohne Journalkontext; `truncateAll()` ohne Freigabe |

**Umsetzungsaufwand im Backend** (aus dem letzten Testlauf):

1. Einen Helfer `setJournalContext(tx, { tick, correlationId, actor })` bauen und ihn am Anfang jeder schreibenden Transaktion aufrufen. Heute betrifft das `createPlayerForUser()`, `deleteAccount()`, die Markt-Schreibwege und die Clan-Buchungen.
2. Den aktuellen Tick aus `WorldTick` lesen; vor T-104 genügt Tick 0.
3. In `truncateAll()` vorher `set_config('app.allow_truncate', 'on', false)` aufrufen.
4. In `forfeitPlayer()` `userId` im selben Update auf `null` setzen.

Selbst ausführen:

```bash
psql "$DATABASE_URL" -f docs/database/invariants.sql
```

```bash
cd docs/database/proposals && psql "$URL_OF_EMPTY_DB_WITH_MAIN_MIGRATIONS_AND_P1" -v ON_ERROR_STOP=1 -f selftest.sql
```

## 4. Offene Fragen

| An       | Frage |
| -------- | ----- |
| Agent 2  | Zählen Stimmen von Wählern, die während der Wahl ihr Konto löschen? Welche Clan-Abgänge sperrt die Wahl genau (Vorschlag: PAYOUT, UPGRADE, DISTRICT, WAR)? |
| Agent 2/5 | Kann der Glücksspiel-Kurs (ADR-023) über 1 liegen? Danach richtet sich, ob X-05 zusätzlich `bankCredit ≤ cashIn` prüfen darf. |
| Agent 5 (Balancing) | Reichen `tick`, `correlationId`, `actorType` und `GameEvent(probability, roll)` für die Kalibrierung? Wird `detail` im Marktjournal mit festen Schlüsseln gebraucht (z. B. `S_target`, `Z`, `q_npc`)? |
| Product Owner | Löschfristen T-605: 7 Tage Klartext-IP/User-Agent, 30 Tage HMAC-Hashes? |
| Agent 3  | Journal-first (Trigger schreibt die Projektion) oder wie vorgeschlagen Kette plus aufgeschobene Prüfung (G-8)? |
