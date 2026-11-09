# Geldwäsche – Illegales und legales Vermögen

## 1. Zweck & Spielgefühl

Geld aus dem Warenhandel ist **Schwarzgeld**: Es kann geraubt werden und reicht nicht für die großen Investitionen
(Immobilien, Clan, Raumfahrt). Wer aufsteigen will, muss es **waschen** – über eigene Betriebe, deren legaler
Umsatz das Waschvolumen tarnt. Je mehr man im Verhältnis zum echten Umsatz wäscht, desto auffälliger wird
es. Das erzeugt die zentrale Abwägung zwischen **Tempo** und **Risiko**.

## 2. Zustandsvariablen

| Symbol | Bedeutung | Typ | Wertebereich |
|---|---|---|---|
| $B_s$ | Schwarzgeld (Bargeld) des Spielers | int64 ct | ≥ 0 |
| $B_w$ | Weißgeld (Bankkonto) | int64 ct | darf durch Strafen negativ werden (Schuld) |
| $x_{b}$ | eingestellte Waschmenge je Betrieb pro Tick | int64 ct | $[0, x_{max}]$ |
| Waschjournal | (Tick, Betrieb, Gutschrift) der letzten 144 Ticks | Liste | – |
| Strohmann-Tageszähler | heute über Strohmann gewaschen | int64 ct | $[0, \text{cap}]$ |

## 3. Parameter (`laundering.*` und `businesses.<id>.wash_fee`)

| Symbol | Schlüssel | Default | Bedeutung |
|---|---|---|---|
| $f_{typ}$ | `businesses.<typ>.wash_fee` | 10–20 % | Gebühr je Betriebstyp (siehe Tabelle) |
| $f_{min}$ | `laundering.fee_min` | 0,05 | Mindestgebühr |
| $\rho_{max}$ | `laundering.max_ratio` | 3,0 | max. Waschmenge relativ zum legalen Umsatz |
| $p_0$ | `laundering.risk_base` | 0,001 | Entdeckungsrisiko pro Tick bei Verhältnis 1 |
| $\gamma$ | `laundering.risk_exponent` | 2,0 | Progression des Risikos |
| – | `laundering.risk_max_per_tick` | 0,5 | Obergrenze |
| – | `laundering.lookback_ticks` | 144 | Zeitraum der Beschlagnahme |
| – | `laundering.penalty_fine_rate` | 0,5 | Strafe relativ zur beschlagnahmten Summe |
| – | `laundering.closure_ticks` | 144 | Betrieb geschlossen |
| – | `laundering.heat_on_detection` | 40 | Heat in der Stadt |
| $f_S$ | `laundering.strawman_fee` | 0,30 | Strohmann-Gebühr |
| – | `laundering.strawman_daily_cap` | 10 000 € | Strohmann-Tageslimit |

| Betrieb | Waschgebühr $f_{typ}$ | Legaler Umsatz $R$ (W = 1, Stufe 0) |
|---|---:|---:|
| Waschsalon | 20 % | 1 500 ct/Tick |
| Autowerkstatt | 18 % | 3 500 ct/Tick |
| Bar | 15 % | 3 000 ct/Tick |
| Bordell | 12 % | 10 000 ct/Tick |
| Spielhalle | 10 % | 6 000 ct/Tick |

Lagerhaus, Labor und Plantage haben keinen legalen Umsatz und können nicht waschen.

### Verwendung der Geldarten

| Ausgabe | Schwarz | Weiß |
|---|:-:|:-:|
| Waren, Waffen, Rüstung, Crew, Bestechung, Treibstoff, Bahn | ✔ | ✔ |
| Fahrzeuge | ✔ | ✔ |
| Betriebe kaufen/ausbauen, Clan gründen/ausbauen, Raumschiffe, Startgebühr Raumhafen | – | ✔ |
| Strafen | zuerst schwarz | Rest |

Bei Zahlungen, die beides erlauben, wird **zuerst Schwarzgeld** verwendet.

## 4. Formeln

**F-ML-01 – Gebühr und Gutschrift**

```math
f = \max\big(f_{min},\; f_{typ} \cdot (1 - b_{Fin,Gebühr})\big), \qquad \text{Gutschrift} = \lfloor x \cdot (1 - f) \rfloor
```

$b_{Fin,Gebühr} = \min(0{,}4;\; 0{,}02\,L_{Finanzen})$. Die Gebühr verschwindet aus dem Spiel (Geldsenke).

**F-ML-02 – Waschkapazität pro Tick und Betrieb**

```math
x_{max} = \lfloor \rho_{max} \cdot R \rfloor
```

$R$ = aktueller legaler Umsatz des Betriebs pro Tick nach F-RE-01 (inkl. Ausbaustufe und Wohlstand).

**F-ML-03 – Entdeckungsrisiko pro Tick und Betrieb**

```math
p = \min\Big(0{,}5;\; p_0 \cdot \Big(\frac{x}{R}\Big)^{\gamma} \cdot \Big(1 + \frac{H}{100}\Big) \cdot (1 - b_{Fin,Risiko})\Big)
```

$H$ = Heat des Spielers in der Stadt des Betriebs, $b_{Fin,Risiko} = \min(0{,}4;\; 0{,}02\,L_{Finanzen})$.
Gewürfelt pro Tick mit $U(\text{seed}, t, \texttt{wash/<betrieb>}, 0) < p$. Bei $x = 0$ ist $p = 0$.

**F-ML-04 – Risiko über einen Zeitraum**

```math
p_n = 1 - (1 - p)^n
```

Für die UI („Risiko pro Tag“ mit $n = 144$); wird auch für Razzien und Kontrollen angezeigt.

**F-ML-05 – Strohmann (risikofrei, teuer, begrenzt)**

```math
x' = \min(x,\; \text{cap} - \text{heute\_genutzt}), \qquad \text{Gutschrift} = \lfloor x' \cdot (1 - f_S) \rfloor
```

Sofortige Gutschrift, kein Entdeckungsrisiko. Gedacht für den Einstieg (erster Betrieb).

**F-ML-06 – Folgen einer Entdeckung**

- Beschlagnahme aller Gutschriften dieses Betriebs aus den letzten 144 Ticks (vom Weißgeld).
- Strafe $\lceil 0{,}5 \cdot \text{beschlagnahmt} \rceil$ (zuerst Schwarz-, dann Weißgeld; Rest wird Schuld).
- Betrieb 144 Ticks geschlossen (kein Umsatz, kein Waschen, Unterhalt läuft weiter).
- Heat +40 in der Stadt.

## 5. Ablauf pro Tick

```text
for business in player.businesses (offen, mit Umsatz):
    R = business_income(...)                       # F-RE-01
    x = min(business.wash_setting, wash_capacity(R), player.cash_black)   # F-ML-02
    if x == 0: continue
    player.cash_black -= x
    credit = floor(x * (1 - wash_fee(...)))       # F-ML-01
    player.cash_white += credit; journal.append(t, business, credit)
    xp.finanzen += xp_gain(...)                    # F-PRF-02
    if U(seed, t, "wash/"+business.id, 0) < detection_risk(x, R, H, L):   # F-ML-03
        apply detection_penalty(sum(journal[business, t-143..t]))         # F-ML-06
```

Der Spieler stellt pro Betrieb einen Betrag pro Tick ein; die UI zeigt Gebühr und Tagesrisiko (F-ML-04) live.

## 6. Grenzwerte & Edge-Cases

- $x \le 3R$: Bei Verhältnis 3 beträgt das Risiko $0{,}009$ pro Tick (≈ 73 % pro Tag bei $H = 0$, L0).
- Geschlossene Betriebe waschen nicht; das Journal wird nach der Beschlagnahme geleert.
- Negatives Weißgeld (Schuld) sperrt Käufe mit Weißgeld, bis die Schuld getilgt ist.
- Gewaschenes Geld zählt nicht als Clan-Steuerbasis (nur Umsatz und Verkaufserlöse).

## 7. Beispielrechnungen

**EX-ML-01 – Spielhalle in Pleitenberg, Finanzen L5, Heat 20**

- Legaler Umsatz $R =$ **6 000 ct/Tick**; Kapazität $x_{max} = 3 \cdot 6000 =$ **18 000 ct/Tick**
- Gebühr $f = 0{,}10 \cdot (1 - 0{,}10) =$ **0,09**
- Waschen mit $x = R = 6\,000$: Gutschrift $\lfloor 6000 \cdot 0{,}91 \rfloor =$ **5 460 ct/Tick** (7 862,40 €/Tag)
- Risiko $p = 0{,}001 \cdot 1^2 \cdot 1{,}2 \cdot 0{,}9 =$ **0,00108** pro Tick → **0,1441** pro Tag

**EX-ML-02 – Tempo gegen Risiko (gleiche Spielhalle)**

| Verhältnis $x/R$ | Waschvolumen/Tag | Risiko pro Tag |
|---:|---:|---:|
| 0,5 | 4 320 € | **0,0381** |
| 1,0 | 8 640 € | 0,1441 |
| 2,0 | 17 280 € | **0,4639** |

Doppeltes Tempo vervierfacht etwa das Risiko pro Tick ($\gamma = 2$).

**EX-ML-03 – Strohmann**

Ein Spieler will 15 000 € waschen: angenommen werden **1 000 000 ct** (Tageslimit), Gutschrift **700 000 ct**.

**EX-ML-04 – Entdeckung nach einem vollen Tag aus EX-ML-01**

Journal: $144 \cdot 5\,460 =$ **786 240 ct** beschlagnahmt, Strafe $\lceil 0{,}5 \cdot 786\,240 \rceil =$ **393 120 ct**,
Spielhalle 1 Tag geschlossen, Heat +40.

## 8. Balancing-Ziele & Exploit-Analyse

| Ziel | Umsetzung / Prüfung |
|---|---|
| Strohmann ist nur Notlösung | 30 % Gebühr > jede Betriebsgebühr (INV-09), Tageslimit |
| Betriebe sind die einzige skalierbare Waschmethode | Kapazität an Umsatz gebunden |
| Gieriges Waschen wird bestraft | quadratisches Risiko, Rückgriff auf 144 Ticks |
| Heat verbindet Systeme | Heat aus Handel/Gewalt erhöht Waschrisiko in derselben Stadt |
| Geldsenke gegen Inflation | Gebühren und Strafen verlassen das Spiel |

**Exploit „viele kleine Betriebe“:** Das Risiko hängt vom Verhältnis $x/R$ je Betrieb ab, nicht von der
Anzahl. Viele Betriebe erhöhen die Kapazität linear – kosten aber Kaufpreis und Unterhalt. Das ist gewollter
Fortschritt.

## 9. Schnittstellen

| Richtung | System | Größe |
|---|---|---|
| ← | [real-estate.md](real-estate.md) | $R$, Gebühr je Typ, Schließung |
| ← | [cities.md](cities.md) | Heat; → Heat bei Entdeckung |
| ← | [professions.md](professions.md) | Finanzen-Boni; → Finanzen-XP |
| → | [combat.md](combat.md) | nur Schwarzgeld plünderbar |
| → | [space.md](space.md), [clans.md](clans.md) | Weißgeld als Voraussetzung |

## 10. Offene Fragen

- Offshore-Konten (Weltraum) als zweite Waschmethode mit anderem Risikoprofil?
- Steuerprüfung als zufälliges Ereignis abhängig vom Verhältnis Weißgeld / legaler Umsatz?
