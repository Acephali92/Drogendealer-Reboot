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
| T-001 | GitHub-Schreibzugriff für alle Agenten herstellen | Product Owner | done (2026-11-08) | – |
| T-002 | Steuerungsdokumente Revision 2 | A1 | done (Basis von `main`) | – |
| T-003 | Game-Design-Grundlagen (Regeln, Parameterdatei, Prüfskript) | A2 | done ([PR #4](https://github.com/Acephali92/Drogendealer-Reboot/pull/4)) | – |
| T-004 | Backend-Fundament: Setup, Prisma-Schema, Auth, `/players/me` | A3 | done ([PR #2](https://github.com/Acephali92/Drogendealer-Reboot/pull/2), 81 Tests grün) | – |
| T-005 | Datenmodell-Review des bestehenden Schemas + Nachvollziehbarkeitskonzept | A5 | todo | T-004 |
| T-006 | Frontend-Gerüst, API-Vertragsentwurf, UI-Richtlinien | A4 | done ([PR #3](https://github.com/Acephali92/Drogendealer-Reboot/pull/3)); Nacharbeiten in T-110 | – |
| T-007 | Root-README konsolidieren, Backend-Schnellstart nach `backend/README.md` | A1 + A3 | done | T-004 |
| T-008 | Branches integrieren | A1 | in progress: A2, A3, A4, A6 gemergt; A5 hat noch nicht gepusht | T-002 – T-007, T-009 |
| T-009 | Balancing-Konzept und Simulations-Spezifikation (`docs/balancing/`) | A6 | done ([PR #1](https://github.com/Acephali92/Drogendealer-Reboot/pull/1)) | – |

## M1 – Wirtschaftskern

| ID | Titel | Zuständig | Status | Abhängig von |
|----|-------|-----------|--------|--------------|
| T-101 | Parameterdatei im Backend laden und beim Start validieren | A3 | todo | T-003, T-004 |
| T-102 | Seed-Daten: Städte, Verbindungen, Waren aus Parametern | A3 | todo | T-101 |
| T-103 | Preisformeln als reine Funktionen + Tests gegen Prüfskript | A3 (Review A2) | todo | T-003 |
| T-104 | Markt-Tick-Job (idempotent, Tick-Nummer) | A3 | todo | T-103, T-105 |
| T-105 | Preisänderungsjournal `MarketPriceChange` mit Ursache, per DB-Trigger auf `MarketPrice` | A3 (gemergt) · Review A5 Pflicht | review | T-005 |
| T-106 | Handels-Endpunkte Kaufen/Verkaufen inkl. Journale | A3 | todo | T-102, T-105 |
| T-107 | API-Vertrag nach `docs/api/API-CONTRACT.md` übernehmen und mit A4-Entwurf abgleichen | A3 + A4 | in progress: Vertrag gemergt; A4 muss Abweichungen bestätigen | T-006 |
| T-109 | Geld in Cent im Backend (ADR-019): Vertrag, Startwerte, Serialisierung, Tests | A3 (Review A5) | todo | T-004 |
| T-110 | Frontend-Nacharbeiten aus PR #3: Schriften selbst hosten (ADR-015), Mock-Default `off` in Production, CI `frontend.yml`, `UI-GUIDE.md` | A4 | todo | T-006 |
| T-111 | Production-Start verweigern, wenn `JWT_SECRET` dem Platzhalter aus `.env.example` entspricht | A3 | todo | T-004 |
| T-112 | Interne Schlüssel (`city.berlin`, Warenschlüssel) nie in der UI anzeigen, nur `name` (ADR-013) | A3 + A4 | todo | T-003 |
| T-113 | `image`-Felder und `[images]`-Fallbacks in `parameters.toml`, Pfadprüfung in `verify.py` (ADR-020) | A2 | todo | – |
| T-114 | API liefert `image` für Waren, Fahrzeuge, Ausrüstung, Schiffe aus `parameters.toml` (ADR-020) | A3 | todo | T-101, T-113 |
| T-115 | `GameImage`-Komponente mit Fallback-Kette, Kategorie-Platzhalter `_fallback.svg`, Mocks aus `parameters.toml` (ADR-020) | A4 | todo | T-113 |
| T-116 | Bilder für Waren, Fahrzeuge, Waffen usw. einstellen (`frontend/public/images/`) | Product Owner | jederzeit | – |

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
| T-305 | Altersbestätigung bei Registrierung (Pflichtfeld, Zeitpunkt speichern) + `age-de.xml` (ADR-013) | A3 ✅ Backend (lokal) · A4 UI + age-de.xml offen · Schema-Review A5 | review | T-004 |
| T-306 | Konto löschen und Datenexport durch den Spieler (ADR-015) | A3 Backend (lokal) · A4 UI offen · Schema A5 | changes requested: Löschung per Cascade entfernt Journalzeilen (verstößt gegen ADR-010), siehe ADR-017 | T-004 |
| T-307 | Seiten Impressum/Datenschutz mit Platzhalter-Konfiguration, keine echten Daten im Repo (ADR-015) | A4 | todo | T-006 |
| T-308 | Satirischer Ton: Namensliste Städte/Waren/Ereignisse (ADR-013) | A2 | todo | T-003 |
| T-309 | Clan-Kasse mit Journal + Wahl eines neuen Paten (ADR-018): Wahlregeln A2, Schema A5, API A3, UI A4 | A2 → A5 → A3 → A4 | todo | T-306 |

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
| T-506 | NPC-Händler/-Gegner (N-1/N-2) mit Intensität k, gesteuert über Aktivitätskennzahlen mit Hysterese (ADR-016, R-4); Backend: täglicher Kennzahlen-Job + k als persistenter Weltzustand im Journal; Sim: Szenario S8-npc-handover | A2 → A6 → A5 → A3 | M5 |
| T-507 | Langzeit-Wachstum der Journale: Partitionierung/Archivierung (ADR-016) | A5 → A3 | M5 |
| T-508 | Ranglisten für Zeiträume ohne Reset (Woche/Monat) | A2 + A3 + A4 | M5 |
| T-601 | ~~Hosting-Entscheidung~~ erledigt durch ADR-014; offen: Domain (Q10) | Product Owner | M6 |
| T-602 | VPS-Deployment laut ADR-014: Produktions-Compose, Caddy, GitHub-Actions-Deployment, Backups, Härtung, Monitoring | A3 | M6 |
| T-603 | Impressum- und Datenschutz-Texte mit eigenen Angaben ausfüllen, kurze rechtliche Prüfung (Jugendschutz) | Product Owner | M6 |
| T-604 | Sicherheits-Review | A1 | M6 |
| T-605 | Löschfrist für IP-Adressen/User-Agent an Refresh-Tokens und in Logs (ADR-015; vom PO zurückgestellt) – **Release-Blocker** | A3 + A5 | M6 |

---

## Integrationsplan (T-008)

Stand 2026-11-09: Zugriff funktioniert. Alle Agenten-Branches haben keine gemeinsame Vorgeschichte mit `main` und werden über `integrate/agent-N-*`-Branches (`--allow-unrelated-histories`) per PR gemergt. Neue Arbeit beginnt immer auf einem Branch von `main`.

Ursprünglich geplante Reihenfolge (A6 wurde vorgezogen, da reine Doku):

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
