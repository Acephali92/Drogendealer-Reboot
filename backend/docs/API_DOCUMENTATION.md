# API-Dokumentation (Backend)

> **Verbindlicher API-Vertrag:** [`docs/api/API-CONTRACT.md`](../../docs/api/API-CONTRACT.md) (ADR-011). Er enthält alle Endpunkte, Anfrage- und Antwortformate sowie Fehlercodes. Dieses Dokument dupliziert ihn bewusst nicht. Es beschreibt, **wie** Endpunkte gebaut und dokumentiert werden.

## 1. Grundregeln

| Regel            | Umsetzung                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prefix `/api/v1` | `API_PREFIX` in `src/app.ts`                                                                                                                                      |
| Auth             | Alle Endpunkte außer `/health` und `/auth/*` liegen im authentifizierten Scope (`src/app.ts`)                                                                     |
| Validierung      | Jede Eingabe (`body`, `query`, `params`) wird in der Route mit einem zod-Schema geparst. Nichts Ungeprüftes erreicht den Service                                  |
| Fehler           | Fachliche Fehler kommen als `AppError(status, code, message)` (`src/lib/errors.ts`), später auch als `DomainError(code)`. Codes sind stabil und stehen im Vertrag |
| Geld             | BigInt immer über `serialize()` ausgeben; Eingaben von Geldbeträgen als String mit `parseMoney()` (`src/domain/money.ts`)                                         |
| Pagination       | `paginationSchema` (`src/lib/pagination.ts`): `limit` 1–100, `offset` ≥ 0; die Antwort enthält `total`, `limit`, `offset`                                         |
| Rate-Limits      | sensible Endpunkte per Routen-Option `config: { rateLimit: … }`                                                                                                   |

## 2. Statuscodes

| Code        | Bedeutung                                          | Beispiel-`code`                                                        |
| ----------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| 200/201/204 | Erfolg                                             | –                                                                      |
| 400         | ungültige Eingabe                                  | `VALIDATION_ERROR`                                                     |
| 401         | Token fehlt oder ist ungültig                      | `INVALID_ACCESS_TOKEN`, `INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN` |
| 403         | Token gültig, Aktion verweigert                    | `INVALID_PASSWORD`                                                     |
| 404         | unbekannte Ressource                               | `CITY_NOT_FOUND`, `NOTIFICATION_NOT_FOUND`                             |
| 409         | Konflikt                                           | `EMAIL_TAKEN`, `USERNAME_TAKEN`                                        |
| 422         | (geplant) Spielregel verletzt, z. B. zu wenig Geld | aus `DomainError.code`                                                 |
| 429         | Rate-Limit                                         | `RATE_LIMITED`                                                         |

## 3. Neuen Endpunkt hinzufügen (Checkliste)

1. zod-Schema für die Eingabe anlegen: `src/modules/<bereich>/<bereich>.schemas.ts` oder direkt in der Route.
2. Service-Funktion: Prisma-Zugriff, bei Schreibzugriffen **eine** `prisma.$transaction`, Journale in derselben Transaktion.
3. Spielregel als reine Funktion in `src/domain/`, sobald Regeln betroffen sind. Der Service ruft sie auf.
4. Route registrieren, im passenden Scope (öffentlich oder authentifiziert).
5. Tests nach [BACKEND_TESTING](BACKEND_TESTING.md): Erfolg, 401, ungültige Eingaben, Grenzfälle, bei Geld auch Doppel-Ausführung und Rollback.
6. **Vertrag aktualisieren:** `docs/api/API-CONTRACT.md`.
7. Bei Änderungen an bestehenden Feldern: Agent 4 informieren (ADR-011). Breaking Changes brauchen die Freigabe von Agent 1.

## 4. Aktualisierungsmechanismus

Das Frontend fragt per Polling ab (TanStack Query, ADR-008). Es gibt noch keine Push-Kanäle (WebSocket/SSE); sie bräuchten einen eigenen ADR.

**Geplant mit T-104:** Ein Endpunkt mit der aktuellen Tick-Nummer und der Zeit bis zum nächsten Tick, damit das Frontend sein Polling danach ausrichten kann.

## 5. Offene Punkte

- Eine generierte OpenAPI-Spezifikation ist zurückgestellt (ADR-011).
- Der Vertragsabgleich mit Agent 4 (T-107) wartet auf deren Bestätigung der dokumentierten Abweichungen.
