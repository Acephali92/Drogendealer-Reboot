# NPCs – Händler, Kuriere, Banden und ihr Rückbau

## 1. Zweck & Spielgefühl

Der Server startet mit **wenigen Spielern** (R-1) und wird **nie zurückgesetzt** (R-2). Ohne Gegenspieler
gehört eine profitable Route einem einzelnen Spieler allein, und Gewalt-Spieler finden wegen Vermögensband,
Anfängerschutz und Cooldowns kaum gültige Ziele. NPCs füllen diese Lücken:

| NPC | Rolle | Wirkung auf die Geldmenge |
|---|---|---|
| **NPC-Händler** | konkurrieren um Handelsmargen | neutral (verschieben nur Marktbestände) |
| **NPC-Kuriere** | Ziele für das Feld Gewalt | Quelle (begrenzt) |
| **NPC-Banden** | Risiko für Spieler mit viel Bargeld | Senke |

Alle NPC-Raten werden mit der **NPC-Intensität $k \in [0, 1]$** skaliert. $k$ startet bei 1 und sinkt erst, wenn
genug echte Spieler die Mechanik tragen (Product-Owner-Entscheidung Q12, F-NPC-04). NPCs sind im Spiel als
satirische Figuren dargestellt (ADR-013), etwa „Onkel Ottos Fahrradkuriere“ oder „Die Rentnergang vom Kiosk“.
Die Regeln selbst sind namensneutral.

NPCs agieren nur auf der Erde. Im Weltraum übernehmen Piraten (F-SPC-04) die Rolle der Banden.

## 2. Zustandsvariablen

| Symbol | Bedeutung | Typ | Wertebereich |
|---|---|---|---|
| $k$ | NPC-Intensität (serverweit) | float64 | $[0, 1]$ |
| met / miss | Tage in Folge mit erfüllten bzw. verfehlten Kennzahlen | int | $\ge 0$ |
| Kuriere | aktive Kuriere je Stadt (Stufe, Ablauf-Tick) | Liste | – |
| letzter Banden-Überfall | je Spieler | int (Tick) | – |
| letzter Kurier-Überfall | je Spieler | int (Tick) | – |

## 3. Parameter (`npc.*`)

| Symbol | Schlüssel | Default | Bedeutung |
|---|---|---|---|
| $k_0$ | `npc.k_start` | 1,0 | Startwert der Intensität |
| – | `npc.k_min` / `npc.k_max` | 0,0 / 1,0 | Grenzen von $k$ |
| $\eta$ | `npc.trader_intensity` | 0,5 | Handelsvolumen der NPCs relativ zu $\min(A_a, D_b)$ |
| $\theta_0$ | `npc.trader_threshold_base` | 0,15 | Mindestmarge, ab der NPCs handeln |
| $\theta_{km}$ | `npc.trader_threshold_per_km` | 0,0002 | Margenzuschlag je km |
| $\theta_s$ | `npc.trader_threshold_scale` | 0,5 | Marge über der Schwelle, ab der NPCs voll aktiv sind |
| – | `npc.couriers_per_city_day` | 4 | Kuriere je Stadt und Tag (bei $k = 1$) |
| – | `npc.courier_tiers` | 5 | Stufen |
| $K_0, g_K$ | `npc.courier_strength_base` / `npc.courier_strength_growth` | 40 / 1,8 | Kurierstärke |
| $C_0, g_C$ | `npc.courier_cash_base` / `npc.courier_cash_growth` | 500 € / 2,0 | Kurier-Bargeld |
| – | `npc.courier_cooldown_ticks` | 18 | Abstand zwischen zwei Kurier-Überfällen eines Spielers |
| $p_G$ | `npc.gang_attack_base` | 0,0007 | Banden-Überfall pro Tick |
| – | `npc.gang_min_cash` | 10 000 € | nur Spieler mit mindestens so viel Bargeld |
| – | `npc.gang_cooldown_ticks` | 144 | höchstens ein Banden-Überfall pro Tag und Spieler |
| $\phi_G$ | `npc.gang_strength_factor` | 0,8 | Bandenstärke relativ zur Verteidigungskraft des Opfers |
| – | `npc.handover_route_competition` | 0,5 | Kennzahl-Schwelle Routen-Konkurrenz |
| – | `npc.handover_target_availability` | 0,3 | Kennzahl-Schwelle Ziel-Verfügbarkeit |
| – | `npc.handover_market_activity` | 0,6 | Kennzahl-Schwelle Marktaktivität |
| – | `npc.handover_min_peak_online` | 15 | Spieler gleichzeitig online zur Tagesspitze |
| – | `npc.handover_hold_days` / `npc.handover_miss_days` | 14 / 7 | Haltedauer bis zum ersten Schritt |
| – | `npc.handover_step` / `npc.handover_step_days` | 0,1 / 7 | Schrittweite und Abstand weiterer Schritte |
| – | `npc.handover_top_routes` | 10 | Anzahl betrachteter Top-Routen |

## 4. Formeln

**F-NPC-01 – NPC-Händler**

Für jede Erdware $g$ und jedes geordnete Städtepaar $(a, b)$ mit Distanz $d$:

```math
m = \frac{P_b\,(1 - s/2)}{P_a\,(1 + s/2)} - 1, \qquad \theta = \theta_0 + \theta_{km} \cdot d, \qquad f = \operatorname{clamp}\Big(\frac{m - \theta}{\theta_s}, 0, 1\Big)
```

```math
q_{a \to b} = k \cdot \eta \cdot \min(A_a, D_b) \cdot f
```

- $P$ nach F-ECO-06 **ohne Rauschen**, $s$ = Grund-Spread (F-TRD-03, Level 0), $A_a$ nach F-ECO-02, $D_b$ nach F-ECO-01.
- Alle Flüsse eines Ticks werden aus **demselben** Zustand berechnet und dann gleichzeitig angewendet:
  $S_a \mathrel{-}= q$, $S_b \mathrel{+}= q$ (Untergrenze $S_{min}$), danach die Erholung F-ECO-04.
- NPC-Ware ist abstrakt (kein Transport, keine Kontrollen, kein Geld). NPCs bewegen nur Bestände und damit Preise.
  Die Schwelle $\theta$ bildet ihre Reise- und Risikokosten ab.

**F-NPC-02 – NPC-Kuriere (Ziele für Gewalt)**

- Pro Stadt erscheinen täglich $k \cdot 4$ Kuriere (gerundet, Stufe gleichverteilt per F-GLB-01), jeder ist
  36 Ticks angreifbar. Sie sind nur für Spieler sichtbar, die in der Stadt sind.
- Stufe $t \in \{1, \dots, 5\}$:

```math
K_t = K_0 \cdot g_K^{\,t-1}, \qquad C_t = C_0 \cdot g_C^{\,t-1}
```

- Ein Überfall ist ein normaler Kampf (F-CMB-01/03) mit $K_D = K_t$, ohne Heimbonus. Bei Sieg erhält der Spieler
  $\lfloor C_t \cdot (1 - f_H) \rfloor$ ($f_H$ = Hehlerabschlag, F-CMB-05). Der Kurier verschwindet in jedem Fall.
- Heat +15 wie bei einem Angriff, Gewalt-XP wie im PvP (F-PRF-02). Cooldown 18 Ticks pro Spieler.
- Verliert der Spieler, gelten Crew- und HP-Verluste nach F-CMB-04/07; Beute gibt es für den Kurier nicht.

**F-NPC-03 – NPC-Banden (Risiko und Geldsenke)**

```math
p_{Bande} = \begin{cases} k \cdot p_G & \text{Bargeld} \ge 10\,000\,€,\ \text{kein Anfängerschutz},\ \ge 144 \text{ Ticks seit letztem Banden-Überfall} \\ 0 & \text{sonst} \end{cases}
```

- Gewürfelt pro Tick und Spieler mit $U(\text{seed}, t, \texttt{gang/<spieler>}, 0)$, nur in Städten, nicht auf Reisen.
- Stärke der Bande: $K_G = \phi_G \cdot K_D$ (Verteidigungskraft des Opfers nach F-CMB-02), Kampf nach F-CMB-03 mit
  der Bande als Angreifer. Bei $\phi_G = 0{,}8$ gewinnt die Bande in rund 42 % der Fälle.
- Gewinnt die Bande, gilt die Beuteformel F-CMB-05 (inklusive Tageslimit). Die Beute **verlässt das Spiel**.
  Gewinnt der Spieler, erhält er Gewalt-XP, aber keine Beute.

**F-NPC-04 – Rückbau der NPCs (Intensität $k$)**

Einmal täglich (Tageswechsel, Tick $\equiv 0 \bmod 144$) werden vier Kennzahlen aus **echten Spielern** gemessen:

| Kennzahl | Definition | Ziel |
|---|---|---|
| Routen-Konkurrenz | Anteil der 10 margenstärksten Routen (F-NPC-01 bei $k = 0$), auf denen in den letzten 1 008 Ticks ≥ 2 verschiedene Spieler verkauft haben | ≥ 0,5 |
| Ziel-Verfügbarkeit | Anteil der aktiven Spieler (Aktion in den letzten 144 Ticks), die zur Tagesspitze ≥ 1 gültiges PvP-Ziel nach F-CMB-06 hatten | ≥ 0,3 |
| Marktaktivität | Anteil der Erdmärkte (Stadt × Ware) mit ≥ 1 Spielertransaktion in den letzten 144 Ticks | ≥ 0,6 |
| Spitzen-Online | höchste Zahl gleichzeitig online in den letzten 144 Ticks | ≥ 15 |

Ein Tag gilt als **erfüllt**, wenn alle vier Ziele erreicht sind. Mit den Zählern met (erfüllte Tage in Folge) und
miss (verfehlte Tage in Folge; ein Tag setzt jeweils den anderen Zähler auf 0):

```math
k \leftarrow k - 0{,}1 \quad \text{wenn met} \in \{14, 21, 28, \dots\}, \qquad k \leftarrow k + 0{,}1 \quad \text{wenn miss} \in \{7, 14, 21, \dots\}
```

danach $k \leftarrow \operatorname{clamp}(k, 0, 1)$. $k$ ist serverweit und wird im Journal protokolliert.

## 5. Tick-Reihenfolge

NPC-Schritte laufen in der Tick-Reihenfolge (README §4) so:

1. Ereignisse (F-ECO-09)
2. **NPC-Händlerflüsse (F-NPC-01)**, danach Märkte (F-ECO-04/05/06)
3. Reisen
4. Betriebe, Geldwäsche, Clans
5. **NPC-Kuriere erscheinen/verfallen (F-NPC-02), Banden-Überfälle (F-NPC-03)**
6. Spielerzustand; am Tageswechsel **Kennzahlen und $k$ (F-NPC-04)**

## 6. Grenzwerte & Edge-Cases

- $k = 0$ schaltet alle NPCs ab; die Wirtschaft verhält sich dann exakt wie ohne dieses Dokument.
- NPC-Händler können keinen Markt unter $S_{min}$ drücken und handeln nie über die Preisgrenzen hinaus
  (die Marge wird aus geklemmten Preisen berechnet).
- Kuriere sind keine Spieler: Vermögensband, Anfängerschutz und Ziel-Cooldown gelten nicht, wohl aber der Kurier-Cooldown.
- Banden greifen niemanden mit Anfängerschutz an und zählen beim Tageslimit der Beute mit (F-CMB-05).
- Geldquelle Kuriere: höchstens $8 \cdot 4 \cdot C_5 \cdot 0{,}85 = 217\,600$ € pro Tag serverweit (nur wenn jeder
  Kurier Stufe 5 hätte und jeder Überfall gelänge); im Erwartungswert deutlich weniger.

## 7. Beispielrechnungen

**EX-NPC-01 – NPC-Konkurrenz auf der Schneegestöber-Route Containerdam → Protzingen**

Zu Beginn (Märkte im Gleichgewicht ohne NPCs):

- $m = 15\,413{,}63 \cdot 0{,}95 / (5\,059{,}64 \cdot 1{,}05) - 1 =$ **1,7563**
- $\theta = 0{,}15 + 0{,}0002 \cdot 820 =$ **0,314**, $f = \operatorname{clamp}((1{,}7563 - 0{,}314)/0{,}5) =$ **1,0**
- $q = 1 \cdot 0{,}5 \cdot \min(6{,}5;\ 13{,}44) =$ **3,25** Einheiten pro Tick (nur diese eine Route)

Gleichgewicht nach Einschwingen (alle Routen aller Städte gleichzeitig, kein Spieler):

| | $k = 0$ | $k = 1$ |
|---|---:|---:|
| Bestand Containerdam | **936,0** | **663,3** |
| Bestand Protzingen | **691,2** | **1 161,9** |
| Preis Containerdam | **5 059,64 ct** | **6 010,53 ct** |
| Preis Protzingen | **15 413,63 ct** | **11 888,32 ct** |
| Preisverhältnis | **3,0464** | **1,9779** |

Die NPCs halbieren die Marge der besten Route etwa (+205 % → +98 %), die Route bleibt aber deutlich profitabel
(INV-14: ≈ 10 000 € pro Transporter-Fahrt statt ≈ 28 500 €).

**EX-NPC-02 – Kurierstufen**

| Stufe | Stärke $K_t$ | Bargeld $C_t$ |
|---:|---:|---:|
| 1 | **40,0** | **50 000 ct** |
| 2 | **72,0** | **100 000 ct** |
| 3 | **129,6** | **200 000 ct** |
| 4 | **233,28** | **400 000 ct** |
| 5 | **419,9** | **800 000 ct** |

Der Angreifer aus EX-CMB-01 ($K_A = 87{,}084$) gegen einen Kurier der Stufe 2: Siegchance **0,5708**,
Beute nach Hehlerabschlag **85 000 ct**. Pro Stadt erscheinen bei $k = 1$ täglich **4** Kuriere.

**EX-NPC-03 – Banden-Risiko**

Spieler mit 20 000 € Bargeld, kein Anfängerschutz, Verteidigungskraft $K_D = 49{,}076$ (EX-CMB-01):

- $p = 1 \cdot 0{,}0007 =$ **0,0007** pro Tick → **0,0959** pro Tag (F-ML-04); bei $k = 0{,}5$: **0,00035** pro Tick
- Mit nur 9 000 € Bargeld: **0** (unter `npc.gang_min_cash`)
- Bandenstärke $0{,}8 \cdot 49{,}076 =$ **39,261**, die Bande gewinnt mit **0,4171**
- Gewinnt sie, verliert der Spieler **500 000 ct** (25 % des Bargelds, F-CMB-05); das Geld verschwindet.

**EX-NPC-04 – Rückbau von $k$**

35 Tage alle Kennzahlen erfüllt, danach 14 Tage verfehlt:

| Tag | 13 | 14 | 21 | 35 | 42 | 49 |
|---|---:|---:|---:|---:|---:|---:|
| $k$ | **1,0** | **0,9** | **0,8** | **0,6** | **0,7** | **0,8** |

## 8. Balancing-Ziele & Exploit-Analyse

| Ziel | Umsetzung / Prüfung |
|---|---|
| Kein Spieler schöpft eine Route allein ab | NPC-Händler senken Top-Margen spürbar (INV-14) |
| Routen bleiben trotzdem lohnend | Referenz- und Startrouten bleiben mit $k = 1$ profitabel (INV-14) |
| Gewalt-Spieler haben immer Ziele | 4 Kuriere pro Stadt und Tag in 5 Stärkestufen |
| Bargeld horten ist riskant | Banden ab 10 000 € Bargeld, Beute ist Geldsenke |
| NPCs verschwinden nur bei echter Aktivität | 14 Tage Haltedauer, Rückkehr nach 7 Fehltagen (INV-15) |

**Kennzahlen manipulieren** (Multi-Accounts handeln zum Schein auf Top-Routen, um $k$ zu senken): Die Spitzen-
Online-Schwelle und die Ziel-Verfügbarkeit verlangen viele echte, aktive Accounts gleichzeitig; ein Absenken von
$k$ schadet zudem dem Manipulierenden selbst nicht, sondern erhöht nur die Konkurrenz durch Spieler.

**Kurier-Farming:** Kuriere sind begrenzt (pro Stadt und Tag) und verschwinden nach einem Überfall; der
Hehlerabschlag und der Heat-Zuwachs machen Dauer-Farming teuer.

## 9. Schnittstellen

| Richtung | System | Größe |
|---|---|---|
| ↔ | [economy.md](economy.md) | Bestandsflüsse vor F-ECO-04 |
| ← | [trade.md](trade.md) | Spread für die Margenberechnung |
| ↔ | [combat.md](combat.md) | Kämpfe gegen Kuriere/Banden über F-CMB-01 bis F-CMB-07 |
| ← | [cities.md](cities.md) | Distanzen, Angebot, Nachfrage |
| → | Balancing (Agent 6) | Kennzahlen und $k$ werden im Journal protokolliert |

## 10. Offene Fragen

- Sollen NPC-Händler auch Weltraummärkte bedienen, sobald dort mehrere Spieler aktiv sind?
- Sollen Kurierstufen an das Vermögen der anwesenden Spieler angepasst werden (statt Gleichverteilung)?
- Werte der Kennzahl-Schwellen werden von Agent 6 in der Simulation (S8-npc-handover) überprüft.
