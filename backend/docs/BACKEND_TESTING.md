# Backend-Tests

> Verantwortlich: Agent 3. Stand: 2026-11-09. Insgesamt 113 Testfälle, alle grün: 81 Integrationstests und 32 Unit-Tests der Domain-Schicht. Gezählt sind Testfälle, also bei `it.each` jede Zeile einzeln.

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

| Datei                   | Tests | Schwerpunkte                                                                                                                                       |
| ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.test.ts`          | 22    | Registrierung inkl. Altersbestätigung, Login, Refresh-Rotation, Erkennung wiederverwendeter Tokens, Logout, 404, Rate-Limit                        |
| `social.test.ts`        | 35    | 401 auf allen geschützten Routen, Profil, Online-Liste, Kontobuch, Clans, Ranglisten, Benachrichtigungen, Ticker                                   |
| `world.test.ts`         | 9     | Städte, Markt, Marktübersicht (BigInt > 2³¹), Inventar/Kapazität, Fahrzeuge, Ausrüstung, Reise                                                     |
| `price-journal.test.ts` | 6     | Trigger: Erstpreis, Ursache und Referenz, kein Übergreifen des Kontexts auf andere Transaktionen, keine Zeile ohne Änderung, append-only, Restrict |
| `account.test.ts`       | 5     | Export ohne Hashes, Löschung mit Passwort, Clan-Bereinigung                                                                                        |
| `password.test.ts`      | 4     | argon2id, Token-Hash, `serialize`                                                                                                                  |
| `domain/rng.test.ts`    | 12    | Determinismus, Golden Values, Gleichverteilung, Grenzen, State-Snapshot, `deriveRng` unabhängig von der Reihenfolge und ohne Kollisionen           |
| `domain/money.test.ts`  | 13    | Rundung bei negativen Werten, Rundungsrichtung, **Aufteilen eines Handels erzeugt kein Geld**, Faktor-Grenzen, Parsing                             |
| `domain/time.test.ts`   | 7     | Tick-Grenzen, ungültige Eingaben, Aufholen verpasster Ticks                                                                                        |

## 5. Pflicht-Testfälle für neue Funktionen

Jede Spielaktion, die Geld, Waren oder Zustand verändert, braucht mindestens diese Tests:

1. **Erfolgsfall** mit Prüfung **aller** betroffenen Projektionen und Journale.
2. **Ungültige Eingaben:** negative Mengen, Kommazahlen, fehlende Felder, fremde IDs → 400/404.
3. **Regelverletzung:** zu wenig Geld, falsche Stadt, Kapazität überschritten, falscher Status → definierter Fehlercode, **keine** Änderung in der DB.
4. **Doppelte Ausführung:** gleicher Idempotenz-Schlüssel → gleiche Antwort, keine zweite Buchung (sobald `CommandLog` existiert).
5. **Nebenläufigkeit:** zwei parallele Anfragen auf denselben Bestand → kein Doppelverkauf, kein negativer Bestand (Exploit X11 bzw. E-07 im Katalog von Agent 6).
6. **Rollback:** Fehler mitten in der Transaktion → keine Teil-Buchung.
7. **Konsistenz:** Summe der Journalbuchungen = Projektion (Geld, Inventar). Das gilt auch nach einer Kontolöschung (Anforderung Agent 1).
8. **Domain-Regeln:** Golden Vectors von Agent 2 (`verify.py`), sobald verfügbar.

## 6. Konventionen

- Keine realen Orts-, Marken- oder Personennamen in Testdaten (ADR-013).
- Domain-Tests dürfen keine Datenbank verwenden, sonst laufen sie nicht in `test:unit`.
- Die Golden Values des RNG (`rng.test.ts`) werden **nie** einfach aktualisiert. Eine Änderung verändert alle Replays und Simulationsergebnisse und braucht deshalb die Abstimmung mit Agent 6.
- Assertions dürfen nicht von zufälliger Reihenfolge abhängen. Bei Listen ohne festgelegte Sortierung ein Element per Schlüssel suchen.
