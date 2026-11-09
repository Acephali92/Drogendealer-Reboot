# GAME_BALANCING – Ist-Analyse, Ziele, Befunde

> Agent 5 – Game Balancing & Simulation · Stand 2026-11-09 · Basis: `main` @ `1c396cd`
> Ersetzt die frühere `balancing-concept.md`. Kennzeichnung: [gemessen] · [Regel] · [Design] · [Annahme] · [Hypothese] (siehe [README](README.md#arbeitsweise)).

## 1. Ist-Analyse

Untersucht wurden folgende Quellen:

- **Steuerungsdokumente:** `PROJECT.md`, `ARCHITECTURE.md`, `DECISIONS.md` (ADR-001…019), `TASKS.md`
- **Game Design:**
  - Dokumente: `docs/game-design/*.md` mit README, economy, trade, cities, travel, professions, combat, clans, money-laundering, real-estate, space, npc
  - Parameter: `parameters.toml` v0.1.0, SHA-256 `1072bd27…`
  - Prüfskript: `tools/verify.py`. Ergebnis: **„ALLE PRÜFUNGEN BESTANDEN“**
- **Backend:**
  - `backend/prisma/schema.prisma`
  - `backend/src/modules/*`
  - `backend/src/domain/*`
- **Simulation:** die eigenen Läufe in `sim/` (Ergebnisse in [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md))

### A – Vorhanden und funktionierend

| Mechanik | Quelle | Beleg |
|---|---|---|
| Preismodell mit Knappheit, Wohlstand, Rauschen, Clamp | [Regel] F-ECO-01…08, `economy.md` | Golden-Tests EX-ECO-01…06 grün. [gemessen] Tagesmittel P/P* bleibt über 365 Tage im Korridor (`base`). |
| Handel mit Preisintegral, Spread und Skill-Rabatt | [Regel] F-TRD-01…03 | EX-TRD-01…03 grün. Rund-Trip-Verlust > 0 in allen Märkten, für jede Menge und jedes Level (I-3). Order-Splitting bringt keinen Vorteil (E-05). |
| Marktereignisse (3 Typen) | [Regel] F-ECO-09 | lokal, zeitlich begrenzt, schaffen Chancen statt Verluste |
| Reisen, Kontrollen, Bestechung | [Regel] F-TRV-01…06 | EX-TRV-01…04 grün |
| Level-Kurve und Freischaltungen | [Regel] F-PRF-01…03 | EX-PRF-01…03 grün. [gemessen] Der LKW (Schmuggel L5) wird von B/C/E erreicht. |
| NPC-Händler und NPC-Rückbau | [Regel] F-NPC-01/04, `npc.md` | EX-NPC-01/04 grün |
| Beute-Grenzen gegen PvP-Dominanz | [Regel] F-CMB-05/06 | INV-12 (≤ 35 % pro Tag), Vermögensband mit 7-Tage-Hysterese |
| Deterministischer Zufall | [Regel] F-GLB-01/02 | EX-GLB-01 grün, I-5 grün |
| Geld in Cent, Rundung zugunsten der Bank | ADR-019, `backend/src/domain/money.ts`, `schema.prisma` | Geldbilanz I-1 je Tick exakt in allen Läufen |
| Preisjournal mit Ursache, append-only | `backend/prisma/migrations/*market_price_journal*` | Tests in `backend/test/price-journal.test.ts` |

### B – Vorhanden, aber unausgewogen

| Mechanik | Problem | Beleg |
|---|---|---|
| **Kontrolle = Totalverlust** | Bei einer Kontrolle werden die ganze Ladung beschlagnahmt **und** 20 % Strafe fällig, was oft Schulden erzeugt. Der Spieler fällt auf Null und steckt fest, eine **wirtschaftliche Sackgasse**. | [gemessen] B-1, Szenarien `base-short` vs. `h-confiscation` |
| **Dominante Kurzroute** | `rotterdam → amsterdam` (80 km, 40 min Bahn) bringt schon mit dem Startkapital ≈ 1.460 €/h Erwartungswert, das Dreifache der nächstbesten Route. Grund: Erzeugerstadt neben Großstadt, nur ein 100-km-Segment, Polizei in Amsterdam 0,3, Kontrollrisiko 0,8 %. | [gemessen] B-2, statische Routenanalyse |
| **Ungebremste Geldmenge** | Die Senkenquote liegt knapp unter 1, die Geldmenge wächst trotzdem über Monate um ein Vielfaches. Ohne Reset (R-2) wachsen Vermögen und Vorsprung unbegrenzt. | [gemessen] B-3, `base` |
| **Rendite von Betrieben ≪ Handel** | Bordell: 77 Tage Amortisation. Kleinwagen: < 1 Fahrt. | [Regel] INV-06. Laut Agent 2 gewollt, weil Weißgeld der Engpass ist. Wirkt erst mit Geldwäsche (nicht simuliert). |
| **Nur ≈ 13 % der Routen sind mit Startkapital profitabel** | Spread 10 % plus Bahnkosten schließen die meisten Paare aus. Das Startspiel ist eng. | [gemessen] statische Routenanalyse |

### C – Unvollständig

| Mechanik | Was fehlt | Zuständig |
|---|---|---|
| Wirtschaftliche Eigendynamik | Wohlstand, Polizei und Konsum sind statisch. Ohne Spieler bewegt sich nur Rauschen und Ereignis. Vorschläge F-ECO-10…14 in [GAME_ECONOMY.md §5](GAME_ECONOMY.md#5-wirtschaftliche-eigendynamik-design-vorschlag-agent-5). | Agent 5 → Agent 2 |
| Ereignisse | nur 3 Typen, rein lokal, ohne Nachwirkung | Agent 5 |
| Progression | Aufhol-XP und vermögensabhängige Senken (T-505) und Ranglisten nach Zuwachs (T-508) sind in `docs/game-design/README.md` §1.1 als Pflicht genannt, aber nicht spezifiziert | Agent 5 / Agent 2 |
| Backend-Spiellogik | `backend/src/domain/` enthält RNG, Geld, Zeit und Verträge. **Keine** Wirtschafts-, Handels- oder Reiseregeln, kein Tick-Job, keine Spielaktionen (nur lesende Endpunkte, `backend/src/modules/*/routes`). | Agent 3 (T-103 ff.) |
| Startwerte und Seed-Daten | `PLAYER_START_VALUES.cash = 0n` (`backend/src/modules/player/player.service.ts`). Keine Seed-Daten aus `parameters.toml` (T-101/T-102). | Agent 3 |
| Marktzustand im Datenmodell | `MarketPrice` hat `supply Int`, aber weder Rauschzustand x noch aktives Ereignis oder Restdauer. Damit ist F-ECO-05/09 nicht fortsetzbar. | Agent 3 |
| Ranglisten | „Vermögen“ zählt nur `cash + bank` (`rankings.service.ts`). F-GLB-03 verlangt Sachwerte, Ware und Clan-Anteil. | Agent 3 |

### D – Fehlend

| Mechanik | Bedeutung | Vorschlag |
|---|---|---|
| Sicherheitsnetz gegen Sackgassen | Nach Totalverlust gibt es keinen Weg zurück, außer das Fahrzeug zu verkaufen. | [Design] Startkredit ([PROGRESSION_MODEL.md §6](PROGRESSION_MODEL.md#6-rückschläge-ohne-sackgasse)) und/oder Teilbeschlagnahme |
| Vermögensabhängige Senken | Pflicht wegen R-2 | [Design] [PROGRESSION_MODEL.md §7](PROGRESSION_MODEL.md#7-langfristige-ziele-und-vermögensabhängige-senken) |
| Konsumentenverhalten mit Gedächtnis | Märkte vergessen Ausbeutung sofort. | [Design] NPC-1b Kundenbindung ([NPC_BEHAVIOR.md](NPC_BEHAVIOR.md)) |
| Reaktive Polizei | Städte „überhitzen“ nicht. | [Design] NPC-4 Polizeidruck |
| Wirtschaftszyklen, Krisen, Überproduktion | lebendige Welt | [Design] F-ECO-10…14 |
| Adversariale Simulation | X2–X10 | Phase P4 ([MARKET_SIMULATION.md §4.4](MARKET_SIMULATION.md#44-adversariale-bots-geplant-phase-p4)) |

### E – Widersprüchlich oder problematisch

| # | Widerspruch | Quellen | Vorschlag | Klärung durch |
|---|---|---|---|---|
| E-1 | **Zufallsgenerator:** Das Game Design legt F-GLB-01 fest, also SHA-256 über `seed:t:e:k`. Das Backend implementiert dagegen cyrb128 + sfc32 (`deriveRng`). Dieselbe Welt ergibt im Backend andere Ereignisse und Kontrollen als in `verify.py` und der Simulation. | `docs/game-design/README.md`, `backend/src/domain/rng.ts` | Eine Methode verbindlich machen. Empfehlung: F-GLB-01, weil zustandslos, sprachneutral und schon mit Testvektor versehen. | Agent 1 (ADR), Agent 2, Agent 3 |
| E-2 | **Zuständigkeit:** `PROJECT.md` §5 weist Formeln und Parameter Agent 2 zu. Der PO hat am 2026-11-09 auf „geteilt nach Systemen“ entschieden. | `PROJECT.md`, diese Session | ADR anlegen | Agent 1 |
| E-3 | **Agentenzählung:** `PROJECT.md` führt sechs Agenten (Agent 5 = Datenbank, Agent 6 = Balancing). Der PO sagt: fünf Agenten, Balancing = Agent 5. | `PROJECT.md` §5 | Rollenliste anpassen | Agent 1 / PO |
| E-4 | **„Saison“ in ROADMAP M5** („stabile Wirtschaft über eine Saison“) widerspricht ADR-016 (keine Saisons). | `ROADMAP.md`, `DECISIONS.md` | „über 365 Simulationstage“ | Agent 1 |
| E-5 | **Verweise auf entfallene Dateien:** ADR-016 (R-4 → `balancing-concept.md` §2) und T-503 (`simulation-spec.md` §8) | `DECISIONS.md`, `TASKS.md` | auf `NPC_BEHAVIOR.md` §4 bzw. `MARKET_SIMULATION.md` §8 ändern | Agent 1 |
| E-6 | **`buyPrice`/`sellPrice` undefiniert:** Das Schema sagt nicht, welcher Preis gemeint ist und ob mit Spread. Die Abrechnung erfolgt aber über das Integral (F-TRD-01/02). | `schema.prisma`, `trade.md` | Anzeigepreis je 1 Einheit, Level 0 ([GAME_ECONOMY.md §3.1](GAME_ECONOMY.md#31-preisarten)) | Agent 3 |
| E-7 | **Vermögen in der Rangliste** = `cash + bank` widerspricht F-GLB-03. | `rankings.service.ts` | F-GLB-03 verwenden | Agent 3 |
| E-8 | **Eigener Fehler, korrigiert:** Das frühere Konzept sprach von „72 h“ für abnehmende Beute. Der Parameter `combat.loot_repeat_window_ticks` = 1 008 entspricht aber 7 Tagen. | `exploit-catalog.md` E-15 | korrigiert | – |

## 2. Designziele

1. **Schneller Einstieg, langsame Sättigung.** Die ersten Stunden bringen spürbaren Fortschritt. Später wächst das Vermögen vor allem absolut, nicht mehr prozentual.
2. **Viele gute Wege, kein einzig richtiger.** Mehrere Routen, Waren und Felder sind konkurrenzfähig.
3. **Risiko gegen Ertrag.** Mehr Ertrag kostet mehr Risiko. Ein einzelnes Unglück darf aber nicht alles beenden.
4. **Spielzeit zählt, aber nicht linear.** Viermal so viel Spielzeit bringt schnelleren Fortschritt, aber nicht viermal so schnellen.
5. **Neulinge bleiben im Einkommen pro Stunde konkurrenzfähig**, auch wenn ihr Vermögen klein ist.
6. **Kein Geld aus dem Nichts.** Jede Geldbewegung hat eine Quelle oder eine Senke.
7. **Eine lebendige Welt.** Märkte bewegen sich auch ohne Spieler, nachvollziehbar und ohne Extreme.

## 3. Kennzahlen und Zielkorridore

| KPI | Definition | Ziel | Ist [gemessen] | Bewertung |
|---|---|---|---|---|
| Tagesmittel P/P* | Marktstabilität | 0,85–1,15 | 0,98–1,05 (`base`), 0,91–1,08 (`ext`) | ✅ |
| Knappe Markt-Ticks | S/S_ref < 0,5 | ≤ 15 % | 6–8 % | ✅ |
| Meilenstein Kleinwagen, aktive Spieler (B/E) | Median-Tag | Tag 1–2 (E), ≤ Tag 7 (B) | E 1,8 · B 4,9 (`base-short`) | ✅ |
| TTM-Verhältnis bei 1:4 Spielzeit | Transporter B (6 h/Tag) ÷ E (16 h/Tag) | ≤ 3 | 14,1 ÷ 4,7 = 3,0 | ⚠️ Grenzwert |
| **Anteil unter Startkapital nach 90 Tagen** | B, C, E | ≤ 10 % | B 50 %, C 67 %, E 29 % (`base-short`) | ❌ **kritisch** (B-1) |
| Route-Dominanz-Index | beste ÷ Median der profitablen Routen (Start, Bahn) | ≤ 2 | **27,6**. Beste ÷ zweitbeste 2,3. | ❌ (B-2) |
| Anteil profitabler Routen (Start, Bahn) | – | ≥ 40 % | **13 %** (58 von 448) | ❌ (B-2) |
| Geldmenge, Wachstum je 30 Tage ab Tag 30 | – | flach bis logarithmisch | +92 % (Tag 60–90), +10 % (Tag 335–365) | ❌ (B-3) |
| Senken ÷ Quellen (SFR) | – | 0,7–0,9 | 0,86–0,97 | ✅ formal, verdeckt aber B-3 |
| Reichster ÷ Median (alle Spieler, Tag 365) | Rangmaß (< 100 Spieler) | ≤ 20 | 26,7 | ⚠️ |
| Rund-Trip-Gewinn | I-3 | nie | nie (alle Märkte, Mengen, Level) | ✅ |
| Invariantenverletzungen | I-1, I-4, I-5 | 0 | 0 in allen Läufen | ✅ |

## 4. Risiko und Belohnung

| Risiko | Mechanik | Ist [gemessen] | Bewertung |
|---|---|---|---|
| Kontrolle unterwegs | F-TRV-04, je Fahrt | 1,5 % (A, Bahn, Heat ≤ 1) bis 4,5 % (C). D: 5–7 % (schlechte Routen). | Häufigkeit angemessen |
| **Folgen einer Kontrolle** | F-TRV-06: ganze Ladung weg, 20 % Strafe, Rest als Schuld | Eine Kontrolle mit voller Ladung kostet oft das gesamte Vermögen. Danach folgen Sackgassen-Tage: B 36, C 49, E 18 (Mittel, 90 Tage). | ❌ **zu hart**: entscheidet zufällig über Erfolg oder Scheitern (Auftrag: „unfaire Zufallsereignisse“) |
| Bestechung | F-TRV-06 | lohnt bei mittlerer Polizei, wird von B/C/E genutzt | ✅ |
| Marktereignisse | F-ECO-09 | ≈ 4.400 je Jahr und Lauf, wirken als Chance | ✅ |
| PvP, NPC-Banden | F-CMB-05, F-NPC-03 | nicht simuliert | – |

**Folgerung:** Die Höhe des Risikos stimmt (wenige Prozent je Fahrt), aber die **Verteilung** ist falsch. Ein einziges Zufallsereignis vernichtet Wochen an Fortschritt. Der Ertrag hängt deshalb stärker vom Glück ab als von den Entscheidungen. Das zeigt die Streuung (P10 = Totalverlust bei B, C und E). Die wirksamste Stellschraube ist die Beschlagnahmequote (Befund B-1).

## 5. Die sieben Balancing-Fragen

### 5.1 Wie schnell können Spieler ihr Vermögen steigern?
[gemessen, `base` 365 Tage, `base-short` 90 Tage]
- **Phase I** (Kapital-Engpass, Tag 0–7): Profil E steigert sein Startkapital in der ersten Woche auf das 9- bis 17-Fache (Median Tag 7: 18.000–34.000 € je nach Lauf). B erreicht das 5- bis 8-Fache.
- **Phase II** (Transport-Engpass, Woche 1–6): Die Fahrzeugstufen werden schnell erreicht. E kauft den Transporter an Tag 5 und den LKW an Tag 22.
- **Phase III** (Markt-Engpass): Das Wachstum wird linear. E erreicht ≈ 1 Mio. € an Tag 180 und ≈ 2,5 Mio. € an Tag 365. B erreicht ≈ 0,5 Mio. € bzw. 1,1 Mio. €. A wächst langsam, aber ohne Rückschläge (95.000 € an Tag 365).

Die Phasen entsprechen dem Konzept. Phase III setzt aber spät ein, und die Geldmenge wächst bis zum Jahresende weiter (B-3).

### 5.2 Welche Handelsrouten sind besonders profitabel?
- **Statisch** (Startkapital, Bahn, Gleichgewicht):
  - Nur 13 % aller Routen sind profitabel.
  - Beste Route `rotterdam → amsterdam / kokain`: ≈ 1.460 €/h Erwartungswert. Sie ist nur 80 km lang, hat ein Kontrollrisiko von 0,8 % und bringt das 2,3-Fache der zweitbesten Route.
  - 21 der 58 profitablen Routen handeln Kokain.
- **Dynamisch** [gemessen]: Kokain stellt 5 der 8 umsatzstärksten Märkte. Spitzenmarkt ist `muenchen/kokain` mit ≈ 173.000 €/Tag, wo die Spieler den Preis dauerhaft auf 0,79 · P* drücken.
- **Bewertung:** Eine Ware dominiert. Das verstärkt monotones Spielen (B-2).

### 5.3 Wie stark beeinflusst ein Einkauf den Marktpreis?
[Regel, exakt nachgerechnet] Für einen Kauf vom Anteil f des Bestands bei ε = 0,5:

| f | Preis danach | Ø Slippage |
|---:|---:|---:|
| 1 % | +0,5 % | +0,3 % |
| 10 % | +5,4 % | +2,6 % |
| 25 % | +15,5 % | +7,2 % |
| 50 % | +41,4 % | +17,2 % |

Erholung: T½ = 34,3 Ticks (5,7 h, EX-ECO-04). Ein Rund-Trip ist immer ein Verlust, der Mindestverlust liegt bei 3,92 % (INV-03). Order-Splitting bringt keinen Vorteil (E-05). [gemessen] Markt-Ticks mit Knappheit 6–8 %. **Bewertung: ausgewogen ✅**

### 5.4 Wie viel Kapital braucht ein Spieler für den nächsten Entwicklungsschritt?
Siehe [PROGRESSION_MODEL.md §4](PROGRESSION_MODEL.md#4-entwicklungsleiter) mit gemessenen Meilensteintagen je Profil. Die Fahrzeuge amortisieren sich nach weniger als einer bis wenigen Fahrten. Betriebe brauchen 30–93 Tage (INV-06), sind aber nicht simuliert.

### 5.5 Wie stark dürfen Überfälle sein?
[Regel, Agent 2]
- Ein Opfer verliert höchstens 35 % seines Bargelds pro Tag (F-CMB-05, INV-12).
- Wiederholte Überfälle desselben Angreifers bringen nur noch halbe Beute.
- 15 % der Beute gehen beim Hehler verloren.
- Vermögensband mit 7-Tage-Hysterese (F-CMB-06).
- Banden (F-NPC-03) greifen erst ab 10.000 € Bargeld an und gewinnen in ≈ 42 % der Fälle.

Nicht simuliert (Phase P2). Die Analogie aus §4 zeigt aber: Verluste sollten **gedeckelt** sein. Das ist für PvP umgesetzt, für Kontrollen nicht.

### 5.6 Wie verhindern wir, dass erfahrene Spieler neue dauerhaft dominieren?
- **Vorhanden [Regel]:** Vermögensband und Neulingsschutz (F-CMB-06), Markttiefe und Slippage begrenzen die Kapitalrendite, Clan-Größenlimits, NPC-Händler.
- **[gemessen]:**
  - Am Ende des Jahres besitzt der reichste Spieler das 26,7-Fache des Medians, bei einem Gini von 0,68.
  - Mit 10 Spielern wächst E deutlich schneller (Median Tag 90: 898.000 €) als mit 100 (Totalverlust in 62 % der Läufe). Mehr Konkurrenz macht die Margen dünn, und eine einzige Kontrolle wiegt dann schwerer.
- **Fehlend [Design]:** Organisationskosten F-PRG-01, Aufhol-XP F-PRG-02 und Zuwachs-Ranglisten F-PRG-03 ([PROGRESSION_MODEL.md §7](PROGRESSION_MODEL.md#7-langfristige-ziele-und-vermögensabhängige-senken)).
- **Offen:** Das Szenario „späte Einsteiger“ (S6) ist noch nicht gelaufen.

### 5.7 Wie verhindern wir wirtschaftliche Exploits?
- Invarianten werden in jedem Lauf und jedem Tick geprüft: I-1 Geldbilanz, I-3 Rund-Trip, I-4 Bestände/Bargeld, I-5 Determinismus. Hinzu kommt E-05 (Splitting) als Test. Bisher: **0 Verletzungen**.
- Exploit-Klassen E-01…E-19 mit Gegenmaßnahmen: [exploit-catalog.md](exploit-catalog.md).
- Adversariale Bots X2–X10 sind Phase P4.

## 6. Befunde und Empfehlungen

Jede Empfehlung ändert **genau einen** Parameter und ist durch einen Simulationslauf belegt. Die Umsetzung erfolgt per PR gegen `parameters.toml`, abgestimmt mit dem jeweiligen Systemeigentümer.

| ID | Schwere | Befund [gemessen] | Ursache | Empfehlung (ein Parameter) | Beleg | Zuständig |
|---|---|---|---|---|---|---|
| **B-1** | **kritisch** | Wirtschaftliche Sackgassen: Nach 90 Tagen liegen 50 % (B), 67 % (C) und 29 % (E) der Läufe unter dem Startkapital. Der Erfolg hängt vom Zufall ab. | F-TRV-06: Eine Kontrolle beschlagnahmt die **ganze** Ladung und erhebt 20 % Strafe, der Rest wird Schuld. | **neu: `travel.confiscation_share` = 0,5** (Strafe auf den beschlagnahmten Teil) | `h-confiscation`: 0 % Verluste (A, B, C, E), Gini 0,74 → 0,56 | Agent 2 (Reisen) |
| **B-2** | hoch | Eine Ware dominiert (Kokain: 5 der 8 umsatzstärksten Märkte). Route-Dominanz-Index 27,6, nur 13 % der Routen lohnen mit Startkapital. Kurzroute `rotterdam → amsterdam` ≈ 1.460 €/h. | Hoher Wert je Volumen, Erzeugerstädte (`supply` 2,0–2,5) neben Verbraucherstädten. Ein 80-km-Paar hat nur ein Kontrollsegment. | **[Hypothese], noch nicht getestet:** `goods.kokain.consumption` 0,004 → 0,003 bzw. `city.amsterdam.police` 0,3 → 0,45 (je ein Experiment) | statische Analyse, `base` | Agent 5 |
| **B-3** | hoch | Die Geldmenge wächst ungebremst (18,7 Mio. € nach einem Jahr, +10 % in den letzten 30 Tagen). Der reichste Spieler hat das 26,7-Fache des Medians. | Es fehlen Senken, die mit dem Vermögen wachsen (R-2, kein Reset). | **neu: F-PRG-01 Organisationskosten `progression.org_cost_rate_per_day` = 0,005 über 500.000 € NW** | `h-wealth-sink`: Geldmenge −30 %, Wachstum 4,5 %/30 Tage, reichster Spieler ÷ Median 17,4 | Agent 5 |
| **B-4** | hoch (abhängig von B-1) | F-NPC-01 bei k = 1 (Startzustand kleiner Server) erhöht ohne B-1 die Totalverluste (C 83 %, E 50 %) und drückt das Wachstum stark. | Dünnere Margen machen jede Kontrolle relativ teurer. | **F-NPC-01 erst zusammen mit B-1 aktivieren.** `npc.trader_intensity` bleibt 0,5. | `npc` vs. `npc-conf` | Agent 2/5, Agent 3 (Reihenfolge der Umsetzung) |
| B-5 | mittel | Die Marktaktivität ist für den NPC-Rückbau der Engpass: k sinkt erst ab ≈ 120–130 Spielern. | 64 Märkte bei wenigen Spielern | keine Parameteränderung. Dem Betreiber als Richtwert mitteilen. | `s8-handover` | – |
| B-6 | niedrig | Die Welt ohne Spieler ist ruhig: Wohlstand, Polizei und Konsum sind statisch. | – | [Design] F-ECO-10…14 aus `sim/proposals.toml` übernehmen | `ext`: P/P* 0,91–1,08, also im Korridor | Agent 5 → Agent 2 |
| B-7 | info | NPC-1b und NPC-4 (eigene Vorschläge) zeigen keinen messbaren Effekt. | zu schwach parametriert | nicht übernehmen, ggf. neu parametrieren | `npc-ext` | Agent 5 |

**Empfohlene Reihenfolge:**
1. B-1 umsetzen.
2. F-NPC-01 aktivieren (B-4).
3. B-3 umsetzen.
4. Experimente zu B-2 durchführen.
5. B-6 übernehmen.

Für 1–3 liegt mit `npc-conf` und `h-wealth-sink` ein Beleg vor. Ein gemeinsamer Lauf aller drei steht noch aus ([SIMULATION_RESULTS.md §3](SIMULATION_RESULTS.md#3-nächste-experimente)).

## 7. Offene Fragen

| # | Frage | An |
|---|---|---|
| 1 | Welcher Zufallsgenerator gilt verbindlich: F-GLB-01 (SHA-256) oder cyrb128/sfc32 (`backend/src/domain/rng.ts`)? (E-1) | Agent 1 |
| 2 | ADR zur geteilten Zuständigkeit (E-2) und Bereinigung der Agentenliste (E-3) | Agent 1 |
| 3 | Übernahme von `travel.confiscation_share` (B-1). Betrifft das Reisesystem von Agent 2. | Agent 2 |
| 4 | Wann liefert das Backend die Wirtschaftsregeln als reine Funktionen (T-103)? Erst dann kann die Simulation sie importieren (ADR-012) und DoD Punkt 8 erfüllt werden. | Agent 3 |
