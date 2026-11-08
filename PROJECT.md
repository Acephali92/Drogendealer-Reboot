# PROJECT.md – Drogendealer-Reboot

> Gepflegt von Agent 1 (Project Director). Stand: 2026-11-08, Revision 2.
> Revision 2 ersetzt das ursprüngliche Single-Player-Platzhalterkonzept: Der Product Owner hat
> gegenüber Agent 2 und Agent 3 ein **Echtzeit-Mehrspieler-Browsergame** festgelegt (siehe ADR-006).

## 1. Vision

Ein **satirisch-überzeichnetes Echtzeit-Mehrspieler-Browsergame mit persistenter Welt** für Erwachsene (ab 18). Spieler handeln mit Waren zwischen
Städten, reisen mit Fahrzeugen, kämpfen gegeneinander, schließen sich zu Clans zusammen und
konkurrieren in Ranglisten. Märkte reagieren serverseitig in festen Zeitschritten (Ticks) auf
Angebot, Nachfrage und Ereignisse. Jede wirtschaftliche Veränderung ist nachvollziehbar.

Das Spiel hat eine **eigenständige Umsetzung**: eigene Texte, Grafiken, Namen und Musik. Es werden
keine geschützten Inhalte (Namen, Texte, Grafiken, Musik) aus bestehenden Spielen übernommen.

## 2. Kern-Loop (Entwurf, maßgeblich sind die Spielregeln von Agent 2)

```
Einloggen ─► Markt in aktueller Stadt prüfen ─► Kaufen / Verkaufen
    ▲                                                │
    │                               Reise starten (dauert echte Zeit, Timer)
    │                                                │
    └── Rangliste / Clan / Kampf ◄── Ankunft, Ereignisse, Markt-Ticks
```

- Zeitmodell: serverseitige **Echtzeit-Ticks** (Tick-Länge laut Parameterdatei von Agent 2; aktueller Entwurf: 10 min).
- Aktionen mit Dauer (Reisen, Krankenhaus, Haft …) speichern Endzeitpunkte und werden lazy aufgelöst.
- **Dauerhafte Welt:** keine Neustarts, keine Saisons mit Reset. Anfangs nur wenige Spieler pro Server (ADR-016).

## 3. Zielplattform & Technik

- Browser (Desktop, Mobile responsiv), Spieloberfläche auf Deutsch, i18n-fähig.
- Server-autoritativ: Spiellogik und Zustand liegen im Backend, der Client zeigt nur an und sendet Aktionen.
- Backend: Node.js + TypeScript, Fastify, Prisma, PostgreSQL. Frontend: React + TypeScript + Vite.
- Details: [ARCHITECTURE.md](ARCHITECTURE.md), Begründungen: [DECISIONS.md](DECISIONS.md).

## 4. Scope

### MVP (Meilenstein M3, siehe [ROADMAP.md](ROADMAP.md))
- Registrierung/Login, Spielerprofil
- Städte, Waren, Marktpreise mit Tick-Aktualisierung und Preis-Historie
- Kaufen/Verkaufen, Inventar mit Kapazität
- Reisen mit Fahrzeugen (Echtzeit-Timer)
- Rangliste (Vermögen)

### Danach
- Kampf zwischen Spielern, Ausrüstung
- Clans, Nachrichten, soziale Funktionen
- Immobilien, Bank
- Spielereignisse, Balancing-Werkzeuge, Admin-Werkzeuge

### Nicht-Ziele (vorerst)
- Native Apps, Echtgeld-Monetarisierung, Werbung (nicht kommerzielles Projekt, ADR-015)
- Realistische Darstellung oder Verherrlichung von Drogenkonsum; echte Städte und reale Personen (ADR-013)
- Übernahme geschützter Inhalte aus bestehenden Spielen

## 5. Rollenmodell (Agenten)

| Agent | Rolle | Eigentum (Ordner/Dokumente) | Session-Titel |
|-------|-------|------------------------------|---------------|
| Agent 1 | Project Director / Technical Lead | Root-Steuerungsdokumente, Root-`README.md`, `.github/` (gemeinsam) | „Agent 1 – Projektdirektor/Technischer Lead“ |
| Agent 2 | Game Designer (Spielregeln & Systemdokumentation) | `docs/game-design/` inkl. `parameters.toml` und Prüfskript `verify.py` | „Spielregeln und Systemdokumentation“ |
| Agent 3 | Backend Developer | `backend/` (außer Datenmodell-Entscheidungen), `docker-compose.yml`, `docs/api/` | „Agent 3 – Backend-Entwickler“ |
| Agent 4 | Frontend / UI | `frontend/`, `docs/frontend/` | „Frontend-UI für Spieloberfläche“ |
| Agent 5 | Database Architect | Datenmodell (`backend/prisma/schema.prisma` fachlich), `docs/database/` | „Datenbankarchitektur für Spielwelt“ |
| Agent 6 | Game Balancing & Simulation Engineer | `sim/`, `docs/balancing/` | „Game Balancing & Simulation Engineer“ |

### Agent 1 – Project Director / Technical Lead
- Gesamtarchitektur überwachen, Entwicklungsaufgaben definieren und verteilen
- Technische Entscheidungen dokumentieren (DECISIONS.md)
- Arbeitsergebnisse anderer Agenten überprüfen (Code-Reviews), Branches integrieren
- Konflikte zwischen Agenten auflösen, Abhängigkeiten zwischen Modulen koordinieren
- Sicherstellen, dass alle Komponenten zusammenpassen

Agent 1 implementiert **keine größeren Features** selbstständig, ohne die zuständigen Entwickler einzubeziehen.

### Schnittstellen zwischen Rollen (Kurzfassung)
- **Agent 2 → Agent 3/6:** Regeln und Zahlen stehen ausschließlich in Agent 2s Parameterdatei; Backend und Simulation lesen sie, kopieren sie nicht.
- **Agent 5 ↔ Agent 3:** Agent 5 entscheidet das Datenmodell, Agent 3 setzt es in Prisma-Migrationen und Code um. Es gibt **ein** Schema (Prisma), keine parallele SQL-Schiene (ADR-010).
- **Agent 3 ↔ Agent 4:** Der API-Vertrag gehört Agent 3; Agent 4 liefert Anforderungen und mockt per MSW, bis Endpunkte existieren (ADR-011).

## 6. Arbeitsregeln für alle Agenten

1. **Arbeit nur über Tasks.** Jede Änderung gehört zu einer Task-ID aus [TASKS.md](TASKS.md). Keine Task → zuerst bei Agent 1 anfragen.
2. **Nur im eigenen Bereich schreiben** (Tabelle oben). Änderungen in fremden Ordnern nur nach Absprache mit dem Eigentümer.
3. **Architektur ist verbindlich.** Abweichungen von [ARCHITECTURE.md](ARCHITECTURE.md) nur über einen ADR in [DECISIONS.md](DECISIONS.md), freigegeben durch Agent 1.
4. **Ein Task, ein Branch, ein PR.** Commit-Messages referenzieren die Task-ID (z. B. `T-104: Marktpreis-Tick`).
5. **Review vor Merge.** Agent 1 prüft gegen Akzeptanzkriterien und Architekturregeln.
6. **Tests sind Pflicht** für Spiellogik, API-Endpunkte und Datenbank-Constraints.
7. **Konflikte** (Zuständigkeit, Schnittstellen, widersprüchliche Änderungen) werden an Agent 1 eskaliert; Entscheidung wird in DECISIONS.md festgehalten.
8. **Status aktuell halten.** Wer einen Task übernimmt, setzt Status und Zuständigkeit in TASKS.md.

## Offene Fragen an den Product Owner

| # | Frage | Auswirkung | Status |
|---|-------|-----------|--------|
| Q1 | Spielkonzept | alles | ✅ geklärt: Echtzeit-Mehrspieler-Browsergame (ADR-006) |
| Q2 | Setting & Tonalität | Content, UI-Stil | ✅ satirisch-überzeichnet, fiktive Städte (ADR-013) |
| Q3 | Zeitmodell | Backend, Game Design | ✅ geklärt: Echtzeit-Ticks (Länge per Parameter) |
| Q4 | Umfang Städte/Waren im MVP | Content | delegiert an Agent 2 |
| Q5 | Weitere Agenten-Rollen | Task-Zuweisung | ✅ geklärt: Agenten 2–6 |
| Q6 | Zielgruppe / Altersfreigabe, Jugendschutz | Content, Texte, Rechtliches | ✅ ab 18, Altersbestätigung + Alterskennzeichnung (ADR-013) |
| Q7 | Sprache der Oberfläche | UI, i18n | ✅ Deutsch, i18n-vorbereitet |
| Q8 | Hosting/Betrieb (Server, Domain, Datenbank) | Deployment | ✅ eigener VPS in Deutschland, Docker Compose (ADR-014); Domain offen |
| Q9 | Rechtliches: Impressum, Datenschutzerklärung | Release | ✅ Privatperson, nicht kommerziell (ADR-015); Angaben trägt der Product Owner selbst ein |
| Q10 | Domain-Name und Absender-Adresse für E-Mails (Passwort-Reset) | Deployment | offen |
| Q11 | Spielerzahl & Welt-Resets | Balancing, Betrieb | ✅ anfangs wenige Spieler, keine Resets/Saisons (ADR-016) |
| Q13 | Was passiert mit einem Clan, wenn der Pate sein Konto löscht und noch Mitglieder da sind? | Game Design, Backend | ✅ Gemeinsames Clan-Guthaben; neuer Pate wird innerhalb des Clans gewählt (ADR-018). Wahlverfahren im Detail: Agent 2 |
| Q12 | Ab welcher Spielerzahl sollen NPC-Ausgleichsmechaniken zurückgefahren werden? | Game Design, Balancing | ✅ „Erst wenn genug Spieler regelmäßig online sind, um die Spielmechanik zu tragen“ (PO gegenüber Agent 6). Umsetzung über Kennzahlen statt fester Zahl, siehe ADR-016 Nachtrag |
