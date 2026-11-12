# GAME_ECONOMY – Wirtschaftsmodell

> Agent 5 – Game Balancing & Simulation · Stand 2026-11-09 · fachlich verantwortlich für Wirtschaft, Preise, Märkte (Entscheidung Product Owner, siehe [README](README.md#zuständigkeit))
>
> **Kennzeichnung:** [Regel] = beschlossene Formel in `docs/game-design/` (auf `main` seit PR #4) · [Design] = Vorschlag Agent 5, noch nicht beschlossen · [Annahme] = Modellannahme · [gemessen] = Ergebnis aus [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md) · [Hypothese] = noch ungetestet.
>
> Formeln werden per ID zitiert und **nicht** neu definiert. Ausführliche Herleitung und Beispiele stehen in Agent 2s `docs/game-design/economy.md`, `trade.md`, `cities.md`. Die TypeScript-Übergangsimplementierung (`sim/src/model/`) reproduziert alle zugehörigen Beispielwerte exakt (Golden-Tests).

## 1. Kausalkette

```text
 Bevölkerung, Wohlstand W ──► Nachfrage D (F-ECO-01) ──► Referenzbestand S_ref (F-ECO-03)
                │                                              │
 Erzeugerstadt m_s ──► Angebotsniveau A (F-ECO-02) ──► Zielbestand S_target (F-ECO-03)
                                                                │
 Ereignisse (F-ECO-09) ──► M_s, M_d, Bestandsschock ───────────►│
                                                                ▼
 Spieler-Orders (sofort) ──► Bestand S ◄── Mean-Reversion λ (F-ECO-04, je Tick)
                                  │
 Rauschen x (F-ECO-05, je Tick) ─►│
                                  ▼
              Marktpreis P = clamp(P_base · W^ω · (S_ref/S)^ε · e^x)   (F-ECO-06)
                                  │
            Kauf/Verkauf über das Preisintegral ± Spread  (F-TRD-01/02/03)
```

Das Modell hat **zwei Zeitskalen**: Spieleraktionen verschieben den Bestand **sofort**. Die Welt (Rückkehr zum Ziel, Rauschen, Ereignisse) bewegt sich **pro Tick** (10 min). Daraus entsteht das Kernspiel: Märkte reagieren auf den Spieler, erholen sich aber aus eigener Kraft.

## 2. Angebot und Nachfrage

| Faktor (Auftrag) | Abbildung | Quelle |
|---|---|---|
| Warenverfügbarkeit | Bestand S je (Stadt, Ware); Anzeige als Stufe knapp…reichlich (F-CTY-03) | [Regel] |
| Nachfrageintensität | D = pop · c · W^β · m_d · M_d (F-ECO-01) | [Regel] |
| Marktgröße | S_ref = D · `cover_ticks` → bestimmt Markttiefe und Slippage | [Regel] |
| Kaufkraft | W (Wohlstand) über W^β (Menge) und W^ω (Preis); zyklisch F-ECO-10 | [Regel] + [Design] |
| Regionale Unterschiede | m_s, m_d je Stadt und Ware; Erzeugerstädte (m_s > 1) gegen Verbraucherstädte (m_d > 1) | [Regel] |
| Zeitliche Veränderungen | Rauschen F-ECO-05, Ereignisse F-ECO-09; Zyklen, Krisen, Wochenrhythmus F-ECO-10/12/14 | [Regel] + [Design] |
| Konkurrenz | gemeinsamer Bestand: jede Order verschiebt S für alle; NPC-Händler F-NPC-01 (`npc.md`) | [Regel] |
| Spieleraktivitäten | Orders sofort auf S; Kundenbindung NPC-1b und Polizeidruck NPC-4 | [Regel] + [Design] |
| Wirtschaftliche Ereignisse | razzia, lieferung, party (F-ECO-09); Krisen F-ECO-12 | [Regel] + [Design] |

**Gleichgewicht.** Ohne Spieler strebt S gegen S_target. Dort gilt P = P* = P_base · W^ω · (m_d/m_s)^ε (F-ECO-07). Mit Spielern verschieben sich die Märkte, die stark gehandelt werden: Belieferte Verbraucherstädte liegen dauerhaft unter P*, leer gekaufte Erzeugerstädte darüber. Die Messwerte dazu, Tagesmittel P/P* und die umsatzstärksten Märkte, stehen in [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md).

**Konsum leert den Bestand nicht** [Regel, economy.md §9]. Konsum bestimmt nur die Größe von S_ref und S_target. Das hält das Modell einfach und stabil, bedeutet aber auch: Ohne Spieler und Ereignisse ist die Welt ruhig. Gegenmittel sind die NPC-Händler (F-NPC-01, [NPC_BEHAVIOR.md](NPC_BEHAVIOR.md)) und die Eigendynamik in §5.

## 3. Preisgestaltung

### 3.1 Preisarten

| Preisart | Definition | Formel |
|---|---|---|
| **Marktpreis** | Momentanpreis bei Bestand S | F-ECO-06 |
| **Gleichgewichtspreis** | Preis bei S = S_target, ohne Rauschen und Ereignis | F-ECO-07 |
| **Einkaufspreis** (Spieler zahlt) | ⌈(1 + s/2) · ∫ P dS⌉ über die gekaufte Menge | F-TRD-01 |
| **Verkaufspreis** (Spieler erhält) | ⌊(1 − s/2) · ∫ P dS⌋ über die verkaufte Menge | F-TRD-02 |
| **Händlerpreis** (Anzeige) | Vorschlag: `buyPrice = ⌈P·(1+s/2)⌉`, `sellPrice = ⌊P·(1−s/2)⌋` je 1 Einheit, s mit Handel-Level 0. Nur Anzeige, abgerechnet wird immer über das Integral. | [Design], offen bei Agent 3 (Feld `MarketPrice.buyPrice` ist undefiniert) |
| **Regionaler Unterschied** | P*_A / P*_B = (W_A/W_B)^ω · ((m_d/m_s)_A / (m_d/m_s)_B)^ε | aus F-ECO-07 |
| **Zeitliche Veränderung** | Rauschen, Ereignisse, Erholung; [Design] Zyklen, Krisen, Wochenrhythmus | §4, §5 |
| **Knappheit / Überangebot** | S < S_ref ⇒ P > Referenz; Dumping S ≫ S_ref ⇒ P → P_min | F-ECO-06 mit Clamp |

### 3.2 Parameter (Auszug; vollständig in [BALANCING_PARAMETERS.md](BALANCING_PARAMETERS.md))

| Parameter | Ausgangswert | Min | Max | Veränderungsfaktoren | Aktualisierung | Einfluss auf andere Systeme |
|---|---:|---:|---:|---|---|---|
| `economy.elasticity` ε | 0,5 | 0,2 | 1,0 | Bestand S, Spielerorders | sofort + Tick | Spreizung zwischen Städten → Routenmargen → Progressionstempo; Slippage → Marktmacht großer Spieler |
| `economy.wealth_price_exponent` ω | 0,3 | 0 | 1 | Wohlstand W (F-ECO-10) | Tick | regionale Preisunterschiede |
| `economy.cover_ticks` | 144 | 36 | 1008 | – | Tick | Markttiefe → wie viel ein Spieler pro Fahrt bewegen kann (Phase III der Progression) |
| `economy.reversion_rate` λ | 0,02 | 0,001 | 0,2 | – | Tick | Erholung T½ ≈ 34 Ticks (5,7 h) → wie oft eine Route am Tag lohnt |
| `economy.noise_rho` ρ | 0,95 | 0 | 0,99 | – | Tick | Trenddauer des Rauschens (Stunden) |
| `goods.*.volatility` σ | 0,015–0,04 | 0 | 0,05 [Design] | F-ECO-11 (regionaler Anteil) | Tick | Schwankung ≈ ±3 σ/√(1−ρ²) → ±5–13 % |
| `economy.price_min_factor` | 0,25 | 0,05 | 1,0 | – | jede Berechnung | Dumping-Grenze |
| `economy.price_max_factor` | 4,0 | 1,0 | 10,0 | – | jede Berechnung | Cornering-Grenze (E-03) |
| `trade.spread_base` s | 0,10 | 0,02 | 0,3 | Handel-Level (−3 %/Level, max. −60 %) | jede Order | Rund-Trip-Verlust (INV-03), Geldsenke |
| `trade.max_trade_share` | 0,9 | 0,1 | 1,0 | – | jede Order | Cornering, Leerkauf |
| `events.*.probability` | 0,0003–0,0005 | 0 | 0,005 [Design] | – | Tick | ≈ 1 Ereignis pro Markt und Woche |

Jede Preisänderung ist nachvollziehbar, denn sie hat genau eine dieser Ursachen: Order (Spieler-ID), Tick-Erholung, Rauschen, Ereignisbeginn bzw. -ende oder [Design] Zyklus, Krise oder NPC-Händler. Das Preisjournal `MarketPriceChange` (Backend, Trigger) kennt bisher die Ursachen `INITIAL | TRADE | TICK | EVENT | ADMIN | UNSPECIFIED` (`backend/prisma/schema.prisma`). **Anforderung an Agent 3:** zusätzlich `NPC` erfassen und bei `TICK` den Anteil aus Rauschen und Erholung aufteilbar halten, z. B. Rauschzustand x im Journal mitschreiben.

## 4. Wirtschaftliche Ereignisse [Regel]

| Ereignis | Wahrscheinlichkeit/Tick/Markt | Dauer | Wirkung | Spielerische Funktion |
|---|---:|---:|---|---|
| `razzia` | 0,0005 | 36 Ticks (6 h) | Bestand × 0,5, Angebot × 0,5 → Preis × √2 | Knappheit: Chance für Händler mit Ware auf Lager |
| `lieferung` | 0,0005 | 36 | Bestand × 2, Angebot × 1,5 → Preis × 0,71 | Überangebot: günstiger Einkauf |
| `party` | 0,0003 | 72 | Nachfrage × 1,8 | Nachfragespitze |

Die Summe der Wahrscheinlichkeiten von 0,0013 pro Tick ergibt bei einer Ereignisdauer von 36–72 Ticks rechnerisch ≈ 0,9 Ereignisse pro Markt und Woche, also ≈ 3.000 pro Jahr in 64 Erdmärkten. Die gemessene Zahl je Lauf steht in [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md). **Bewertung:** Die Ereignisse sind lokal, kurz und gut sichtbar. Sie entscheiden nicht willkürlich über Erfolg oder Misserfolg, weil sie Chancen schaffen statt Besitz zu vernichten. Folgen über die Dauer hinaus haben sie nicht. Das schließen F-ECO-12/13 (§5).

## 5. Wirtschaftliche Eigendynamik [Design, Vorschlag Agent 5]

Ziel: Die Welt verändert sich auch ohne Spieler. Das geschieht langsam, nachvollziehbar und ohne Extremschwankungen. Alle Werte stehen in `sim/proposals.toml`. Verbindlich werden sie erst per PR in `parameters.toml` (Abschnitt `[economy_ext]`).

| ID | Mechanik | Formel | Vorschlag | Wirkung (überschlägig) |
|---|---|---|---|---|
| **F-ECO-10** | Kaufkraftzyklus je Stadt | W_eff = W · (1 + a · sin(2π t / T + φ_Stadt)), φ aus U(seed, 0, `phase/<stadt>`) | a = 0,08, T = 56 Tage | Nachfrage und Markttiefe ±8 %, Gleichgewichtspreis ±2,3 % (W^ω). Spieler erleben „gute“ und „schlechte“ Wochen je Stadt. |
| **F-ECO-11** | Regionale Kopplung | x = √(1−w) · x_lokal + √w · x_regional(Ware); beide AR(1) nach F-ECO-05 | w = 0,5 | Preise einer Ware bewegen sich zu 50 % gemeinsam (Korrelation 0,5). Trends sind landesweit erkennbar, die Varianz bleibt unverändert. |
| **F-ECO-12** | Regionale Krise | täglich je Stadt: Krise, wenn U < p; Dauer gleichverteilt [5, 14] Tage; Nachfrage × m_k | p = 0,004/Tag, m_k = 0,7 | Preis −16 % bei unverändertem Bestand, ≈ 1,5 Krisen pro Stadt und Jahr. Zwingt zum Ausweichen auf andere Städte. |
| **F-ECO-13** | Angebotsreaktion (Überproduktion/Verknappung) | m_sup ← clamp(m_sup + r · (P/P* − 1), min, max); S_target × m_sup | r = 0,0005, [0,7; 1,5] | Hohe Preise ziehen Angebot nach: 10 Tage bei P/P* = 1,2 → +14 % Zielbestand → −6,5 % Preis. Ausgebeutete Erzeugerstädte erholen sich, überbelieferte Verbraucherstädte verlieren Angebot. Das verhindert dauerhaft einseitige Märkte. |
| **F-ECO-14** | Wochenrhythmus (ohne Reset, R-2) | Freitag und Samstag: Nachfrage × m_w für Partywaren | m_w = 1,15; `ecstasy, speed, lsd, pilze` | Preis +7 % an Wochenenden. Gibt Planungsanreiz und Grund, zu bestimmten Zeiten zu spielen. |

**Begrenzung der Komplexität:** Pro Tick kommen 8 Zufallszüge für das regionale Rauschen hinzu. Am Tageswechsel folgen 8 Würfe für Krisen. Dazu kommen je Markt drei Multiplikationen.

**Abgrenzung:** Saisons im Sinne eines Neustarts sind ausgeschlossen (R-2). Gemeint sind nur wiederkehrende Muster.

[gemessen] Die Messwerte stehen in [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md), Szenario `ext`.

## 6. Geldquellen und Geldsenken

| Quellen (Geld entsteht) | Status | Senken (Geld verschwindet) | Status |
|---|---|---|---|
| Verkauf an NPC-Märkte (Stadtbevölkerung) | [Regel] simuliert | Kauf von NPC-Märkten | [Regel] simuliert |
| Fahrzeug-Wiederverkauf (60 %) | [Regel] simuliert | Treibstoff, Bahn | [Regel] simuliert |
| [Design] Startkredit (Sicherheitsnetz) | Variante | Strafen, Bestechung, Beschlagnahme, Schuldentilgung | [Regel] simuliert |
| Betriebe, Produktion, Bezirke, Weltraum | [Regel, Agent 2] nicht simuliert | Fahrzeugkauf | [Regel] simuliert |
| | | Waschgebühren, Unterhalt, Clan-Ausbau, Kriegserklärung, Startgebühren Weltraum | [Regel, Agent 2] nicht simuliert |
| | | Hehlerabschlag 15 % bei Beute (F-CMB-05) | [Regel, Agent 2] nicht simuliert |
| NPC-Kuriere: Beute abzüglich Hehlerabschlag (F-NPC-02) | [Regel, Agent 2] nicht simuliert | Kontolöschung: Vermögen verfällt (`account.deletion_policy = "forfeit"`, ADR-017) | [Regel] nicht simuliert |
| | | NPC-Banden: Beute (F-NPC-03) | [Regel, Agent 2] nicht simuliert |
| | | NPC-Händler: bewegen nur Bestände, **kein Geld** (F-NPC-01) | – |

**Wichtigster Befund [gemessen]:** Im simulierten Teil (Handel und Reisen) liegt die Senkenquote (Senken ÷ Quellen) knapp unter 1. Die Geldmenge wächst trotzdem in den ersten Monaten um ein Vielfaches. Ursache: Der Einkauf ist zwar eine Senke, aber jede profitable Fahrt erzeugt netto Geld, und der Gewinn wächst mit dem Kapital bis zur Grenze der Markttiefe. Messwerte stehen in [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md). Senken, die mit dem Vermögen mitwachsen (T-505, ADR-016), sind deshalb **Pflicht**, nicht Kür. Vorschläge dazu stehen in [PROGRESSION_MODEL.md §7](PROGRESSION_MODEL.md#7-langfristige-ziele-und-vermögensabhängige-senken).

## 7. Anforderungen an die technische Umsetzung (Agent 3)

| # | Anforderung | Begründung |
|---|---|---|
| T-1 | ~~Geld in Cent~~ ✅ erledigt (ADR-019, `schema.prisma`, `backend/src/domain/money.ts`) | Rundungsregeln F-TRD-01/02 |
| T-2 | Marktzustand je (Stadt, Ware): S (float), x (float), aktives Ereignis + Restdauer; [Design] m_sup, Kundenbindung. Heute (`MarketPrice` auf main): `supply Int`, kein x, kein Ereignis. | Ohne x und Ereignisstatus ist F-ECO-05/09 nicht deterministisch fortsetzbar |
| T-3 | Jede Order schreibt S **sofort** fort (zugesagt) | E-05 Order-Splitting |
| T-4 | Regelfunktionen rein und seedbar mit gleichen Signaturen wie `sim/src/model/*` (`marketPrice`, `buyCost`, `sellRevenue`, `stockStep`, `noiseStep`, `pickEvent`, `controlProbability`, `npcTraderFlows` …). Die Basis `backend/src/domain/` (RNG, Geld, Zeit, `CommandResult`) ist vorhanden. | ADR-012: Formelschicht der Simulation wird ausgetauscht |
| T-5 | Tick-Reihenfolge laut Agent 2 README §4 und npc.md §5. Zufall nach F-GLB-01 (SHA-256-U): Ereigniswurf mit Entität `<stadt>/<ware>`, k = 0, Rauschen k = 1. ✅ `backend/src/domain/rng.ts` folgt seit PR #14 F-GLB-01/02 und wird von `sim/` importiert. | Reproduzierbarkeit gegen Simulation und `verify.py` |
| T-6 | Preisjournal: Ursache `NPC` ergänzen, x je Tick-Eintrag | §3.2 |

## 8. Testfälle und erwartete Ergebnisse

| ID | Eingabe | Erwartet | Status |
|---|---|---|---|
| ECO-T1 | Alle EX-ECO-01…06, EX-TRD-01…06, EX-CTY-01…03, EX-TRV-01…04, EX-PRF-01…03, EX-NPC-01, EX-NPC-04 | exakt die Werte aus `verify.py` | ✅ `sim/test/golden.test.ts` |
| ECO-T2 | Kauf q und Rückverkauf q, alle Märkte, q ∈ {0,1 %…90 %}, Handel-Level 0/10/20 | Verlust > 0 | ✅ `invariants.test.ts` (I-3) |
| ECO-T3 | 1 Order q gegen 10 Orders q/10 | Summe ≥ Einzelorder − 1 ct | ✅ (E-05) |
| ECO-T4 | S ∈ {1 … 10⁹}, x ∈ {−1, 0, 1} | P ∈ [P_min, P_max] | ✅ |
| ECO-T5 | 3 Tage, alle Erweiterungen an | Geldbilanz exakt, keine negativen Bestände | ✅ (I-1, I-4) |
| ECO-T6 | gleicher Seed zweimal | identischer Endzustand | ✅ (I-5) |
| ECO-T7 | 365 Tage Basis | Tagesmittel P/P* ∈ [0,85; 1,15] | siehe SIMULATION_RESULTS `base` |
| ECO-T8 | F-ECO-12 Krise, Bestand = S_target | Preis × 0,7^0,5 = 0,837 | offen (Golden Vector für [Design] nach Beschluss) |
