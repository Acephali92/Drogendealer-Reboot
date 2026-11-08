# TASKS.md – Aufgaben-Board

> Gepflegt von Agent 1. Revision 2 (2026-11-08): neu aufgesetzt für Echtzeit-Mehrspieler (ADR-006).
> Die Tasks T-001 bis T-017 aus Revision 1 (Single-Player) sind **verworfen**; T-010 (UI-Technik) ist durch ADR-008 erledigt.
> Agenten übernehmen Tasks, indem sie Status und Zuständigkeit setzen. Neue Tasks nur nach Abstimmung mit Agent 1.

## Legende

**Status:** `todo` · `in progress` · `review` · `done` · `blocked`
**Agenten:** A1 Director · A2 Game Design · A3 Backend · A4 Frontend · A5 Datenbank · A6 Balancing/Simulation

## M0 – Integration & Fundament

| ID | Titel | Zuständig | Status | Abhängig von |
|----|-------|-----------|--------|--------------|
| T-001 | GitHub-Schreibzugriff für alle Agenten herstellen | Product Owner | blocked | – |
| T-002 | Steuerungsdokumente Revision 2 | A1 | review | – |
| T-003 | Game-Design-Grundlagen (Regeln, Parameterdatei, Prüfskript) | A2 | in progress | – |
| T-004 | Backend-Fundament: Setup, Prisma-Schema, Auth, `/players/me` | A3 | in progress | – |
| T-005 | Datenmodell-Review des bestehenden Schemas + Nachvollziehbarkeitskonzept | A5 | todo | T-004 |
| T-006 | Frontend-Gerüst, API-Vertragsentwurf, UI-Richtlinien | A4 | in progress | – |
| T-007 | Root-README konsolidieren, Backend-Schnellstart nach `backend/README.md` | A1 + A3 | todo | T-004 |
| T-008 | Branches integrieren (Reihenfolge siehe unten) | A1 | blocked (T-001) | T-002 – T-007, T-009 |
| T-009 | Balancing-Konzept und Simulations-Spezifikation (`docs/balancing/`) | A6 | review | – |

## M1 – Wirtschaftskern

| ID | Titel | Zuständig | Status | Abhängig von |
|----|-------|-----------|--------|--------------|
| T-101 | Parameterdatei im Backend laden und beim Start validieren | A3 | todo | T-003, T-004 |
| T-102 | Seed-Daten: Städte, Verbindungen, Waren aus Parametern | A3 | todo | T-101 |
| T-103 | Preisformeln als reine Funktionen + Tests gegen Prüfskript | A3 (Review A2) | todo | T-003 |
| T-104 | Markt-Tick-Job (idempotent, Tick-Nummer) | A3 | todo | T-103, T-105 |
| T-105 | Preisänderungsjournal mit Ursache (Schema-Entwurf) | A5 (Umsetzung A3) | todo | T-005 |
| T-106 | Handels-Endpunkte Kaufen/Verkaufen inkl. Journale | A3 | todo | T-102, T-105 |
| T-107 | API-Vertrag nach `docs/api/` übernehmen und abgleichen | A3 + A4 | todo | T-006 |

## M2 – Reisen & Spielerfortschritt

| ID | Titel | Zuständig | Status | Abhängig von |
|----|-------|-----------|--------|--------------|
| T-201 | Reiseregeln und Fahrzeugwerte | A2 | todo | T-003 |
| T-202 | Reise-Endpunkte + lazy Auflösung + Tick-Auflösung | A3 | todo | T-201, T-106 |
| T-203 | Spielerstatus-Übergänge (IDLE, TRAVELING, …) | A3 (Review A2) | todo | T-202 |
| T-204 | Fahrzeugkauf | A3 | todo | T-201 |

## M3 – MVP spielbar

| ID | Titel | Zuständig | Status | Abhängig von |
|----|-------|-----------|--------|--------------|
| T-301 | Login/Registrierung, Token-Refresh im Client | A4 | todo | T-004, T-107 |
| T-302 | Markt- und Handelsseite | A4 | todo | T-106 |
| T-303 | Reise- und Statusanzeige mit Countdown | A4 | todo | T-202 |
| T-304 | Rangliste (Vermögen) – Endpunkt + Seite | A3 + A4 | todo | T-106 |
| T-305 | Altersbestätigung bei Registrierung (Pflichtfeld, Zeitpunkt speichern) + `age-de.xml` (ADR-013) | A3 + A4 (Schema: A5) | todo | T-004 |
| T-306 | Konto löschen und Datenexport durch den Spieler (ADR-015) | A3 + A4 (Schema: A5) | todo | T-004 |
| T-307 | Seiten Impressum/Datenschutz mit Platzhalter-Konfiguration, keine echten Daten im Repo (ADR-015) | A4 | todo | T-006 |
| T-308 | Satirischer Ton: Namensliste Städte/Waren/Ereignisse (ADR-013) | A2 | todo | T-003 |

## M4 – M6 (Grobplanung, wird bei Erreichen von M3 verfeinert)

| ID | Titel | Zuständig | MS |
|----|-------|-----------|----|
| T-401 | Kampfregeln + Ausrüstung | A2 → A3 → A4 | M4 |
| T-402 | Clans (Gründen, Einladen, Rollen, Clan-Kasse) | A2 → A3 → A4 | M4 |
| T-403 | Nachrichten | A3 → A4 | M4 |
| T-404 | Missbrauchs- und Neulingsschutz | A2 + A3 | M4 |
| T-501 | Immobilien | A2 → A5 → A3 → A4 | M5 |
| T-502 | Spielereignisse | A2 → A5 → A3 | M5 |
| T-503 | Sim-Engine Phasen P0–P5 laut `docs/balancing/simulation-spec.md` §8 (ADR-012), inkl. CI `sim-fast` und nächtlichem `balance-check` | A6 | ab M1 (Start ab T-103) |
| T-504 | Balancing-Bericht und Parameteranpassung | A6 + A2 | M5 |
| T-505 | Vermögensabhängige Geldsenken und Aufhol-Mechaniken (ADR-016) | A2 → A6 → A3 | M1/M5 |
| T-506 | NPC-Händler/-Gegner (N-1/N-2), skaliert mit Spielerzahl (ADR-016, Q12) | A2 → A6 → A3 | M5 |
| T-507 | Langzeit-Wachstum der Journale: Partitionierung/Archivierung (ADR-016) | A5 → A3 | M5 |
| T-508 | Ranglisten für Zeiträume ohne Reset (Woche/Monat) | A2 + A3 + A4 | M5 |
| T-601 | ~~Hosting-Entscheidung~~ erledigt durch ADR-014; offen: Domain (Q10) | Product Owner | M6 |
| T-602 | VPS-Deployment laut ADR-014: Produktions-Compose, Caddy, GitHub-Actions-Deployment, Backups, Härtung, Monitoring | A3 | M6 |
| T-603 | Impressum- und Datenschutz-Texte mit eigenen Angaben ausfüllen, kurze rechtliche Prüfung (Jugendschutz) | Product Owner | M6 |
| T-604 | Sicherheits-Review | A1 | M6 |

---

## Integrationsplan (T-008)

Derzeit liegt **kein** Branch auf GitHub: Pushes scheitern mit 403 (T-001). Sobald der Zugriff steht:

1. `claude/tender-mccarthy-dhr8kr` (A1, Steuerungsdokumente) wird Basis des Hauptbranches `main`.
2. Game Design (A2): `docs/game-design/`.
3. Backend (A3, `claude/nice-wright-ljm3zq`): `backend/`, `docker-compose.yml`. Root-README nach `backend/README.md` (T-007).
4. Datenmodell-Änderungen (A5) als PR gegen `backend/prisma/`.
5. Frontend (A4, `claude/inspiring-ritchie-oaq48s`): `frontend/`, `docs/frontend/`, `.github/workflows/frontend.yml`.
6. Balancing/Simulation (A6, `claude/confident-bohr-6oed2u`): `docs/balancing/`, später `sim/`.

Jeder Schritt: PR gegen `main`, Review durch A1 nach dem Prozess unten.

## Review-Prozess (Agent 1)

Jeder PR wird geprüft auf:
1. Erfüllung der Akzeptanzkriterien bzw. des Task-Ziels
2. Änderungen nur im eigenen Ordner bzw. mit Zustimmung des Eigentümers (ADR-009)
3. Schemaänderungen mit Review von A5 (ADR-010); Migration enthalten
4. API-Änderungen im Vertrag dokumentiert (ADR-011)
5. Spielwerte aus der Parameterdatei, nicht im Code dupliziert
6. Tests vorhanden, CI grün, keine Secrets im Repo
7. Dokumente aktualisiert (TASKS.md-Status, ggf. neuer ADR)

Ergebnis: `approved` → Status `done` · `changes requested` → Status zurück auf `in progress`.
