# Geldwäsche – Illegales und legales Vermögen

## 1. Zweck & Spielgefühl

Geld aus dem Warenhandel ist **Schwarzgeld** (Bargeld): Es kann geraubt werden, wird bei jeder Polizeikontrolle
**vollständig beschlagnahmt** (ADR-023, F-TRV-06) und reicht nicht für die großen Investitionen (Immobilien, Clan,
Raumfahrt). Sicher ist nur gewaschenes Geld auf dem **Bankkonto**. Geldwäsche ist deshalb kein Nebensystem,
sondern die **Progression** des Spiels:

| Stufe | Methode (Anzeigename) | ab | Kurs auf das Konto | Besonderheit |
|---|---|---|---:|---|
| W0 | Glücksspiel „Spielhölle Zum Goldenen Zufall“ | Start | 0,40–1,00 (Ø 0,70) | stark schwankend, kleines Tageslimit |
| W1 | Strohmann „Cousin Kalle“ | Finanzen L2 | 0,75 | fest, 10 000 € pro Tag |
| W2 | eigene Betriebe (Waschsalon … Bordell) | Kauf des Betriebs | 0,80–0,90 | Kapazität aus Umsatz, Entdeckungsrisiko |
| W3 | Scheinfirma „Briefkasten-GmbH auf dem Steuerfrei-Atoll“ | Finanzen L10 | 0,92 | Mindestbetrag 100 000 € |
| W4 | „Stiftung Sonnenschein (Insel Diskretistan)“ | Finanzen L15 | 0,95 | Mindestbetrag 1 Mio. €, Risiko „Diskretistan-Papers“ |

Je höher die Stufe, desto **stabiler und lukrativer**. Bei den Betrieben (W2) entsteht zusätzlich die Abwägung
zwischen **Tempo** und **Risiko**: Je mehr man im Verhältnis zum echten Umsatz wäscht, desto auffälliger wird es.
Alle Methoden sind rein spielmechanische Abstraktionen mit fiktiven Namen (ADR-013), keine Anleitung zu realer
Geldwäsche.

## 2. Zustandsvariablen

| Symbol | Bedeutung | Typ | Wertebereich |
|---|---|---|---|
| $B_s$ | Schwarzgeld (Bargeld) des Spielers | int64 ct | ≥ 0 |
| $B_w$ | Weißgeld (Bankkonto) | int64 ct | darf durch Strafen negativ werden (Schuld) |
| $x_{b}$ | eingestellte Waschmenge je Betrieb pro Tick | int64 ct | $[0, x_{max}]$ |
| Waschjournal | (Tick, Betrieb, Gutschrift) der letzten 144 Ticks | Liste | – |
| Tageszähler je Stufe | heute über W0, W1, W3, W4 gewaschen | int64 ct | $[0, \text{cap}]$ |
| W4-Journal | (Tick, Gutschrift) der letzten 4 320 Ticks | Liste | – |
| Kredithai-Rest | offene Rückzahlung | int64 ct | ≥ 0 |

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
| $r_{min}, r_{max}$ | `laundering.tiers.gambling.rate_min` / `laundering.tiers.gambling.rate_max` | 0,40 / 1,00 | Kursspanne Glücksspiel (W0) |
| $c_0, c_L$ | `laundering.tiers.gambling.daily_cap_base` / `laundering.tiers.gambling.daily_cap_per_level` | 2 000 € / 1 000 € | Tageslimit W0 = $c_0 + c_L \cdot L_{Finanzen}$ |
| $r_S$ | `laundering.tiers.strawman.rate` | 0,75 | Kurs Strohmann (W1), ab `laundering.tiers.strawman.min_level` = 2 |
| – | `laundering.tiers.strawman.daily_cap` | 10 000 € | Tageslimit W1 |
| – | `laundering.tiers.shell.rate` / `laundering.tiers.shell.min_amount` / `laundering.tiers.shell.daily_cap` | 0,92 / 100 000 € / 1 Mio. € | Scheinfirma (W3), ab L10 |
| – | `laundering.tiers.foundation.rate` / `laundering.tiers.foundation.min_amount` / `laundering.tiers.foundation.daily_cap` | 0,95 / 1 Mio. € / 10 Mio. € | Stiftung (W4), ab L15 |
| $p_P$ | `laundering.tiers.foundation.papers_probability_per_day` | 0,002 | „Papers“-Enthüllung pro Tag |
| – | `laundering.tiers.foundation.papers_confiscation_rate` / `laundering.tiers.foundation.papers_lookback_ticks` | 0,25 / 4 320 | Beschlagnahme der W4-Gutschriften der letzten 30 Tage |
| – | `loan_shark.amount` | 100 000 € | Kredithai, Auszahlung als Schwarzgeld |
| – | `loan_shark.max_vehicles` / `loan_shark.max_weapons` / `loan_shark.max_assets` | 1 / 0 / 2 000 € | Bedingungen Kredithai |
| – | `loan_shark.repayment_rate` / `loan_shark.repay_factor` | 0,5 / 1,0 | Tilgung aus Verkaufserlösen, Rückzahlungsfaktor |

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
| Waren, Waffen, Rüstung, Crew, Treibstoff, Bahn | ✔ | ✔ |
| Bestechung bei Kontrollen | ✔ (nur mitgeführtes) | – |
| Fahrzeuge | ✔ | ✔ |
| Betriebe kaufen/ausbauen, Clan gründen/ausbauen, Raumschiffe, Startgebühr Raumhafen | – | ✔ |
| Strafen (F-ML-06) | zuerst schwarz | Rest |
| Beschlagnahmt bei Polizeikontrolle (F-TRV-06) | **ja, vollständig** | nein |

Bei Zahlungen, die beides erlauben, wird **zuerst Schwarzgeld** verwendet. Schwarzgeld lässt sich **nirgends
sicher parken**: Lagerhaus und Immobilien schützen nur Ware, kein Bargeld.

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

**F-ML-05 – Strohmann „Cousin Kalle“ (Stufe W1, risikofrei, begrenzt)**

```math
x' = \min(x,\; \text{cap} - \text{heute\_genutzt}), \qquad \text{Gutschrift} = \lfloor x' \cdot r_S \rfloor
```

Ab Finanzen L2. Sofortige Gutschrift, kein Entdeckungsrisiko. Brücke zwischen Glücksspiel und erstem Betrieb.

**F-ML-06 – Folgen einer Entdeckung**

- Beschlagnahme aller Gutschriften dieses Betriebs aus den letzten 144 Ticks (vom Weißgeld).
- Strafe $\lceil 0{,}5 \cdot \text{beschlagnahmt} \rceil$ (zuerst Schwarz-, dann Weißgeld; Rest wird Schuld).
- Betrieb 144 Ticks geschlossen (kein Umsatz, kein Waschen, Unterhalt läuft weiter).
- Heat +40 in der Stadt.

**F-ML-07 – Glücksspiel „Spielhölle Zum Goldenen Zufall“ (Stufe W0)**

Jederzeit und ab Spielbeginn verfügbar, in jeder Stadt. Jeder Vorgang $n$ würfelt einen eigenen Kurs:

```math
r = r_{min} + (r_{max} - r_{min}) \cdot U(\text{seed}, t, \texttt{gamble/<spieler>/<n>}, 0), \qquad \mathbb{E}[r] = \frac{r_{min} + r_{max}}{2} = 0{,}70
```

```math
\text{cap}_{W0} = c_0 + c_L \cdot L_{Finanzen}, \qquad x' = \min(x,\; \text{cap}_{W0} - \text{heute\_genutzt}), \qquad \text{Gutschrift} = \lfloor x' \cdot r \rfloor
```

Kein Entdeckungsrisiko, keine Heat. Der Kurs wird erst nach dem Einsatz angezeigt (Glücksspiel).

**F-ML-08 – Festkurs-Stufen W3 Scheinfirma und W4 Stiftung**

Verfügbar ab dem jeweiligen Finanzen-Level (`min_level`). Ein Vorgang wird abgelehnt, wenn $x$ unter dem
Mindestbetrag liegt. Sonst:

```math
x' = \min(x,\; \text{cap} - \text{heute\_genutzt}), \qquad \text{Gutschrift} = \lfloor x' \cdot r_{Stufe} \rfloor
```

Sofortige Gutschrift. W3 hat kein eigenes Risiko; W4 hat das Ereignis F-ML-09. Freigeschaltete Stufen bleiben
nutzbar (W0 und W1 verschwinden nicht).

**F-ML-09 – „Diskretistan-Papers“ (Risiko der Stufe W4)**

Einmal täglich wird für jeden Spieler mit W4-Gutschriften in den letzten 4 320 Ticks gewürfelt
($U(\text{seed}, t, \texttt{papers/<spieler>}, 0) < p_P$). Bei einer Enthüllung:

```math
\text{Beschlagnahme} = \min\big(\text{Weißgeld},\; \lceil r_P \cdot \textstyle\sum \text{W4-Gutschriften der letzten 30 Tage} \rceil\big)
```

Höchstens bis zum Kontostand 0, keine Schuld. Heat +40 in der Stadt, in der sich der Spieler befindet; die
Enthüllung erscheint als satirische Schlagzeile im Ereignis-Ticker.

**F-ML-10 – Kredithai „Onkel Kredit-Klaus“ (Notkredit)**

Ausweg für Spieler, die nach einer Beschlagnahme nichts mehr haben. Verfügbar, wenn **alle** Bedingungen gelten:

- höchstens `loan_shark.max_vehicles` = 1 Fahrzeug (alle anderen verkauft),
- keine Waffe (alle verkauft),
- Schwarz- + Weißgeld < `loan_shark.max_assets` = 2 000 €,
- kein offener Kredithai-Kredit.

Auszahlung: 100 000 € als **Schwarzgeld** (also wieder beschlagnahmbar). Rückzahlung
$K = \text{amount} \cdot \text{repay\_factor}$, getilgt automatisch aus jedem Verkaufserlös $E$:

```math
\text{Tilgung} = \min\big(\text{Rest},\; \lceil 0{,}5 \cdot E \rceil\big), \qquad \text{an den Spieler} = E - \text{Tilgung}
```

Ein neuer Kredit ist erst nach vollständiger Tilgung möglich. Bei Kontolöschung verfällt der Rest (ADR-017).

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

**EX-ML-03 – Strohmann „Cousin Kalle“**

Ein Spieler will 15 000 € waschen: angenommen werden **1 000 000 ct** (Tageslimit), Gutschrift **750 000 ct**.

**EX-ML-04 – Entdeckung nach einem vollen Tag aus EX-ML-01**

Journal: $144 \cdot 5\,460 =$ **786 240 ct** beschlagnahmt, Strafe $\lceil 0{,}5 \cdot 786\,240 \rceil =$ **393 120 ct**,
Spielhalle 1 Tag geschlossen, Heat +40.

**EX-ML-05 – Glücksspiel (W0)**

Testvektor $U(\texttt{demo-server}, 1, \texttt{gamble/p1/1}, 0) =$ **0,969025** → Kurs $0{,}40 + 0{,}60 \cdot 0{,}969025 =$ **0,981415**.

- Finanzen L0, Tageslimit **200 000 ct**: Einsatz 1 500 € → Gutschrift $\lfloor 150\,000 \cdot 0{,}981415 \rfloor =$ **147 212 ct**
  (Glück gehabt; im Mittel kämen 105 000 ct an).
- Finanzen L5: Tageslimit **700 000 ct**; von 10 000 € Einsatz werden **700 000 ct** angenommen.
- Kursspanne immer zwischen **0,4** und **1,0**.

**EX-ML-06 – Freischaltung und Festkurs-Stufen**

| Finanzen-Level | verfügbare Direktwäsche |
|---:|---|
| 0 | **gambling** |
| 2 | **gambling,strawman** |
| 10 | **gambling,strawman,shell** |
| 15 | **gambling,strawman,shell,foundation** |

(dazu jeweils W2, sobald ein Betrieb gekauft ist)

- Scheinfirma, 1 Mio. € auf Level 10: Gutschrift **92 000 000 ct**; 50 000 € werden abgelehnt (**unter Mindestbetrag**).
- Stiftung, 5 Mio. € auf Level 15: Gutschrift **475 000 000 ct**; auf Level 12: **Level zu niedrig**.

**EX-ML-07 – „Diskretistan-Papers“**

$p = 0{,}002$ pro Tag → über ein Jahr $1 - 0{,}998^{365} =$ **0,5184**. Hat ein Spieler in den letzten 30 Tagen
9,5 Mio. € über die Stiftung gewaschen, werden bei einer Enthüllung $\lceil 0{,}25 \cdot 950\,000\,000 \rceil =$
**237 500 000 ct** vom Konto beschlagnahmt.

**EX-ML-08 – Kredithai**

| Lage | berechtigt |
|---|---|
| 1 Fahrzeug, keine Waffe, 500 € Bargeld | **True** |
| 2 Fahrzeuge | **False** |
| 1 Waffe | **False** |
| 1 500 € Bargeld + 1 000 € Konto (≥ 2 000 €) | **False** |

Auszahlung **10 000 000 ct**. Erster Verkauf über 4 000 €: Tilgung **200 000 ct**, an den Spieler **200 000 ct**,
Rest **9 800 000 ct**.

## 8. Balancing-Ziele & Exploit-Analyse

| Ziel | Umsetzung / Prüfung |
|---|---|
| Waschen ist Progression | Kurs steigt streng mit der Stufe: 0,70 < 0,75 < 0,80 … 0,90 < 0,92 < 0,95 (INV-16) |
| Strohmann ist nur Brücke | 25 % Abschlag > jede Betriebsgebühr (INV-09), Tageslimit |
| Totalbeschlagnahme führt nicht in die Sackgasse | Konto bleibt sicher und darf für Einkauf genutzt werden; Kredithai als letzter Ausweg (INV-17); Simulationsnachweis durch Agent 5 (T-120) |
| Superreiche tragen ein eigenes Risiko | „Papers“ beschlagnahmen 25 % der W4-Wäsche der letzten 30 Tage |
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

- Kalibrierung durch Agent 5 (Szenario `adr023`): W0-Spanne und -Limit, Mindestbeträge W3/W4,
  Kredithai-Schwelle und ob ein Rückzahlungsaufschlag (`loan_shark.repay_factor` > 1) nötig ist.
- Offshore-Konten im Weltraum als weitere Stufe mit eigenem Risikoprofil?
- Steuerprüfung als zufälliges Ereignis abhängig vom Verhältnis Weißgeld / legaler Umsatz?
