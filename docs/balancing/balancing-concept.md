# Balancing-Konzept

> Agent 6 · Konzept v0.1 · Stand 2026-11-08
> Bezieht sich auf `docs/game-design/parameters.toml` **v0.1.0** (Agent 2).

## 0. Grundlagen

### 0.1 Designziele des Balancings

1. **Schneller Einstieg, langsame Sättigung.** Die ersten Stunden sollen spürbaren Fortschritt bringen.
   Später wächst das Vermögen vor allem in absoluten Zahlen, die Rendite in Prozent sinkt.
2. **Viele gute Wege, kein einzig richtiger.** Mehrere Routen, Waren und Betätigungsfelder sind konkurrenzfähig.
3. **Risiko gegen Ertrag.** Höherer Ertrag kostet immer höheres Risiko (Heat, Kontrollen, PvP).
4. **Spielzeit zählt, aber nicht linear.** Wer viermal so viel spielt, kommt schneller voran, aber nicht viermal so schnell.
5. **Neulinge bleiben konkurrenzfähig im Einkommen pro Stunde**, auch wenn sie im Vermögen weit zurückliegen.
6. **Kein Geld aus dem Nichts.** Jede Geldbewegung hat eine definierte Quelle oder Senke.

### 0.2 Annahmen dieser Version

Die Formeln von Agent 2 (`economy.md`, `verify.py`) sind noch nicht veröffentlicht. Für die Überschlagsrechnungen
gilt daher folgende **Arbeitsannahme A-1**. Sie ist mit der endgültigen Formel abzugleichen; alle Beispielwerte
sind dann neu zu rechnen.

| ID | Annahme |
|---|---|
| A-1 | Gleichgewichtspreis $P^* = P_{base}\cdot W^{\omega}\cdot (m_d/m_s)^{\varepsilon}$; Momentanpreis $P = P^*\cdot(S^*/S)^{\varepsilon}$, Zielbestand $S^* = D\cdot$ `cover_ticks` $\cdot\, m_s$, Nachfrage $D = pop\cdot c\cdot W^{\beta}\cdot m_d$ |
| A-2 | Kaufpreis $= P\cdot(1+s/2)$, Verkaufspreis $= P\cdot(1-s/2)$ mit $s$ = `trade.spread_base` |
| A-3 | Jede Order verändert den Bestand **sofort** (kein Batching bis zum nächsten Tick), siehe [E-05](exploit-catalog.md#e-05-tick-grenzen-timing--order-splitting) |
| A-4 | Reisen laufen auch weiter, wenn der Spieler offline ist |

Alle Beispielzahlen in diesem Dokument sind **illustrativ**. Sie zeigen die Methode und deuten erste Befunde
an. Verbindlich ist erst das Ergebnis der Simulation.

### 0.3a Rahmenbedingungen des Product Owners (2026-11-08)

| ID | Festlegung | Folge für das Balancing |
|---|---|---|
| R-1 | **Anfangs nur wenige Spieler** pro Server | Standard-Szenarien laufen mit **30 Spielern**. Die Skalierung wird mit 10 / 30 / 100 / 300 geprüft. Konkurrenz zwischen Spielern begrenzt den Gewinn kaum, deshalb müssen Markttiefe und NPC-Mechaniken das übernehmen. |
| R-2 | **Keine Neustarts** der Welt (keine Saisons mit Reset) | Die Welt ist dauerhaft. Inflation und Vorsprung der ersten Spieler wachsen unbegrenzt, wenn die Senken nicht mitwachsen. Jeder spätere Spieler ist ein „Late Joiner“. Die Maßnahmen gegen Dominanz dürfen sich nicht auf Resets stützen. |

Die Abschnitte 1, 2, 5 und 6 enthalten dazu je einen Unterabschnitt **„Bei wenigen Spielern / ohne Reset“**.

### 0.3 Gliederung jedes Abschnitts

**Fragestellung → Modell → Messgrößen → Zielkorridor → Simulationsszenario → Stellschrauben → Überschlag → Befund.**

---

## 1. Wie schnell können Spieler ihr Vermögen steigern?

### Fragestellung
Wie entwickelt sich `NW(t)` je Spielertyp, und wie schnell wächst die gesamte Geldmenge des Servers (Inflation)?

### Modell: drei Wachstumsphasen
Das Einkommen eines Händlers pro Fahrt ist durch den kleinsten von drei Engpässen begrenzt:

$$
\text{Gewinn}_{Fahrt} = \text{Marge} \cdot \min\Big(\underbrace{\tfrac{\text{Kapital}}{P_{Kauf}}}_{\text{Kapital}},\ \underbrace{\tfrac{\text{Kapazität}}{\text{volume}}}_{\text{Transport}},\ \underbrace{q_{max}(\text{Markttiefe})}_{\text{Markt}}\Big) - \text{Reisekosten} - E[\text{Kontrollverlust}]
$$

| Phase | Engpass | Wachstum | Typischer Zeitraum (Ziel) |
|---|---|---|---|
| I | Kapital | exponentiell (Gewinn ∝ Vermögen) | Stunden bis Tag 2 |
| II | Transportkapazität | linear, sprunghaft bei jedem Fahrzeugkauf | Tag 2 bis Woche 3 |
| III | Markttiefe / Konkurrenz | linear, flach, über Diversifikation (Betriebe, Weltraum) | ab Woche 3 |

Diese Struktur ist der wichtigste Hebel gegen Ungleichheit: **Ab Phase III sinkt die Kapitalrendite automatisch.**
Mehr Geld erzeugt dann nicht proportional mehr Einkommen.

### Messgrößen
- `NW(t)`: Median und P90 je Spielertyp an Tag 1, 3, 7, 14, 30, 90.
- `IPH`: Einkommen pro aktiver Stunde je Phase.
- Tagesrendite `r(t) = ΔNW / NW`.
- Verhältnis Vielspieler zu Gelegenheitsspieler: `TTM_casual(m) / TTM_hardcore(m)`.
- Serverweite Geldmenge `M(t)` und **Sink/Faucet-Ratio** `SFR`.
- Warenkorb-Index: durchschnittlicher Marktpreis über alle Waren und Städte relativ zu `P*`.

### Zielkorridore

| KPI | Ziel |
|---|---|
| Tagesrendite aktiver Händler, Phase I | 50–150 % |
| Tagesrendite, Phase II | 10–40 % |
| Tagesrendite, Phase III | 0,5–5 % |
| `TTM_casual / TTM_hardcore` (Spielzeit-Verhältnis 1:4) | ≤ 3, Ziel ≈ 2 |
| `SFR` auf einem reifen Server (≥ 30 Tage) | 0,7–0,9 |
| Wachstum `M(t)` pro aktivem Spieler und Tag, ab Tag 30 | flach oder sinkend |
| Warenkorb-Index | 0,85–1,15 dauerhaft |

### Geldquellen und -senken (Faucets & Sinks)

| Quellen (Geld entsteht) | Senken (Geld verschwindet) |
|---|---|
| Verkauf an NPC-Märkte (Konsum der Städte) | Kauf von NPC-Märkten |
| Betriebseinnahmen (`businesses.*.income`) | Treibstoff, Bahn, Startgebühren (`space.launch_fee`) |
| Bezirkseinnahmen der Clans (`clans.district_income_base`) | Unterhalt Betriebe/Crew (`upkeep`) |
| Produktion (Labor, Plantage) | Strafen, Bestechung, Beschlagnahme |
| | Waschgebühren (`laundering.fee_min`, `wash_fee`, `strawman_fee`) |
| | Käufe: Fahrzeuge, Waffen, Rüstung, Immobilien, Clan-Ausbau |
| | Clankriegs-Erklärung |

**Problem:** Die Marktpreise sind an `P_base` verankert. Deshalb steigen die Warenpreise nicht mit der
Geldmenge. Die Inflation zeigt sich stattdessen darin, dass **feste Preise** (Fahrzeuge, Waffen, Betriebe) für
Veteranen bedeutungslos werden. Senken müssen daher mit dem Vermögen mitwachsen. Kandidaten dafür:
progressiver Unterhalt, Ausbaukosten mit Wachstumsfaktor, Waschgebühren, Clan-Ausbau, Weltraum.

### Simulationsszenario `S1-growth`
30 Bots im Standard-Mix ([player-archetypes.md](player-archetypes.md#standard-population)), 365 Tage, 20 Seeds.
Zusätzlich laufen Varianten mit 10, 100 und 300 Bots. Ausgegeben werden `NW(t)`-Kurven je Typ, Rendite je Phase,
`M(t)` und `SFR(t)`.

### Bei wenigen Spielern / ohne Reset
- Weil die Welt nie zurückgesetzt wird, wird die Geldmenge **über ein Jahr** simuliert und nicht nur über 90 Tage.
  Ziel: `M(t)` pro aktivem Spieler wächst ab Tag 30 höchstens **logarithmisch** und nicht linear oder exponentiell.
- Senken, die mit dem Vermögen wachsen, sind ohne Reset **Pflicht** und keine Option mehr (siehe D-6).
- Mit wenigen Spielern bremst die Konkurrenz um Gewinnpools das Wachstum kaum (siehe Abschnitt 2).
  Phase III (Markt-Engpass) entsteht dann vor allem durch die **eigene** Slippage des Spielers. Das ist ausreichend,
  solange `economy.elasticity` und `cover_ticks` die Markttiefe begrenzen.

### Stellschrauben
`player.start_cash_black`, `player.backpack_capacity`, `vehicles.*.price/capacity`, `trade.spread_base`,
`economy.elasticity`, die Städte-Multiplikatoren `city.*.supply/demand`, `businesses.*.upkeep`.

### Überschlag (illustrativ, A-1/A-2)
Route Kokain Rotterdam → München (820 km):

| Größe | Wert |
|---|---|
| $P^*$ Rotterdam | 80 € · 1,0^0,3 · (1/2,5)^0,5 ≈ **50,6 €** |
| $P^*$ München | 80 € · 1,6^0,3 · (1,4/0,5)^0,5 ≈ **154,1 €** |
| Kauf / Verkauf (Spread 10 %) | 53,1 € / 146,4 € → Marge **93 €/Einheit (+176 %)** |
| Neuling (2.000 €) | 37 Einheiten (Kapital-Engpass) → ≈ 3.300 € Gewinn nach Bahnkosten (123 €) |
| Rucksack voll (60 Vol.) | ≈ 5.600 € pro Fahrt (Transport-Engpass) |
| Kleinwagen (300 Vol.) | ≈ 28.000 € pro Fahrt |
| Kontrollrisiko je Fahrt (8,2 Segmente à 2 %) | ≈ 15 % (vor Heat- und Ladungsfaktor) |

### Befund B-1 (vorläufig)
Eine einzelne Fahrt verdoppelt das Startkapital. Damit liegt Phase I im Zielkorridor oder leicht darüber.
Der Kleinwagen (8.000 €) ist nach etwa zwei Fahrten erreichbar, also an Tag 1. Die Spreizung der Preise zwischen
Städten (Faktor 3 bei Kokain) ist jedoch sehr groß. → Sobald `verify.py` steht, prüft Szenario S2, ob der Route-Dominanz-Index
eingehalten wird (siehe Abschnitt 2).

---

## 2. Welche Handelsrouten sind besonders profitabel?

### Fragestellung
Welche (Ware, Start, Ziel)-Kombinationen liefern den höchsten Gewinn pro Zeit? Gibt es eine einzelne Route,
die alle anderen dominiert?

### Modell
Gewinn pro Tick einer Route r bei Menge q:

$$
G_r(q) = \frac{\int_0^{q} P^{sell}_{B}(x)\,dx - \int_0^{q} P^{buy}_{A}(x)\,dx - K_{Reise}(d) - p_{bust}(d,H,q)\cdot V_{Verlust}(q)}{T_{Reise}(d) + T_{Rückweg}}
$$

- $K_{Reise}$: Bahn (`travel.train_price_per_km`) oder Treibstoff (`vehicles.*.consumption` × `city.*.fuel_price`).
- $p_{bust}$: Kontrollwahrscheinlichkeit nach Formel von Agent 2 (Segmente, Heat, Ladung, `hide`).
- $V_{Verlust}$: Strafe (`travel.fine_rate`) plus erwartete Beschlagnahme oder Bestechung.
- Rückweg: leer, oder als **Rundkurs** mit einer zweiten Ware beladen (Optimierer-Bot).

**Routen-Gewinnpool.** Die Nachfrage einer Stadt erholt sich nur mit der Rate von `economy.reversion_rate`. Daher hat jede
Route einen begrenzten Gewinn pro Tag, den sich alle Spieler auf dieser Route teilen:

$$
\text{Pool}_r \approx \text{Marge}_r \cdot D_{B} \cdot 144
$$

### Messgrößen
- Vollständige Routenmatrix: 12 Waren × 8 × 7 Städtepaare (Erde) plus Weltraum, je Fahrzeugstufe.
- `RDI` = $G_{best} / \text{median}(G_r \mid G_r > 0)$.
- Anteil profitabler Routen nach Kosten und Risiko.
- Sättigungskurve: Gewinn pro Spieler in Abhängigkeit von der Zahl N der Spieler auf derselben Route.
- Rang-Stabilität: Wie oft wechselt die beste Route im Zeitverlauf (Events, Konkurrenz)?

### Zielkorridore

| KPI | Ziel |
|---|---|
| `RDI` je Fahrzeugstufe | 1,5–2,0 (> 2,5 = rot) |
| Anteil profitabler Routen | ≥ 40 % |
| Beste Route nach Sättigung durch 10 Bots | fällt unter die zweitbeste Route ohne Konkurrenz |
| Häufigkeit eines Wechsels der besten Route | mindestens 1× pro Spieltag |
| Risikoaufschlag: Waren mit höchstem `heat` | höchstes $G$ **vor** Risiko, nicht zwingend **nach** Risiko |

### Simulationsszenario
- `S2a-route-matrix`: statische Auswertung aller Routen, ohne Bots und deterministisch. Das ist schnell genug für jeden PR.
- `S2b-route-saturation`: N ∈ {1, 5, 10, 25, 50} Greedy-Händler starten in derselben Stadt. Gemessen wird der Gewinn pro Bot.

### Stellschrauben
`city.*.supply`, `city.*.demand`, `goods.*.consumption`, `goods.*.heat`, `travel.control_base`,
`travel.fine_rate`, `distances`, `economy.reversion_rate`.

### Überschlag (illustrativ)
München nimmt etwa 13,4 Einheiten Kokain pro Tick auf, also ≈ 1.930 pro Tag. Der **Gewinnpool** der Route
Rotterdam → München beträgt damit ≈ 1.930 × 93 € ≈ **180.000 € pro Tag**, und alle Spieler auf dieser Route teilen ihn.
Ein einzelner Transporter (1.500 Vol.) würde den Zielbestand Münchens (~970 Einheiten) mehr als verdoppeln.
Die Route sättigt also früh, und genau das ist gewünscht (siehe Abschnitt 6).

### Bei wenigen Spielern / ohne Reset
Mit 10–30 Spielern auf 8 Städten und 12 Waren treffen sich Händler selten auf derselben Route. Ein Gewinnpool
von ≈ 180.000 € pro Tag gehört dann praktisch einem einzigen Spieler. Die Folgen:
- `S2b-route-saturation` ist anfangs weniger wichtig. Wichtiger ist, dass **ein einzelner Spieler** eine Route
  durch seine eigene Slippage und die Erholungszeit $T_{1/2}$ selbst sättigt. Wer die Route zu oft fährt, findet
  schlechtere Preise vor und muss rotieren.
- **Vorschlag N-1 (an Agent 2): NPC-Händler.** Simulierte Konkurrenten, die profitable Routen mit einer festen Rate
  abschöpfen. Ihre Rate sinkt, wenn mehr echte Spieler aktiv sind. So bleibt der Markt bei wenigen Spielern
  lebendig, und die Balance verschiebt sich nicht, wenn die Spielerzahl wächst.
- Zielkorridor zusätzlich: Gewinn pro Fahrt eines einzelnen Spielers bei 10 Spielern ≤ 1,3 × bei 100 Spielern.

---

## 3. Wie stark beeinflusst ein Einkauf den Marktpreis?

### Fragestellung
Wie groß sind Slippage und Preisänderung bei Orders verschiedener Größe? Wie schnell erholt sich der Markt?

### Modell
Bei konstanter Elastizität ε gilt für einen Kauf, der den Anteil $f = q/S$ des Bestands abräumt:

$$
\frac{P_{nach}}{P_{vor}} = (1-f)^{-\varepsilon},
\qquad
\text{Slip}(f) = \frac{1-(1-f)^{1-\varepsilon}}{(1-\varepsilon)\,f} - 1
$$

Die Erholung folgt der Mean-Reversion des Bestands mit der Rate λ:

$$
T_{1/2} = \frac{\ln 2}{\lambda}\ \text{Ticks}
$$

Ein **Rund-Trip** (Kauf q und sofortiger Rückverkauf q in derselben Stadt) muss immer Verlust bringen:

$$
L_{RT}(q) = q\cdot P\cdot\big(s_{eff} + \text{Slip}_{buy} + \text{Slip}_{sell}\big) > 0
$$

$s_{eff}$ ist der Spread **nach** Skill-Rabatt: `spread_base · (1 − min(L·handel_spread_reduction, cap))`.

### Werte aus den aktuellen Parametern (ε = 0,5, λ = 0,02)

| Order (Anteil am Bestand) | Preis danach | Ø Slippage |
|---|---|---|
| 1 % | +0,5 % | +0,3 % |
| 5 % | +2,6 % | +1,3 % |
| 10 % | +5,4 % | +2,6 % |
| 25 % | +15,5 % | +7,2 % |
| 50 % | +41,4 % | +17,2 % |

Daraus folgt $T_{1/2}$ = ln 2 / 0,02 ≈ **35 Ticks ≈ 5,8 h**.

### Zielkorridore

| KPI | Ziel | Aktuell (A-1) |
|---|---|---|
| Ø Slippage einer Neulings-Order (2.000 €) | < 1 % | ✅ ~0,1–0,5 % |
| Ø Slippage einer vollen Kleinwagen-Ladung im Zielmarkt | 3–10 % | ✅ ~5–10 % (München, Kokain) |
| Preisänderung bei 25 % des Bestands | +10–25 % | ✅ +15,5 % |
| $T_{1/2}$ | 12–48 Ticks (2–8 h) | ✅ 35 Ticks |
| $L_{RT}$ bei maximalem Skill (`spread` effektiv 4 %) | > 0 für jedes q | ✅ 4 % + Slippage |
| Gewinn durch Aufkaufen (Cornering) und späteren Verkauf | < Gewinn durch normalen Handel | zu simulieren (S3b) |

### Simulationsszenario
- `S3a-impact-sweep`: Für jede Ware und Stadt Orders mit $f \in [0{,}001;\ 0{,}9]$ (Grenze `trade.max_trade_share`).
  Gemessen werden Slippage, Preisänderung und Erholungskurve über 144 Ticks.
- `S3b-cornering`: Ein Wal-Bot mit sehr viel Kapital kauft eine Ware in einer Stadt komplett auf
  und versucht, über künstliche Knappheit Gewinn zu machen. Erfolgskriterium: nicht profitabler als normaler Handel.

### Stellschrauben
`economy.elasticity`, `economy.reversion_rate`, `economy.cover_ticks`, `trade.spread_base`,
`trade.max_trade_share`, `professions.handel_spread_reduction_cap`.

### Befund B-3
Mit den aktuellen Parametern liegen alle Impact-KPIs im Korridor. Kritisch bleibt die Annahme **A-3**. Wenn das Backend den Bestand
erst am Tick-Ende fortschreibt, kann man jede Slippage durch Order-Splitting umgehen.

---

## 4. Wie viel Kapital braucht ein Spieler für den nächsten Entwicklungsschritt?

### Fragestellung
Welche Kosten haben die Entwicklungsschritte, und wie lange braucht ein Spieler mit dem Einkommen seiner aktuellen Stufe dafür?

### Modell

$$
TTM(m) = \frac{K(m) - NW_{frei}}{\text{Einkommen pro Tag}(\text{aktuelle Stufe})}
\qquad
\text{Amortisation}(m) = \frac{K(m)}{\Delta\text{Einkommen pro Tag durch } m}
$$

Ein gutes Progressionsgefühl entsteht, wenn die **Amortisationszeit** jedes Schritts in einem Korridor bleibt.
Die Kosten dürfen schneller wachsen als das Einkommen, aber nur moderat. Ziel: Kosten ×2–3 pro Stufe,
Einkommen ×1,5–2.

### Entwicklungsleiter (aus `parameters.toml`)

| # | Schritt | Kosten | Weitere Bedingung | Ziel-TTM aktiv (4 h/Tag) | Ziel-TTM casual (1 h/Tag) |
|---|---|---|---|---|---|
| 1 | Kleinwagen | 8.000 € | – | Tag 1 | Tag 1–2 |
| 2 | Pistole + Weste | 5.500 € | – | Tag 1–2 | Tag 2–3 |
| 3 | Transporter | 25.000 € | – | Tag 2–4 | Tag 4–7 |
| 4 | Erster Betrieb (Waschsalon) | 60.000 € | Weißgeld | Woche 1–2 | Woche 2–3 |
| 5 | Clan gründen | 50.000 € Weißgeld | Level-Summe 15 | Woche 2–3 | Woche 3–5 |
| 6 | Sportwagen / LKW | 60.000–90.000 € | LKW: Schmuggel L5 | Woche 2–4 | Woche 4–6 |
| 7 | Bordell | 500.000 € | Finanzen L5 | Woche 4–8 | Woche 8–12 |
| 8 | Weltraum | 5 Mio. € Nettovermögen + Shuttle 500.000 € | Schmuggel L10, Raumhafen | Monat 2–3 | Monat 4–6 |

### Messgrößen
- `TTM(m)` je Spielertyp (Median, P10, P90).
- Amortisationszeit je Schritt.
- **Leerlauf-Anteil**: Zeitanteil, in dem ein Spieler mehr als 3 Tage auf den nächsten Schritt spart (Frustindikator).
- Übersprungene Schritte: Anteil der Bots, die einen Schritt auslassen, weil er sich nicht lohnt.

### Zielkorridore

| KPI | Ziel |
|---|---|
| Amortisation Fahrzeuge | 0,5–3 Spieltage |
| Amortisation Betriebe | 20–120 Tage (`real_estate.roi_target_*`). Der Waschwert zählt als Ertrag. |
| Leerlauf-Anteil aktiver Spieler in den ersten 30 Tagen | < 20 % |
| Übersprungene Schritte | kein Schritt wird von > 50 % der Bots ausgelassen |

### Simulationsszenario `S4-progression`
Je Spielertyp 50 Bots, 120 Tage. Jeder Bot kauft nach seiner Policy, sobald er es sich leisten kann.
Protokolliert werden Kaufzeitpunkte und das Einkommen vor und nach dem Kauf.

### Stellschrauben
`vehicles.*.price`, `businesses.*.price/income/upkeep`, `unlocks.*`, `clans.founding_cost`,
`professions.xp_per_level_k`, `professions.*_xp_*`.

### Überschlag & Befund B-4 (vorläufig, wichtig)

| Investition | Ertrag pro Tag | Amortisation |
|---|---|---|
| Kleinwagen 8.000 € | +22.000 € pro Fahrt gegenüber Rucksack | **< 1 Fahrt** |
| Waschsalon 60.000 € | (15 € − 9 €) × 144 = 864 € | 69 Tage |
| Bar 150.000 € | 1.872 € | 80 Tage |
| Bordell 500.000 € | 6.480 € | 77 Tage |

Eine **einzige** Kleinwagen-Fahrt bringt mehr als vier Tage Bordell-Ertrag. Pro investiertem Euro und Tag
liegt die Rendite eines Betriebs (~1,3 %) um mehr als den Faktor 100 unter der eines Fahrzeugs. Betriebe lohnen
sich damit nur als **Waschkapazität**, nicht als Einkommensquelle.
Das ist nur dann gewollt, wenn Weißgeld der eigentliche Engpass für den Fortschritt ist (Clan, Weltraum).
→ Vorschlag an Agent 2: In Szenario S4 messen, ob Bots ab Woche 3 überhaupt Betriebe kaufen. Falls nicht, gibt es zwei
Hebel: Erstens die Spreizung zwischen den Städten senken (z. B. `elasticity` 0,5 → 0,35 oder die Multiplikatoren `supply`/`demand` reduzieren).
Zweitens die Betriebserträge an die Vermögensentwicklung koppeln.

Die XP-Kurve (`XP = 100 · L²`, Handel 0,01 XP pro €) braucht für Handel L10 1 Mio. € Umsatz und für L20 4 Mio. €.
Bei ~28.000 € Gewinn je Kleinwagen-Fahrt (Umsatz ≈ 44.000 €) entspricht L10 etwa 23 Fahrten. Das passt zu „Woche 1–2“.

---

## 5. Wie stark dürfen Überfälle sein?

### Fragestellung
Wie viel darf ein Überfall erbeuten, damit PvP spannend ist, Händler aber nicht dauerhaft ausgeplündert werden?

### Modell
**Erwartungswert für den Angreifer pro Angriff:**

$$
EV_{A} = p_{win}\cdot\big(r_{cash}\cdot C_{bar} + r_{goods}\cdot V_{Ladung}\big) - (1-p_{win})\cdot V_{Verlust,A} - K_{Heat} - K_{Ausfall}
$$

mit $p_{win} = \dfrac{K_A^{\alpha}}{K_A^{\alpha} + (b_{def} K_D)^{\alpha}}$, geklemmt auf [`win_chance_min`, `win_chance_max`].
$K_{Ausfall}$ steht für entgangenes Handelseinkommen durch Krankenhaus (`hospital_ticks`) und Cooldowns.

**Verlust des Opfers pro Tag** bei n Angriffen (Ziel-Cooldown `target_cooldown_ticks` = 36 → n ≤ 4/Tag):

$$
\text{Verlust}_{Tag} = C_{bar}\cdot\big(1-(1-p_{win}\,r_{cash})^{n}\big)
\qquad
VLQ = \frac{\text{Verlust}_{Tag}}{\text{Tageseinkommen}}
$$

### Messgrößen
- `VLQ` je Opferprofil (Händler ohne Waffe, bewaffneter Händler, Bankspieler).
- `EV_A / IPH_Handel`: Wie lohnend ist Rauben im Vergleich zu Handeln bei gleicher Spielzeit?
- Anteil der Überfälle, die gegen Spieler unter der Neulingsschutzschwelle versucht werden (sollte 0 sein).
- Abwanderungs-Proxy: Anteil der Bots, deren `NW` über 3 Tage durch PvP sinkt.

### Zielkorridore

| KPI | Ziel |
|---|---|
| `VLQ` eines ungeschützten Händlers (worst case, 4 Angriffe pro Tag) | ≤ 1,0 |
| `VLQ` eines Händlers, der Bank und Ausrüstung nutzt | ≤ 0,25 |
| `EV_A / IPH_Handel` gegen ungeschützte Ziele | 1,0–1,5 (Rauben lohnt sich) |
| `EV_A / IPH_Handel` gegen gleichstarke, ausgerüstete Ziele | 0,3–0,8 (lohnt sich nicht als Hauptberuf) |
| Maximaler Einzelverlust | ≤ 25 % des Bargelds, Bank und Weißgeld nie |
| Neulinge (in Schutzzeit) mit PvP-Verlust | 0 % |

### Leitplanken (vorhanden ✅ / vorgeschlagen ➕)
- ✅ Beute nur aus Schwarzgeld in bar und Ladung (`loot_cash_rate`, `loot_goods_rate` = 25 %).
- ✅ Vermögensband: Das Ziel muss mindestens 50 % des Angreifer-Vermögens besitzen (`networth_band`).
- ✅ Ziel-Cooldown 6 h, Angriffs-Cooldown 30 min, Heat für den Angreifer.
- ✅ Neulingsschutz: 7 Tage bzw. 50.000 € Nettovermögen.
- ➕ **Tages-Beutecap pro Opfer**: Die Summe aller Verluste eines Opfers durch PvP in 24 h ≤ 35 % seines Bargelds zu Beginn
  des Zeitfensters. Ohne diese Grenze verliert ein Opfer bei 4 Angriffen bis zu 68 % (1 − 0,75⁴).
- ➕ **Abnehmende Beute** für denselben Angreifer gegen dasselbe Opfer: 100 % / 50 % / 25 % innerhalb von 72 h.
- ➕ **Beute-Senke**: 10–20 % der Beute verschwinden (Hehlerabschlag). Damit hat PvP keine Geldbilanz von null mehr,
  sondern wird zur Geldsenke, und das Farmen mit Zweitaccounts wird teurer ([E-04](exploit-catalog.md#e-04-multi-account-feeding)).

### Bei wenigen Spielern / ohne Reset
Mit wenigen Spielern, Vermögensband, Neulingsschutz und Cooldowns gibt es oft **gar kein gültiges Ziel**.
Rauben wird dann zur Sackgasse, und das Betätigungsfeld Gewalt verliert seinen Sinn. Gleichzeitig trifft jeder
Angriff einen großen Teil der kleinen Community, und Frust wirkt stärker.
- KPI zusätzlich: **Ziel-Verfügbarkeit** = Anteil der Online-Ticks eines Räubers, in denen mindestens ein gültiges
  Ziel existiert. Ziel ≥ 30 % bei 30 Spielern.
- **Vorschlag N-2 (an Agent 2): NPC-Ziele und NPC-Gegner.** Dazu gehören NPC-Kuriere und rivalisierende Banden als Ziele
  für Gewalt-Spieler sowie NPC-Überfälle auf Händler als Risiko. Echte PvP-Angriffe bleiben möglich, sind aber nicht die einzige Quelle.
  NPC-Beute ist eine Geldquelle und muss in der Geldbilanz (I-1) erscheinen.

### Simulationsszenario `S5-raids`
50 Händler (verschiedene Schutzprofile) und 10 Räuber-Bots, 30 Tage, Variation über
`loot_cash_rate` ∈ {0,10; 0,15; 0,25; 0,35} und `alpha` ∈ {1,0; 1,5; 2,0}.

### Stellschrauben
`combat.loot_cash_rate`, `combat.loot_goods_rate`, `combat.alpha`, `combat.target_cooldown_ticks`,
`combat.networth_band`, `combat.heat_attack`, `combat.hospital_ticks`, Waffen- und Rüstungspreise.

---

## 6. Wie verhindern wir, dass erfahrene Spieler neue Spieler dauerhaft dominieren?

### Fragestellung
Wie bleibt das Spiel für Neueinsteiger in einer persistenten Welt attraktiv, in der Veteranen
Monate Vorsprung haben?

### Leitprinzip
**Vorsprung im Vermögen ist erlaubt, Kontrolle über Neulinge nicht.** Wir vergleichen deshalb das
**Einkommen pro Stunde** (`GAP14`) und nicht das Vermögen. Außerdem darf ein Veteran einem Neuling weder
durch Gewalt noch durch Marktmacht die Grundlage entziehen.

### Werkzeuge

| # | Mechanik | Wirkt gegen | Status |
|---|---|---|---|
| D-1 | Sinkende Kapitalrendite (Markttiefe, Abschnitt 1) | Schneeballeffekt | ✅ systemisch |
| D-2 | Vermögensband für Angriffe (`networth_band`) | Veteranen jagen Neulinge | ✅ |
| D-3 | Neulingsschutz (Zeit **und** Vermögen) | frühe Frustration | ✅ |
| D-4 | Markt-Fairness: Gewinnpool pro Route, Slippage, `max_trade_share` | Wal kauft Markt leer | ✅ teilweise |
| D-5 | ➕ Pro-Spieler-Limit pro Markt und Tick (z. B. ≤ 25 % des Zielbestands je Stunde) | Cornering, Ausdünnung | Vorschlag |
| D-6 | ➕ Progressiver Unterhalt / Vermögens-Senken (Ausbau, Clan, Weltraum) | Inflation, Abheben der Top 1 % | **Pflicht** (R-2) |
| D-7 | ➕ Aufhol-XP: XP-Bonus, wenn das Level unter dem Server-Median liegt (z. B. +50 %, abnehmend) | dauerhafter Skill-Rückstand | **Pflicht** (R-2) |
| D-8 | Clan-Größenlimit (`member_base` + `member_per_level`) und Bezirksbegrenzung | Monopol-Clans | ✅ |
| D-9 | ➕ Zeitraum-Ranglisten **ohne Welt-Reset**: „Aufsteiger der Woche/des Monats“ (Zuwachs von `NW` oder `IPH` statt Bestand), Ranglisten je Altersklasse des Accounts | Neulinge haben keine Chance auf Ruhm | Vorschlag (R-2: keine Resets) |
| D-10 | Veteranen-Inhalte (Weltraum) entziehen Veteranen den Erdmärkten | Veteranen besetzen Einsteiger-Routen | ✅ systemisch |

### Messgrößen
- `Gini`, `Top1%`, `Top10%` des Nettovermögens aktiver Spieler (aktiv = Login in den letzten 7 Tagen).
- `GAP14`: IPH eines Neulings an Tag 14 ÷ IPH eines Veteranen (Tag 90+).
- Markt-Verdrängung: Gewinn pro Fahrt eines Neulings mit vs. ohne Veteranen in derselben Stadt.
- Neulings-Bindung: Anteil der Neulings-Bots, die Tag 14 mit wachsendem `NW` erreichen.

### Zielkorridore

| KPI | Ziel |
|---|---|
| `Gini` (aktive Spieler, Tag 90) | 0,45–0,65 |
| `Top1%` | ≤ 20 % |
| `GAP14` | ≥ 0,25 (Neuling verdient pro Stunde mindestens ¼ des Veteranen) |
| Markt-Verdrängung durch Veteranen | ≤ 20 % weniger Gewinn pro Fahrt |
| Neulings-Bindung | ≥ 90 % |

### Bei wenigen Spielern / ohne Reset
Ohne Resets ist `S6-late-joiner` das **wichtigste** Szenario. Jeder Spieler, der nach den ersten Wochen kommt,
trifft auf Veteranen mit Monaten oder Jahren Vorsprung, und das bleibt dauerhaft so.
- Gini und Top-1 % sind bei 10–30 Spielern statistisch wenig aussagekräftig (1 % von 30 Spielern ist kein Spieler).
  Bei weniger als 100 Spielern gelten daher **Rangmaße**: Vermögen des reichsten Spielers ÷ Median (Ziel ≤ 20 im ersten Jahr)
  und `GAP14`.
- Die Vermögensunterschiede dürfen wachsen, die **Einkommenslücke pro Stunde** (`GAP14`) nicht. Sie wird deshalb an
  Tag 30, 180 und 365 nach Serverstart gemessen und muss jedes Mal ≥ 0,25 sein.
- Senken, die mit dem Vermögen wachsen (D-6), und Aufhol-XP (D-7) ersetzen den Reset als Gleichmacher.
  Ohne sie wäre die Welt nach einem Jahr für Neue kaum attraktiv.

### Simulationsszenario `S6-late-joiner`
Ein Server läuft mit 30 Bots. An Tag 30, 180 und 365 kommen jeweils 10 Neulinge hinzu. Gemessen wird deren
Entwicklung über 30 Tage im Vergleich zu einer Kontrollgruppe, die an Tag 0 auf einem frischen Server startet.

### Stellschrauben
`combat.networth_band`, `combat.newbie_protection_*`, `trade.max_trade_share`, `clans.member_*`,
`clans.district_*`, die vorgeschlagenen neuen Parameter für D-5, D-6, D-7, D-9 (Schlüssel durch Agent 2 festzulegen).

### Befund B-6 (vorläufig)
Das Vermögensband `networth_band = 0,5` verhindert sehr wirksam, dass reiche Spieler arme angreifen.
Gleichzeitig öffnet es zwei Lücken: Wer sein Vermögen klein hält, kann jeden Reicheren angreifen. Und Zweitaccounts mit wenig Vermögen
sind ideale Räuber ([E-04](exploit-catalog.md#e-04-multi-account-feeding), [E-11](exploit-catalog.md#e-11-neulingsschutz-missbrauch--vermögens-parken)).

---

## 7. Wie verhindern wir wirtschaftliche Exploits?

### Methodik
1. **Invarianten statt Einzelfälle.** Jede Simulation prüft nach jedem Tick:
   - **I-1 Geldbilanz:** $\Delta M = \sum \text{Quellen} - \sum \text{Senken}$ (ganzzahlig in Cent, exakt).
   - **I-2 Warenbilanz:** $\Delta\text{Waren} = \text{Produktion} + \text{NPC-Angebot} - \text{Konsum} - \text{Verderb} - \text{Beschlagnahme}$.
   - **I-3 Kein Rund-Trip-Gewinn:** Kauf und Rückverkauf ohne Zeitverzug in derselben Stadt bringen nie einen Gewinn.
   - **I-4 Keine negativen Bestände**, kein Überlauf, Preise innerhalb `[price_min_factor, price_max_factor] · P_base`.
   - **I-5 Determinismus:** Gleicher Seed und gleiche Eingaben ergeben einen identischen Endzustand (Hash-Vergleich).
2. **Adversariale Bots** suchen gezielt nach Gewinnen, die gegen die Invarianten verstoßen oder unverhältnismäßig sind
   ([player-archetypes.md](player-archetypes.md#adversariale-bots)).
3. **Anomalie-Erkennung** vergleicht live mit dem Sim-Modell: Spieler mit `IPH` > P99,9 der Simulation werden zur Prüfung markiert.
4. **Katalog:** Alle bekannten Exploit-Klassen mit Gegenmaßnahme und Test stehen in [exploit-catalog.md](exploit-catalog.md).

### Zielkorridore

| KPI | Ziel |
|---|---|
| Verletzungen von I-1 bis I-5 | 0 (harter Fehler im CI) |
| Bester Exploit-Bot `IPH` ÷ bester regulärer Bot | ≤ 1,1 |
| Live-Spieler über P99,9 des Sim-`IPH` | manuelle Prüfung binnen 24 h |

---

## 8. Zusammenfassung der vorläufigen Befunde

| ID | Befund | Empfehlung | An |
|---|---|---|---|
| B-1 | Start sehr schnell: eine Fahrt verdoppelt das Startkapital | ok für Phase I. Phase II/III per S1 messen | Agent 2 |
| B-3 | Impact-Werte im Korridor, aber nur bei sofortiger Bestandsänderung | A-3 verbindlich in der Backend-Implementierung | Agent 3 |
| B-4 | Kapitalrendite von Betrieben liegt unter 1/100 der Rendite von Fahrzeugen | in S4 prüfen, ob Bots Betriebe kaufen. Ggf. Spreizung senken oder Erträge skalieren | Agent 2 |
| B-5 | Opfer kann bis zu 68 % des Bargelds pro Tag verlieren | Tages-Beutecap und abnehmende Beute ergänzen | Agent 2 |
| B-6 | Vermögensband schützt Arme, begünstigt aber kleine Zweitaccounts | Schutz an Account-Alter, Level-Summe und Zweitaccount-Erkennung koppeln | Agent 2, 3 |
| B-7 | Bei wenigen Spielern teilt sich kaum jemand eine Route, und Räuber finden kaum gültige Ziele (R-1) | NPC-Händler (N-1) und NPC-Ziele/-Gegner (N-2) | Agent 2 |
| B-8 | Ohne Reset wachsen Geldmenge und Vorsprung unbegrenzt (R-2) | Senken, die mit dem Vermögen wachsen (D-6), und Aufhol-XP (D-7) sind Pflicht. Ranglisten für Zeiträume statt Resets (D-9) | Agent 2 |

## 9. Offene Fragen

1. Endgültige Preis- und Spread-Formeln (A-1, A-2) → Agent 2.
2. Wird der Bestand pro Order sofort fortgeschrieben (A-3)? → Agent 3.
3. ~~Gibt es Saisons bzw. Server-Resets?~~ → **Nein** (R-2).
4. ~~Wie viele aktive Spieler werden pro Server erwartet?~~ → **Anfangs wenige** (R-1). Offen: Ab welcher Spielerzahl
   sollen NPC-Mechaniken (N-1, N-2) zurückgefahren werden?
