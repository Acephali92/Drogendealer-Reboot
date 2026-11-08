# Weltraum – Fortgeschrittene Spielwelt und besondere Waren

## 1. Zweck & Spielgefühl

Der Weltraum ist das **Endgame**: Wer genug Kapital und Schmuggelerfahrung hat, startet vom Raumhafen
Frankfurt zu Orbitalstation, Mond, Mars und Asteroidengürtel. Dort gibt es **Spezialwaren** mit hohen
Margen, lange Reisen, teuren Treibstoff und **Piraten** statt Polizei. Der Weltraum nutzt dieselben
Formeln wie die Erde (Wirtschaft, Handel, Kampf) – nur mit eigenen Parametern.

## 2. Zustandsvariablen

| Feld | Typ | Bemerkung |
|---|---|---|
| Raumschiff je Spieler | enum / null | zusätzlich zum Erd-Fahrzeug |
| Standort | Stadt-ID oder Weltraum-ID | `orbit`, `mond`, `mars`, `ceres` |
| Märkte der Weltraumorte | wie [economy.md](economy.md) | Bestand, Rauschen, Ereignisse |
| Flug | wie Reise in [travel.md](travel.md), mit Piratenplan statt Kontrollplan | – |

## 3. Parameter

### 3.1 Orte (`space_location.<id>.*`)

| Ort | pop (Tsd.) | $W$ | $\pi$ | Deuterium (ct/Einheit) | Gefahr | Angebot $m_s$ | Nachfrage $m_d$ |
|---|---:|---:|---:|---:|---:|---|---|
| Orbitalstation Hafen Eins | 200 | 1,5 | 0,10 | 1 500 | 0,1 | Nullgrav 2,0 · Kokain 0,5 | Sternenstaub 3 · Mondkristall 2 · Marsmoos 2 · Kokain 4 |
| Selene-Basis (Mond) | 300 | 1,2 | 0,05 | 1 800 | 0,3 | Mondkristall 3,0 · Gras 0,5 | Sternenstaub 2 · Gras 4 |
| Ares-Kolonie (Mars) | 1 000 | 1,2 | 0,05 | 2 000 | 0,5 | Marsmoos 3,0 · Kokain 0,5 | Sternenstaub 3 · Nullgrav 2 · Kokain 4 |
| Ceres-Depot | 150 | 0,8 | 0,00 | 2 500 | 1,0 | Sternenstaub 3,0 | Marsmoos 3 · Nullgrav 2 |

Weltraumwaren (`realm = "space"`) sind an allen Weltraumorten handelbar (fehlende Multiplikatoren = 1,0).
Erdwaren nur dort, wo beide Multiplikatoren gesetzt sind. Auf der Erde sind Weltraumwaren ausschließlich in
Frankfurt handelbar (`city.frankfurt.supply.sternenstaub` = 0,2, `city.frankfurt.demand.sternenstaub` = 1,0).

Distanzen (`space_distances`, in Tkm = 1 000 km): Orbit–Mond 384, Orbit–Mars 78 000, Mond–Mars 78 000,
Mars–Ceres 190 000, Orbit–Ceres 263 000, Mond–Ceres 263 000. Erde ↔ Orbit ist ein fester Start bzw. eine Landung.

### 3.2 Raumschiffe (`ships.<id>.*`)

| Schiff | Preis (Weißgeld) | Tkm/h | Deuterium / 100 Tkm | Kapazität | Kampfkraft | Reichweite |
|---|---:|---:|---:|---:|---:|---:|
| Shuttle | 500 000 € | 200 | 2,0 | 200 | 20 | 500 Tkm (nur Orbit ↔ Mond) |
| Frachter | 3 000 000 € | 10 000 | 0,2 | 5 000 | 40 | 300 000 Tkm |
| Kreuzer | 8 000 000 € | 20 000 | 0,4 | 1 500 | 200 | 300 000 Tkm |

### 3.3 Globale Parameter (`space.*`)

| Symbol | Schlüssel | Default | Bedeutung |
|---|---|---|---|
| $T_{launch}$ | `space.launch_ticks` | 3 | Start/Landung Frankfurt ↔ Orbit |
| – | `space.launch_fee` | 5 000 € | Start- bzw. Landegebühr |
| $q_0$ | `space.piracy_base` | 0,03 | Piratenrisiko je Segment |
| – | `space.piracy_segment_ticks` | 24 | ein Segment je 4 h Flugzeit |
| $K_{P,0}$ | `space.pirate_strength` | 120 | Piratenstärke bei Gefahr 1,0 |
| – | `space.pirate_loot_rate` | 0,5 | Anteil der Ladung, den Piraten nehmen |

## 4. Formeln

**F-SPC-01 – Freischaltung**

```math
\text{frei} \iff NW \ge 5\,000\,000\,€ \;\wedge\; L_{Schmuggel} \ge 10 \;\wedge\; \text{Standort} = \text{Raumhafen}
```

Schlüssel `unlocks.weltraum.networth`, `unlocks.weltraum.level`, `unlocks.weltraum.requires_spaceport`.
Danach kann ein Raumschiff (Weißgeld) gekauft werden.

**F-SPC-02 – Flugzeit**

```math
T = \begin{cases} T_{launch} & \text{Frankfurt} \leftrightarrow \text{Orbit} \\ \lceil d / v \cdot 6 \rceil & \text{sonst, nur wenn } d \le \text{Reichweite} \end{cases}
```

**F-SPC-03 – Flugkosten**

```math
C = \begin{cases} \text{launch\_fee} & \text{Frankfurt} \leftrightarrow \text{Orbit} \\ \lceil d/100 \cdot \text{Verbrauch} \cdot \text{Deuteriumpreis}_{Start} \rceil & \text{sonst} \end{cases}
```

Bei der **Landung in Frankfurt** findet genau eine Zollkontrolle nach F-TRV-04 statt
($n = 1$, $\bar\pi = \pi_{Frankfurt}$, Versteck 0, Heat in Frankfurt).

**F-SPC-04 – Piraten**

```math
n = \lceil T / 24 \rceil, \quad \bar g = \tfrac{1}{2}(\text{Gefahr}_A + \text{Gefahr}_B), \quad p_{seg} = \min\big(0{,}5;\; q_0 \cdot \bar g \cdot g(hv)\big)
```

```math
p_{Begegnung} = 1 - (1 - p_{seg})^n, \qquad K_{Schiff} = (\text{Schiffsstärke} + \textstyle\sum\text{Crew}) \cdot (1 + b_{Gewalt}), \qquad K_P = K_{P,0} \cdot \bar g
```

Bei einer Begegnung wird nach F-CMB-03 gekämpft ($K_A = K_{Schiff}$, $K_D = K_P$). Verliert der Spieler,
nehmen die Piraten 50 % jeder Ware (abgerundet) und die Crew erleidet Verluste nach F-CMB-04.
$g(hv)$ nach F-TRV-05: wertvolle Ladung zieht Piraten an.

Weltraummärkte nutzen unverändert F-ECO-01 bis F-ECO-09 und F-TRD-01 bis F-TRD-06.

## 5. Ablauf

```text
launch(player at frankfurt):
    require space_unlocked(...) and player.ship          # F-SPC-01
    pay launch_fee (Weißgeld); arrive orbit after 3 Ticks
fly(player, a, b):
    T = space_travel_ticks(a, b, ship)                   # F-SPC-02
    pay space_fuel_cost(a, b, ship)                      # F-SPC-03
    plan = [j for j in 1..n if U(seed, t, flight, j) < p_seg]   # F-SPC-04
    on first planned segment: pirate fight
land(player at orbit -> frankfurt):
    pay launch_fee; customs control (F-TRV-04, n = 1)
```

## 6. Grenzwerte & Edge-Cases

- Shuttle kann nur Orbit ↔ Mond fliegen (Reichweite 500 Tkm).
- Spieler im Weltraum können sich gegenseitig angreifen (gleiche Regeln wie [combat.md](combat.md)),
  der Heimbonus entfällt (keine Betriebe im All).
- Weltraumorte haben keine Viertel und keine Betriebe (Erweiterungspunkt).
- Polizei im All ist so schwach, dass keine Kontrollen stattfinden; Heat entsteht trotzdem (für die Rückkehr).

## 7. Beispielrechnungen

**EX-SPC-01 – Freischaltung**

| Fall | NW | Schmuggel | Ort | Ergebnis |
|---|---:|---:|---|---|
| a | 6 Mio. € | 12 | Frankfurt | **frei** |
| b | 6 Mio. € | 12 | Berlin | **gesperrt** (kein Raumhafen) |
| c | 4 Mio. € | 12 | Frankfurt | **gesperrt** (Vermögen) |

**EX-SPC-02 – Frankfurt → Orbit → Mars mit Frachter**

- Start: **3 Ticks**, Gebühr **500 000 ct**
- Orbit → Mars: $\lceil 78\,000 / 10\,000 \cdot 6 \rceil =$ **47 Ticks** (≈ 7,8 h),
  Deuterium $\lceil 780 \cdot 0{,}2 \cdot 1\,500 \rceil =$ **234 000 ct**

**EX-SPC-03 – Piratenrisiko Ceres → Orbit mit 230 Sternenstaub**

Frachter, 2 Profis, Gewalt L10:

- $T = \lceil 263\,000 / 10\,000 \cdot 6 \rceil =$ **158 Ticks**, $n = \lceil 158/24 \rceil =$ **7**
- Gefahr $\bar g = (1{,}0 + 0{,}1)/2 =$ **0,55**; $hv = 230 \cdot 50\,000 \cdot 3 / 100\,000 = 345$, $g =$ **1,8734**
- $p_{seg} = 0{,}03 \cdot 0{,}55 \cdot 1{,}8734 =$ **0,0309**, $p_{Begegnung} =$ **0,1973**
- $K_{Schiff} = (40 + 2 \cdot 20) \cdot 1{,}3 =$ **104,0**, $K_P = 120 \cdot 0{,}55 =$ **66,0**
- Siegchance **0,6642** → Verlustwahrscheinlichkeit $0{,}1973 \cdot (1 - 0{,}6642) =$ **0,0663**

Ein Kreuzer (Stärke 200) senkt das Verlustrisiko deutlich, transportiert aber weniger.

**EX-SPC-04 – Gleichgewichtspreise Sternenstaub**

| Ort | $P^{*}$ |
|---|---:|
| Ceres-Depot | **26 998,30 ct** |
| Orbitalstation | **97 804,31 ct** |
| Ares-Kolonie | **91 471,33 ct** |
| Frankfurt | **126 264,83 ct** |

**EX-SPC-05 – Route Ceres → Orbit → Frankfurt mit 230 Sternenstaub (Frachter)**

| Posten | Wert |
|---|---:|
| Marktbestand Ceres / Frankfurt ($S_{target}$) | **518,4** / **332,64** |
| Einkauf Ceres (F-TRD-01) | **−7 469 143 ct** |
| Verkauf Frankfurt (F-TRD-02) | **+23 984 549 ct** |
| Deuterium Ceres → Orbit | **−1 315 000 ct** |
| Landegebühr | **−500 000 ct** |
| Flugzeit gesamt | **161 Ticks** (≈ 27 h) |
| Gewinn ohne Piraten/Zoll | **14 700 406 ct** (≈ 147 000 €) |

Hinzu kommen Piratenrisiko (EX-SPC-03), die Zollkontrolle bei der Landung (Heat-Faktor 3,0!) und die
Rückreise. INV-11 prüft, dass diese Referenzroute profitabel bleibt.

### Weitere Gleichgewichtspreise im All (€)

| Ware | Frankfurt | Orbitalstation | Selene-Basis | Ares-Kolonie | Ceres-Depot |
|---|---:|---:|---:|---:|---:|
| Sternenstaub | 1262,65 | 978,04 | 746,86 | 914,71 | 269,98 |
| Mondkristall | 757,59 | 479,14 | 182,94 | 316,87 | 280,57 |
| Marsmoos | 505,06 | 319,43 | 211,24 | 121,96 | 323,98 |
| Nullgrav-Kapseln | 2020,24 | 638,86 | 844,98 | 1194,98 | 1058,11 |
| Kokain | 110,65 | 255,54 | – | 239,00 | – |
| Gras | 11,29 | – | 29,87 | – | – |

## 8. Balancing-Ziele

| Ziel | Umsetzung |
|---|---|
| Weltraum ist Endgame, kein Abkürzungsweg | 5 Mio. € NW, Schmuggel L10, Schiffe nur mit Weißgeld |
| Gewinn pro Reise ≫ Erde, Gewinn pro Stunde moderat höher | lange Flüge, Treibstoff, Gebühren |
| Risiko statt Polizei | Piraten, Gefahr steigt mit Entfernung |
| Erdwaren bleiben relevant | Kokain/Gras im All 2–5× teurer als auf der Erde |
| Märkte im All sind flach | kleine Bevölkerung → großer Preis-Impact |

## 9. Schnittstellen

| Richtung | System | Größe |
|---|---|---|
| ← | [economy.md](economy.md), [trade.md](trade.md) | Formeln unverändert |
| ← | [travel.md](travel.md) | Raumhafen, Zollkontrolle, $g(hv)$ |
| ← | [combat.md](combat.md) | Piratenkampf über F-CMB-03/04 |
| ← | [money-laundering.md](money-laundering.md) | Weißgeld für Schiffe und Gebühren |
| ← | [professions.md](professions.md) | Schmuggel-Level, Gewalt-Bonus |

## 10. Offene Fragen

- Betriebe im All (Bergbau auf Ceres, Gewächshäuser auf dem Mars)?
- Clan-Stationen als Endgame-Ziel für Clans?
- Soll der Zoll in Frankfurt mit Schmuggel-Level/Versteck reduzierbar sein?
