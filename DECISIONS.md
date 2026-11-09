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
- **Nachtrag 2026-11-08 (Q12):** Der Product Owner hat gegenüber Agent 6 festgelegt: „Erst wenn genug Spieler regelmäßig Online sind um die Spielmechanik zu tragen.“ Umsetzung (Agent 6, `docs/balancing/balancing-concept.md` §2, R-4): Es gibt keine feste Spielerzahl. Die NPC-Intensität k (Start 1) sinkt erst, wenn Kennzahlen aus echten Spielern 14 Tage am Stück erfüllt sind: Routen-Konkurrenz, Zielverfügbarkeit ohne NPCs, Marktaktivität, gleichzeitig Online zur Abendspitze; „regelmäßig aktiv“ heißt Login an ≥ 4 von 7 Tagen. k sinkt dann um 0,1 pro Woche und steigt wieder, wenn die Kennzahlen 7 Tage verfehlt werden (Hysterese). Schwellenwerte sind Parameter in `parameters.toml`, nicht im Code.
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
