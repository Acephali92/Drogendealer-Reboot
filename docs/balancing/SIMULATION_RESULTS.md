# SIMULATION_RESULTS – Simulationsergebnisse

> Agent 5 – Game Balancing & Simulation · Läufe vom 2026-11-09
> Werkzeug: [`sim/`](../../sim) ([MARKET_SIMULATION.md](MARKET_SIMULATION.md)). Parameter: `docs/game-design/parameters.toml` auf `main` @ `1c396cd` (SHA-256 `1072bd270762…`). Vorschläge: `sim/proposals.toml`.
> Alle Werte sind **[gemessen]**, solange nicht anders markiert. Jeder Lauf lässt sich mit `npm run sim -- run <id>` reproduzieren (deterministisch, Seeds `<id>-1 … <id>-n`).

## Zusammenfassung

| # | Erkenntnis | Läufe | Folge |
|---|---|---|---|
| 1 | **Totalbeschlagnahme erzeugt Sackgassen.** Nach 90 Tagen liegen 50 % (B), 67 % (C) und 29 % (E) der Läufe unter dem Startkapital. Mit 50 % Beschlagnahme sind es 0 % bei A, B, C und E, Gini 0,74 → 0,56. | `base-short`, `h-confiscation`, `safety-net` | Empfehlung B-1 |
| 2 | **NPC-Händler (F-NPC-01, k = 1) allein verschärfen das Problem.** Dünnere Margen machen jede Kontrolle relativ teurer (Verlustquote C 83 %, E 50 %). **Zusammen mit 50 % Beschlagnahme** bremsen sie nur noch das Wachstum (E Tag 90: 335.000 € statt 624.000 €), alle Läufe von A, B, C und E bleiben im Plus, und der reichste Spieler hat nur noch das 3,9-Fache des Medians. | `npc`, `npc-half`, `npc-conf` | Empfehlung B-1 vor Einführung von F-NPC-01 |
| 3 | **Die Geldmenge wächst ungebremst.** Nach 365 Tagen liegen ≈ 18,7 Mio. € bei 35 Spielern im Spiel, in den letzten 30 Tagen kamen noch +10 % dazu. E besitzt ≈ 2,5 Mio. €. | `base` | Empfehlung B-3 (F-PRG-01) |
| 4 | **Eine Ware und eine Kurzroute dominieren.** 5 der 8 umsatzstärksten Märkte handeln Kokain. Statisch: Route-Dominanz-Index 27,6, nur 13 % der Routen sind mit Startkapital profitabel. | `base`, statische Analyse | Befund B-2 (nächstes Experiment) |
| 5 | **Die Marktstabilität ist gut.** P/P* liegt im Tagesmittel bei 0,98–1,05 (Regel) bzw. 0,91–1,08 (mit Eigendynamik), knappe Markt-Ticks bei 6–8 %. | alle | – |
| 6 | **NPC-Rückbau (R-4):** Die Kennzahlen sind bei ≈ 120–130 Spielern erfüllt, k sinkt erstmals bei 117–134 Spielern (3 von 4 Läufen). Engpass ist die Marktaktivität. | `s8-handover` | Prognose für den Betreiber |
| 7 | **0 Invariantenverletzungen** in allen Läufen: Geldbilanz je Tick exakt, keine negativen Bestände, deterministisch. | alle | – |

## 0. Änderungen am Modell

| Datum | Änderung | Grund |
|---|---|---|
| 2026-11-09 | Bots lernen einen Prognosefaktor für den Verkaufserlös (`forecastBias`) | In der ersten Version überschätzten alle Bots den Erlös am Ziel um 10–30 %, weil sie den Preis zum Abfahrtszeitpunkt ansetzten. Profil A verlor dadurch in ≈ 90 % der Läufe sein Kapital. Das war ein **Modellfehler, kein Spielbefund**. |
| 2026-11-09 | Profil A darf in bessere Startstädte umziehen (Leerfahrt) | A blieb sonst in Städten ohne profitable Route mit wenig Heat hängen. |
| 2026-11-09 | NPC-Händler nach F-NPC-01 (Agent 2) statt des eigenen Vorschlags | F-NPC-01 ist beschlossen (`npc.md`). |
| 2026-11-09 | Fahrzeugverkauf nach Totalverlust (Neustart) | rationale Reaktion, vorher blieben Bots mit Fahrzeug, aber ohne Geld stehen |

Ergebnisse von vor diesen Änderungen sind **nicht** in diesem Dokument enthalten.

## 1. Statische Routenanalyse (Startkapital 2.000 €, Bahn, Gleichgewichtspreise)

Bewertet sind alle 448 (Ware, Start, Ziel)-Kombinationen auf der Erde mit voller Rucksackladung, höchstens 2.000 €. Der Erwartungswert berücksichtigt Kontrollwahrscheinlichkeit und Strafe (F-TRV-04/06).

| Kennzahl | Wert |
|---|---|
| profitable Routen (EV > 0) | 58 von 448 (13 %), davon Kokain 21, Haschisch 9, Speed 7, Pilze 6, Gras 6, Heroin 5, Ecstasy 4 |
| beste Route | `rotterdam → amsterdam / kokain`: 37 Einheiten, Gewinn 1.004 €, 4 Ticks, Kontrolle 0,8 %, **≈ 1.460 €/h** |
| zweitbeste | `rotterdam → amsterdam / heroin`: ≈ 650 €/h |
| beste Route mit Heat ≤ 1 | `amsterdam → rotterdam / haschisch`: ≈ 270 €/h |
| Median der profitablen Routen | ≈ 53 €/h |
| Route-Dominanz-Index (beste ÷ Median) | **27,6** (Ziel ≤ 2) |

## 2. Läufe

### 2.1 `base` – Basis: Regeln von Agent 2 unverändert, 30 Spieler + A–E

- **Hypothese:** Referenzlauf. Keine Erweiterungen, keine NPCs.
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 365 Tage, 12 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 aus, Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 | Tag 180 | Tag 365 |
|---|---:|---:|---:|---:|---:|---:|
| A Vorsichtig | 2.088 (2.012–2.274) | 3.310 (2.609–3.626) | 5.331 (4.180–7.060) | 13.620 (10.881–16.669) | 25.262 (20.303–47.553) | 95.169 (84.505–122.927) |
| B Durchschnitt | 2.714 (2.355–3.855) | 15.828 (5.718–27.768) | 102.003 (9.211–165.433) | 243.393 (15.110–485.745) | 511.932 (139.107–781.011) | 1.104.477 (726.963–1.428.440) |
| C Aggressiv | 3.258 (-295–4.701) | 7.229 (-299–30.280) | 1.137 (-699–220.367) | 24.748 (-699–517.724) | 219.392 (-699–1.084.139) | 718.793 (-699–2.312.590) |
| D Ineffizient | 1.825 (1.634–2.909) | 3.798 (169–7.585) | 3.398 (-359–11.556) | 3.346 (-359–8.010) | 3.346 (-359–7.858) | 3.346 (-359–7.858) |
| E Optimiert | 5.227 (-59–7.698) | 33.563 (-602–68.190) | 151.420 (-602–237.710) | 514.214 (-602–847.808) | 968.653 (-602–1.630.361) | 2.453.093 (-602–3.142.745) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | 100 % · Tag 188.7 | 92 % · Tag 292.5 | – | 100 % · Tag 233.5 | – | – |
| B | 92 % · Tag 7.2 | 92 % · Tag 18.1 | 92 % · Tag 43.5 | 92 % · Tag 19 | 92 % · Tag 172 | – |
| C | 67 % · Tag 3.2 | 67 % · Tag 9.8 | 50 % · Tag 32.1 | 50 % · Tag 14.5 | 50 % · Tag 107.5 | – |
| D | 50 % · Tag 10 | 17 % · Tag 51.3 | – | – | – | – |
| E | 83 % · Tag 2.1 | 67 % · Tag 5.2 | 67 % · Tag 21.7 | 67 % · Tag 7.5 | 67 % · Tag 82.5 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 1.84 | 1.5 % | 35 % | 775.056 | 634.049 | 35.111 | 5.815 | 0 | 0 | 0 % |
| B | 2.04 | 3.1 % | 31 % | 9.475.314 | 8.037.584 | 192.848 | 194.678 | 27.4 | 1.42 | 8 % |
| C | 1.34 | 2.8 % | 41 % | 7.120.318 | 5.723.500 | 131.393 | 305.073 | 152.1 | 1.42 | 50 % |
| D | 0.11 | 7.4 % | 21 % | 118.659 | 107.645 | 2.647 | 3.065 | 333.3 | 0 | 50 % |
| E | 1.98 | 2.5 % | 51 % | 10.166.619 | 7.951.273 | 198.547 | 172.696 | 89.3 | 0.75 | 33 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.011, Spanne 0.983–1.046. Anteil knapper Markt-Ticks: 7.1 %. Marktereignisse je Lauf: 4406.
- Handelsvolumen: 775.478 € pro Tag. Geldmenge am Ende (Median): 18.722.306 €, Wachstum in den letzten 30 Tagen: 10.2 %. Senken/Quellen (SFR): 0.881.
- Ungleichheit am Ende (alle Spieler): Gini 0.68, reichster Spieler ÷ Median 26.7.
- Umsatzstärkste Märkte: `muenchen/kokain` 172.780 €/Tag (P/P* 0.791, knapp 34 %); `hamburg/kokain` 64.934 €/Tag (P/P* 1.088, knapp 0 %); `frankfurt/kokain` 64.202 €/Tag (P/P* 0.951, knapp 4 %); `amsterdam/gras` 59.812 €/Tag (P/P* 1.186, knapp 0 %); `rotterdam/kokain` 53.920 €/Tag (P/P* 1.224, knapp 0 %).

**Auswertung:** Die drei Wachstumsphasen sind gut erkennbar. Die Märkte bleiben stabil (P/P* 0,98–1,05). Zwei Probleme fallen auf: Die Geldmenge wächst auch nach einem Jahr noch (+10 %/30 Tage), und C/E enden in 50 %/33 % der Läufe unter dem Startkapital, weil Kontrollen Totalverluste erzeugen. → Befunde B-1, B-3.

### 2.2 `base-short` – Basis über 90 Tage mit mehr Seeds (Streuung)

- **Hypothese:** Wie base, für robustere Aussagen zu den ersten 90 Tagen.
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 24 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 aus, Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.284 (1.939–2.400) | 2.971 (2.144–3.541) | 5.403 (3.849–7.101) | 12.985 (10.072–17.283) |
| B Durchschnitt | 3.570 (1.835–4.219) | 10.758 (-350–26.620) | 17.033 (-390–151.853) | 47.362 (-390–435.635) |
| C Aggressiv | 2.291 (-656–4.665) | -348 (-682–39.977) | -465 (-1.818–148.811) | -465 (-1.818–485.679) |
| D Ineffizient | 1.984 (1.603–2.950) | 3.169 (-172–7.715) | 4.504 (-273–9.227) | 6.355 (-273–8.008) |
| E Optimiert | 5.041 (2.800–9.415) | 18.039 (-778–65.778) | 64.830 (-2.215–271.611) | 473.247 (-2.215–754.696) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 58 % · Tag 4.9 | 54 % · Tag 14.1 | 42 % · Tag 37.2 | 54 % · Tag 15 | 8 % · Tag 74.5 | – |
| C | 46 % · Tag 2.6 | 46 % · Tag 6.1 | 33 % · Tag 25.4 | 38 % · Tag 11 | 13 % · Tag 80 | – |
| D | 58 % · Tag 11.6 | – | – | – | – | – |
| E | 88 % · Tag 1.8 | 75 % · Tag 4.7 | 71 % · Tag 22.6 | 75 % · Tag 11 | 46 % · Tag 69 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 2.07 | 1.7 % | 42 % | 78.010 | 57.681 | 8.762 | 508 | 0 | 0 | 0 % |
| B | 1.33 | 3.7 % | 53 % | 1.133.696 | 936.596 | 19.696 | 18.119 | 36.1 | 0.58 | 50 % |
| C | 1.03 | 4.5 % | 72 % | 1.074.570 | 851.455 | 17.121 | 55.421 | 48.8 | 1 | 67 % |
| D | 0.38 | 5.3 % | 22 % | 64.227 | 58.454 | 2.295 | 795 | 68.2 | 0 | 42 % |
| E | 2.44 | 3.5 % | 48 % | 2.530.604 | 2.013.050 | 41.386 | 39.980 | 17.9 | 2.17 | 29 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.011, Spanne 0.981–1.046. Anteil knapper Markt-Ticks: 7.2 %. Marktereignisse je Lauf: 1080.
- Handelsvolumen: 613.494 € pro Tag. Geldmenge am Ende (Median): 3.073.345 €, Wachstum in den letzten 30 Tagen: 91.7 %. Senken/Quellen (SFR): 0.903.
- Ungleichheit am Ende (alle Spieler): Gini 0.741, reichster Spieler ÷ Median 54.
- Umsatzstärkste Märkte: `muenchen/kokain` 151.699 €/Tag (P/P* 0.806, knapp 38 %); `hamburg/kokain` 81.794 €/Tag (P/P* 1.103, knapp 0 %); `frankfurt/kokain` 53.957 €/Tag (P/P* 0.944, knapp 3 %); `rotterdam/kokain` 46.512 €/Tag (P/P* 1.19, knapp 0 %); `amsterdam/gras` 36.888 €/Tag (P/P* 1.115, knapp 0 %).

**Auswertung:** Die Streuung der Händlerprofile ist extrem: P10 liegt bei B, C und E beim Totalverlust, der Median von E bei ≈ 470.000 €. Erfolg hängt stärker vom Zufall (Kontrolle ja/nein) ab als von Entscheidungen. → B-1.

### 2.3 `h-confiscation` – Hypothese: Kontrolle beschlagnahmt 50 % statt 100 % der Ladung (Strafe anteilig)

- **Hypothese:** Teilbeschlagnahme halbiert den Einzelverlust und senkt die Streuung (P10) der Profile B/C deutlich, ohne das Median-Wachstum zu verdoppeln.
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 12 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 aus, Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 50 % der Ladung.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.285 (2.155–2.388) | 2.956 (2.452–3.761) | 6.649 (5.444–7.942) | 13.434 (12.406–17.640) |
| B Durchschnitt | 2.774 (1.527–4.363) | 12.347 (8.864–16.227) | 69.763 (41.190–116.735) | 224.418 (184.353–279.051) |
| C Aggressiv | 3.235 (1.628–7.214) | 16.191 (8.788–25.620) | 100.040 (41.998–135.653) | 290.579 (205.047–410.750) |
| D Ineffizient | 1.845 (992–2.379) | 3.755 (1.380–8.190) | 2.944 (34–14.231) | 4.028 (15–13.893) |
| E Optimiert | 4.219 (3.458–8.672) | 42.942 (34.301–62.081) | 177.447 (153.283–253.013) | 623.587 (452.551–727.461) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 100 % · Tag 8.2 | 100 % · Tag 20.8 | 83 % · Tag 63.2 | 100 % · Tag 21 | – | – |
| C | 100 % · Tag 3.9 | 100 % · Tag 10.9 | 100 % · Tag 33.9 | 100 % · Tag 19.5 | – | – |
| D | 50 % · Tag 12.5 | 33 % · Tag 58.1 | – | – | – | – |
| E | 100 % · Tag 1.6 | 100 % · Tag 5.5 | 100 % · Tag 21.8 | 100 % · Tag 8 | 75 % · Tag 68 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 1.99 | 1.5 % | 40 % | 77.129 | 56.495 | 8.396 | 232 | 0 | 0 | 0 % |
| B | 2.46 | 4.1 % | 28 % | 1.699.602 | 1.428.300 | 28.330 | 15.982 | 0 | 0 | 0 % |
| C | 2.78 | 4.4 % | 28 % | 2.806.837 | 2.327.344 | 51.110 | 131.554 | 0 | 0 | 0 % |
| D | 0.95 | 6.6 % | 18 % | 241.441 | 219.037 | 5.335 | 5.280 | 39.6 | 0 | 50 % |
| E | 3.13 | 2.6 % | 34 % | 3.166.555 | 2.479.349 | 63.357 | 17.141 | 0 | 0 | 0 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.01, Spanne 0.976–1.043. Anteil knapper Markt-Ticks: 6.9 %. Marktereignisse je Lauf: 1075.
- Handelsvolumen: 887.241 € pro Tag. Geldmenge am Ende (Median): 4.331.023 €, Wachstum in den letzten 30 Tagen: 57 %. Senken/Quellen (SFR): 0.905.
- Ungleichheit am Ende (alle Spieler): Gini 0.563, reichster Spieler ÷ Median 4.
- Umsatzstärkste Märkte: `muenchen/kokain` 203.372 €/Tag (P/P* 0.76, knapp 24 %); `hamburg/kokain` 107.072 €/Tag (P/P* 1.134, knapp 0 %); `frankfurt/kokain` 81.746 €/Tag (P/P* 0.918, knapp 3 %); `rotterdam/kokain` 54.313 €/Tag (P/P* 1.223, knapp 0 %); `amsterdam/gras` 53.319 €/Tag (P/P* 1.163, knapp 0 %).

**Auswertung: Hypothese bestätigt.** Keine Sackgassen mehr für A, B, C und E (0 % unter Startkapital, 0 Sackgassen-Tage). P10 von E steigt von −2.215 € auf 452.551 €, der Gini sinkt von 0,74 auf 0,56. Das Median-Wachstum von B steigt deutlich (47.000 → 224.000 €), das von E nur moderat (473.000 → 624.000 €). Nur D bleibt in 50 % der Läufe unter dem Startkapital, durch eigene Fehler. → Empfehlung `travel.confiscation_share` = 0,5.

### 2.4 `safety-net` – Variante: Sicherheitsnetz (Startkredit) an

- **Hypothese:** Der Startkredit verhindert Sackgassen (stuckDays → 0), ohne das Wachstum spürbar zu erhöhen.
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 12 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 aus, Kundenbindung/Polizeidruck aus, Sicherheitsnetz an, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.233 (1.927–2.445) | 3.334 (2.935–3.774) | 5.677 (4.890–7.951) | 11.912 (8.693–14.941) |
| B Durchschnitt | 2.953 (-177–3.426) | 9.311 (-202–22.829) | 11.928 (-69–132.603) | 115.078 (30.211–305.167) |
| C Aggressiv | 3.537 (-484–5.398) | 20.288 (291–30.409) | 19.172 (540–137.260) | 203.304 (568–347.173) |
| D Ineffizient | 1.882 (-107–2.663) | 3.295 (-468–5.254) | -164 (-1.248–7.789) | -1.401 (-2.994–7.511) |
| E Optimiert | 5.534 (31–8.199) | 27.092 (703–56.659) | 117.159 (7.243–201.205) | 421.123 (202.590–690.522) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 100 % · Tag 8.9 | 83 % · Tag 27.9 | 33 % · Tag 43.4 | 83 % · Tag 28 | – | – |
| C | 100 % · Tag 2.6 | 100 % · Tag 8.4 | 75 % · Tag 48.2 | 100 % · Tag 13 | – | – |
| D | 33 % · Tag 17.7 | – | – | – | – | – |
| E | 100 % · Tag 1.9 | 100 % · Tag 7 | 100 % · Tag 26.4 | 100 % · Tag 13 | 42 % · Tag 79 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 2.02 | 1.6 % | 39 % | 74.105 | 55.757 | 8.640 | 452 | 0 | 0 | 0 % |
| B | 2.46 | 3.5 % | 34 % | 1.176.331 | 985.481 | 22.387 | 23.866 | 10.8 | 1 | 8 % |
| C | 3.11 | 3.3 % | 35 % | 1.934.968 | 1.594.360 | 33.291 | 72.769 | 5.2 | 3.75 | 17 % |
| D | 1.05 | 5.6 % | 16 % | 57.424 | 51.786 | 5.357 | 10.944 | 40.2 | 0 | 67 % |
| E | 3.3 | 2.7 % | 37 % | 2.839.632 | 2.299.504 | 53.983 | 43.290 | 1.9 | 2.08 | 0 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.011, Spanne 0.983–1.042. Anteil knapper Markt-Ticks: 7.0 %. Marktereignisse je Lauf: 1088.
- Handelsvolumen: 742.693 € pro Tag. Geldmenge am Ende (Median): 3.054.291 €, Wachstum in den letzten 30 Tagen: 64.7 %. Senken/Quellen (SFR): 0.921.
- Ungleichheit am Ende (alle Spieler): Gini 0.661, reichster Spieler ÷ Median 42.2.
- Umsatzstärkste Märkte: `muenchen/kokain` 171.284 €/Tag (P/P* 0.782, knapp 30 %); `hamburg/kokain` 97.236 €/Tag (P/P* 1.124, knapp 0 %); `frankfurt/kokain` 66.085 €/Tag (P/P* 0.926, knapp 3 %); `rotterdam/kokain` 53.048 €/Tag (P/P* 1.217, knapp 0 %); `amsterdam/gras` 43.764 €/Tag (P/P* 1.136, knapp 0 %).

**Auswertung: Teilweise bestätigt.** Der Startkredit senkt die Sackgassen deutlich (B 8 %, C 17 %, E 0 %), beseitigt sie aber nicht und schafft eine zusätzliche Geldquelle. Er ist schwächer als die Teilbeschlagnahme.

### 2.5 `npc` – Variante: NPC-Händler F-NPC-01 (Agent 2) an, k = 1

- **Hypothese:** NPC-Händler halbieren die Spreizung der Top-Route (EX-NPC-01: Preisverhältnis 3,05 → 1,98) und bremsen damit das Wachstum aller Händlerprofile; die Startroute bleibt profitabel (INV-14).
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 12 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 an (k = 1), Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.054 (1.864–2.296) | 2.650 (1.382–3.072) | 3.178 (1.461–4.161) | 5.462 (3.086–8.742) |
| B Durchschnitt | 2.723 (1.777–3.913) | 8.486 (-126–15.048) | 40.688 (-126–61.088) | 63.011 (-169–222.428) |
| C Aggressiv | 2.587 (-260–3.798) | -380 (-735–15.363) | -526 (-823–57.619) | -634 (-934–28.992) |
| D Ineffizient | 2.047 (1.806–2.588) | 3.015 (1.126–4.769) | -52 (-373–9.007) | -52 (-373–7.910) |
| E Optimiert | 3.245 (-394–5.015) | 12.116 (-476–33.870) | 6.239 (-621–116.237) | 29.458 (-621–439.871) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 67 % · Tag 12 | 67 % · Tag 28.1 | 17 % · Tag 55.1 | 67 % · Tag 27.5 | – | – |
| C | 42 % · Tag 3.6 | 25 % · Tag 12.8 | 17 % · Tag 48.6 | 17 % · Tag 20.5 | – | – |
| D | 33 % · Tag 17.8 | – | – | – | – | – |
| E | 67 % · Tag 2.8 | 58 % · Tag 7.3 | 50 % · Tag 28 | 50 % · Tag 13 | 8 % · Tag 76 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 2.02 | 1.6 % | 26 % | 62.958 | 51.556 | 7.832 | 368 | 0 | 0 | 8 % |
| B | 1.75 | 3.7 % | 35 % | 958.210 | 828.369 | 14.744 | 16.466 | 27.5 | 0.92 | 42 % |
| C | 0.81 | 4.7 % | 39 % | 450.290 | 406.204 | 5.815 | 17.937 | 57.7 | 1.25 | 83 % |
| D | 0.37 | 6.8 % | 16 % | 49.697 | 45.879 | 2.343 | 807 | 69.1 | 0 | 67 % |
| E | 1.87 | 4.0 % | 42 % | 1.328.280 | 1.124.412 | 25.183 | 21.288 | 32 | 1.67 | 50 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.008, Spanne 0.973–1.039. Anteil knapper Markt-Ticks: 6.1 %. Marktereignisse je Lauf: 1077.
- Handelsvolumen: 407.002 € pro Tag. Geldmenge am Ende (Median): 1.290.476 €, Wachstum in den letzten 30 Tagen: 63.7 %. Senken/Quellen (SFR): 0.941.
- Ungleichheit am Ende (alle Spieler): Gini 0.79, reichster Spieler ÷ Median 75.7.
- Umsatzstärkste Märkte: `muenchen/kokain` 87.926 €/Tag (P/P* 0.742, knapp 3 %); `hamburg/kokain` 59.740 €/Tag (P/P* 1.133, knapp 0 %); `frankfurt/kokain` 33.280 €/Tag (P/P* 0.895, knapp 1 %); `rotterdam/kokain` 26.185 €/Tag (P/P* 1.252, knapp 0 %); `amsterdam/gras` 24.173 €/Tag (P/P* 1.173, knapp 0 %).

**Auswertung: Hypothese teilweise widerlegt.** F-NPC-01 bremst das Wachstum stark (E Tag 90: 29.000 € statt 473.000 €, Handelsvolumen −34 %). Dünnere Margen machen jede Kontrolle relativ teurer, deshalb **steigen** die Totalverluste (C 83 %, E 50 %). Die Startroute bleibt profitabel (A wächst, aber langsamer). Da ein kleiner Server mit k = 1 startet, wäre das die Einstiegserfahrung aller Spieler. → F-NPC-01 erst zusammen mit B-1 einführen (siehe `npc-conf`).

### 2.6 `npc-half` – Variante: NPC-Händler F-NPC-01 an, k = 0,5

- **Hypothese:** Die Wirkung von k ist monoton: k = 0,5 liegt zwischen Basis und k = 1.
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 12 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 an (k = 0.5), Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.170 (1.937–2.265) | 2.550 (1.243–3.357) | 4.221 (715–6.105) | 8.080 (5.574–14.992) |
| B Durchschnitt | 2.729 (2.261–5.727) | 9.378 (-241–17.002) | 55.905 (-334–138.716) | 77.472 (-334–282.241) |
| C Aggressiv | 2.779 (1.904–3.452) | 5.606 (-335–15.140) | 13.857 (-357–87.431) | 7.504 (-2.130–288.410) |
| D Ineffizient | 2.035 (1.551–2.347) | 2.280 (-275–4.350) | -154 (-614–7.920) | -154 (-614–7.920) |
| E Optimiert | 4.070 (-506–5.952) | 22.522 (-506–43.954) | 58.670 (-537–122.050) | 320.097 (-537–524.474) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 67 % · Tag 9.5 | 58 % · Tag 15.4 | 25 % · Tag 64.5 | 58 % · Tag 15 | – | – |
| C | 75 % · Tag 3.8 | 67 % · Tag 15 | 58 % · Tag 43.8 | 67 % · Tag 29.5 | – | – |
| D | 33 % · Tag 18.5 | 8 % · Tag 79.3 | – | – | – | – |
| E | 75 % · Tag 2.2 | 75 % · Tag 6.7 | 67 % · Tag 30 | 67 % · Tag 11 | 17 % · Tag 76.5 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 2.05 | 1.2 % | 33 % | 68.464 | 53.070 | 7.673 | 405 | 5.4 | 0 | 8 % |
| B | 1.52 | 3.9 % | 37 % | 1.038.164 | 895.940 | 14.603 | 22.000 | 31.6 | 0.58 | 42 % |
| C | 1.9 | 4.1 % | 37 % | 1.383.470 | 1.175.344 | 23.884 | 62.864 | 28.8 | 3.08 | 50 % |
| D | 0.4 | 6.9 % | 19 % | 73.677 | 68.179 | 2.541 | 1.188 | 67.7 | 0 | 67 % |
| E | 2.42 | 3.1 % | 39 % | 2.061.514 | 1.677.930 | 36.996 | 29.740 | 20.4 | 2.17 | 33 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.009, Spanne 0.983–1.04. Anteil knapper Markt-Ticks: 6.2 %. Marktereignisse je Lauf: 1103.
- Handelsvolumen: 504.856 € pro Tag. Geldmenge am Ende (Median): 2.028.553 €, Wachstum in den letzten 30 Tagen: 50.9 %. Senken/Quellen (SFR): 0.925.
- Ungleichheit am Ende (alle Spieler): Gini 0.774, reichster Spieler ÷ Median 73.8.
- Umsatzstärkste Märkte: `muenchen/kokain` 114.997 €/Tag (P/P* 0.761, knapp 6 %); `hamburg/kokain` 71.159 €/Tag (P/P* 1.126, knapp 0 %); `frankfurt/kokain` 41.041 €/Tag (P/P* 0.911, knapp 2 %); `rotterdam/kokain` 33.715 €/Tag (P/P* 1.228, knapp 0 %); `amsterdam/gras` 32.285 €/Tag (P/P* 1.155, knapp 0 %).

**Auswertung:** Die Wirkung ist monoton in k. E am Tag 90: 473.000 € (k = 0) → 320.000 € (k = 0,5) → 29.000 € (k = 1).

### 2.7 `npc-conf` – Variante zu h-confiscation: zusätzlich NPC-Händler F-NPC-01, k = 1

- **Hypothese:** Mit Teilbeschlagnahme verlieren NPC-Händler ihren verheerenden Nebeneffekt (mehr Totalverluste durch dünnere Margen); sie bremsen dann nur noch das Wachstum.
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 12 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 an (k = 1), Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 50 % der Ladung, Organisationskosten F-PRG-01 aus.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`dd7fbf2aee4d…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.121 (1.920–2.208) | 2.499 (1.953–2.971) | 4.286 (2.585–5.529) | 6.030 (4.994–9.564) |
| B Durchschnitt | 2.987 (2.096–4.174) | 10.781 (4.989–12.400) | 52.186 (32.504–73.781) | 147.767 (113.909–183.394) |
| C Aggressiv | 2.475 (2.247–4.643) | 13.851 (7.786–18.804) | 44.456 (31.169–104.742) | 230.928 (151.876–299.788) |
| D Ineffizient | 2.040 (1.671–2.675) | 2.746 (785–4.957) | 2.383 (9–9.292) | 4.025 (9–8.026) |
| E Optimiert | 4.035 (2.470–7.947) | 22.993 (13.254–29.261) | 109.093 (87.941–163.351) | 335.409 (306.915–405.702) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 100 % · Tag 11 | 100 % · Tag 29.5 | 17 % · Tag 78.5 | 100 % · Tag 29 | – | – |
| C | 100 % · Tag 4.5 | 100 % · Tag 11.9 | 100 % · Tag 49.6 | 100 % · Tag 25.5 | – | – |
| D | 50 % · Tag 21.6 | – | – | – | – | – |
| E | 100 % · Tag 2.6 | 100 % · Tag 8.5 | 100 % · Tag 27.6 | 100 % · Tag 14 | – | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen, Bestechung, Tilgung, Organisation € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 1.96 | 1.6 % | 25 % | 65.926 | 53.668 | 7.637 | 200 | 0 | 0 | 0 % |
| B | 2.54 | 3.4 % | 23 % | 1.268.596 | 1.091.504 | 20.079 | 9.404 | 0 | 0 | 0 % |
| C | 2.8 | 3.5 % | 22 % | 2.129.286 | 1.803.074 | 44.575 | 44.936 | 0 | 0.08 | 0 % |
| D | 0.87 | 4.9 % | 11 % | 102.573 | 94.056 | 4.980 | 1.476 | 44 | 0 | 50 % |
| E | 3.12 | 3.0 % | 27 % | 2.364.479 | 1.939.773 | 57.583 | 12.172 | 0 | 0 | 0 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.007, Spanne 0.979–1.037. Anteil knapper Markt-Ticks: 6.1 %. Marktereignisse je Lauf: 1072.
- Handelsvolumen: 685.418 € pro Tag. Geldmenge am Ende (Median): 2.423.958 €, Wachstum in den letzten 30 Tagen: 76.3 %. Senken/Quellen (SFR): 0.93.
- Ungleichheit am Ende (alle Spieler): Gini 0.57, reichster Spieler ÷ Median 3.9.
- Umsatzstärkste Märkte: `muenchen/kokain` 147.008 €/Tag (P/P* 0.716, knapp 3 %); `hamburg/kokain` 95.053 €/Tag (P/P* 1.153, knapp 0 %); `frankfurt/kokain` 55.914 €/Tag (P/P* 0.882, knapp 1 %); `amsterdam/gras` 42.739 €/Tag (P/P* 1.207, knapp 0 %); `rotterdam/kokain` 35.686 €/Tag (P/P* 1.265, knapp 0 %).

**Auswertung: Hypothese bestätigt.** Zusammen mit Teilbeschlagnahme bremsen die NPC-Händler nur noch: E am Tag 90 335.000 € statt 624.000 € (`h-confiscation`). Für A, B, C und E gibt es 0 % Verluste unter Startkapital und 0 Sackgassen-Tage. Gini 0,57, reichster Spieler ÷ Median 3,9. Kleinwagen bei B an Tag 11, bei E an Tag 2,6, also im Ziel. **Empfohlene Startkonfiguration** für einen kleinen Server.

### 2.8 `npc-ext` – Variante: Kundenbindung/Abwanderung + Polizeidruck (Vorschlag Agent 5), ohne NPC-Händler

- **Hypothese:** Kundenbindung bestraft dauerhaftes Leerkaufen (weniger knappe Märkte); Polizeidruck verteilt den Handel auf mehr Städte (geringere Konzentration auf die Top-Märkte).
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 12 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 aus, Kundenbindung/Polizeidruck an, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.248 (1.953–2.357) | 2.858 (1.534–3.418) | 5.419 (304–7.156) | 11.780 (1.067–18.551) |
| B Durchschnitt | 3.199 (-191–4.454) | 1.989 (-347–23.752) | 21.940 (-347–146.863) | 77.204 (-347–303.669) |
| C Aggressiv | 3.559 (1.636–5.928) | 20.059 (3.260–35.268) | 19.769 (-213–118.682) | 278.103 (-610–409.868) |
| D Ineffizient | 1.900 (1.350–2.611) | 5.808 (1.480–8.389) | 8.000 (7.695–14.565) | 7.790 (4.718–8.001) |
| E Optimiert | 3.823 (59–5.910) | 29.083 (509–53.067) | 150.826 (230–258.361) | 594.352 (1.529–901.496) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 50 % · Tag 5.3 | 50 % · Tag 20.5 | 42 % · Tag 51.3 | 50 % · Tag 19.5 | – | – |
| C | 92 % · Tag 2.4 | 83 % · Tag 7.5 | 75 % · Tag 38.3 | 83 % · Tag 18 | 8 % · Tag 82 | – |
| D | 92 % · Tag 13.1 | 17 % · Tag 47.7 | – | – | – | – |
| E | 92 % · Tag 1.9 | 83 % · Tag 6.1 | 83 % · Tag 24.1 | 83 % · Tag 11.5 | 58 % · Tag 53 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 1.84 | 2.2 % | 41 % | 69.036 | 51.491 | 7.651 | 630 | 11.5 | 0 | 17 % |
| B | 1.29 | 3.5 % | 60 % | 1.066.736 | 892.308 | 17.511 | 14.185 | 39.7 | 0.5 | 50 % |
| C | 2.35 | 3.9 % | 35 % | 2.177.600 | 1.783.186 | 35.463 | 90.277 | 15.4 | 3 | 25 % |
| D | 0.59 | 5.2 % | 21 % | 147.305 | 133.667 | 3.374 | 1.628 | 56.6 | 0 | 8 % |
| E | 2.82 | 3.0 % | 45 % | 3.066.651 | 2.431.117 | 49.682 | 36.527 | 11.1 | 1.33 | 17 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.037, Spanne 0.997–1.07. Anteil knapper Markt-Ticks: 7.8 %. Marktereignisse je Lauf: 1075.
- Handelsvolumen: 608.278 € pro Tag. Geldmenge am Ende (Median): 2.886.307 €, Wachstum in den letzten 30 Tagen: 64.2 %. Senken/Quellen (SFR): 0.909.
- Ungleichheit am Ende (alle Spieler): Gini 0.748, reichster Spieler ÷ Median 55.
- Umsatzstärkste Märkte: `muenchen/kokain` 125.969 €/Tag (P/P* 0.8, knapp 36 %); `hamburg/kokain` 74.843 €/Tag (P/P* 1.137, knapp 0 %); `frankfurt/kokain` 54.779 €/Tag (P/P* 0.951, knapp 4 %); `rotterdam/kokain` 46.085 €/Tag (P/P* 1.228, knapp 0 %); `amsterdam/gras` 39.993 €/Tag (P/P* 1.165, knapp 0 %).

**Auswertung: Hypothese nicht bestätigt.** Kundenbindung und Polizeidruck erhöhen das Preisniveau leicht (P/P* 1,04) und die Knappheit minimal (7,8 % statt 7,2 %). Einen messbaren Verteilungseffekt gibt es nicht. Die Unterschiede in den Profilen liegen im Rauschen der 12 Läufe. **Nicht zur Übernahme empfohlen**, bis eine stärkere Parametrierung getestet ist.

### 2.9 `ext` – Variante: wirtschaftliche Eigendynamik F-ECO-10…14 an

- **Hypothese:** Zyklen, Krisen, Angebotsreaktion und Wochenrhythmus erhöhen die Preisbewegung moderat (P/P* bleibt in 0,85–1,15), ohne Vermögen der Profile stark zu verschieben.
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 12 Seeds. Erweiterungen: Wirtschaft an, NPC-Händler F-NPC-01 aus, Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.270 (1.956–2.451) | 3.391 (2.574–3.971) | 6.592 (5.130–8.407) | 20.258 (17.017–21.973) |
| B Durchschnitt | 3.346 (897–5.384) | 13.013 (-196–25.968) | 60.365 (-333–139.397) | 376.877 (-333–478.903) |
| C Aggressiv | 4.125 (-34–5.633) | 12.303 (-595–46.217) | 54.007 (-595–206.356) | 38.849 (-1.880–770.538) |
| D Ineffizient | 1.852 (1.417–2.752) | 2.170 (-570–7.463) | -57 (-570–7.998) | -57 (-570–7.841) |
| E Optimiert | 4.841 (74–7.861) | 24.912 (-585–53.387) | 169.382 (-585–346.589) | 868.857 (-585–1.159.618) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 75 % · Tag 5.7 | 67 % · Tag 21 | 67 % · Tag 43.1 | 67 % · Tag 20.5 | – | – |
| C | 83 % · Tag 2.2 | 75 % · Tag 8.3 | 75 % · Tag 28.9 | 75 % · Tag 17 | 33 % · Tag 68.5 | – |
| D | 42 % · Tag 11.9 | 8 % · Tag 24.5 | – | – | – | – |
| E | 75 % · Tag 1.8 | 75 % · Tag 6.4 | 75 % · Tag 21.5 | 75 % · Tag 12 | 75 % · Tag 57 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 2.03 | 1.8 % | 53 % | 85.425 | 58.841 | 8.730 | 635 | 0 | 0 | 0 % |
| B | 1.68 | 4.6 % | 53 % | 1.625.635 | 1.300.214 | 24.371 | 36.275 | 25.6 | 1.08 | 33 % |
| C | 2.18 | 3.7 % | 50 % | 2.525.630 | 1.998.240 | 32.104 | 128.914 | 20.5 | 3.67 | 42 % |
| D | 0.29 | 7.7 % | 19 % | 71.480 | 62.108 | 1.804 | 1.833 | 72.4 | 0 | 58 % |
| E | 2.51 | 3.5 % | 56 % | 3.435.641 | 2.601.192 | 47.920 | 49.415 | 16.6 | 1 | 25 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.003, Spanne 0.907–1.076. Anteil knapper Markt-Ticks: 7.4 %. Marktereignisse je Lauf: 1081.
- Handelsvolumen: 811.463 € pro Tag. Geldmenge am Ende (Median): 5.963.705 €, Wachstum in den letzten 30 Tagen: 97.2 %. Senken/Quellen (SFR): 0.863.
- Ungleichheit am Ende (alle Spieler): Gini 0.74, reichster Spieler ÷ Median 54.8.
- Umsatzstärkste Märkte: `muenchen/kokain` 205.096 €/Tag (P/P* 0.828, knapp 45 %); `hamburg/kokain` 98.503 €/Tag (P/P* 1.034, knapp 0 %); `frankfurt/kokain` 85.519 €/Tag (P/P* 0.967, knapp 4 %); `rotterdam/kokain` 81.002 €/Tag (P/P* 1.11, knapp 0 %); `amsterdam/gras` 48.870 €/Tag (P/P* 1.053, knapp 0 %).

**Auswertung: Hypothese bestätigt.** Die Eigendynamik macht die Märkte lebendiger (P/P*-Spanne 0,91–1,08 statt 0,98–1,05), bleibt aber im Korridor 0,85–1,15. Profil A profitiert (20.000 € statt 13.000 €). Ungleichheit und Sackgassen ändern sich kaum. → zur Übernahme empfohlen, sobald B-1 umgesetzt ist (Werte in `sim/proposals.toml`).

### 2.10 `h-elasticity` – Hypothese: economy.elasticity 0,5 → 0,4

- **Hypothese:** Geringere Elastizität verkleinert die Preisspreizung (P* ∝ (m_d/m_s)^ε) und bremst das frühe Wachstum, ohne vorsichtige Spieler (A) weiter zu benachteiligen.
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 12 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 aus, Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Geänderter Parameter:** `economy.elasticity` = 0.4
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.055 (1.889–2.262) | 2.508 (1.388–3.213) | 4.599 (2.672–5.749) | 9.871 (6.452–11.512) |
| B Durchschnitt | 2.757 (2.269–3.797) | 10.216 (-269–17.052) | 28.955 (-1.852–118.903) | 114.737 (-1.852–312.002) |
| C Aggressiv | 3.167 (2.137–4.210) | 5.663 (-740–23.523) | 15.431 (-959–114.456) | -686 (-1.754–420.511) |
| D Ineffizient | 1.778 (-287–2.902) | 3.206 (-287–6.228) | 7.234 (-287–8.758) | 6.931 (-313–8.006) |
| E Optimiert | 5.940 (3.474–8.246) | 17.410 (6.272–45.083) | 74.706 (21.585–160.818) | 366.325 (139.629–568.058) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 75 % · Tag 7.2 | 58 % · Tag 16 | 50 % · Tag 64.7 | 58 % · Tag 17 | – | – |
| C | 67 % · Tag 2.7 | 58 % · Tag 12.7 | 50 % · Tag 30 | 50 % · Tag 17.5 | 8 % · Tag 89 | – |
| D | 58 % · Tag 8.7 | 8 % · Tag 69.7 | – | – | – | – |
| E | 92 % · Tag 1.7 | 92 % · Tag 8.3 | 92 % · Tag 32.8 | 92 % · Tag 14 | 25 % · Tag 80 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 1.87 | 1.5 % | 30 % | 65.976 | 51.125 | 7.851 | 370 | 3.7 | 0 | 8 % |
| B | 1.56 | 3.0 % | 45 % | 1.137.803 | 967.302 | 18.898 | 16.799 | 30.5 | 0.67 | 42 % |
| C | 1.62 | 3.7 % | 42 % | 1.333.451 | 1.130.549 | 19.227 | 56.017 | 36.5 | 2.67 | 58 % |
| D | 0.44 | 4.0 % | 30 % | 69.380 | 62.251 | 2.533 | 826 | 63.8 | 0 | 42 % |
| E | 3.1 | 3.6 % | 36 % | 3.075.767 | 2.559.179 | 50.032 | 53.490 | 5.5 | 3.17 | 8 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.01, Spanne 0.984–1.038. Anteil knapper Markt-Ticks: 7.3 %. Marktereignisse je Lauf: 1088.
- Handelsvolumen: 557.532 € pro Tag. Geldmenge am Ende (Median): 2.152.085 €, Wachstum in den letzten 30 Tagen: 75.4 %. Senken/Quellen (SFR): 0.924.
- Ungleichheit am Ende (alle Spieler): Gini 0.779, reichster Spieler ÷ Median 69.5.
- Umsatzstärkste Märkte: `muenchen/kokain` 129.652 €/Tag (P/P* 0.854, knapp 44 %); `hamburg/kokain` 70.667 €/Tag (P/P* 1.071, knapp 0 %); `rotterdam/kokain` 48.278 €/Tag (P/P* 1.148, knapp 0 %); `frankfurt/kokain` 48.150 €/Tag (P/P* 0.955, knapp 4 %); `amsterdam/gras` 33.286 €/Tag (P/P* 1.079, knapp 0 %).

**Auswertung:** Bei geringerer Elastizität sinken Spreizung und Wachstum (E 366.000 € statt 473.000 €), der Anteil der E-Totalverluste sinkt auf 8 %. Die Wirkung ist aber kleiner und weniger gezielt als bei B-1. Nicht empfohlen.

### 2.11 `h-control` – Hypothese: travel.control_base 0,02 → 0,015

- **Hypothese:** Weniger Kontrollen helfen vor allem risikoarmen Spielern (A) und reduzieren Totalverluste (C).
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 12 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 aus, Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Geänderter Parameter:** `travel.control_base` = 0.015
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.268 (1.926–2.476) | 3.126 (1.862–3.787) | 6.960 (3.667–8.766) | 14.332 (11.117–17.432) |
| B Durchschnitt | 3.230 (1.676–4.322) | 16.275 (299–22.990) | 97.647 (-300–157.472) | 211.258 (-300–338.693) |
| C Aggressiv | 4.252 (3.198–8.161) | 32.333 (5.575–41.623) | 60.853 (19.049–120.656) | 331.568 (45.243–486.644) |
| D Ineffizient | 1.940 (1.306–2.272) | 2.872 (70–7.818) | 7.622 (-353–15.716) | 7.375 (-353–17.850) |
| E Optimiert | 5.468 (173–8.938) | 39.122 (130–86.243) | 173.476 (4.608–256.405) | 621.949 (41.960–787.235) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 83 % · Tag 5.8 | 75 % · Tag 13.8 | 67 % · Tag 42.8 | 75 % · Tag 14 | 8 % · Tag 81 | – |
| C | 92 % · Tag 2.2 | 92 % · Tag 7.9 | 92 % · Tag 37.1 | 92 % · Tag 12 | 8 % · Tag 69 | – |
| D | 67 % · Tag 10.6 | 25 % · Tag 40.9 | – | – | – | – |
| E | 83 % · Tag 1.8 | 83 % · Tag 4.8 | 83 % · Tag 21.2 | 83 % · Tag 7 | 75 % · Tag 64 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 1.96 | 1.1 % | 42 % | 79.052 | 57.697 | 9.251 | 355 | 0 | 0 | 0 % |
| B | 1.8 | 2.8 % | 49 % | 1.577.518 | 1.325.309 | 25.207 | 25.543 | 19.2 | 0.42 | 25 % |
| C | 2.62 | 2.5 % | 32 % | 2.667.459 | 2.202.210 | 42.434 | 81.746 | 6.2 | 2.58 | 8 % |
| D | 0.63 | 4.1 % | 30 % | 183.849 | 165.569 | 3.536 | 2.786 | 55.7 | 0 | 33 % |
| E | 2.56 | 2.0 % | 43 % | 2.953.108 | 2.314.595 | 53.589 | 29.185 | 11.3 | 0.75 | 17 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.011, Spanne 0.978–1.051. Anteil knapper Markt-Ticks: 7.0 %. Marktereignisse je Lauf: 1080.
- Handelsvolumen: 764.301 € pro Tag. Geldmenge am Ende (Median): 3.676.004 €, Wachstum in den letzten 30 Tagen: 60.8 %. Senken/Quellen (SFR): 0.906.
- Ungleichheit am Ende (alle Spieler): Gini 0.687, reichster Spieler ÷ Median 45.9.
- Umsatzstärkste Märkte: `muenchen/kokain` 181.454 €/Tag (P/P* 0.775, knapp 28 %); `hamburg/kokain` 99.879 €/Tag (P/P* 1.125, knapp 0 %); `frankfurt/kokain` 70.982 €/Tag (P/P* 0.928, knapp 3 %); `rotterdam/kokain` 52.716 €/Tag (P/P* 1.216, knapp 0 %); `amsterdam/gras` 44.563 €/Tag (P/P* 1.137, knapp 0 %).

**Auswertung:** Weniger Kontrollen senken die Totalverluste (B 25 %, C 8 %, E 17 %) und erhöhen das Wachstum. Das Problem bleibt bestehen, weil die Folge einer Kontrolle weiter total ist. B-1 ist wirksamer.

### 2.12 `h-wealth-sink` – Hypothese: Organisationskosten F-PRG-01 (0,5 %/Tag über 500 000 € NW)

- **Hypothese:** Die Organisationskosten lassen frühe Phasen unberührt (< 500 000 €) und flachen das Spätspiel ab: Geldmenge und Vorsprung des reichsten Spielers wachsen langsamer als in base.
- **Setup:** 30 Hintergrundspieler + je 1 beobachteter Bot A–E, 365 Tage, 8 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 aus, Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung, Organisationskosten F-PRG-01 an.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`dd7fbf2aee4d…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 | Tag 180 | Tag 365 |
|---|---:|---:|---:|---:|---:|---:|
| A Vorsichtig | 2.230 (2.170–2.562) | 2.808 (1.020–3.850) | 5.012 (3.777–7.402) | 13.074 (10.785–16.451) | 39.175 (22.502–47.057) | 121.173 (89.597–172.019) |
| B Durchschnitt | 3.901 (-113–5.817) | 7.898 (-195–24.745) | 60.459 (-195–159.615) | 266.331 (-195–431.292) | 592.857 (-195–783.284) | 965.053 (-195–1.124.408) |
| C Aggressiv | 3.862 (1.309–4.701) | 11.811 (-497–41.676) | -303 (-497–22.067) | -324 (-562–182.531) | -324 (-562–635.477) | -324 (-562–1.186.260) |
| D Ineffizient | 2.354 (1.174–3.170) | 5.089 (494–9.781) | 3.947 (-294–18.037) | 3.427 (-294–7.917) | 3.427 (-294–7.917) | 3.427 (-294–7.917) |
| E Optimiert | 6.099 (4.680–9.011) | 27.429 (-1.730–71.094) | 70.742 (-1.730–236.535) | 523.096 (-1.730–734.298) | 1.116.672 (-1.730–1.422.936) | 1.587.614 (-1.730–1.731.747) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | 100 % · Tag 164.5 | 100 % · Tag 265.5 | – | 100 % · Tag 203 | – | – |
| B | 63 % · Tag 4.3 | 63 % · Tag 11.9 | 63 % · Tag 41.4 | 63 % · Tag 12 | 63 % · Tag 121 | – |
| C | 50 % · Tag 2.2 | 38 % · Tag 6.2 | 25 % · Tag 39.4 | 38 % · Tag 17 | 25 % · Tag 125.5 | – |
| D | 50 % · Tag 7 | 25 % · Tag 29.1 | – | – | – | – |
| E | 88 % · Tag 2.1 | 75 % · Tag 5.5 | 63 % · Tag 21.9 | 75 % · Tag 7.5 | 63 % · Tag 70 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen, Bestechung, Tilgung, Organisation € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 1.84 | 1.5 % | 36 % | 886.324 | 718.161 | 35.864 | 5.691 | 0 | 0 | 0 % |
| B | 1.37 | 3.3 % | 46 % | 6.872.431 | 5.668.820 | 140.972 | 409.028 | 123.5 | 0.38 | 38 % |
| C | 0.75 | 3.6 % | 44 % | 3.964.057 | 3.198.803 | 66.961 | 364.783 | 224.5 | 2 | 75 % |
| D | 0.09 | 6.4 % | 25 % | 117.644 | 104.750 | 2.275 | 2.017 | 337.5 | 0 | 50 % |
| E | 1.86 | 2.5 % | 39 % | 9.617.904 | 7.456.515 | 185.505 | 911.767 | 99.5 | 1.5 | 38 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.011, Spanne 0.976–1.053. Anteil knapper Markt-Ticks: 7.1 %. Marktereignisse je Lauf: 4377.
- Handelsvolumen: 731.572 € pro Tag. Geldmenge am Ende (Median): 13.030.191 €, Wachstum in den letzten 30 Tagen: 4.5 %. Senken/Quellen (SFR): 0.912.
- Ungleichheit am Ende (alle Spieler): Gini 0.675, reichster Spieler ÷ Median 17.4.
- Umsatzstärkste Märkte: `muenchen/kokain` 165.301 €/Tag (P/P* 0.799, knapp 36 %); `hamburg/kokain` 59.481 €/Tag (P/P* 1.083, knapp 0 %); `frankfurt/kokain` 58.358 €/Tag (P/P* 0.955, knapp 4 %); `amsterdam/gras` 57.456 €/Tag (P/P* 1.179, knapp 0 %); `rotterdam/kokain` 52.267 €/Tag (P/P* 1.217, knapp 0 %).

**Auswertung: Hypothese bestätigt.** Die Organisationskosten (0,5 %/Tag über 500.000 €) lassen A unberührt. Nach einem Jahr ist die Geldmenge um 30 % kleiner (13,0 statt 18,7 Mio. €), ihr Wachstum in den letzten 30 Tagen halbiert (4,5 % statt 10,2 %). Der reichste Spieler hat nur noch das 17,4-Fache des Medians statt das 26,7-Fache. E endet bei 1,6 statt 2,5 Mio. €. → Empfehlung B-3. (Die Sackgassen sind hier weiter vorhanden, weil die Beschlagnahme bei 100 % blieb.)

### 2.13 `pop-10` – Variante: 10 Hintergrundspieler

- **Hypothese:** Mit weniger Spielern steigt der Gewinn je Spieler (weniger Konkurrenz um Gewinnpools).
- **Setup:** 10 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 12 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 aus, Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.079 (1.859–2.314) | 3.216 (2.151–4.240) | 6.807 (5.387–8.047) | 18.171 (15.768–19.935) |
| B Durchschnitt | 4.346 (2.357–5.758) | 12.193 (2.224–41.465) | 95.392 (19.958–140.808) | 444.744 (414–605.800) |
| C Aggressiv | 4.304 (3.596–5.904) | 26.797 (7.525–42.092) | 62.563 (-4.721–375.332) | 580.485 (-4.721–807.890) |
| D Ineffizient | 2.120 (1.522–2.940) | 5.137 (-141–8.726) | 7.792 (-142–20.504) | 7.143 (-142–7.952) |
| E Optimiert | 6.149 (3.507–9.676) | 75.127 (508–120.745) | 280.790 (54.082–441.048) | 897.519 (435.542–1.219.085) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 92 % · Tag 4.3 | 92 % · Tag 16.5 | 75 % · Tag 39.8 | 92 % · Tag 17 | 42 % · Tag 77 | – |
| C | 92 % · Tag 2.3 | 83 % · Tag 5.7 | 75 % · Tag 23.4 | 83 % · Tag 10.5 | 50 % · Tag 60.5 | – |
| D | 67 % · Tag 8.5 | 25 % · Tag 22.5 | – | – | – | – |
| E | 92 % · Tag 1.3 | 92 % · Tag 3.7 | 92 % · Tag 20 | 92 % · Tag 5 | 83 % · Tag 43.5 | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 2.07 | 1.5 % | 49 % | 81.612 | 56.762 | 8.684 | 528 | 0 | 0 | 0 % |
| B | 2.12 | 3.8 % | 52 % | 2.165.675 | 1.705.901 | 32.384 | 41.486 | 10.5 | 1.5 | 17 % |
| C | 2.34 | 3.4 % | 43 % | 2.884.033 | 2.225.329 | 37.737 | 126.199 | 16.7 | 3.42 | 25 % |
| D | 0.34 | 6.2 % | 20 % | 111.934 | 89.844 | 2.096 | 2.356 | 70.2 | 0 | 33 % |
| E | 2.93 | 3.7 % | 49 % | 4.056.586 | 3.093.199 | 59.327 | 73.500 | 5.4 | 0.92 | 8 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.012, Spanne 0.983–1.045. Anteil knapper Markt-Ticks: 7.4 %. Marktereignisse je Lauf: 1088.
- Handelsvolumen: 438.827 € pro Tag. Geldmenge am Ende (Median): 3.016.035 €, Wachstum in den letzten 30 Tagen: 71.4 %. Senken/Quellen (SFR): 0.861.
- Ungleichheit am Ende (alle Spieler): Gini 0.653, reichster Spieler ÷ Median 45.8.
- Umsatzstärkste Märkte: `muenchen/kokain` 121.516 €/Tag (P/P* 0.849, knapp 53 %); `hamburg/kokain` 51.441 €/Tag (P/P* 1.074, knapp 0 %); `rotterdam/kokain` 38.784 €/Tag (P/P* 1.16, knapp 0 %); `frankfurt/kokain` 35.335 €/Tag (P/P* 0.966, knapp 4 %); `amsterdam/gras` 27.832 €/Tag (P/P* 1.088, knapp 0 %).

**Auswertung:** Mit 10 Mitspielern verdienen die Händler deutlich mehr (E Tag 90: 898.000 €, B: 445.000 €), weil sich kaum jemand eine Route teilt (R-1). Das bestätigt den Bedarf an NPC-Händlern auf kleinen Servern.

### 2.14 `pop-100` – Variante: 100 Hintergrundspieler

- **Hypothese:** Mit mehr Spielern sinken Margen; optimierte Spieler verlieren relativ am meisten.
- **Setup:** 100 Hintergrundspieler + je 1 beobachteter Bot A–E, 90 Tage, 8 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 aus, Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 |
|---|---:|---:|---:|---:|
| A Vorsichtig | 2.098 (1.934–2.299) | 2.716 (2.378–3.400) | 3.787 (3.187–5.183) | 6.920 (3.694–9.867) |
| B Durchschnitt | 2.283 (1.218–3.089) | 6.786 (-27–10.785) | 24.324 (-27–61.061) | 86.580 (-27–133.366) |
| C Aggressiv | 3.185 (-494–4.886) | 11.818 (-707–17.793) | 8.633 (-707–37.965) | 19.164 (-707–131.143) |
| D Ineffizient | 1.914 (1.385–2.998) | 2.647 (180–6.444) | 3.548 (-281–8.223) | 7.266 (-281–8.006) |
| E Optimiert | 4.646 (1.910–5.594) | 19.087 (-1.457–35.053) | -408 (-1.485–105.600) | -408 (-1.485–273.955) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 63 % · Tag 12.4 | 63 % · Tag 27.5 | – | 63 % · Tag 28 | – | – |
| C | 63 % · Tag 3.8 | 63 % · Tag 12.5 | 25 % · Tag 57.5 | 50 % · Tag 21 | – | – |
| D | 63 % · Tag 20.3 | – | – | – | – | – |
| E | 88 % · Tag 2.3 | 38 % · Tag 8.5 | 38 % · Tag 36.1 | 38 % · Tag 11 | – | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 1.87 | 1.3 % | 29 % | 62.838 | 50.166 | 8.022 | 287 | 0 | 0 | 0 % |
| B | 1.79 | 3.8 % | 34 % | 683.917 | 587.585 | 12.460 | 10.337 | 29.2 | 1 | 38 % |
| C | 1.71 | 3.5 % | 43 % | 893.608 | 758.588 | 14.674 | 31.060 | 36 | 2.88 | 50 % |
| D | 0.48 | 5.8 % | 16 % | 66.589 | 59.811 | 2.955 | 815 | 64 | 0 | 38 % |
| E | 1.51 | 3.9 % | 43 % | 854.554 | 711.052 | 22.600 | 13.307 | 35.6 | 1 | 63 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.011, Spanne 0.976–1.044. Anteil knapper Markt-Ticks: 6.8 %. Marktereignisse je Lauf: 1059.
- Handelsvolumen: 949.024 € pro Tag. Geldmenge am Ende (Median): 2.932.342 €, Wachstum in den letzten 30 Tagen: 54.7 %. Senken/Quellen (SFR): 0.946.
- Ungleichheit am Ende (alle Spieler): Gini 0.803, reichster Spieler ÷ Median 73.
- Umsatzstärkste Märkte: `muenchen/kokain` 200.461 €/Tag (P/P* 0.746, knapp 16 %); `hamburg/kokain` 121.619 €/Tag (P/P* 1.156, knapp 0 %); `frankfurt/kokain` 85.635 €/Tag (P/P* 0.902, knapp 2 %); `rotterdam/kokain` 65.295 €/Tag (P/P* 1.267, knapp 0 %); `amsterdam/gras` 51.775 €/Tag (P/P* 1.16, knapp 0 %).

**Auswertung:** Mit 100 Mitspielern werden die Margen dünn, Totalverluste nehmen zu (E 62 %, B 38 %). Größere Server verschärfen B-1.

### 2.15 `s8-handover` – S8: Zustrom 10 → 150 Spieler, NPC-Händler mit F-NPC-04-Rückbau (k startet bei 1)

- **Hypothese:** Ab einer bestimmten Zahl regelmäßig aktiver Spieler erfüllen Routen-Konkurrenz, Marktaktivität und Spitzen-Online die Schwellen 14 Tage am Stück; danach sinkt k schrittweise (Prognose für den Betreiber, keine Schwelle).
- **Setup:** 10 Hintergrundspieler + je 1 beobachteter Bot A–E, 180 Tage, 4 Seeds. Erweiterungen: Wirtschaft aus, NPC-Händler F-NPC-01 an (k = 1), Kundenbindung/Polizeidruck aus, Sicherheitsnetz aus, Beschlagnahme bei Kontrolle 100 % der Ladung.
- **Parameter:** `docs/game-design/parameters.toml (main 1c396cd)` (SHA-256 `1072bd270762…`), Vorschläge `sim/proposals.toml` (`a631ba892620…`). Invariantenverletzungen: **0**.

**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)

| Profil | Tag 1 | Tag 7 | Tag 30 | Tag 90 | Tag 180 |
|---|---:|---:|---:|---:|---:|
| A Vorsichtig | 1.951 (1.936–2.080) | 3.119 (2.315–3.231) | 2.243 (1.802–4.280) | 3.610 (2.879–5.675) | 3.171 (582–4.625) |
| B Durchschnitt | 2.054 (1.802–3.479) | 8.283 (1.793–12.548) | -166 (-304–12.809) | -166 (-304–61.377) | -166 (-304–98.487) |
| C Aggressiv | 3.244 (3.062–5.539) | 4.121 (-459–12.279) | 24.214 (369–49.177) | -101 (-707–69.992) | -101 (-707–12.496) |
| D Ineffizient | 2.002 (1.701–3.160) | 1.833 (734–4.624) | 11 (-254–5.604) | 11 (-254–5.604) | 11 (-254–5.604) |
| E Optimiert | 5.459 (4.350–6.567) | 8.032 (1.876–25.775) | 80.737 (22.099–108.586) | 29.039 (-1.396–156.026) | 86.410 (-1.396–307.394) |

**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)

| Profil | Kleinwagen | Transporter | LKW | NW ≥ 50 000 € | NW ≥ 500 000 € | NW ≥ 5 Mio. € |
|---|---|---|---|---|---|---|
| A | – | – | – | – | – | – |
| B | 50 % · Tag 10.1 | 25 % · Tag 47.7 | – | 25 % · Tag 48 | – | – |
| C | 100 % · Tag 3.1 | 50 % · Tag 27.5 | 50 % · Tag 47.8 | 50 % · Tag 30.5 | – | – |
| D | 25 % · Tag 16.6 | – | – | – | – | – |
| E | 75 % · Tag 2.1 | 75 % · Tag 13.7 | 75 % · Tag 35.8 | 75 % · Tag 16 | – | – |

**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)

| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen+Bestechung € | Sackgassen-Tage | Neustarts | Ende < Startkapital |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 1.71 | 2.0 % | 17 % | 102.420 | 88.429 | 12.787 | 738 | 9.3 | 0 | 50 % |
| B | 0.71 | 3.3 % | 23 % | 557.254 | 504.567 | 11.364 | 7.673 | 116.1 | 0.5 | 75 % |
| C | 1.4 | 3.7 % | 29 % | 1.143.668 | 1.028.772 | 30.081 | 43.949 | 86.9 | 3.75 | 75 % |
| D | 0.14 | 6.7 % | 9 % | 25.753 | 23.360 | 1.842 | 546 | 161.9 | 0 | 75 % |
| E | 1.82 | 3.3 % | 30 % | 2.145.351 | 1.867.570 | 55.601 | 28.440 | 52 | 2.75 | 50 % |

**Markt und Geldmenge [gemessen]**

- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø 1.01, Spanne 0.978–1.048. Anteil knapper Markt-Ticks: 6.1 %. Marktereignisse je Lauf: 2171.
- Handelsvolumen: 978.614 € pro Tag. Geldmenge am Ende (Median): 3.158.840 €, Wachstum in den letzten 30 Tagen: 28.2 %. Senken/Quellen (SFR): 0.971.
- Ungleichheit am Ende (alle Spieler): Gini 0.765, reichster Spieler ÷ Median 4323.2.

**Rückbau der NPC-Händler F-NPC-04 [gemessen]** (Median je 30-Tage-Abschnitt; Ziel-Verfügbarkeit PvP nicht simuliert → als erfüllt angenommen)

| bis Tag | Spieler | Routen-Konkurrenz | Marktaktivität | Spitzen-Online | Anteil erfüllter Tage | k |
|---:|---:|---:|---:|---:|---:|---:|
| 30 | 27 | 0.7 | 0.43 | 13 | 0 % | 1 |
| 60 | 50.5 | 1 | 0.51 | 27 | 8 % | 1 |
| 90 | 73.5 | 1 | 0.57 | 40 | 33 % | 1 |
| 120 | 97 | 1 | 0.6 | 52.5 | 58 % | 1 |
| 150 | 120.5 | 1 | 0.65 | 65 | 85 % | 1 |
| 180 | 143.5 | 1 | 0.66 | 78 | 87 % | 0.9 |

Erster Rückgang von k je Seed: kein Rückgang; Tag 145 bei 128 Spielern; Tag 131 bei 117 Spielern; Tag 153 bei 134 Spielern. k am Ende: 1, 0.6, 0.9, 0.8.

- Umsatzstärkste Märkte: `muenchen/kokain` 172.550 €/Tag (P/P* 0.709, knapp 3 %); `hamburg/kokain` 118.653 €/Tag (P/P* 1.177, knapp 0 %); `frankfurt/kokain` 84.659 €/Tag (P/P* 0.872, knapp 1 %); `amsterdam/gras` 62.478 €/Tag (P/P* 1.249, knapp 0 %); `rotterdam/kokain` 58.245 €/Tag (P/P* 1.326, knapp 0 %).

**Auswertung:** Prognose für den Betreiber: Routen-Konkurrenz und Spitzen-Online sind früh erfüllt (≈ 30–50 Spieler). Die **Marktaktivität** (≥ 60 % der Märkte täglich gehandelt) wird erst bei ≈ 100–120 Spielern erreicht. k sinkt erstmals bei 117–134 Spielern (3 von 4 Läufen), im vierten Lauf nicht innerhalb von 180 Tagen. [Annahme] Die Ziel-Verfügbarkeit (PvP) ist als erfüllt angenommen. Echte Spieler ballen sich abends, also ist das ein grober Richtwert, keine Schwelle. Die Profilwerte dieses Laufs sind wegen des Zustroms und k = 1 bei 100 % Beschlagnahme nicht mit den anderen vergleichbar.

## 3. Nächste Experimente

| Hypothese | Änderung (genau eine) | Basis |
|---|---|---|
| Ein Kokain-Engpass verteilt den Handel auf mehrere Waren (B-2) | `goods.kokain.consumption` 0,004 → 0,003 | `npc-conf` |
| Die Kurzroute Rotterdam → Amsterdam verliert ihre Dominanz | `city.amsterdam.police` 0,3 → 0,45 | `npc-conf` |
| Kombination B-1 + B-3 + Eigendynamik bleibt im Korridor | `wealthSink` an | `npc-conf` + `ext` |
| Späte Einsteiger (S6) holen im Einkommen pro Stunde auf | Zustrom an Tag 30/180/365 | empfohlene Konfiguration |
