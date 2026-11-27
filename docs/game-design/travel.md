# Reisen – Fahrzeuge, Treibstoff, Reisekosten, Transportkapazität

## 1. Zweck & Spielgefühl

Reisen verbindet die Märkte. Es kostet **Zeit** (Echtzeit-Ticks), **Geld** (Treibstoff/Ticket) und birgt
**Risiko** (Polizeikontrollen). Fahrzeuge sind die wichtigste frühe Investition: mehr Kapazität, aber auch
mehr Ware, die man verlieren kann.

## 2. Zustandsvariablen

| Symbol | Bedeutung | Typ | Wertebereich |
|---|---|---|---|
| Reise | Start, Ziel, Fahrzeug, Abfahrt-Tick, Ankunft-Tick, Ladung | Datensatz | – |
| Kontrollplan | vorab gewürfelte Segment-Ticks mit Kontrolle | Liste int | – |
| Fahrzeugbesitz | Fahrzeug-ID je Spieler (genau eines aktiv) | enum / null | – |

Während einer Reise kann der Spieler **nicht handeln** und **nicht angegriffen** werden (unterwegs ist er
nur für Polizei bzw. Piraten erreichbar).

## 3. Parameter

### 3.1 Fahrzeuge (`vehicles.<id>.*`)

| Fahrzeug | Preis | km/h | l/100 km | Kapazität | Versteck | Freischaltung |
|---|---:|---:|---:|---:|---:|---|
| Bahn (kein Fahrzeug) | – | 120 | – (15 ct/km) | 0 (nur Rucksack 60) | 0 | – |
| Kleinwagen | 8 000 € | 100 | 6 | 300 | 0,10 | – |
| Transporter | 25 000 € | 85 | 10 | 1 500 | 0,00 | – |
| Sportwagen | 60 000 € | 150 | 12 | 150 | 0,20 | – |
| LKW mit Schmuggelversteck | 90 000 € | 75 | 30 | 6 000 | 0,30 | Schmuggel L5 (`unlocks.lkw.level`) |

Der Rucksack (`player.backpack_capacity`) kommt immer hinzu. Eine eigene Autowerkstatt erhöht das
Versteck um `businesses.autowerkstatt.hide_bonus` = 0,10.

### 3.2 Reise & Kontrolle (`travel.*`)

| Symbol | Schlüssel | Default | Bedeutung |
|---|---|---|---|
| $v_{Bahn}$ | `travel.train_speed` | 120 | km/h |
| $k_{Bahn}$ | `travel.train_price_per_km` | 15 | ct/km |
| $d_{seg}$ | `travel.segment_km` | 100 | Länge eines Kontrollsegments |
| $c_0$ | `travel.control_base` | 0,02 | Grundwahrscheinlichkeit je Segment |
| $p_{seg,max}$ | `travel.control_segment_max` | 0,5 | Obergrenze je Segment |
| $hv_{1/2}$ | `travel.cargo_heat_half` | 50 | Ladungsheat, bei dem $g = 1{,}5$ |
| $\Delta H_{bust}$ | `travel.heat_on_bust` | 30 | Heat in der Zielstadt nach Erwischtwerden |
| $r_{bribe}$ | `travel.bribe_cost_rate` | 0,5 | Bestechungskosten |
| – | `travel.bribe_base_success`, `travel.bribe_police_penalty` | 0,6 / 0,5 | Bestechungschance |

Distanzen: `distances."<a>-<b>"` (alphabetisch sortiert), z. B. Pleitenberg–Schmuddelhafen 289 km.

## 4. Formeln

**F-TRV-01 – Reisezeit**

```math
T = \Big\lceil \frac{d}{v} \cdot 6 \Big\rceil \text{ Ticks} \quad (6 = \text{Ticks pro Stunde})
```

Für die API gilt: Reisedauer in Sekunden = $T \cdot 600$. Dauer und Kosten sind keine festen Werte je
Verbindung, sondern hängen von Fahrzeug und Startstadt ab (F-TRV-01 bis F-TRV-03).

**F-TRV-02 – Treibstoffkosten (bezahlt bei Abfahrt in der Startstadt)**

```math
C_{fuel} = \Big\lceil d \cdot \frac{\text{Verbrauch}}{100} \cdot \text{Preis}_{Start} \Big\rceil
```

**F-TRV-03 – Bahnticket**

```math
C_{Bahn} = \lceil d \cdot k_{Bahn} \rceil
```

Mit der Bahn steht nur der Rucksack zur Verfügung.

**F-TRV-05 – Ladungsheat**

```math
hv = \frac{1}{100\,000} \sum_i q_i \cdot P_{base,i} \cdot h_i, \qquad g(hv) = 1 + \frac{hv}{hv + hv_{1/2}} \in [1, 2)
```

$hv$ misst, wie „auffällig“ die Ladung ist (≈ Basiswert in 1 000 € × Heat-Faktor). Ohne illegale Ladung
gibt es keine Konsequenz einer Kontrolle.

**F-TRV-04 – Kontrollwahrscheinlichkeit**

```math
p_{seg} = \min\Big(p_{seg,max},\; c_0 \cdot \Pi(\bar\pi, H_{Start}) \cdot g(hv) \cdot (1 - \text{hide}) \cdot (1 - b_{Schmuggel})\Big)
```

```math
n = \lceil d / d_{seg} \rceil, \qquad p_{Reise} = 1 - (1 - p_{seg})^n
```

- $\bar\pi$ = Mittel der Polizeistärke von Start- und Zielstadt, $\Pi$ nach F-CTY-02 mit dem Heat des Spielers
  in der **Startstadt**.
- $b_{Schmuggel} = \min(0{,}5;\; 0{,}025 \cdot L_{Schmuggel})$ (F-PRF-03).
- Bei Abfahrt wird für jedes Segment $j$ mit $U(\text{seed}, t_{Abfahrt}, \texttt{trip/<id>}, j) < p_{seg}$
  gewürfelt; die **erste** Kontrolle findet beim Tick $t_{Abfahrt} + \lceil T \cdot j / n \rceil$ statt.

**F-TRV-06 – Folgen einer Kontrolle (ADR-023)**

Eine Kontrolle **beschlagnahmt alles Mitgeführte**: alle Waren im Inventar (Rucksack und Fahrzeug) und das
**gesamte mitgeführte Bargeld** (Schwarzgeld $B$). Es gibt **keine zusätzliche Strafe und keine Schuld**.
Nicht betroffen sind das Bankkonto (Weißgeld), Lagerhaus-Bestände, Betriebe und das Fahrzeug selbst.

Basiswert der Ladung $V = \sum q_i \cdot P_{base,i}$. Der Spieler wählt:

| Option | Kosten | Erfolg | Folge bei Misserfolg |
|---|---|---|---|
| Bestechen (nur wenn $B \ge$ Kosten) | $C_b = \lceil r_{bribe} \cdot V \cdot (1 + \bar\pi) \rceil$ aus dem mitgeführten Bargeld | $p_b = \operatorname{clamp}(0{,}6 - 0{,}5\bar\pi + 0{,}015\,L_{Schmuggel},\; 0{,}05,\; 0{,}9)$ | Beschlagnahme von Ladung und restlichem Bargeld $B - C_b$; $C_b$ ist ohnehin weg |
| Kooperieren | – | – | Beschlagnahme von Ladung und Bargeld $B$ |

- Gelingt die Bestechung, behält der Spieler Ladung und $B - C_b$.
- Bei jeder Beschlagnahme: $H_{Ziel} \mathrel{+}= 30$. Die Reise wird fortgesetzt (mit leerem Laderaum).
- Bestechung ist nur aus **mitgeführtem** Bargeld möglich, nicht vom Bankkonto.
- Beschlagnahmtes Geld und beschlagnahmte Ware verlassen das Spiel (Geldsenke) und werden im Journal festgehalten.
- Ausweg nach einer Beschlagnahme: Das Bankkonto darf für den Wareneinkauf genutzt werden ([trade.md](trade.md)).
  Wer gar nichts mehr hat, kann den Kredithai nutzen (F-ML-10).

## 5. Ablauf

```text
function depart(player, from, to, vehicle):
    require not traveling, Ladung <= Kapazität (F-TRD-06)
    d = distance(from, to)
    pay fuel_cost or train_cost             # F-TRV-02 / F-TRV-03
    T = travel_ticks(d, speed)              # F-TRV-01
    p_seg = control_probability(...)        # F-TRV-04
    plan = [segment j for j in 1..n if U(seed, t, trip, j) < p_seg]
    schedule arrival at t + T, first control at plan[0] (if any)
on control tick: present choice (Timeout travel.control_decision_timeout_ticks = 3 -> "Kooperieren")
on arrival: player.city = to; xp.schmuggel += xp_gain(...)   # F-PRF-02, nur mit illegaler Ladung
```

## 6. Grenzwerte & Edge-Cases

- $p_{seg} \le 0{,}5$; kurze Strecken ($d \le 100$ km) haben genau ein Segment.
- Fahrzeugwechsel nur in einer Stadt, nicht während der Reise. Verkauf eines Fahrzeugs: `travel.vehicle_resale_rate` = 60 % des Kaufpreises.
- Reagiert der Spieler nicht innerhalb von `travel.control_decision_timeout_ticks` = 3 Ticks auf eine Kontrolle, gilt „Kooperieren“.
- Abbruch einer Reise ist nicht möglich (verhindert „Kontrolle sehen → abbrechen“).
- Der Kontrollplan wird bei Abfahrt fixiert – nachträgliche Heat-Änderungen wirken nicht.

## 7. Beispielrechnungen

**EX-TRV-01 – Pleitenberg → Schmuddelhafen (289 km)**

| | Kleinwagen | Bahn |
|---|---|---|
| Reisezeit | $\lceil 289/100 \cdot 6 \rceil =$ **18 Ticks** (3 h) | $\lceil 289/120 \cdot 6 \rceil =$ **15 Ticks** (2,5 h) |
| Kosten | $\lceil 289 \cdot 6/100 \cdot 185 \rceil =$ **3 208 ct** | $289 \cdot 15 =$ **4 335 ct** |

Die Bahn ist schneller und für kleine Mengen sinnvoll, der Kleinwagen billiger und transportiert 6× mehr.

**EX-TRV-02 – Kontrollrisiko Containerdam → Protzingen mit 200 Schneegestöber**

Transporter (Versteck 0), Heat in Containerdam 10, Schmuggel-Level 4, $d = 820$ km.

- $n = \lceil 820/100 \rceil =$ **9** Segmente, $\bar\pi = (0{,}45 + 0{,}8)/2 =$ **0,625**
- $hv = 200 \cdot 8000 \cdot 1{,}5 / 100\,000 =$ **24,0**, $g = 1 + 24/74 =$ **1,324324**
- $p_{seg} = 0{,}02 \cdot 0{,}625 \cdot 1{,}1 \cdot 1{,}324324 \cdot 1 \cdot 0{,}9 =$ **0,016389**
- $p_{Reise} = 1 - (1 - 0{,}016389)^9 =$ **0,138188** (≈ 13,8 %)

**EX-TRV-03 – Folgen einer Kontrolle auf dieser Route**

- Basiswert $V = 200 \cdot 8000 =$ **1 600 000 ct**
- Bestechung: $\lceil 0{,}5 \cdot 1\,600\,000 \cdot 1{,}625 \rceil =$ **1 300 000 ct**,
  Erfolg $0{,}6 - 0{,}3125 + 0{,}06 =$ **0,3475**
- Spieler mit 5 000 € Bargeld: Bestechung **nicht möglich** (False). Er verliert die Ladung und
  **500 000 ct** Bargeld, ohne weitere Strafe.
- Spieler mit 20 000 € Bargeld: Bestechung **möglich** (True). Gelingt sie, bleiben **700 000 ct** Bargeld
  und die Ladung; misslingt sie, ist alles weg.

Bestechung lohnt sich hier kaum – sie wird erst mit höherem Schmuggel-Level und in Städten mit schwacher
Polizei attraktiv. Wer mit viel Bargeld reist, riskiert es komplett; deshalb lohnt das Waschen vor der Fahrt
([money-laundering.md](money-laundering.md)).

**EX-TRV-04 – Wirtschaftlichkeit der Route (mit EX-TRD-01/02)**

| Posten | Wert |
|---|---:|
| Einkauf 200 Schneegestöber Containerdam | −1 126 303 ct |
| Verkauf 200 Schneegestöber Protzingen | +2 742 772 ct |
| Treibstoff $\lceil 820 \cdot 10/100 \cdot 200 \rceil$ | **−16 400 ct** |
| Reisezeit $\lceil 820/85 \cdot 6 \rceil$ | **58 Ticks** (9,7 h) |
| Gewinn ohne Kontrolle | **1 600 069 ct** |
| Erwartungswert $(1-p)R - C - C_{fuel} - p \cdot B$ bei $B$ = 3 000 € mitgeführtem Bargeld | **1 179 594 ct** |

## 8. Balancing-Ziele & Exploit-Analyse

| Ziel | Prüfung |
|---|---|
| Startroute mit Bahn und Startkapital rentabel | INV-04 (Plattenhausen → Pleitenberg, Turboflocken) |
| Jede Referenzroute deckt Treibstoff | INV-05 |
| Große Ladungen sind riskanter, aber nicht prohibitiv | $g < 2$ begrenzt den Ladungseffekt |
| Lange Routen = mehr Segmente = mehr Risiko | $n \propto d$ |

**Exploit „Ladung aufteilen auf viele Fahrten“:** $g$ ist konkav, kleine Ladungen haben relativ höheres Risiko
pro Euro; zusätzlich kostet jede Fahrt Zeit und Treibstoff. Aufteilen reduziert den Maximalverlust, nicht den
Erwartungswert – gewollte Risikoabwägung.

## 9. Schnittstellen

| Richtung | System | Größe |
|---|---|---|
| ← | [cities.md](cities.md) | Distanzen, Treibstoffpreise, $\pi$, Heat |
| ← | [professions.md](professions.md) | Schmuggel-Boni; → Schmuggel-XP |
| ← | [real-estate.md](real-estate.md) | Versteckbonus Autowerkstatt |
| → | [space.md](space.md) | Raumhafen Bankfurt als Übergang |

## 10. Offene Fragen

- Zwischenstopps / Routen über mehrere Städte?
- Mietfahrzeuge für Spieler ohne Kapital?
