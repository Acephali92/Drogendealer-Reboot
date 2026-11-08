# Handel – Einkauf, Verkauf, Lagerbestände

## 1. Zweck & Spielgefühl

Handel ist der Einstieg ins Spiel und bleibt das Rückgrat der Wirtschaft: billig einkaufen, transportieren,
teuer verkaufen. Jede Order **bewegt den Markt** – kleine Mengen kaum, große Mengen deutlich. Dadurch lohnt
es sich, Ware auf mehrere Städte zu verteilen, und kein Spieler kann eine Route allein abschöpfen.

## 2. Zustandsvariablen

| Symbol | Bedeutung | Typ | Einheit | Wertebereich |
|---|---|---|---|---|
| $q$ | Ordermenge | int | Einheiten | $1 \ldots q_{max}$ |
| $S$ | Marktbestand vor der Order | float64 | Einheiten | siehe [economy.md](economy.md) |
| $Q_i, t_{0,i}$ | Spielerbestand je Ware und Kauf-Tick (Stapel) | int, int | Einheiten, Tick | $\ge 0$ |
| $H_{p,c}$ | Heat des Spielers $p$ in Stadt $c$ | float64 | – | $[0, 100]$ |

## 3. Parameter

| Symbol | Schlüssel | Default | Bedeutung |
|---|---|---|---|
| $s_0$ | `trade.spread_base` | 0,10 | Abstand zwischen Kauf- und Verkaufspreis (10 %) |
| $\phi$ | `trade.max_trade_share` | 0,9 | max. Anteil des Bestands pro Order |
| $k_H$ | `heat.trade_heat_per_keur` | 0,5 | Heat je 1 000 € Volumen × Heat-Faktor |
| $H_{max}$ | `heat.max` | 100 | Heat-Obergrenze |
| – | `player.backpack_capacity` | 60 | Rucksack ohne Fahrzeug |
| – | `professions.handel_spread_reduction` | 0,03 | Spread-Reduktion je Handel-Level |

## 4. Formeln

**F-TRD-01 – Kaufkosten mit Preis-Impact**

Der Spieler kauft die Einheiten nacheinander; jede Einheit verknappt den Markt. Die Kosten sind das Integral
des Preises über den abgebauten Bestand plus halber Spread:

```math
C(q) = \Big\lceil \big(1 + \tfrac{s}{2}\big) \int_{S-q}^{S} P(\sigma)\, d\sigma \Big\rceil, \qquad S \leftarrow S - q
```

Mit $P(\sigma) = \operatorname{clamp}(K\sigma^{-\varepsilon}, P_{min}, P_{max})$ (F-ECO-06) ist das Integral stückweise
geschlossen lösbar. Seien $\sigma_{hi} = (K/P_{max})^{1/\varepsilon}$ und $\sigma_{lo} = (K/P_{min})^{1/\varepsilon}$:

```math
\int_a^b P\,d\sigma = P_{max}\,|[a,b]\cap[0,\sigma_{hi}]| \;+\; \frac{K}{1-\varepsilon}\Big[\sigma^{1-\varepsilon}\Big]_{\max(a,\sigma_{hi})}^{\min(b,\sigma_{lo})} \;+\; P_{min}\,|[a,b]\cap[\sigma_{lo},\infty)|
```

(für $\varepsilon = 1$ wird der Mittelteil zu $K \ln(\cdot)$). Rechenaufwand $O(1)$, unabhängig von $q$.

Zulässigkeit: $1 \le q \le q_{max} = \lfloor \min(\phi S,\; S - S_{min}) \rfloor$, ausreichend Bargeld und Kapazität.

**F-TRD-02 – Verkaufserlös**

```math
R(q) = \Big\lfloor \big(1 - \tfrac{s}{2}\big) \int_{S}^{S+q} P(\sigma)\, d\sigma \Big\rfloor, \qquad S \leftarrow S + q
```

Verkäufe sind nicht mengenbegrenzt (der Markt nimmt alles, zum sinkenden Preis bis $P_{min}$).

**F-TRD-03 – Spread mit Handelsfähigkeit**

```math
s = s_0 \cdot \big(1 - \min(0{,}6;\; 0{,}03 \cdot L_{Handel})\big)
```

Level 0: 10 %, Level 10: 7 %, Level 20: 4 % (siehe [professions.md](professions.md)).

**F-TRD-04 – Verderb (lazy ausgewertet)**

Jeder Kauf erzeugt einen Stapel $(Q_0, t_0)$. Der aktuelle Bestand wird nur beim Lesen berechnet:

```math
Q(t) = \big\lfloor Q_0 \cdot (1 - r)^{\,t - t_0} \big\rfloor
```

$r$ = `goods.<ware>.spoil_rate`. Kein Update pro Tick nötig. Beim Verkauf wird FIFO aus den ältesten
Stapeln entnommen.

**F-TRD-05 – Heat durch Handel**

```math
H_{p,c} \leftarrow \min\Big(H_{max},\; H_{p,c} + k_H \cdot \frac{V}{100\,000} \cdot h_{Ware}\Big)
```

$V$ = Ordervolumen in ct (Kaufkosten bzw. Verkaufserlös), $h$ = `goods.<ware>.heat`. Heat zerfällt nach
F-CTY-01.

**F-TRD-06 – Transport- und Lagerkapazität**

```math
\sum_i q_i \cdot \text{vol}_i \;\le\; \text{Rucksack} + \text{Fahrzeugkapazität}
```

Ware im **Lagerhaus** (siehe [real-estate.md](real-estate.md), `businesses.lagerhaus.capacity` = 5 000)
zählt nicht zur Transportkapazität, ist aber an die Stadt gebunden.

## 5. Ablauf einer Order

```text
function buy(player, city, good, q):
    S = market.S
    require 1 <= q <= floor(min(0.9*S, S - S_min))
    require volume(player.inventory) + q*vol <= capacity(player)
    C = buy_cost(...)                     # F-TRD-01, mit aktuellem Rauschen x
    require player.cash_black + player.cash_white >= C   # Schwarzgeld zuerst
    market.S -= q                         # sofort, atomar (Row-Lock auf den Markt)
    player.add_stack(good, q, t_now)
    player.heat[city] = trade_heat(...)   # F-TRD-05
    player.xp.handel += xp_gain(...)      # F-PRF-02
```

Verkauf analog; Erlös wird als **Schwarzgeld** gutgeschrieben. Orders werden pro Markt serialisiert,
damit zwei gleichzeitige Käufe nicht denselben Bestand sehen.

## 6. Grenzwerte & Edge-Cases

- Die UI zeigt vor Bestätigung **exakte** Kosten (gleiche Funktion, gleicher Zustand). Ändert sich der Markt
  zwischen Anzeige und Bestätigung, wird mit einer Slippage-Toleranz des Spielers (Standard `trade.slippage_tolerance` = 2 %) abgebrochen.
- Kauf mit Weißgeld ist erlaubt, Verkauf erzeugt immer Schwarzgeld.
- $q_{max}$ verhindert, dass ein Markt auf $S_{min}$ leergekauft wird.
- Weltraumwaren in Erdstädten: nur in Frankfurt handelbar (siehe [space.md](space.md)).

## 7. Beispielrechnungen

**EX-TRD-01 – Kauf von 200 Kokain in Rotterdam (Level 0)**

- Aus EX-ECO-02: $S = 936{,}0$, $K = 8000 \cdot 1 \cdot 374{,}4^{0{,}5} = 154\,795{,}35$
- Preisgrenzen 2 000 / 32 000 ct werden nicht berührt.
- $\int_{736}^{936} K\sigma^{-0{,}5} d\sigma = 2K(\sqrt{936} - \sqrt{736}) = 1\,072\,668{,}97$
- $C = \lceil 1{,}05 \cdot 1\,072\,668{,}97 \rceil =$ **1 126 303 ct** (11 263,03 €), Ø **5 631,52 ct**/Einheit
  (Marktpreis vorher 5 059,64 ct)
- Neuer Bestand **736,0**

**EX-TRD-02 – Verkauf von 200 Kokain in München (Level 0)**

- $S_{ref} = 1500 \cdot 0{,}004 \cdot 1{,}6 \cdot 1{,}4 \cdot 144 = 1\,935{,}36$, $S = S_{target} = 691{,}2$
- $K = 8000 \cdot 1{,}6^{0{,}3} \cdot 1935{,}36^{0{,}5} = 405\,234{,}92$; Preis vorher 15 413,63 ct
- $\int_{691{,}2}^{891{,}2} \ldots = 2\,887\,128{,}84$
- $R = \lfloor 0{,}95 \cdot 2\,887\,128{,}84 \rfloor =$ **2 742 772 ct**, Ø **13 713,86 ct**/Einheit;
  Preis danach 13 574,36 ct; neuer Bestand **891,2**

**EX-TRD-03 – Kauf und Sofortverkauf (kein Arbitrage-Gewinn)**

200 Kokain in Rotterdam kaufen (**1 126 303 ct**) und sofort zurückverkaufen:
Integral identisch, $R = \lfloor 0{,}95 \cdot 1\,072\,668{,}97 \rfloor =$ **1 019 035 ct**.
Verlust **107 268 ct** = exakt der Spread. INV-03 prüft dies für jeden Markt.

**EX-TRD-04 – Verderb von Pilzen**

100 Pilze, $r = 0{,}002$: nach 144 Ticks $\lfloor 100 \cdot 0{,}998^{144} \rfloor =$ **74**, nach einer Woche
(1 008 Ticks) **13**.

**EX-TRD-05 – Heat durch den Kauf aus EX-TRD-01**

$H = 0 + 0{,}5 \cdot 1\,126\,303 / 100\,000 \cdot 1{,}5 =$ **8,4473** in Rotterdam.

**EX-TRD-06 – Kapazität mit Kleinwagen**

$60 + 300 =$ **360** Volumeneinheiten → max. **180** Gras (Volumen 2) oder **360** Kokain.

## 8. Balancing-Ziele & Exploit-Analyse

- **Round-Trip-Verlust ≥ Spread.** Weil Kauf und Verkauf über dasselbe Integral laufen, ist der Verlust
  mindestens $s \cdot \int P$. INV-03 meldet den kleinsten Verlust über alle Märkte (≥ 3,9 % bei Level 20).
- **Splitten bringt nichts.** Zehn Orders à 20 Einheiten kosten (bis auf Rundung) dasselbe wie eine à 200,
  weil das Integral additiv ist. Erst die **Tick-Erholung zwischen Orders** verbilligt – das ist gewollt
  (Geduld wird belohnt, aber nur mit $\lambda = 2\,\%$ pro 10 Minuten).
- **Pump & Dump** durch zwei Accounts: A kauft (Preis steigt), B verkauft teuer – A trägt den Impact selbst,
  die Summe beider Accounts ist negativ.

## 9. Schnittstellen

| Richtung | System | Größe |
|---|---|---|
| ← | [economy.md](economy.md) | $K$, $S$, Preisgrenzen |
| → | [economy.md](economy.md) | $\Delta S$ |
| → | [cities.md](cities.md) | Heat (F-TRD-05) |
| ← | [professions.md](professions.md) | Spread-Bonus; → XP Handel |
| ← | [travel.md](travel.md) | Fahrzeugkapazität |
| ← | [clans.md](clans.md) | Clansteuer auf Verkaufserlöse (F-CLN-03) |

## 10. Offene Fragen

- Limit-Orders (Kauf, sobald Preis < X) als Komfortfunktion? Technisch einfach, aber verstärkt Bots.
- Spieler-zu-Spieler-Handel (direkter Tausch) – erst mit Clan-System, um Multi-Account-Transfers zu begrenzen.
