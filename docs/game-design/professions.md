# Berufe – Die fünf Betätigungsfelder

## 1. Zweck & Spielgefühl

Die fünf ursprünglichen „Berufe“ sind **keine Charakterklassen**, sondern fünf wirtschaftliche und
spielerische Betätigungsfelder. Grundsätze:

- **Keine Berufswahl** bei Spielbeginn.
- **Keine exklusiven Fähigkeiten** aufgrund einer Klasse.
- **Keine dauerhaften Einschränkungen** auf bestimmte Tätigkeiten.
- **Keine Verpflichtung**, sich auf einen Spielstil festzulegen.

Was ein Spieler tun kann, bestimmen **Kapital, Fähigkeiten (Level je Feld), Ausrüstung und Spielfortschritt**.
Fähigkeiten wachsen ausschließlich durch Tun („learning by doing“) und machen die jeweilige Tätigkeit
effizienter oder sicherer – sie schalten nie etwas frei, das nicht auch mit genug Kapital erreichbar wäre,
außer einigen Ausrüstungsstufen, die Erfahrung voraussetzen.

| Feld | Spielstil | Kernsysteme | Hauptbonus |
|---|---|---|---|
| **Handel** | Dealen, Märkte lesen | [trade.md](trade.md), [economy.md](economy.md) | geringerer Spread, Marktinformationen |
| **Schmuggel** | Transport großer Mengen über Grenzen | [travel.md](travel.md), [space.md](space.md) | weniger Kontrollen, bessere Bestechung |
| **Gewalt** | Vollstrecker, Überfälle, Gebietskämpfe | [combat.md](combat.md), [clans.md](clans.md) | höhere Kampfkraft |
| **Produktion** | Labore, Plantagen | [real-estate.md](real-estate.md) | mehr Ertrag |
| **Finanzen** | Geldwäsche, Betriebe, Immobilien | [money-laundering.md](money-laundering.md), [real-estate.md](real-estate.md) | geringere Gebühren, weniger Entdeckung |

Als kosmetischer **Titel** wird das Feld mit dem höchsten Level angezeigt (Gleichstand: Reihenfolge der
Tabelle), z. B. „Schmuggler (L12)“. Der Titel hat keine Spielwirkung.

## 2. Zustandsvariablen (pro Spieler)

| Symbol | Bedeutung | Typ | Wertebereich |
|---|---|---|---|
| $XP_f$ | Erfahrung je Feld $f$ | int64 | $\ge 0$ |
| $L_f$ | Level (abgeleitet, nicht gespeichert) | int | $0 \ldots 20$ |

## 3. Parameter (`professions.*`)

| Symbol | Schlüssel | Default | Bedeutung |
|---|---|---|---|
| $k$ | `professions.xp_per_level_k` | 100 | Skalierung der Level-Kurve |
| $L_{max}$ | `professions.level_max` | 20 | Höchstlevel |
| – | `professions.handel_xp_per_eur` | 0,01 | 1 XP je 100 € Handelsvolumen |
| – | `professions.schmuggel_xp_per_km` | 0,1 | 1 XP je 10 km mit illegaler Ladung |
| – | `professions.schmuggel_xp_per_cargo_heat` | 1,0 | + 1 XP je Punkt Ladungsheat $hv$ |
| – | `professions.gewalt_xp_win` / `professions.gewalt_xp_loss` | 50 / 10 | je Kampf |
| – | `professions.produktion_xp_per_unit` | 0,1 | 1 XP je 10 produzierte Einheiten |
| – | `professions.finanzen_xp_per_eur` | 0,001 | 1 XP je 1 000 € gewaschen |

### 3.1 Boni pro Level

| Feld | Bonus | Rate/Level | Obergrenze | Schlüssel | Wirkt in |
|---|---|---:|---:|---|---|
| Handel | Spread-Reduktion | 3 % | 60 % | `professions.handel_spread_reduction` | F-TRD-03 |
| Schmuggel | Kontrollrisiko-Reduktion | 2,5 % | 50 % | `professions.schmuggel_control_reduction` | F-TRV-04 |
| Schmuggel | Bestechungschance (absolut) | +1,5 Pp. | – (Clamp 0,9) | `professions.schmuggel_bribe_bonus` | F-TRV-06 |
| Gewalt | Kampfkraft | +3 % | +60 % | `professions.gewalt_strength_bonus` | F-CMB-01/02 |
| Produktion | Ertrag | +2,5 % | +50 % | `professions.produktion_yield_bonus` | F-RE-06 |
| Finanzen | Waschgebühr-Reduktion | 2 % | 40 % | `professions.finanzen_fee_reduction` | F-ML-01 |
| Finanzen | Entdeckungsrisiko-Reduktion | 2 % | 40 % | `professions.finanzen_risk_reduction` | F-ML-03 |

Zusätzliche **Informationsboni Handel** (keine Zahlenwirkung): ab L5 Preise der Nachbarstädte (≤ 300 km)
sichtbar, ab L10 Trendpfeil (Vorzeichen von $S_{target} - S$), ab L15 aktive Marktereignisse aller Städte.

### 3.2 Freischaltungen (`unlocks.*`)

Freischaltungen kombinieren Level **und** Kapital (Kaufpreis) – Kapital allein oder Level allein reicht nicht.

| Freischaltung | Bedingung Level | Weitere Bedingung | Schlüssel |
|---|---|---|---|
| LKW mit Schmuggelversteck | Schmuggel ≥ 5 | Kaufpreis 90 000 € | `unlocks.lkw.level` |
| Maschinenpistole | Gewalt ≥ 5 | 15 000 € | `unlocks.mp.level` |
| Sturmgewehr | Gewalt ≥ 10 | 40 000 € | `unlocks.sturmgewehr.level` |
| Profi-Crew | Gewalt ≥ 8 | 5 000 € je Person | `unlocks.profi.level` |
| Plantage | Produktion ≥ 1 | 120 000 € Weißgeld | `unlocks.plantage.level` |
| Labor | Produktion ≥ 3 | 250 000 € Weißgeld | `unlocks.labor.level` |
| Spielhalle | Finanzen ≥ 3 | 300 000 € Weißgeld | `unlocks.spielhalle.level` |
| Bordell | Finanzen ≥ 5 | 500 000 € Weißgeld | `unlocks.bordell.level` |
| Clan gründen | Summe aller Level ≥ 15 | 50 000 € Weißgeld | `unlocks.clan_gruendung.level_sum` |
| Weltraum | Schmuggel ≥ 10 | Nettovermögen ≥ 5 Mio. €, Raumhafen | `unlocks.weltraum.networth` |

Alles andere (Kleinwagen, Transporter, Waschsalon, Bar, Pistole …) ist nur eine Kapitalfrage.

## 4. Formeln

**F-PRF-01 – Level-Kurve**

```math
L = \min\Big(L_{max},\; \Big\lfloor \sqrt{XP / k} \Big\rfloor\Big), \qquad XP(L) = k \cdot L^2
```

Quadratische Kurve: frühe Level kommen schnell, Level 20 erfordert 40 000 XP.
Implementierung ganzzahlig: $L = \min(L_{max}, \operatorname{isqrt}(\lfloor XP / k \rfloor))$.

**F-PRF-02 – XP-Zuwachs**

| Feld | Formel (abgerundet) | Auslöser |
|---|---|---|
| Handel | $\lfloor V_{€} \cdot 0{,}01 \rfloor$ | jede Order, $V$ = Volumen |
| Schmuggel | $\lfloor d \cdot 0{,}1 + hv \rfloor$ | Ankunft mit illegaler Ladung (nicht bei Beschlagnahme) |
| Gewalt | 50 (Sieg) / 10 (Niederlage) | jeder Kampf |
| Produktion | $\lfloor Q \cdot 0{,}1 \rfloor$ | Einsammeln der Produktion |
| Finanzen | $\lfloor x_{€} \cdot 0{,}001 \rfloor$ | jede Waschgutschrift |

**F-PRF-03 – Bonusfunktion**

```math
b_f(L) = \min(\text{cap}_f,\; \text{rate}_f \cdot L)
```

Boni verschiedener Quellen (Skill, Ausrüstung, Clan) werden **multiplikativ** verknüpft, z. B.
$(1 - \text{hide}) \cdot (1 - b_{Schmuggel})$. Damit kann kein Risiko durch Stapeln auf 0 sinken.

## 5. Ablauf

```text
on action(player, field, payload):
    gained = xp_gain(field, payload)        # F-PRF-02
    old = level(player.xp[field])
    player.xp[field] += gained
    if level(player.xp[field]) > old: notify("Level-Up", field)
```

Level werden bei jeder Nutzung aus XP berechnet (keine Speicherung, keine Inkonsistenz).

## 6. Grenzwerte & Edge-Cases

- Kein XP-Verlust, kein Respec nötig (es gibt nichts zu „verskillen“).
- Kein globales Skill-Limit: Ein Spieler kann theoretisch alle Felder auf 20 bringen; begrenzend ist allein
  die Zeit (alle Tätigkeiten konkurrieren um dieselbe Echtzeit und dasselbe Kapital).
- XP-Farming durch Kauf und Sofortverkauf ist teuer: Ein Round-Trip über 100 € bringt 2 XP (Kauf + Verkauf)
  und kostet selbst auf Level 20 mindestens 4 % Spread, also ≥ 2 € je XP (INV-03).

## 7. Beispielrechnungen

**EX-PRF-01 – Level-Kurve**

| XP | Level |
|---:|---:|
| 2 500 | **5** |
| 9 999 | **9** |
| **10 000** | 10 |
| **40 000** | 20 |

**EX-PRF-02 – XP aus der Schneegestöber-Route (EX-TRD-01, EX-TRV-02)**

- Handel: Einkaufsvolumen 11 263,03 € → $\lfloor 112{,}63 \rfloor =$ **112** XP (der Verkauf bringt weitere XP)
- Schmuggel: $\lfloor 820 \cdot 0{,}1 + 24 \rfloor =$ **106** XP
- Finanzen: 8 640 € gewaschen (ein Tag Spielhalle, EX-ML-01) → **8** XP

**EX-PRF-03 – Boni auf Level 10 und 20**

| Bonus | L10 | L20 |
|---|---:|---:|
| Spread | **0,07** | **0,04** |
| Kontrollrisiko-Reduktion | **0,25** | 0,50 |
| Kampfkraft | **+0,30** | +0,60 |
| Waschgebühr-Reduktion | **0,20** | 0,40 |

## 8. Balancing-Ziele

| Ziel | Umsetzung |
|---|---|
| Spezialisierung lohnt, ist aber nicht Pflicht | Boni bis 40–60 %, Grundfunktion für alle verfügbar |
| Generalisten sind nicht dominant | quadratische XP-Kurve: L10 in fünf Feldern = 50 000 XP, L20 in einem = 40 000 XP |
| Felder sind gleich wertvoll | jedes Feld beeinflusst eine Hauptgeldquelle |
| Neue Spieler sind nicht chancenlos | Anfängerschutz (F-CMB-06), günstiger Einstieg über Handel |

## 9. Schnittstellen

Alle Systeme lesen Level über F-PRF-01 und Boni über F-PRF-03; alle Systeme melden Aktionen über F-PRF-02.

## 10. Offene Fragen

- **Namen der fünf Felder:** Die Bezeichnungen Handel, Schmuggel, Gewalt, Produktion und Finanzen sind ein
  Vorschlag, abgeleitet aus der Systemliste. Falls das Originalspiel andere Namen verwendet, werden nur
  Anzeigenamen und die Schlüssel in `professions.fields` angepasst.
- **Pflicht wegen R-2 (keine Resets, siehe README):** Aufhol-XP für Spieler unter dem Server-Median
  (z. B. XP-Multiplikator abhängig vom Abstand zum Median), damit der Vorsprung früher Spieler nicht unbegrenzt
  wächst. Noch nicht spezifiziert.
- Soll ein Feld ab Level 20 „Prestige-Ränge“ für Ranglisten bekommen? (Ranglisten nach Zuwachs statt Saisons, R-2)
