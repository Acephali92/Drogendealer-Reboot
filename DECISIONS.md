# DECISIONS.md – Architecture Decision Records

> Gepflegt von Agent 1 (Project Director). Neue Entscheidungen werden **angehängt**, nie gelöscht.
> Überholte ADRs erhalten Status `Ersetzt durch ADR-XXX`.

Status-Werte: `Vorgeschlagen` · `Akzeptiert` · `Abgelehnt` · `Ersetzt durch ADR-XXX`

| ID | Titel | Status | Datum |
|----|-------|--------|-------|
| ADR-001 | Dokumentgetriebene Agenten-Koordination | Akzeptiert | 2026-11-08 |
| ADR-002 | TypeScript + Vite als Tech-Stack | Ersetzt durch ADR-007, ADR-008 | 2026-11-08 |
| ADR-003 | Strikte Trennung Core/UI, deterministischer Core | Ersetzt durch ADR-006 | 2026-11-08 |
| ADR-004 | Persistenz über LocalStorage mit Schema-Version | Ersetzt durch ADR-006, ADR-010 | 2026-11-08 |
| ADR-005 | Vitest als Testframework | Akzeptiert (gilt für Backend und Frontend) | 2026-11-08 |
| ADR-006 | Echtzeit-Mehrspieler, server-autoritativ, Tick-Modell | Akzeptiert | 2026-11-08 |
| ADR-007 | Backend-Stack: Node.js, Fastify, Prisma, PostgreSQL | Akzeptiert | 2026-11-08 |
| ADR-008 | Frontend-Stack: React, Vite, TanStack Query (erledigt T-010) | Akzeptiert | 2026-11-08 |
| ADR-009 | Repo-Struktur und Ordner-Eigentum | Akzeptiert | 2026-11-08 |
| ADR-010 | Ein Datenmodell (Prisma), Journale für Nachvollziehbarkeit | Akzeptiert | 2026-11-08 |
| ADR-011 | API-Vertrag: Eigentum Backend, MSW-Mocks im Frontend | Akzeptiert | 2026-11-08 |
| ADR-012 | Balancing-Simulation in TypeScript auf Basis der Backend-Regelfunktionen | Akzeptiert | 2026-11-08 |
| ADR-013 | Satirisches Setting, Zielgruppe ab 18, Jugendschutzmaßnahmen | Akzeptiert | 2026-11-08 |
| ADR-014 | Hosting auf eigenem VPS in Deutschland mit Docker Compose | Akzeptiert | 2026-11-08 |
| ADR-015 | Betrieb als Privatperson, nicht kommerziell; Datenschutz durch Datensparsamkeit | Akzeptiert | 2026-11-08 |
| ADR-016 | Dauerhafte Welt ohne Resets, kleine Spielerzahl zum Start | Akzeptiert | 2026-11-08 |
| ADR-017 | Kontolöschung pseudonymisiert statt Journale zu löschen | Akzeptiert (Details durch Agent 5) | 2026-11-08 |
| ADR-018 | Gemeinsames Clan-Guthaben, Wahl eines neuen Paten | Akzeptiert (Wahlverfahren durch Agent 2) | 2026-11-08 |
| ADR-019 | Geld überall in Cent (ganzzahlig) | Akzeptiert | 2026-11-09 |
| ADR-020 | Datengetriebene Spielbilder mit Fallback | Akzeptiert | 2026-11-09 |
| ADR-021 | Technische Enum-Werte englisch, deutsche Namen nur zur Anzeige | Akzeptiert | 2026-11-09 |
| ADR-022 | Team aus fünf Agenten; Spielregeln geteilt nach Systemen | Akzeptiert | 2026-11-09 |
| ADR-023 | Polizeikontrolle beschlagnahmt alles Mitgeführte; Geldwäsche als Progressionssystem | Akzeptiert | 2026-11-12 |

---

## ADR-001 – Dokumentgetriebene Agenten-Koordination
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Mehrere KI-Agenten arbeiten parallel am Projekt. Ohne gemeinsame, persistente Grundlage entstehen widersprüchliche Annahmen und Doppelarbeit.
- **Entscheidung:** Fünf Steuerungsdokumente im Repo-Root sind die einzige verbindliche Quelle: `PROJECT.md` (Was/Warum), `ARCHITECTURE.md` (Wie), `DECISIONS.md` (Warum so), `ROADMAP.md` (Wann), `TASKS.md` (Wer/Was jetzt). Agent 1 ist Eigentümer.
- **Konsequenzen:** Jede Arbeit referenziert eine Task-ID. Dokumente müssen mit dem Code synchron gehalten werden; veraltete Dokumente gelten als Bug.

## ADR-002 – TypeScript + Vite als Tech-Stack
- **Status:** Ersetzt durch ADR-007, ADR-008 · **Datum:** 2026-11-08
- **Kontext:** Zielplattform ist der Browser, kein Backend nötig. Gewünscht sind schnelle Iteration, Typsicherheit und einfache Auslieferung als statische Seite.
- **Entscheidung:** TypeScript (strict) mit Vite als Dev-Server und Bundler. Kein UI-Framework im ersten Schritt; die UI-Technik (Vanilla DOM vs. leichtgewichtiges Framework) wird in T-010 evaluiert und ggf. per eigenem ADR festgelegt.
- **Konsequenzen:** Build erzeugt statische Dateien (Hosting z. B. über GitHub Pages). Node.js LTS ist Entwicklungsvoraussetzung.

## ADR-003 – Strikte Trennung Core/UI, deterministischer Core
- **Status:** Ersetzt durch ADR-006 (der Grundsatz „reine, testbare Regelfunktionen mit seedbarem Zufall“ lebt im Backend weiter, siehe ARCHITECTURE.md §3) · **Datum:** 2026-11-08
- **Kontext:** Spiellogik muss testbar, balancierbar und unabhängig von der Darstellung weiterentwickelbar sein. Mehrere Agenten sollen parallel an Logik und UI arbeiten.
- **Entscheidung:** `src/core` ist reine, seiteneffektfreie Logik (`reduce(state, command, rng)`). Zufall nur über seeded RNG, dessen Zustand im `GameState` liegt. Keine DOM-, Zeit- oder Storage-Zugriffe im Core.
- **Konsequenzen:** Reproduzierbare Spiele und Tests; Balancing-Simulationen headless möglich. UI muss den gesamten Zustand aus `GameState` ableiten. Importregeln werden per Lint erzwungen.

## ADR-004 – Persistenz über LocalStorage mit Schema-Version
- **Status:** Ersetzt durch ADR-006, ADR-010 · **Datum:** 2026-11-08
- **Kontext:** Spielstände und Highscores sollen ohne Server erhalten bleiben.
- **Entscheidung:** Speicherung als JSON im `localStorage`. Jeder Spielstand enthält `schemaVersion`; `persistence` stellt Migrationen bereit. Fehlerhafte/unlesbare Stände werden verworfen, ohne das Spiel abstürzen zu lassen.
- **Konsequenzen:** Spielstände sind gerätegebunden. Jede Änderung an `GameState` erfordert Prüfung, ob eine Migration nötig ist (Review-Checkpunkt von Agent 1).

## ADR-005 – Vitest als Testframework
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Es braucht ein schnelles Testframework, das nahtlos mit Vite/TypeScript funktioniert.
- **Entscheidung:** Vitest für Unit- und Integrationstests, Coverage über `@vitest/coverage-v8`. E2E-Tests (z. B. Playwright) werden später bei Bedarf per eigenem ADR entschieden.
- **Konsequenzen:** Kein separates Babel/Jest-Setup. Core-Coverage-Ziel ≥ 90 %.

## ADR-006 – Echtzeit-Mehrspieler, server-autoritativ, Tick-Modell
- **Status:** Akzeptiert · **Datum:** 2026-11-08 · **Angestoßen von:** Agent 4, Entscheidung des Product Owners (in den Sessions von Agent 2 und Agent 3 gewählt: „Multiplayer-Browserspiel“, „Echtzeit-Ticks“, „Echtzeit-Browsergame“)
- **Kontext:** ADR-002 bis ADR-004 gingen von einem Single-Player-Spiel mit Client-Logik und LocalStorage aus. Der Product Owner hat ein Mehrspieler-Spiel mit persistenter Welt, Kampf und Clans festgelegt.
- **Entscheidung:** Server-autoritatives Echtzeit-Browsergame. Spielzustand liegt ausschließlich in PostgreSQL, Spiellogik ausschließlich im Backend. Märkte werden in festen Ticks aktualisiert (Länge laut Parameterdatei von Agent 2), Aktionen mit Dauer speichern Endzeitpunkte und werden lazy aufgelöst.
- **Konsequenzen:** Konten, Authentifizierung, Datenschutz und Betrieb eines Servers werden nötig (PROJECT.md Q8, Q9). Der Client enthält keine Spielregeln. Regelfunktionen bleiben rein und seedbar, damit Tests und Simulation (Agent 6) sie nutzen können.

## ADR-007 – Backend-Stack: Node.js, Fastify, Prisma, PostgreSQL
- **Status:** Akzeptiert · **Datum:** 2026-11-08 · **Vorgeschlagen von:** Agent 3, vom Product Owner gewählt
- **Kontext:** Ein gemeinsamer TypeScript-Stack für Frontend und Backend vereinfacht Typen, Tooling und Reviews.
- **Entscheidung:** Node.js ≥ 20, TypeScript strict (ESM), Fastify, zod, Prisma, PostgreSQL 16, argon2id, JWT (Access 15 min) + rotierende Refresh-Tokens (30 Tage, nur gehasht gespeichert). Code in `backend/`.
- **Konsequenzen:** Docker (oder lokales Postgres) für Entwicklung und Tests. Geld als `BigInt`, im JSON als String.

## ADR-008 – Frontend-Stack: React, Vite, TanStack Query
- **Status:** Akzeptiert · **Datum:** 2026-11-08 · **Vorgeschlagen von:** Agent 4 (erledigt T-010)
- **Kontext:** Die UI zeigt Server-State an, der sich pro Tick ändert, und braucht Routing, Formulare und Übersetzbarkeit.
- **Entscheidung:** React 18 + TypeScript strict + Vite in `frontend/`; Tailwind CSS; React Router; TanStack Query für Server-State (Polling); Zustand für lokalen UI-State; react-i18next (Deutsch); MSW als Mock-Server; Vitest, ESLint, Prettier; CI `.github/workflows/frontend.yml` mit lint, typecheck, test, build.
- **Konsequenzen:** Polling statt WebSockets im MVP; Push-Aktualisierung (WebSocket/SSE) kann später per eigenem ADR ergänzt werden.

## ADR-009 – Repo-Struktur und Ordner-Eigentum
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Sechs Agenten arbeiten parallel in einem Repository. Mehrere haben bereits Dateien im Root angelegt (z. B. `README.md` durch Agent 3).
- **Entscheidung:** Monorepo ohne Workspace-Tooling. Ordner und Eigentümer laut ARCHITECTURE.md §2 und PROJECT.md §5. Root-`README.md` und die Steuerungsdokumente gehören Agent 1. Die Backend-Schnellstartanleitung gehört nach `backend/README.md`. CI-Workflows je Bereich als eigene Datei unter `.github/workflows/`.
- **Konsequenzen:** Agent 3 verschiebt seinen Root-README-Inhalt nach `backend/README.md`. Beim Integrieren setzt Agent 1 die Root-`README.md` aus seiner Version zusammen und verlinkt die Bereichs-READMEs.

## ADR-010 – Ein Datenmodell (Prisma), Journale für Nachvollziehbarkeit
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Agent 3 hat bereits ein vollständiges Prisma-Schema angelegt. Agent 5 (Database Architect) soll das Datenmodell verantworten und erwägt eigene SQL-Migrationen. Zwei Schema-Quellen würden zwangsläufig auseinanderlaufen. Fachliche Anforderung: Es muss jederzeit rekonstruierbar sein, warum sich ein Marktpreis verändert hat.
- **Entscheidung:**
  1. Es gibt genau **ein** Schema: `backend/prisma/schema.prisma` mit Prisma-Migrationen. Handgeschriebenes SQL (CHECK, Trigger, Partitionierung) nur als Teil einer Prisma-Migration.
  2. **Agent 5** verantwortet das Datenmodell fachlich (Entwurf, Review jeder Schemaänderung, Dokumentation in `docs/database/`). **Agent 3** setzt es um (Migrationen, Zugriffscode). Agent 5 baut auf Agent 3s bestehendem Schema auf, statt neu zu beginnen.
  3. Wirtschaftliche Vorgänge werden in append-only Journalen gespeichert (Geld, Handel, Preisänderungen mit Ursache). Aktuelle Werte sind daraus abgeleitete Projektionen.
- **Konsequenzen:** Jede PR mit Schemaänderung braucht ein Review von Agent 5 und Agent 1. Datenbank: PostgreSQL (damit ist die DB-Frage in Agent 5s Session beantwortet).

## ADR-011 – API-Vertrag: Eigentum Backend, MSW-Mocks im Frontend
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Agent 4 hat einen Vertragsentwurf `docs/frontend/API-CONTRACT.md` angelegt, Agent 3 implementiert die Endpunkte. Ohne klaren Eigentümer driften Mocks und Server auseinander.
- **Entscheidung:** Der API-Vertrag gehört **Agent 3** und liegt unter `docs/api/API-CONTRACT.md`. Agent 4s Entwurf dient als Anforderungsdokument und wird von Agent 3 übernommen bzw. abgeglichen. Eine aus den Fastify-/zod-Schemas generierte OpenAPI-Spezifikation ist vorerst zurückgestellt (laut Agent 3 Entscheidung des Product Owners); bis dahin ist das Markdown-Dokument verbindlich. Das Frontend mockt ausschließlich gemäß Vertrag. Prefix `/api/v1`, Fehlerformat `{error:{code,message}}`, Geld als String.
- **Konsequenzen:** Vertragsänderungen werden von Agent 3 und Agent 4 gemeinsam abgestimmt; Breaking Changes brauchen Freigabe durch Agent 1.
- **Nachtrag 2026-11-12 (Breaking Changes vor dem ersten Release):** Solange es keinen öffentlichen Betrieb und keine fremden Clients gibt, sind Breaking Changes in `/api/v1` ohne neue Versionsnummer erlaubt. Bedingungen: (1) Freigabe durch Agent 1, (2) Vertrag in `docs/api/API-CONTRACT.md` im selben PR aktualisiert, mit Liste der entfernten bzw. umbenannten Felder, (3) Agent 4 wird vorab informiert und die Frontend-Anpassung unmittelbar danach gemergt; in der Zwischenzeit nutzt das Frontend seine Mocks, `main` bleibt dadurch lauffähig. Ab dem ersten öffentlichen Release (M6) gelten Breaking Changes nur noch mit neuer API-Version.
- **Erste Anwendung:** Datenmodell-Paket von Agent 3 (T-005, B-9 bis B-14, T-119, ADR-017, ADR-018): Katalogwerte (Waren, Städte, Fahrzeuge …) kommen nur noch aus `parameters.toml`, die Datenbank behält nur Schlüssel für Fremdschlüssel und Journale. Feldänderungen u. a. `unitVolume`/`capacity`, getrennte Geldarten (ADR-023), Wegfall von `illegal`, `description`, `country`, `techLevel`, `licenseClass`. Freigegeben.


## ADR-012 – Balancing-Simulation in TypeScript auf Basis der Backend-Regelfunktionen
- **Status:** Akzeptiert · **Datum:** 2026-11-08 · **Vorgeschlagen von:** Agent 6
- **Kontext:** Balancing braucht viele simulierte Spielverläufe. Eine eigene Nachimplementierung der Regeln würde vom echten Spiel abweichen.
- **Entscheidung:** Die Simulation wird in TypeScript im Ordner `sim/` gebaut und importiert die reinen, I/O-freien Regelfunktionen des Backends (seedbarer Zufall). Parameter kommen aus `docs/game-design/parameters.toml`, Referenzwerte (Golden Vectors) aus Agent 2s `verify.py`. CI: schneller Simulationslauf (`sim-fast`) pro PR, ausführlicher `balance-check` nächtlich. Konzept und Spezifikation unter `docs/balancing/`.
- **Konsequenzen:** Agent 3 muss die Regelfunktionen in einem eigenen Bereich ohne Prisma/Fastify-Abhängigkeit halten (ARCHITECTURE.md §3). Änderungen an deren Signaturen brauchen Abstimmung mit Agent 6. `sim/` hängt vom Backend-Code ab, nicht umgekehrt.

## ADR-013 – Satirisches Setting, Zielgruppe ab 18, Jugendschutzmaßnahmen
- **Status:** Akzeptiert · **Datum:** 2026-11-08 · **Entschieden von:** Product Owner (Q2, Q6)
- **Kontext:** Drogenhandel und Kampf sind jugendschutzrelevant (JMStV). Setting und Ton bestimmen Texte, Namen, Grafik und Ereignisse.
- **Entscheidung:**
  1. **Ton:** satirisch-überzeichnet, schwarzer Humor. Fiktive Städte, fiktive Figuren, überzeichnete Waren- und Ereignisnamen. Keine realen Personen oder Marken, keine Anleitungen und keine realistischen Details zu Herstellung oder Konsum, keine Verherrlichung.
  2. **Zielgruppe:** Erwachsene ab 18.
  3. **Maßnahmen:** Pflicht-Checkbox „Ich bin mindestens 18 Jahre alt“ bei der Registrierung (Zeitpunkt der Bestätigung wird gespeichert); Alterskennzeichnung der Website für Jugendschutzprogramme (`age-de.xml`, Stufe 18); Hinweis auf Startseite und im Impressum; keine Werbung oder Social-Media-Ansprache, die sich an Minderjährige richtet.
- **Konsequenzen:** Agent 2 richtet Texte und Ereignisse am satirischen Ton aus; Agent 4 am Grafikstil (Comic/überzeichnet). Agent 3 und Agent 4 setzen die Altersbestätigung um (T-305). Eine reine Selbstauskunft ist rechtlich die schwächste Variante. Vor dem öffentlichen Release ist eine kurze rechtliche Prüfung empfohlen (T-603).

## ADR-014 – Hosting auf eigenem VPS in Deutschland mit Docker Compose
- **Status:** Akzeptiert · **Datum:** 2026-11-08 · **Entschieden von:** Product Owner (Q8)
- **Kontext:** Das Backend braucht Node.js und PostgreSQL. Gewünscht ist ein eigener, günstiger Server (z. B. Hetzner) in Deutschland.
- **Entscheidung:** Ein VPS mit Docker Compose: Container für Backend, PostgreSQL und Reverse Proxy (Caddy mit automatischem TLS); Caddy liefert auch den statischen Frontend-Build aus. Deployment per GitHub Actions (Image bauen, per SSH ausrollen, Migrationen ausführen). Tägliches `pg_dump` mit externer Kopie und getesteter Wiederherstellung. Firewall (nur 22/80/443), SSH nur per Schlüssel, automatische Sicherheitsupdates. Secrets nur als Umgebungsvariablen auf dem Server bzw. als GitHub-Secrets.
- **Konsequenzen:** Updates, Backups und Sicherheit liegen beim Projekt. Agent 3 verantwortet Deployment und Betriebsdokumentation (T-602). Die bestehende `docker-compose.yml` (Dev) bekommt ein Produktions-Gegenstück. Domain noch offen (Q10).

## ADR-015 – Betrieb als Privatperson, nicht kommerziell; Datenschutz durch Datensparsamkeit
- **Status:** Akzeptiert · **Datum:** 2026-11-08 · **Entschieden von:** Product Owner (Q9)
- **Kontext:** Das Spiel speichert Konten (E-Mail, Benutzername, Passwort-Hash, IP-Adressen in Refresh-Tokens/Logs) und ist öffentlich erreichbar.
- **Entscheidung:**
  1. Betreiber ist eine Privatperson, keine Einnahmen, keine Werbung, keine In-App-Käufe.
  2. Impressum und Datenschutzerklärung werden als Seiten im Frontend bereitgestellt. Die persönlichen Angaben trägt der Product Owner selbst in eine Konfigurationsdatei ein; **Agenten erfinden oder committen keine Betreiberdaten**.
  3. Datensparsamkeit: nur E-Mail, Benutzername, Passwort-Hash und Altersbestätigung; IP-Adressen nur so kurz wie nötig (Missbrauchsschutz, Löschfrist in der Datenschutzerklärung); keine Tracker, keine Analyse-Dienste von Dritten, Schriften und Assets selbst gehostet.
  4. Betroffenenrechte: Konto-Löschung und Datenexport durch den Spieler selbst (T-306).
  5. Mit dem Hoster wird ein Auftragsverarbeitungsvertrag geschlossen.
- **Konsequenzen:** Keine AGB/Widerrufsbelehrung nötig, solange nicht kommerziell. Wird das Projekt später kommerziell, braucht es einen neuen ADR.
- **Nachtrag 2026-11-08:** Die Löschfrist für IP-Adressen und User-Agent ist laut Agent 3 vom Product Owner zurückgestellt. Derzeit werden beide gespeichert, solange der Refresh-Token-Eintrag existiert. Das muss vor dem öffentlichen Start gelöst und in der Datenschutzerklärung beschrieben sein (T-605, Release-Blocker).

## ADR-016 – Dauerhafte Welt ohne Resets, kleine Spielerzahl zum Start
- **Status:** Akzeptiert · **Datum:** 2026-11-08 · **Entschieden von:** Product Owner (gegenüber Agent 6: „An Anfang werden es nicht viele Spieler sein.“ / „Nein es soll keine Neustarts in diesem Sinne geben.“)
- **Kontext:** Ohne Resets wachsen Vermögen und Datenbestände unbegrenzt. Neue Spieler treffen auf eine etablierte Elite. Bei wenigen Spielern fehlen Handelspartner, Gegner und Marktbewegung.
- **Entscheidung:**
  1. Die Welt ist dauerhaft: keine Neustarts, keine Saisons mit Reset.
  2. Auslegung für eine kleine Spielerzahl. Standard-Simulation: 30 Spieler über 365 Tage, Varianten mit 10/100/300 (Agent 6).
  3. Gegen Inflation und Abhängen von Neulingen: Geldsenken, die mit dem Vermögen wachsen, und Aufhol-Mechaniken für neue Spieler (Ausgestaltung: Agent 2, Prüfung: Agent 6).
  4. Ranglisten zusätzlich für Zeiträume ohne Reset (z. B. „Aufsteiger der Woche/des Monats“), damit auch neue Spieler Ziele haben.
  5. NPC-Händler und NPC-Gegner als Ausgleich für eine kleine Spielerzahl werden von Agent 2 geprüft (Vorschlag N-1/N-2 von Agent 6). Ihre Stärke soll mit steigender Spielerzahl sinken; die Schwelle ist offen (PROJECT.md Q12).
- **Nachtrag 2026-11-08 (Q12):** Der Product Owner hat gegenüber Agent 6 festgelegt: „Erst wenn genug Spieler regelmäßig Online sind um die Spielmechanik zu tragen.“ Umsetzung (Balancing-Agent, R-4; seit #19 in `docs/balancing/NPC_BEHAVIOR.md` §4): Es gibt keine feste Spielerzahl. Die NPC-Intensität k (Start 1) sinkt erst, wenn Kennzahlen aus echten Spielern 14 Tage am Stück erfüllt sind: Routen-Konkurrenz, Zielverfügbarkeit ohne NPCs, Marktaktivität, gleichzeitig Online zur Abendspitze; „regelmäßig aktiv“ heißt Login an ≥ 4 von 7 Tagen. k sinkt dann um 0,1 pro Woche und steigt wieder, wenn die Kennzahlen 7 Tage verfehlt werden (Hysterese). Schwellenwerte sind Parameter in `parameters.toml`, nicht im Code.
- **Konsequenzen:** Ein einzelner VPS reicht vorerst (passt zu ADR-014). Journale wachsen dauerhaft, deshalb plant Agent 5 Partitionierung bzw. Archivierung (T-507). NPC-Logik läuft serverseitig im Tick und muss als reine Regelfunktion simulierbar sein (ADR-012). Jede Parameteränderung im Live-Betrieb wirkt auf eine bestehende Welt; sie braucht vorher einen Simulationslauf und ggf. eine Datenmigration.

## ADR-017 – Kontolöschung pseudonymisiert statt Journale zu löschen
- **Status:** Akzeptiert (Detailausgestaltung durch Agent 5) · **Datum:** 2026-11-08 · **Anlass:** Review von T-306
- **Kontext:** Die erste Umsetzung von `DELETE /players/me` (Agent 3) löscht das Konto per `onDelete: Cascade`. Damit verschwinden auch Zeilen aus den append-only Journalen (Geld, Handel, ggf. Preisänderungen mit Handelsbezug). Das verletzt ADR-010: Preise und Geldflüsse anderer Spieler wären nicht mehr rekonstruierbar. Gleichzeitig verlangt die DSGVO die Löschung personenbezogener Daten.
- **Entscheidung:**
  1. Bei Kontolöschung werden alle **personenbezogenen** Daten entfernt: E-Mail, Benutzername, Passwort-Hash, Altersbestätigung, Refresh-Tokens (inkl. IP/User-Agent), Nachrichteninhalte.
  2. Der Spieldatensatz (`Player`) bleibt als **pseudonymisierter Akteur** erhalten (z. B. Name „Gelöschter Spieler #<kurze ID>“, Status `DELETED`, vom Login getrennt). Journalzeilen bleiben unverändert und verweisen weiter auf ihn.
  3. Journale dürfen keine `onDelete: Cascade` vom User/Player haben. Für die Journale wird `Restrict` gesetzt; die Löschung läuft über einen Service, nicht über einen Datenbank-Cascade.
  4. Bestand (Geld, Inventar, Fahrzeuge, Immobilien) des gelöschten Spielers wird aus dem Spiel genommen. Die Regeln dazu legt Agent 2 fest, jede Buchung läuft über das Journal.
- **Konsequenzen:** Agent 5 legt die genaue Pseudonymisierung und die Constraint-Änderungen fest (gehört zu T-005/T-105). Agent 3 passt T-306 an. Die Datenschutzerklärung muss die Pseudonymisierung erwähnen. Clan-Folgen siehe Q13 / T-309.

## ADR-018 – Gemeinsames Clan-Guthaben, Wahl eines neuen Paten
- **Status:** Akzeptiert (Wahlverfahren im Detail durch Agent 2) · **Datum:** 2026-11-08 · **Entschieden von:** Product Owner (Q13)
- **Kontext:** Bei einer Kontolöschung (ADR-017) kann ein Clan ohne Paten zurückbleiben. Clans brauchen außerdem gemeinsame Mittel.
- **Entscheidung:**
  1. Jeder Clan hat ein **gemeinsames Clan-Guthaben** (Clan-Kasse). Ein- und Auszahlungen laufen wie alle Geldbewegungen über ein append-only Journal mit Akteur, Betrag, Saldo danach und Grund (ADR-010). Spieler- und Clanseite einer Buchung erscheinen beide im Journal.
  2. Löscht der Pate sein Konto, wählen die verbleibenden Mitglieder **innerhalb des Clans einen neuen Paten**.
  3. Bis zum Ende der Wahl ist der Clan ohne Paten. Auszahlungen aus der Clan-Kasse sind in dieser Zeit gesperrt, Einzahlungen bleiben möglich (Schutz vor Plünderung).
  4. Wahlverfahren (wer wählen und gewählt werden darf, Dauer, Mehrheit, Gleichstand, keine Stimmabgabe, einziges verbleibendes Mitglied) legt Agent 2 als Regel mit Parametern in `parameters.toml` fest. Fallback-Vorschlag von Agent 1, falls die Wahl ergebnislos endet: das dienstälteste ranghöchste Mitglied.
  5. Verlässt das letzte Mitglied den Clan, wird der Clan aufgelöst. Was mit dem Restguthaben geschieht, regelt Agent 2 inflationsneutral (ADR-016).
- **Konsequenzen:** Agent 5 modelliert Clan-Journal und Wahl (Wahl, Stimmen, Ergebnis nachvollziehbar). Agent 3 setzt Wahl-Endpunkte und die Auflösung per Tick bzw. lazy um. Agent 4 baut die Wahl-Oberfläche. Die bestehende Löschlogik (Clan bleibt ohne Paten) ist bis dahin korrekt.

## ADR-019 – Geld überall in Cent (ganzzahlig)
- **Status:** Akzeptiert · **Datum:** 2026-11-09 · **Anlass:** Review der PRs #2, #3, #4
- **Kontext:** Drei Bereiche haben unterschiedliche Geldeinheiten angenommen: Game Design (`parameters.toml`, `verify.py`) und Frontend rechnen in **Cent**, der Backend-Vertrag (`docs/api/API-CONTRACT.md`) in **ganzen Spielwährungs-Einheiten**. Das Game Design braucht Beträge unter 1 € (z. B. Spritpreis 185 ct/l, Umsatz und Wäsche pro Tick in ct).
- **Entscheidung:** Alle Geldbeträge werden im gesamten System als **ganzzahlige Cent** geführt: in `parameters.toml`, in der Datenbank (`BigInt`), in der Spiellogik, im API-JSON (als String, z. B. `"3000000"` = 30.000,00 €) und im Frontend (`BigInt`). Umrechnung in Euro nur bei der Anzeige. Keine Gleitkommazahlen für Geld.
- **Konsequenzen:** Agent 3 stellt Vertrag, Startwerte und Tests auf Cent um (T-109); da noch kein Spieler existiert, ist keine Datenmigration nötig. Agent 4 behält seine Cent-Logik. Agent 5 prüft, dass `BigInt` für Cent-Beträge im Late-Game reicht (ja: bis ca. 9,2 · 10^16 €). Agent 6 nutzt Cent in der Simulation.

## ADR-020 – Datengetriebene Spielbilder mit Fallback
- **Status:** Akzeptiert · **Datum:** 2026-11-09 · **Entschieden von:** Product Owner (Vorgabe: Bildpfade in `parameters.toml`, dynamisches Laden mit Fallback), Ausgestaltung Agent 1
- **Kontext:** Waren, Fahrzeuge, Waffen, Schutzausrüstung, Crew und Raumschiffe sollen Bilder bekommen. Der Product Owner will Bilder selbst einstellen können, ohne Code anzufassen.
- **Entscheidung:**
  1. **Ablage:** `frontend/public/images/<kategorie>/` mit den Kategorien `goods`, `vehicles`, `weapons`, `armor`, `crew`, `ships`. Die Bilddateien liefert der Product Owner. Ordnerstruktur, Platzhalter (`_fallback.svg`) und Anleitung (`README.md`) betreut Agent 4. Herkunft und Lizenz fremder Bilder stehen in `QUELLEN.md`.
  2. **Zuordnung nur in `parameters.toml` (Agent 2):** Jeder Eintrag bekommt ein optionales Feld `image`, relativ zu `images/` (z. B. `[goods.gras] image = "goods/gras.webp"`). Dazu ein Abschnitt `[images]` mit `fallback.<kategorie>` (z. B. `fallback.goods = "goods/_fallback.svg"`). Konvention: Dateiname = Schlüssel. Kein Bildpfad steht im Code.
  3. **Prüfung:** `verify.py` prüft jeden `image`-Pfad: relativ, ohne `..`, Endung `.webp`, `.png` oder `.svg`, Kategorie passt zum Abschnitt. Fehlende Dateien sind eine Warnung, kein Fehler, weil der Fallback greift.
  4. **API (Agent 3):** Endpunkte für Waren, Fahrzeuge, Ausrüstung und Schiffe liefern das Feld `image` (relativer Pfad oder `null`) aus `parameters.toml` mit aus (Teil von T-101). Bildpfade werden nicht in der Datenbank gespeichert.
  5. **Frontend (Agent 4):** eine zentrale Komponente (z. B. `GameImage`) lädt das Bild aus `${BASE_URL}images/<image>`. Fallback-Kette: `image` fehlt oder lädt nicht → Kategorie-Platzhalter aus `[images]` → eingebautes neutrales Symbol. Dazu `loading="lazy"`, festes Seitenverhältnis (kein Layout-Springen) und `alt` = Anzeigename (`name`), nie der Schlüssel (ADR-013). Im Mock-Modus kommen die Pfade aus derselben `parameters.toml` (beim Build eingelesen), damit Mock und Backend identisch sind.
  6. **Bildregeln:** WebP (bevorzugt), PNG oder SVG; quadratisch 512 × 512 px; höchstens 300 KB. Stil satirisch-comicartig (ADR-013): keine echten Markenlogos, keine realen Personen, keine realistischen Drogen- oder Konsumdarstellungen. Nur eigene oder passend lizenzierte Bilder.
- **Nachtrag 2026-11-09 (Reihenfolge):** Das Backend validiert `parameters.toml` strikt und lehnt unbekannte Schlüssel ab (T-101). Deshalb zuerst T-114a: Agent 3 nimmt `image` (optional) und `[images]` ins Parameter-Schema auf. Erst danach trägt Agent 2 die Felder ein (T-113). Die Auslieferung über die API (T-114) folgt im Anschluss.
- **Konsequenzen:** Neue Bilder brauchen keine Code-Änderung, nur Datei plus Eintrag in `parameters.toml`. Ohne Bilder sieht das Spiel dank Fallback trotzdem vollständig aus. Bild-PRs prüft Agent 1 auf Format, Größe, Stil und Rechte. Bilder werden von Caddy als statische Dateien ausgeliefert (ADR-014); ein späterer Wechsel auf ein CDN ändert nur den Basis-Pfad.

## ADR-021 – Technische Enum-Werte englisch, deutsche Namen nur zur Anzeige
- **Status:** Akzeptiert · **Datum:** 2026-11-09 · **Anlass:** Befund B-15 (Agent 3)
- **Kontext:** Das Game Design (Agent 2) nennt die Clan-Ränge `PATE/CONSIGLIERE/CAPO/SOLDAT/MITLAEUFER` als verbindliche API-Werte. Datenbank-Enum, API-Vertrag und Frontend nutzen bereits `GODFATHER/CONSIGLIERE/CAPO/SOLDIER/ASSOCIATE`. Dasselbe Muster kann bei weiteren Aufzählungen (Status, Kontoarten …) auftreten.
- **Entscheidung:**
  1. Technische Werte in Datenbank, API und Code sind **englisch in Großbuchstaben** und bleiben stabil. Den API-Vertrag verantwortet Agent 3 (ADR-011).
  2. Deutsche Bezeichnungen sind **Anzeigetexte** (Frontend-i18n bzw. `name`-Felder in `parameters.toml`), nie API-Werte.
  3. Für Clan-Ränge gilt: `GODFATHER` = Pate, `CONSIGLIERE` = Consigliere, `CAPO` = Capo, `SOLDIER` = Soldat, `ASSOCIATE` = Mitläufer.
  4. Das Game Design verwendet in Regeln und Parametern die technischen Werte, z. B. `clans.election_voter_min_rank = "SOLDIER"`, und führt die deutsche Bezeichnung als Erläuterung.
- **Konsequenzen:** Agent 2 passt `clans.md` und die Rang-Parameter in `parameters.toml` an (T-117). Agent 3 prüft die Werte beim Laden der Parameter gegen den Enum. Keine Datenbankmigration nötig.

## ADR-022 – Team aus fünf Agenten; Spielregeln geteilt nach Systemen
- **Status:** Akzeptiert · **Datum:** 2026-11-09 · **Entschieden von:** Product Owner (gegenüber Agent 1 bestätigt)
- **Kontext:** Bisher waren sechs Agenten geführt (5 = Database Architect, 6 = Balancing). Die Datenbank-Sitzung hatte kein Repository und hat nie geliefert; der Balancing-Agent arbeitet als „Agent 5“. Außerdem war offen, wer die Wirtschaftsregeln verantwortet.
- **Entscheidung:**
  1. **Fünf Agenten:** 1 Project Director, 2 Game Design, 3 Backend **inklusive Datenmodell**, 4 Frontend, 5 Game Balancing & Simulation. Die Rolle „Database Architect“ entfällt.
  2. **Datenmodell:** Agent 3 entwirft, dokumentiert (`docs/database/`) und setzt um. ADR-010 gilt weiter (ein Prisma-Schema, Journale). Wo frühere ADRs (ADR-010, ADR-016 bis ADR-019) „Agent 5“ für Datenbankaufgaben nennen, ist jetzt Agent 3 gemeint. Wo sie „Agent 6“ nennen, ist der Balancing-Agent gemeint, also jetzt Agent 5.
  3. **Spielregeln geteilt nach Systemen:** Agent 5 verantwortet fachlich Spielökonomie, Preise, Angebot/Nachfrage, Marktdynamik, Wirtschaftsereignisse, NPC-Marktverhalten, Progression und Simulation. Agent 2 verantwortet Kampf, Clans, Geldwäsche, Immobilien, Weltraum und Reisen/Kontrollen.
  4. `docs/game-design/parameters.toml` und `verify.py` bleiben in Agent 2s Eigentum. Änderungen an den Abschnitten von Agent 5 bringt Agent 5 per PR ein, abgestimmt mit Agent 2. Bei Streit entscheidet Agent 1.
- **Konsequenzen:** Die offenen Datenbank-Aufgaben (T-005, ADR-017-Pseudonymisierung, ADR-018-Clan-Kasse, B-9 bis B-15, T-507, T-605) liegen bei Agent 3. Die Datenbank-Sitzung wird nicht mehr genutzt. Systemübergreifende Regeln (z. B. Beschlagnahme bei Kontrollen beeinflusst die Wirtschaft) stimmen Agent 2 und Agent 5 gemeinsam ab.

## ADR-023 – Polizeikontrolle beschlagnahmt alles Mitgeführte; Geldwäsche als Progressionssystem
- **Status:** Akzeptiert · **Datum:** 2026-11-12 · **Entschieden von:** Product Owner (gegenüber Agent 1)
- **Kontext:** Der Balancing-Agent hatte empfohlen, bei Kontrollen nur 50 % zu beschlagnahmen, weil Totalverlust in der Simulation Sackgassen erzeugt (`docs/balancing/GAME_BALANCING.md` §6). Der Product Owner will das Risiko bewusst hoch halten und stattdessen über Geldwäsche einen Ausweg und eine Progression schaffen.
- **Entscheidung (Vorgaben des Product Owners):**
  1. **Polizeikontrolle:** Beschlagnahmt werden **alles mitgeführte Bargeld (Schwarzgeld) und alle mitgeführten Drogen**. Die 50-%-Empfehlung ist damit abgelehnt. Nicht mitgeführte Werte (Bankkonto, Lager/Immobilien) sind nicht betroffen.
  2. **Zwei Geldarten:** Bargeld = Schwarzgeld (mitgeführt, beschlagnahmbar). Bankkonto = gewaschenes Geld (sicher vor Kontrollen). Damit ist die Grundfrage von Befund B-9 entschieden.
  3. **Sichern über legale Geschäfte:** Spieler sollen Geld in Geschäfte anlegen, aufsteigend vom kleinen Rotlicht-Einstieg bis zum Bordell. Erträge daraus gelten als gewaschen und landen auf dem Bankkonto.
  4. **Bargeld jederzeit waschen:** Spieler können Bargeld jederzeit direkt waschen. Am Anfang geht das nur über **Glücksspiel**, mit stark schwankendem Umtauschkurs Schwarz → Weiß.
  5. **Progression:** Mit steigendem Level werden die Waschmethoden **stabiler und lukrativer**. Am Ende stehen Methoden für Superreiche: Offshore-Enthüllungen à la „Panama Papers“, Scheinfirmen in Steuerparadiesen, Stiftungen.
  6. **Darstellung (ADR-013):** satirisch überzeichnet, mit fiktiven Namen für Steueroasen, Firmen und Enthüllungen, keine realen Personen oder Firmen. Rein spielmechanisch abstrahiert, keine Anleitung zu realer Geldwäsche; das Rotlicht-Gewerbe bleibt wie bisher eine abstrakte Wirtschaftseinheit.
  7. **Zusammenarbeit:** Agent 2 (Geldwäsche, Kontrollen) und Agent 5 (Wirtschaft, Progression) erarbeiten die Regeln **gemeinsam** (ADR-022). Ziel ist ein ansprechender Spielfortschritt trotz Totalbeschlagnahme. Agent 5 weist per Simulation nach, dass Durchschnittsspieler nicht in Sackgassen geraten.
- **Nachtrag 2026-11-12 (Produktentscheidungen zu T-120, vom Product Owner beantwortet):**
  1. **Keine Zusatzstrafe:** Bei einer Kontrolle gibt es nur die Beschlagnahme. Die bisherige Strafe (20 % des Ladungswerts, Rest als Schuld) entfällt.
  2. **Kein Geld-Versteck:** Im Lager bzw. in Immobilien ist nur Ware sicher. Schwarzgeld ist nur mitgeführt (gefährdet) oder gewaschen auf dem Bankkonto (sicher).
  3. **Notkredit nur als letzter Ausweg („Kredithai“):** Präzisiert vom Product Owner gegenüber Agent 2: Der Notkredit beträgt **100.000 €** und gibt es erst, wenn **alle Waffen und alle Fahrzeuge bis auf eines** verkauft sind; ein Fahrzeug darf der Spieler also behalten. Tilgung und Zinsen legen Agent 2 und Agent 5 in T-120 fest (Startidee Agent 5: Tilgung mit 50 % der Verkaufserlöse, höchstens ein Kredit pro Woche). Voraussetzung: Waffen und Fahrzeuge lassen sich zurückverkaufen (Rückkaufpreis legt Agent 5 fest, Exploit-Prüfung E-08).
  4. **Kontrollen nur auf Reisen.** Überfälle durch Spieler und NPC-Banden folgen ihren eigenen, gedeckelten Regeln.
- **Konsequenzen:** `money-laundering.md`, die Kontrollregeln und `parameters.toml` werden überarbeitet (T-120); die Simulation bekommt ein neues Szenario mit Totalbeschlagnahme und Wäsche-Progression. Agent 3 trennt im Datenmodell Bargeld (schwarz) und Bankkonto (weiß) und journalisiert jede Wäsche und jede Beschlagnahme (ADR-010). Agent 4 zeigt beide Geldarten und das Kontrollrisiko deutlich an.

---

## Vorlage für neue ADRs

```md
## ADR-XXX – <Titel>
- **Status:** Vorgeschlagen · **Datum:** YYYY-MM-DD · **Vorgeschlagen von:** <Agent>
- **Kontext:** <Problem, Randbedingungen>
- **Optionen:** <A, B, C mit Vor-/Nachteilen>
- **Entscheidung:** <gewählte Option>
- **Konsequenzen:** <Folgen, betroffene Module/Tasks>
```
