# PROJECT.md – Drogendealer-Reboot

> **Status: ENTWURF.** Das Spielkonzept ist ein Platzhalter des Project Directors (Agent 1).
> Alle mit ⚠️ markierten Punkte müssen vom Product Owner bestätigt oder ersetzt werden
> (siehe [Offene Fragen](#offene-fragen-an-den-product-owner)).

## 1. Vision

⚠️ Ein rundenbasiertes Handels- und Wirtschaftsspiel im Browser. Der Spieler startet mit wenig
Kapital und Schulden, kauft Waren an einem Ort günstig ein und verkauft sie anderswo teurer.
Schwankende Preise, Zufallsereignisse und begrenzte Zeit sorgen für Risiko und Spannung.

Das Spiel hat eine **eigene Spielwelt**, eigene Orte, eigene Waren und eine eigene Präsentation.
Es ist ausdrücklich **keine Nachbildung** eines bestehenden Spiels.

## 2. Kern-Loop

```
Neuer Tag ─► Marktpreise ansehen ─► Kaufen / Verkaufen ─► Reisen (kostet Zeit)
    ▲                                                          │
    └──────────── Bilanz / Spielende-Prüfung ◄── Zufallsereignis ◄┘
```

- Das Spiel dauert eine feste Anzahl an Tagen ⚠️ (Vorschlag: 30).
- Ziel: am Ende möglichst viel Nettovermögen (Bargeld + Bank − Schulden).
- Begrenzte Tragekapazität, Schulden mit Zinsen, Reisen verbraucht Tage.

## 3. Zielplattform & Technik

- Browser (Desktop, Mobile als Nice-to-have), Single-Player, offline-fähig.
- TypeScript + Vite, kein Backend. Details: [ARCHITECTURE.md](ARCHITECTURE.md), Begründungen: [DECISIONS.md](DECISIONS.md).

## 4. Scope

### MVP (Meilenstein M2, siehe [ROADMAP.md](ROADMAP.md))
- 1 Spielmodus, feste Spieldauer
- ⚠️ 5–6 Orte, 6–8 Warenarten mit eigenen Preisbändern
- Kaufen, Verkaufen, Reisen, Schulden tilgen
- Einfache Zufallsereignisse (Preisspitzen / -einbrüche, Funde, Verluste)
- Spielende-Bildschirm mit Punktzahl

### Später
- Bank/Sparkonto, Kapazitäts-Upgrades
- Speichern/Laden, lokale Highscore-Liste
- Erweitertes Ereignissystem, Balancing-Werkzeuge
- Sound, Animationen, Lokalisierung (DE/EN)

### Nicht-Ziele
- Kein Multiplayer, kein Server, keine Accounts
- Keine Monetarisierung
- Keine Übernahme von Namen, Texten, Grafiken oder Musik aus bestehenden Spielen

## 5. Rollenmodell (Agenten)

| Agent | Rolle | Status |
|-------|-------|--------|
| Agent 1 | Project Director / Technical Lead | aktiv |
| Agent 2+ | Entwickler-/Fach-Rollen | **TBD** – werden vom Product Owner definiert |

### Agent 1 – Project Director / Technical Lead
Verantwortlich für Gesamtkoordination und technische Entscheidungen:
- Gesamtarchitektur überwachen
- Entwicklungsaufgaben definieren und verteilen
- Technische Entscheidungen dokumentieren
- Arbeitsergebnisse anderer Agenten überprüfen (Code-Reviews)
- Konflikte zwischen Agenten auflösen
- Abhängigkeiten zwischen Modulen koordinieren
- Sicherstellen, dass alle Komponenten zusammenpassen

Agent 1 implementiert **keine größeren Features** selbstständig, ohne die zuständigen Entwickler einzubeziehen.

Steuerungsdokumente von Agent 1:
[PROJECT.md](PROJECT.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md) · [DECISIONS.md](DECISIONS.md) · [TASKS.md](TASKS.md)

## 6. Arbeitsregeln für alle Agenten

1. **Arbeit nur über Tasks.** Jede Änderung gehört zu einer Task-ID aus [TASKS.md](TASKS.md). Keine Task → zuerst bei Agent 1 anfragen.
2. **Architektur ist verbindlich.** Abweichungen von [ARCHITECTURE.md](ARCHITECTURE.md) nur über einen neuen ADR in [DECISIONS.md](DECISIONS.md), freigegeben durch Agent 1.
3. **Ein Task, ein Branch, ein PR.** Commit-Messages referenzieren die Task-ID (z. B. `T-006: Preismodell`).
4. **Review vor Merge.** Agent 1 prüft gegen Akzeptanzkriterien und Architekturregeln.
5. **Tests sind Pflicht** für alle Änderungen in `src/core`.
6. **Konflikte** (Zuständigkeit, Schnittstellen, widersprüchliche Änderungen) werden an Agent 1 eskaliert; Entscheidung wird in DECISIONS.md festgehalten.
7. **Status aktuell halten.** Wer einen Task übernimmt, trägt sich in TASKS.md ein und setzt den Status.

## Offene Fragen an den Product Owner

| # | Frage | Auswirkung |
|---|-------|-----------|
| Q1 | Bestätigung / Ersetzung des Spielkonzepts (Genre, Ton, Setting) | PROJECT.md, Content (T-013) |
| Q2 | Setting & Tonalität: realistisch, satirisch, fiktiv-futuristisch? | Content, UI-Stil |
| Q3 | Spieldauer und Siegbedingung | Core (T-009) |
| Q4 | Anzahl Orte / Waren im MVP | Content (T-011, T-013) |
| Q5 | Welche weiteren Agenten-Rollen gibt es? | Task-Zuweisung |
| Q6 | Zielgruppe / Altersfreigabe | Content, Texte |
| Q7 | Sprache der Spieloberfläche (DE, EN, beides) | UI, i18n |
