# Immobilien – Bordelle und weitere Geschäftsmodelle

## 1. Zweck & Spielgefühl

Betriebe sind die **Mittelspiel-Investition**: Sie bringen passives legales Einkommen, schaffen
Waschkapazität (siehe [money-laundering.md](money-laundering.md)) und – als Labor oder Plantage – eigene
Ware. Sie sind an eine Stadt gebunden und damit an deren Wohlstand, Polizei und Clan-Lage.
Alle Betriebe werden ausschließlich mit **Weißgeld** gekauft und ausgebaut.

Das Rotlicht-Gewerbe (Bordell) wird – wie alle Betriebe – abstrakt als Wirtschaftseinheit mit Umsatz,
Unterhalt und Risiko modelliert.

## 2. Zustandsvariablen (pro Betrieb)

| Feld | Typ | Wertebereich |
|---|---|---|
| Typ, Stadt, Besitzer | enum, enum, Spieler-ID | – |
| Ausbaustufe $A$ | int | 0–5 |
| geschlossen bis Tick | int | – |
| Produktionsakkumulator (Labor/Plantage): Start-Tick, gewählte Ware | int, enum | – |
| Waschmenge pro Tick | int64 ct | siehe F-ML-02 |

## 3. Parameter

### 3.1 Betriebstypen (`businesses.<id>.*`)

| Betrieb | Kaufpreis | Umsatz $R_0$ | Unterhalt $U_0$ | Waschgebühr | Razziarisiko $r$ | Besonderheit | Freischaltung |
|---|---:|---:|---:|---:|---:|---|---|
| Waschsalon | 60 000 € | 1 500 | 900 | 20 % | 0,0001 | – | – |
| Bar | 150 000 € | 3 000 | 1 700 | 15 % | 0,0002 | – | – |
| Autowerkstatt | 200 000 € | 3 500 | 2 000 | 18 % | 0,0002 | Versteck +0,10 für eigene Fahrzeuge | – |
| Spielhalle | 300 000 € | 6 000 | 3 200 | 10 % | 0,0003 | beste Waschgebühr | Finanzen L3 |
| Bordell | 500 000 € | 10 000 | 5 500 | 12 % | 0,0005 | höchster Umsatz | Finanzen L5 |
| Lagerhaus | 80 000 € | 0 | 300 | – | 0,0001 | 5 000 Volumen Lager in der Stadt | – |
| Plantage | 120 000 € | 0 | 600 | – | 0,0006 | produziert Gras 4,0/Tick | Produktion L1 |
| Labor | 250 000 € | 0 | 1 500 | – | 0,0008 | produziert Speed **oder** Ecstasy 3,0/Tick | Produktion L3 |

Umsatz und Unterhalt in ct pro Tick. Schlüssel z. B. `businesses.bordell.income`, `businesses.labor.output_per_tick`,
`businesses.plantage.material_cost_ratio`.

### 3.2 Globale Parameter (`real_estate.*`)

| Symbol | Schlüssel | Default | Bedeutung |
|---|---|---|---|
| $\omega_{RE}$ | `real_estate.wealth_exponent` | 0,5 | Wohlstand hebt Umsatz |
| $u_R$ | `real_estate.upgrade_income_bonus` | 0,20 | +20 % Umsatz/Produktion je Ausbaustufe |
| $u_U$ | `real_estate.upgrade_upkeep_bonus` | 0,10 | +10 % Unterhalt je Ausbaustufe |
| $k_A$ | `real_estate.upgrade_cost_factor` | 0,20 | Ausbau auf Stufe $n$ kostet $0{,}2 \cdot n \cdot$ Kaufpreis |
| – | `real_estate.max_upgrade` | 5 | höchste Stufe |
| – | `real_estate.raid_fine_rate` / `real_estate.raid_closure_ticks` | 0,05 / 72 | Razzia-Folgen |
| – | `real_estate.roi_target_min_days` / `real_estate.roi_target_max_days` | 20 / 120 | Zielkorridor Amortisation |

## 4. Formeln

**F-RE-01 – Legaler Umsatz pro Tick**

```math
R = \big\lfloor R_0 \cdot W^{\omega_{RE}} \cdot (1 + u_R A) \big\rfloor
```

Gutschrift als **Weißgeld**, abzüglich Clansteuer (F-CLN-03).

**F-RE-02 – Unterhalt pro Tick**

```math
U = \big\lceil U_0 \cdot (1 + u_U A) \big\rceil
```

Abbuchung vom Weißgeld, auch wenn der Betrieb geschlossen ist. Kann der Unterhalt `real_estate.unpaid_upkeep_ticks` = 144 Ticks lang nicht
bezahlt werden, wird der Betrieb zwangsversteigert (Erlös `real_estate.foreclosure_rate` = 50 % des Kaufpreises).

**F-RE-03 – Ausbaukosten**

```math
C_A(n) = k_A \cdot n \cdot \text{Kaufpreis}, \qquad \sum_{n=1}^{A} C_A(n) = k_A \cdot \text{Kaufpreis} \cdot \frac{A(A+1)}{2}
```

Stufe 5 kostet kumuliert das Dreifache des Kaufpreises.

**F-RE-04 – Amortisationsdauer**

```math
T_{amort} = \frac{\text{Kaufpreis} + \sum C_A}{(R - U) \cdot 144} \text{ Tage}
```

Ohne Waschnutzen gerechnet; der eigentliche Wert vieler Betriebe liegt in der Waschkapazität.

**F-RE-05 – Razzia**

```math
p_{Razzia} = r_{typ} \cdot \Pi(\pi, H) \text{ pro Tick}
```

$\Pi$ nach F-CTY-02 mit dem Heat des Besitzers in der Stadt. Folgen: Strafe $\lceil 0{,}05 \cdot \text{Kaufpreis} \rceil$,
Schließung 72 Ticks, bei Labor/Plantage Verlust der nicht eingesammelten Produktion.

**F-RE-06 – Produktion (Labor, Plantage)**

```math
Q = \big\lfloor o \cdot n \cdot (1 + b_{Prod}) \cdot (1 + u_R A) \big\rfloor, \qquad \text{Material} = \lceil Q \cdot m \cdot P_{base} \rceil
```

$o$ = Ausstoß pro Tick, $n$ = Ticks seit letztem Einsammeln (max. `real_estate.production_max_ticks` = 288, danach stoppt die Produktion),
$b_{Prod} = \min(0{,}5;\; 0{,}025\,L_{Produktion})$, $m$ = Materialkostenanteil. Lazy ausgewertet beim
Einsammeln; Material wird dabei vom Schwarzgeld bezahlt. Die Ware landet im Inventar bzw. Lagerhaus.

## 5. Ablauf pro Tick

```text
for b in businesses:
    if b.closed_until > t: pay upkeep; continue
    player.cash_white += business_income(b) - clan_tax      # F-RE-01, F-CLN-03
    player.cash_white -= business_upkeep(b)                 # F-RE-02
    if U(seed, t, "raid/"+b.id, 0) < raid_risk(b): apply raid  # F-RE-05
```

## 6. Grenzwerte & Edge-Cases

- Höchstens `real_estate.max_per_type_city` = 3 Betriebe je Typ und Stadt pro Spieler (gegen Monokultur und Server-Last).
- Verkauf eines Betriebs: `real_estate.resale_rate` = 70 % von Kaufpreis + Ausbaukosten, als Weißgeld.
- Produktion stoppt nach 288 Ticks ohne Einsammeln (Anwesenheit erforderlich).
- Der Heimbonus im Kampf (F-CMB-02) gilt, sobald der Spieler irgendeinen Betrieb in der Stadt besitzt.

## 7. Beispielrechnungen

**EX-RE-01 – Bordell in München, Ausbaustufe 2**

- $R = \lfloor 10\,000 \cdot 1{,}6^{0{,}5} \cdot 1{,}4 \rfloor =$ **17 708 ct/Tick**
- $U = \lceil 5\,500 \cdot 1{,}2 \rceil =$ **6 600 ct/Tick**
- Netto pro Tag: $(17\,708 - 6\,600) \cdot 144 =$ **1 599 552 ct** (≈ 16 000 €)
- Investition: $50 + 0{,}2 \cdot 50 \cdot (1 + 2) = $ **80 000 000 ct** (800 000 €)
- Amortisation: **50,01 Tage**

**EX-RE-02 – Amortisation in Berlin (W = 1, Stufe 0)**

| Betrieb | Investition | Netto/Tag | Amortisation |
|---|---:|---:|---:|
| Waschsalon | 60 000 € | 864 € | **69,44 d** |
| Bar | 150 000 € | 1 872 € | **80,13 d** |
| Spielhalle | 300 000 € | 4 032 € | **74,4 d** |
| Bordell | 500 000 € | 6 480 € | **77,16 d** |
| Autowerkstatt | 200 000 € | 2 160 € | **92,59 d** |

Alle liegen im Zielkorridor 20–120 Tage (INV-06). Der Ausbau verkürzt die Amortisation, weil der
Umsatz doppelt so stark wächst wie der Unterhalt.

**EX-RE-03 – Razziarisiko Bordell München (Heat 0)**

$p = 0{,}0005 \cdot 0{,}8 \cdot 1 =$ **0,0004** pro Tick → **0,056** pro Tag (F-ML-04).

**EX-RE-04 – Plantage, Produktion L4, Ausbaustufe 1, ein Tag**

- $Q = \lfloor 4{,}0 \cdot 144 \cdot 1{,}10 \cdot 1{,}20 \rfloor =$ **760** Gras
- Material $\lceil 760 \cdot 0{,}15 \cdot 1000 \rceil =$ **114 000 ct**
- Unterhalt $\lceil 600 \cdot 1{,}1 \rceil \cdot 144 =$ **95 040 ct**
- Verkaufswert in München (Ø ≈ 13–14 € bei dieser Menge): ≈ 10 000 € – abzüglich Transport und Risiko.

## 8. Balancing-Ziele

| Ziel | Umsetzung / Prüfung |
|---|---|
| Betriebe amortisieren sich in Wochen, nicht Tagen | INV-06: 20–120 Tage |
| Teure Betriebe sind die besseren Waschmaschinen | Gebühr sinkt mit Preisklasse |
| Reiche Städte bringen mehr, sind aber riskanter | $W^{0{,}5}$ beim Umsatz, höhere $\pi$ |
| Produktion ersetzt Einkauf, nicht Handel | Ware muss weiterhin verkauft und transportiert werden |

## 9. Schnittstellen

| Richtung | System | Größe |
|---|---|---|
| → | [money-laundering.md](money-laundering.md) | $R$, Waschgebühr, Schließung |
| ← | [cities.md](cities.md) | $W$, $\pi$, Heat |
| → | [combat.md](combat.md) | Heimbonus |
| → | [travel.md](travel.md) | Versteckbonus Autowerkstatt |
| → | [trade.md](trade.md) | Lagerhaus-Kapazität, produzierte Ware |
| ← | [professions.md](professions.md) | Produktions-Bonus, Freischaltungen; → Produktions-XP |
| → | [clans.md](clans.md) | Steuerbasis |

## 10. Offene Fragen

- Personal als eigene Ressource (statt im Unterhalt enthalten)?
- Übernahme gegnerischer Betriebe im Clankrieg?
