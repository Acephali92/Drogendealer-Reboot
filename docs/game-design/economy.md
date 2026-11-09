# Wirtschaft – Angebot, Nachfrage, Preise, Marktbewegungen

## 1. Zweck & Spielgefühl

Die Wirtschaft erzeugt **Preisunterschiede zwischen Städten** (Grundlage des Handels), reagiert
**spürbar auf Spieleraktionen** (wer viel kauft, treibt den Preis) und **erholt sich wieder**, damit Routen
nicht dauerhaft „leergekauft“ sind. Zufall und Ereignisse sorgen für Bewegung, ohne dass Preise
ins Absurde laufen.

Kernidee: Jeder Markt (Stadt × Ware) hat einen **Bestand $S$**. Der Preis hängt davon ab, wie knapp dieser
Bestand im Verhältnis zur Nachfrage ist. Der Bestand strebt ohne Spielereinfluss exponentiell zu einem
**Zielbestand**, der vom lokalen Angebot bestimmt wird.

## 2. Zustandsvariablen (pro Markt)

| Symbol | Bedeutung | Typ | Einheit | Wertebereich |
|---|---|---|---|---|
| $S_t$ | aktueller Marktbestand | float64 | Einheiten | $[S_{min}, \infty)$ |
| $x_t$ | Log-Rauschen des Preises | float64 | – | praktisch $\pm 0{,}3$ |
| $e_t$ | aktives Ereignis | enum / null | – | `razzia`, `lieferung`, `party`, null |
| $r_t$ | Resttick des Ereignisses | int | Ticks | $[0, \text{duration}]$ |

Abgeleitete (nicht gespeicherte) Größen: $D$, $A$, $S_{ref}$, $S_{target}$, $P$.

## 3. Parameter

| Symbol | Schlüssel | Default | Bereich | Bedeutung |
|---|---|---|---|---|
| $\varepsilon$ | `economy.elasticity` | 0,5 | 0,2–1,0 | Preisreaktion auf Knappheit. 0,5 ⇒ halber Bestand = Preis × √2 |
| $\omega$ | `economy.wealth_price_exponent` | 0,3 | 0–1 | Reiche Städte zahlen mehr |
| $\beta$ | `cities.demand_wealth_exponent` | 1,0 | – | Reiche Städte konsumieren mehr |
| $c_{cov}$ | `economy.cover_ticks` | 144 | – | Lager reicht im Gleichgewicht 1 Tag |
| $\lambda$ | `economy.reversion_rate` | 0,02 | 0,001–0,2 | Erholungsrate des Bestands pro Tick |
| $\rho$ | `economy.noise_rho` | 0,95 | 0–0,99 | Trägheit des Rauschens |
| $f_{min}$ | `economy.price_min_factor` | 0,25 | – | Preisuntergrenze relativ zu $P_{base}$ |
| $f_{max}$ | `economy.price_max_factor` | 4,0 | – | Preisobergrenze relativ zu $P_{base}$ |
| $S_{min}$ | `economy.min_stock` | 1 | – | Bestand fällt nie darunter |

### 3.1 Warenkatalog

Werte aus `goods.<id>.*`. Preise in ct pro Einheit, Verbrauch in Einheiten pro 1 000 Einwohner und Tick.

| Ware | Welt | $P_{base}$ | Verbrauch $c$ | Volatilität $\sigma$ | Volumen | Verderb/Tick | Heat $h$ |
|---|---|---:|---:|---:|---:|---:|---:|
| Grünzeug | Erde | 1 000 | 0,020 | 0,015 | 2 | 0,0001 | 0,5 |
| Krümelbrocken | Erde | 1 200 | 0,010 | 0,015 | 1 | 0 | 0,6 |
| Zauberschwammerl | Erde | 1 500 | 0,004 | 0,020 | 2 | 0,002 | 0,7 |
| Turboflocken | Erde | 2 000 | 0,008 | 0,020 | 1 | 0 | 1,0 |
| Grinsepillen | Erde | 1 000 | 0,008 | 0,020 | 1 | 0 | 1,0 |
| Bunte Briefmarken | Erde | 1 500 | 0,003 | 0,025 | 1 | 0 | 1,0 |
| Schneegestöber | Erde | 8 000 | 0,004 | 0,020 | 1 | 0 | 1,5 |
| Dämmerpulver | Erde | 6 000 | 0,002 | 0,025 | 1 | 0 | 2,0 |
| Sternenstaub | All | 50 000 | 0,010 | 0,040 | 1 | 0 | 3,0 |
| Mondkristall | All | 30 000 | 0,010 | 0,030 | 1 | 0 | 1,0 |
| Marsmoos | All | 20 000 | 0,015 | 0,035 | 2 | 0,001 | 1,5 |
| Nullgrav-Kapseln | All | 80 000 | 0,005 | 0,040 | 1 | 0 | 2,5 |

Beispiel-Schlüssel: `goods.kokain.base_price`, `goods.pilze.spoil_rate`, `goods.sternenstaub.realm`.

### 3.2 Marktereignisse

| Ereignis | Schlüssel | $p$/Tick/Markt | Dauer | Bestandsschock | $M_s$ | $M_d$ |
|---|---|---:|---:|---:|---:|---:|
| Medienwirksame Razzia | `events.razzia` | 0,0005 | 36 (6 h) | × 0,5 | 0,5 | 1,0 |
| Container vom Laster gefallen | `events.lieferung` | 0,0005 | 36 | × 2,0 | 1,5 | 1,0 |
| Stadtfest mit Kontrollverlust | `events.party` | 0,0003 | 72 (12 h) | × 1,0 | 1,0 | 1,8 |

Pro Markt ist höchstens ein Ereignis aktiv. Erwartete Ereignisse pro Markt und Tag:
$144 \cdot (0{,}0005 + 0{,}0005 + 0{,}0003) = 0{,}187$ – bei 80 Märkten (8 Städte × 8 Waren auf der Erde)
also ca. 15 Ereignisse pro Tag serverweit.

## 4. Formeln

**F-ECO-01 – Nachfrage pro Tick**

```math
D = \text{pop} \cdot c \cdot W^{\beta} \cdot m_d \cdot M_d
```

$\text{pop}$ in Tausend, $m_d$ Nachfragemultiplikator der Stadt für die Ware (`city.<id>.demand`),
$M_d$ Ereignismultiplikator (sonst 1).

**F-ECO-02 – Angebotsniveau pro Tick**

```math
A = \text{pop} \cdot c \cdot W^{\beta} \cdot m_s
```

$m_s$ aus `city.<id>.supply`. $A$ normiert das lokale Angebot auf dieselbe Skala wie die Nachfrage.
Fehlt ein Multiplikator, gilt 1,0 – aber nur für Waren der eigenen Welt (`realm`). Waren einer anderen Welt
werden in einer Stadt nur gehandelt, wenn **beide** Multiplikatoren explizit gesetzt sind.

**F-ECO-03 – Referenz- und Zielbestand**

```math
S_{ref} = D \cdot c_{cov} \qquad S_{target} = A \cdot c_{cov} \cdot M_s
```

$S_{ref}$ ist der Bestand, bei dem der Preis „neutral“ ist; $S_{target}$ ist der Bestand, zu dem der Markt
ohne Spieler zurückkehrt.

**F-ECO-04 – Bestandsentwicklung pro Tick**

```math
S_{t+1} = \max\big(S_{min},\; S_t + \lambda\,(S_{target} - S_t)\big)
```

Geschlossene Form (für Prognosen, UI „Markt erholt sich in …“):

```math
S_{t+n} = S_{target} + (S_t - S_{target})\,(1-\lambda)^n
```

Spielertransaktionen verändern $S$ **sofort** (siehe [trade.md](trade.md)), nicht im Tick.

**F-ECO-05 – Preisrauschen (AR(1) im Log-Raum)**

```math
x_{t+1} = \rho\, x_t + \sigma\, Z_t, \qquad N_t = e^{x_t}
```

$Z_t$ nach F-GLB-02 mit Entität `<stadt>/<ware>` und $k = 1$. Stationäre Standardabweichung
$\sigma / \sqrt{1-\rho^2}$, z. B. Grünzeug: $0{,}015 / 0{,}312 = 4{,}8\,\%$.

**F-ECO-06 – Marktpreis**

```math
P = \operatorname{clamp}\!\Big(P_{base} \cdot W^{\omega} \cdot \big(\tfrac{S_{ref}}{S}\big)^{\varepsilon} \cdot N,\; f_{min} P_{base},\; f_{max} P_{base}\Big)
```

Für die Handelsformeln wird $P$ als Funktion des Bestands geschrieben: $P(S) = \operatorname{clamp}(K \cdot S^{-\varepsilon})$
mit $K = P_{base} \cdot W^{\omega} \cdot S_{ref}^{\varepsilon} \cdot N$.

**F-ECO-07 – Gleichgewichtspreis**

Setzt man $S = S_{target}$, $N = 1$ und keine Ereignisse ein, kürzen sich Bevölkerung und Verbrauch heraus:

```math
P^{*} = P_{base} \cdot W^{\omega} \cdot \Big(\frac{m_d}{m_s}\Big)^{\varepsilon}
```

Damit ist das Preisgefüge vollständig über die Stadtmultiplikatoren steuerbar. Die Bevölkerung bestimmt
nur die **Markttiefe** (wie stark ein Handel den Preis bewegt).

**F-ECO-08 – Halbwertszeit der Markterholung**

```math
t_{1/2} = \frac{\ln 0{,}5}{\ln(1-\lambda)}
```

**F-ECO-09 – Ereignisse**

- Würfeln (nur wenn kein Ereignis aktiv): $U(\text{seed}, t, \texttt{<stadt>/<ware>}, 0)$; die Ereignisse
  belegen in fester Reihenfolge (razzia, lieferung, party) aufeinanderfolgende Intervalle der Länge $p$.
- Bei Eintritt: $S \leftarrow S \cdot \text{stock\_shock}$, Restdauer $r = \text{duration}$.
- Solange aktiv: $M_s = \text{supply\_mult}$ in F-ECO-03, $M_d = \text{demand\_mult}$ in F-ECO-01.
- Pro Tick $r \leftarrow r - 1$; bei $r = 0$ endet das Ereignis, $S$ kehrt per F-ECO-04 zurück.

## 5. Tick-Algorithmus (pro Markt)

```text
for market in markets:
    if market.event is None:
        u = U(seed, t, market.id, 0)
        market.event = pick_event(u)                 # F-ECO-09
        if market.event: market.S *= event.stock_shock
    Ms, Md = event multipliers or (1, 1)
    market.x = rho * market.x + sigma * Z(seed, t, market.id, 1)        # F-ECO-05
    market.S = max(S_min, market.S + lambda * (S_target(Ms) - market.S)) # F-ECO-04
    market.price = P(market.S, market.x, Md)                             # F-ECO-06 (Anzeige/Cache)
    tick down event
```

## 6. Grenzwerte & Edge-Cases

- **Preis:** immer in $[0{,}25 \cdot P_{base},\; 4{,}0 \cdot P_{base}]$. Auch im Leerkauf-Fall ($S \to S_{min}$) bleibt
  der Preis endlich.
- **Bestand:** nie unter $S_{min} = 1$. Eine Order darf höchstens `trade.max_trade_share` = 90 % des
  Bestands kaufen (siehe [trade.md](trade.md)).
- **Gleichgewicht im Rahmen:** jeder Markt muss $P^{*} \in [P_{min}, P_{max}]$ erfüllen (INV-02).
- **Rauschen** wirkt multiplikativ und wird vor dem Clamp angewendet.
- **Neue Städte/Waren** benötigen nur Einträge in `parameters.toml`; der Algorithmus bleibt gleich.

## 7. Beispielrechnungen

**EX-ECO-01 – Gleichgewichtspreis Grünzeug: Qualmsterdam vs. Protzingen**

| | Qualmsterdam | Protzingen |
|---|---|---|
| $W$ | 1,3 | 1,6 |
| $m_d / m_s$ | 1,0 / 3,0 | 1,0 / 0,6 |
| $W^{0{,}3}$ | 1,0819 | 1,1514 |
| $(m_d/m_s)^{0{,}5}$ | 0,5774 | 1,2910 |
| $P^{*} = 1000 \cdot W^{0{,}3} \cdot (m_d/m_s)^{0{,}5}$ | **624,63 ct** | **1 486,48 ct** |

Verhältnis Protzingen/Qualmsterdam = **2,3798** → die klassische „Qualm-Route“.

**EX-ECO-02 – Markttiefe Schneegestöber in Containerdam**

$\text{pop} = 650$, $c = 0{,}004$, $W = 1{,}0$, $m_d = 1{,}0$, $m_s = 2{,}5$:

- $D = 650 \cdot 0{,}004 \cdot 1{,}0 \cdot 1{,}0 =$ **2,6** Einheiten/Tick
- $A = 650 \cdot 0{,}004 \cdot 1{,}0 \cdot 2{,}5 =$ **6,5** Einheiten/Tick
- $S_{ref} = 2{,}6 \cdot 144 =$ **374,4**, $S_{target} = 6{,}5 \cdot 144 =$ **936,0**
- $P = 8000 \cdot 1 \cdot (374{,}4 / 936)^{0{,}5} = 8000 \cdot 0{,}63246 =$ **5 059,64 ct**

**EX-ECO-03 – Erholung nach einem Großeinkauf**

Ein Spieler kauft 200 Einheiten Schneegestöber in Containerdam: $S_0 = 936 - 200 = $ **736,0**, Preis **5 705,83 ct**.

| Ticks nach Kauf | $S = 936 + (736 - 936) \cdot 0{,}98^n$ | Preis |
|---|---:|---:|
| 0 | 736,00 | 5 705,83 ct |
| 34 (≈ 5,7 h) | 835,37 | 5 355,72 ct |
| 144 (1 Tag) | 925,10 | 5 089,38 ct |

**EX-ECO-04 – Halbwertszeit**

$t_{1/2} = \ln 0{,}5 / \ln 0{,}98 =$ **34,31 Ticks** = **5,72 h**. Eine leergekaufte Route ist nach einem
halben Arbeitstag zur Hälfte, nach einem Tag zu ~95 % erholt.

**EX-ECO-05 – Razzia auf dem Pleitenberger Grünzeugmarkt**

$S_{target} = 3700 \cdot 0{,}02 \cdot 144 =$ **10 656,0**; Preis vorher **1 000,00 ct**.
Razzia: $S \leftarrow 10656 \cdot 0{,}5 =$ **5 328,0**; Preis nachher $1000 \cdot \sqrt{2} =$ **1 414,21 ct**
(Faktor **1,4142**). Während der 36 Ticks zieht $S$ nur Richtung $0{,}5 \cdot S_{target}$, der Preis bleibt hoch;
danach erholt sich der Markt per F-ECO-04.

**EX-ECO-06 – Ein Rauschschritt**

Grünzeug, $x_t = 0{,}02$, $Z_t = -1{,}0$: $x_{t+1} = 0{,}95 \cdot 0{,}02 + 0{,}015 \cdot (-1) =$ **0,004**,
$N = e^{0{,}004} =$ **1,004008**.

## 8. Balancing-Ziele & Exploit-Analyse

| Ziel | Mechanismus | Geprüft durch |
|---|---|---|
| Preise bleiben im sinnvollen Rahmen | Clamp, Mean-Reversion | INV-02, INV-08 |
| Rauschen verzerrt nicht systematisch | Log-AR(1) mit Mittel 0 | INV-08: geometrisches Mittel ≈ $P^{*}$ (±10 %) über 20 000 Ticks |
| Kauf + Sofortverkauf lohnt nie | Spread + Preis-Impact | INV-03 |
| Großstädte sind „tiefe“ Märkte | $S_{ref} \propto \text{pop}$ | EX-ECO-02 vs. EX-ECO-05 |
| Routen erholen sich in Stunden, nicht Tagen | $\lambda = 0{,}02$ | EX-ECO-04 |

**Multi-Account-Manipulation:** Mehrere Accounts können einen Markt gemeinsam drücken und dann teuer
verkaufen. Das ist durch Spread und Impact unrentabel (beide Accounts zahlen den Spread). Absprachen über
Städte hinweg sind gewolltes Clan-Gameplay.

## 9. Schnittstellen

| Richtung | System | Größe |
|---|---|---|
| ← | [cities.md](cities.md) | pop, $W$, $m_s$, $m_d$ |
| → | [trade.md](trade.md) | $P(S)$, $K$, $S$ |
| ← | [trade.md](trade.md) | $\Delta S$ durch Kauf/Verkauf |
| ← | [real-estate.md](real-estate.md) | Produktion erhöht nicht $S$ direkt – produzierte Ware geht ins Spielerinventar |
| → | [space.md](space.md) | gleiche Formeln mit Weltraum-Parametern |

## 10. Offene Fragen

- **Pflicht wegen R-1 (wenige Spieler, siehe README):** NPC-Händler, die profitable Routen mit fester Rate
  abschöpfen (z. B. als zusätzlicher Verbrauch an Billig-Märkten und zusätzliches Angebot an teuren Märkten).
  Ohne sie hat ein einzelner Spieler bei 10–30 Spielern eine Route wie Containerdam → Protzingen praktisch für
  sich allein. Die Stärke soll mit wachsender Spielerzahl sinken. Noch nicht spezifiziert.

- Sollen Spielerverkäufe den **Zielbestand** dauerhaft verschieben (Marktsättigung über Tage)?
  Aktuell nein – Märkte vergessen nach ~1 Tag.
- Saisonale Effekte (Wochenende, Feiertage) als deterministische Party-Ereignisse?
