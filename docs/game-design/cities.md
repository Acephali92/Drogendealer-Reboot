# Städte – Bedarf, Warenverfügbarkeit, Besonderheiten

## 1. Zweck & Spielgefühl

Städte geben der Wirtschaft ihre **Geografie**: In Qualmsterdam ist alles Pflanzliche spottbillig, in Containerdam
und Schmuddelhafen fällt Schneegestöber ständig vom Laster, Protzingen zahlt Spitzenpreise, wird aber streng überwacht. Jede Stadt ist durch
wenige Kennzahlen vollständig beschrieben; alle Unterschiede zwischen Städten entstehen ausschließlich aus
diesen Parametern.

## 2. Zustandsvariablen

| Symbol | Bedeutung | Typ | Wertebereich |
|---|---|---|---|
| $H_{p,c}$ | Heat des Spielers $p$ in Stadt $c$ | float64 | $[0, 100]$ |
| Markt $(c, g)$ | Bestand, Rauschen, Ereignis | siehe [economy.md](economy.md) | – |
| Viertel $(c, 1..4)$ | kontrollierender Clan | Clan-ID / null | siehe [clans.md](clans.md) |

Stadtattribute selbst sind **statisch** (nur durch Content-Updates änderbar).

## 3. Parameter

### 3.1 Stadtattribute (`city.<id>.*`)

| Stadt | pop (Tsd.) | Wohlstand $W$ | Polizei $\pi$ | Treibstoff (ct/l) | Raumhafen | Angebot $m_s$ (≠ 1) | Nachfrage $m_d$ (≠ 1) |
|---|---:|---:|---:|---:|---|---|---|
| Pleitenberg | 3 700 | 1,0 | 0,55 | 185 | – | Turboflocken 1,5 · Grinsepillen 1,5 | Turboflocken 1,4 · Grinsepillen 1,6 |
| Schmuddelhafen | 1 850 | 1,2 | 0,65 | 185 | – | Schneegestöber 2,0 · Dämmerpulver 1,5 | – |
| Protzingen | 1 500 | 1,6 | 0,80 | 190 | – | Schneegestöber 0,5 · Grünzeug 0,6 · Krümelbrocken 0,7 | Schneegestöber 1,4 |
| Klüngelheim | 1 080 | 1,1 | 0,60 | 185 | – | – | Grünzeug 1,3 |
| Bankfurt | 770 | 1,5 | 0,70 | 185 | **ja** | Dämmerpulver 1,3 · Weltraumwaren 0,2 | Schneegestöber 1,5 · Weltraumwaren 1,0 |
| Plattenhausen | 620 | 0,8 | 0,50 | 180 | – | Turboflocken 2,5 | – |
| Qualmsterdam | 900 | 1,3 | 0,30 | 200 | – | Grünzeug · Krümelbrocken · Zauberschwammerl 3,0 · Grinsepillen 2,0 | – |
| Containerdam | 650 | 1,0 | 0,45 | 200 | – | Schneegestöber 2,5 · Dämmerpulver 1,8 | – |

Beispiel-Schlüssel: `city.muenchen.police`, `city.amsterdam.supply.gras`, `city.frankfurt.spaceport`.

### 3.2 Globale Parameter

| Symbol | Schlüssel | Default | Bedeutung |
|---|---|---|---|
| $\beta$ | `cities.demand_wealth_exponent` | 1,0 | Wohlstand erhöht Konsum |
| $\delta_0$ | `heat.decay_base` | 0,01 | Heat-Zerfall pro Tick |
| $d$ | `heat.police_decay_damping` | 0,5 | Polizei verlangsamt Zerfall |

## 4. Formeln

Nachfrage, Angebot und Preise einer Stadt folgen F-ECO-01 bis F-ECO-07. Zusätzlich:

**F-CTY-01 – Heat-Zerfall**

```math
H_{t+n} = H_t \cdot \big(1 - \delta_0 (1 - d\,\pi)\big)^n
```

Starke Polizei „vergisst“ langsamer. Halbwertszeit in Protzingen ($\pi = 0{,}8$): $\ln 0{,}5 / \ln 0{,}994 \approx 115$
Ticks (19 h); in Qualmsterdam ($\pi = 0{,}3$): ≈ 81 Ticks (13,5 h).

**F-CTY-02 – Fahndungsdruck**

```math
\Pi(\pi, H) = \pi \cdot \Big(1 + \frac{H}{100}\Big) \in [0, 2]
```

Wird von Kontrollen (F-TRV-04), Razzien auf Betriebe (F-RE-05) verwendet. Geldwäsche nutzt nur den Heat-Anteil.

**F-CTY-03 – Verfügbarkeitsanzeige**

Spieler sehen nicht den exakten Bestand, sondern eine Stufe aus $v = S / S_{ref}$:

| $v$ | < 0,5 | 0,5–0,8 | 0,8–1,25 | 1,25–2,0 | > 2,0 |
|---|---|---|---|---|---|
| Anzeige | knapp | gering | normal | gut | reichlich |

## 5. Gleichgewichtspreise (F-ECO-07, in €)

Erzeugt mit `python3 docs/game-design/tools/verify.py --price-table`.

| Ware | Pleitenberg | Schmuddelhafen | Protzingen | Klüngelheim | Bankfurt | Plattenhausen | Qualmsterdam | Containerdam |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Grünzeug | 10,00 | 10,56 | 14,86 | 11,73 | 11,29 | 9,35 | 6,25 | 10,00 |
| Krümelbrocken | 12,00 | 12,67 | 16,51 | 12,35 | 13,55 | 11,22 | 7,50 | 12,00 |
| Zauberschwammerl | 15,00 | 15,84 | 17,27 | 15,44 | 16,94 | 14,03 | 9,37 | 15,00 |
| Turboflocken | 19,32 | 21,12 | 23,03 | 20,58 | 22,59 | 11,83 | 21,64 | 20,00 |
| Grinsepillen | 10,33 | 10,56 | 11,51 | 10,29 | 11,29 | 9,35 | 7,65 | 10,00 |
| Bunte Briefmarken | 15,00 | 15,84 | 17,27 | 15,44 | 16,94 | 14,03 | 16,23 | 15,00 |
| Schneegestöber | 80,00 | 59,75 | 154,14 | 82,32 | 110,65 | 74,82 | 86,55 | 50,60 |
| Dämmerpulver | 60,00 | 51,74 | 69,09 | 61,74 | 59,43 | 56,11 | 64,91 | 44,72 |

**Lesart:** Die besten Einkaufsorte sind Qualmsterdam (Grünzeug, Krümelbrocken, Zauberschwammerl, Grinsepillen), Plattenhausen (Turboflocken) und
Containerdam/Schmuddelhafen (Schneegestöber, Dämmerpulver). Die besten Absatzorte sind Protzingen und Bankfurt. Bunte Briefmarken hat keine
Spezialisierung und dient als „Rauschware“ für Kurzstrecken-Spekulation.

## 6. Grenzwerte & Edge-Cases

- $W \in [0{,}5; 2{,}0]$, $\pi \in [0; 1]$ (Content-Regel; Weltraumstationen dürfen $\pi$ nahe 0 haben).
- Jede neue Stadt braucht Distanzen zu **allen** anderen Erdstädten in `distances`.
- Heat wird pro Stadt geführt; Reisen nimmt Heat nicht mit. Heat < 0,01 wird auf 0 gesetzt.

## 7. Beispielrechnungen

**EX-CTY-01 – Grinsepillen-Markt Pleitenberg**

- $D = 3700 \cdot 0{,}008 \cdot 1{,}0 \cdot 1{,}6 =$ **47,36** Einheiten/Tick
- $S_{ref} = 47{,}36 \cdot 144 =$ **6 819,84**; $S_{target} = 3700 \cdot 0{,}008 \cdot 1{,}5 \cdot 144 =$ **6 393,6**
- $P^{*} = 1000 \cdot 1{,}0^{0{,}3} \cdot (1{,}6/1{,}5)^{0{,}5} =$ **1 032,80 ct**

Pleitenberg ist ein tiefer Markt: 200 Grinsepillen bewegen den Preis nur um ≈ 1,6 %.

**EX-CTY-02 – Heat-Zerfall über einen Tag**

Startwert $H = 50$, 144 Ticks:

- Protzingen: $50 \cdot (1 - 0{,}01 \cdot 0{,}6)^{144} =$ **21,02**
- Qualmsterdam: $50 \cdot (1 - 0{,}01 \cdot 0{,}85)^{144} =$ **14,63**

**EX-CTY-03 – Verfügbarkeit nach dem Großeinkauf aus EX-TRD-01**

$v = 736 / 374{,}4 =$ **1,9658** → Anzeige **„gut“** (vorher 2,5 = „reichlich“).

## 8. Balancing-Ziele

| Ziel | Umsetzung |
|---|---|
| Jede Stadt hat mindestens eine Einkaufs- **oder** Verkaufsspezialität | Multiplikatoren in 3.1 |
| Profitabelste Absatzmärkte haben die stärkste Polizei | Protzingen $\pi = 0{,}8$, Bankfurt 0,7 |
| Risikoarmer Einstieg möglich | Plattenhausen → Pleitenberg (Turboflocken), Bahn, $\pi \le 0{,}55$ (INV-04) |
| Kein Markt dauerhaft am Preislimit | INV-02 |

## 9. Schnittstellen

| Richtung | System | Größe |
|---|---|---|
| → | [economy.md](economy.md) | pop, $W$, $m_s$, $m_d$ |
| → | [travel.md](travel.md) | Distanzen, Treibstoffpreis, $\pi$ |
| → | [real-estate.md](real-estate.md) | $W$ (Ertrag), $\pi$ (Razzien) |
| → | [clans.md](clans.md) | Viertel, Schutzgeld |
| ← | Handel, Kampf, Geldwäsche | Heat-Zuwachs |

## 10. Offene Fragen

- Dynamische Polizeistärke (steigt, wenn serverweit viel Heat in einer Stadt entsteht)?
- Weitere Städte (Wien, Zürich, Prag) für mehr Routenvielfalt.
