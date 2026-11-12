# Backend-Tests

> Verantwortlich: Agent 3. Stand: 2026-11-09 (T-101). Insgesamt 302 Testfälle, alle grün: 85 Integrationstests und 217 Unit-Tests der Domain-Schicht. Gezählt sind Testfälle, also bei `it.each` jede Zeile einzeln.

## 1. Testarten

| Art          | Ordner           | Datenbank | Befehl                                                                       | Zweck                                                                                         |
| ------------ | ---------------- | --------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Domain-Unit  | `test/domain/`   | nein      | `npm run test:unit`                                                          | reine Regeln: Determinismus, Rundung, Grenzfälle                                              |
| Integration  | `test/*.test.ts` | Test-DB   | `npm test` (alle)                                                            | Endpunkte über `app.inject`: Auth, Validierung, Datenbank-Constraints, Trigger, Transaktionen |
| Statisch     | –                | –         | `npm run lint`, `npm run typecheck`, `npm run format:check`                  | Architekturregeln (Domain-Importsperre), Typen, Formatierung                                  |
| Schema-Drift | –                | Shadow-DB | siehe [DATA_MODELS §5](DATA_MODELS.md#5-migrationen-erstellen-arbeitsablauf) | `schema.prisma` und Migrationen passen zusammen                                               |

Die CI (`.github/workflows/backend.yml`) führt alles in dieser Reihenfolge aus: Format → Lint → Typecheck → Migrationen → Drift → Tests → Build.

## 2. Test-Datenbank

- `TEST_DATABASE_URL` muss sich von `DATABASE_URL` unterscheiden. Sonst bricht `test/global-setup.ts` ab.
- `global-setup.ts` führt einmal pro Lauf `prisma migrate deploy` aus. Das ist nicht destruktiv.
- Jede Testdatei leert vor jedem Test alle Tabellen mit `truncateAll()` aus `test/helpers.ts`. Dabei bleibt `_prisma_migrations` erhalten, und `TRUNCATE` umgeht den Schreibschutz der Journale bewusst.
- Die Testdateien laufen nacheinander (`fileParallelism: false`), weil sie sich eine Datenbank teilen.

## 3. Hilfsmittel

| Datei              | Inhalt                                                                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/helpers.ts`  | `createTestApp(overrides)` (App mit Test-ENV), `truncateAll`, `register`, `validUser`                                                                                                                                       |
| `test/fixtures.ts` | Factories für Testdaten: `createUser`, `createCity`, `connectCities`, `createCommodity`, `setPrice`, `createVehicleType`, `createClan`, `auth()`. **Nur für Tests.** Die Namen sind fiktiv (ADR-013) und keine Spielinhalte |

## 4. Bestand nach Datei

| Datei                       | Tests | Schwerpunkte                                                                                                                                                                                  |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.test.ts`              | 22    | Registrierung inkl. Altersbestätigung, Login, Refresh-Rotation, Erkennung wiederverwendeter Tokens, Logout, 404, Rate-Limit                                                                   |
| `social.test.ts`            | 35    | 401 auf allen geschützten Routen, Profil, Online-Liste, Kontobuch, Clans, Ranglisten, Benachrichtigungen, Ticker                                                                              |
| `world.test.ts`             | 9     | Städte, Markt, Marktübersicht (BigInt > 2³¹), Inventar/Kapazität, Fahrzeuge, Ausrüstung, Reise                                                                                                |
| `price-journal.test.ts`     | 6     | Trigger: Erstpreis, Ursache und Referenz, kein Übergreifen des Kontexts auf andere Transaktionen, keine Zeile ohne Änderung, append-only, Restrict                                            |
| `account.test.ts`           | 5     | Export ohne Hashes, Löschung mit Passwort, Clan-Bereinigung                                                                                                                                   |
| `password.test.ts`          | 4     | argon2id, Token-Hash, `serialize`                                                                                                                                                             |
| `domain/rng.test.ts`        | 154   | F-GLB-01 bitgenau und F-GLB-02 innerhalb von 4 ULP gegen 72 Referenzwerte aus `verify.py`, EX-GLB-01, Strom-API, Grenzen                                                                      |
| `domain/sha256.test.ts`     | 10    | FIPS-180-4-Testvektoren, Abgleich mit `node:crypto`, UTF-8                                                                                                                                    |
| `domain/parameters.test.ts` | 22    | echte `parameters.toml` gültig, Parser-Konformität zu Python `tomllib`, 15 Negativfälle mit genauem Pfad, Fail-fast                                                                           |
| `parameters.test.ts`        | 4     | Start mit echten Parametern, `hp_max` für neue Spieler, Startabbruch bei fehlender oder fehlerhafter Datei                                                                                    |
| `domain/money.test.ts`      | 24    | Rundung bei negativen Werten, Rundungsrichtung, **Aufteilen eines Handels erzeugt kein Geld**, Faktor-Grenzen, Parsing und `ceilCt`/`floorCt`/`roundHalfUp` mit Toleranz 10⁻⁹ wie `verify.py` |
| `domain/time.test.ts`       | 7     | Tick-Grenzen, ungültige Eingaben, Aufholen verpasster Ticks                                                                                                                                   |

## 5. Golden Vectors aus `verify.py`

`docs/game-design/tools/verify.py` (Agent 2) ist die Referenzimplementierung aller Formeln. `backend/scripts/export-golden-vectors.py` importiert sie nur lesend und schreibt `test/golden/golden-vectors.json`. Die Datei enthält:

- alle EX-Beispielwerte,
- das `tomllib`-Parse-Ergebnis von `parameters.toml`,
- 72 exakte Zufallswerte,
- Hashes der beiden Quelldateien.

```bash
python3 -I backend/scripts/export-golden-vectors.py
```

Den Prüfmodus mit `--check` führt die CI aus. Ändert Agent 2 `parameters.toml` oder `verify.py`, schlagen der CI-Schritt und `test/domain/parameters.test.ts` fehl, bis die Datei neu erzeugt und eingecheckt ist. Die Datei ist von Prettier ausgenommen, sonst würde der Byte-Vergleich scheitern.

Jede neue Domain-Formel (T-103 ff.) wird gegen die passenden EX-Werte getestet.

## 6. Pflicht-Testfälle für neue Funktionen

Jede Spielaktion, die Geld, Waren oder Zustand verändert, braucht mindestens diese Tests:

1. **Erfolgsfall** mit Prüfung **aller** betroffenen Projektionen und Journale.
2. **Ungültige Eingaben:** negative Mengen, Kommazahlen, fehlende Felder, fremde IDs → 400/404.
3. **Regelverletzung:** zu wenig Geld, falsche Stadt, Kapazität überschritten, falscher Status → definierter Fehlercode, **keine** Änderung in der DB.
4. **Doppelte Ausführung:** gleicher Idempotenz-Schlüssel → gleiche Antwort, keine zweite Buchung (sobald `CommandLog` existiert).
5. **Nebenläufigkeit:** zwei parallele Anfragen auf denselben Bestand → kein Doppelverkauf, kein negativer Bestand (Exploit X11 bzw. E-07 im Katalog von Agent 6).
6. **Rollback:** Fehler mitten in der Transaktion → keine Teil-Buchung.
7. **Konsistenz:** Summe der Journalbuchungen = Projektion (Geld, Inventar). Das gilt auch nach einer Kontolöschung (Anforderung Agent 1).
8. **Domain-Regeln:** Golden Vectors von Agent 2 (`verify.py`), sobald verfügbar.

## 7. Konventionen

- Keine realen Orts-, Marken- oder Personennamen in Testdaten (ADR-013).
- Domain-Tests dürfen keine Datenbank verwenden, sonst laufen sie nicht in `test:unit`.
- Die Golden Values des RNG (`rng.test.ts`) werden **nie** einfach aktualisiert. Eine Änderung verändert alle Replays und Simulationsergebnisse und braucht deshalb die Abstimmung mit Agent 6.
- Assertions dürfen nicht von zufälliger Reihenfolge abhängen. Bei Listen ohne festgelegte Sortierung ein Element per Schlüssel suchen.
