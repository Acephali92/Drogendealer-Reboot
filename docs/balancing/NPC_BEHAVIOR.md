# NPC_BEHAVIOR – NPC- und Marktakteure

> Agent 5 – Game Balancing & Simulation · Stand 2026-11-09
>
> **Grundlage [Regel]:** `docs/game-design/npc.md` (Agent 2) mit F-NPC-01 bis F-NPC-04 und `parameters.toml` `[npc]`. Dazu ADR-016 (kleine Spielerzahl, keine Resets) und die Antwort des Product Owners auf Q12 (R-4).
> **Ergänzungen [Design]:** Kundenbindung (NPC-1b) und Polizeidruck (NPC-4) von Agent 5. Werte stehen in `sim/proposals.toml` `[npc_ext]`, noch nicht beschlossen.
> Messungen: [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md), Szenarien `npc`, `npc-half`, `npc-ext`, `s8-handover`.

## 1. Gestaltungsprinzipien

1. **NPCs füllen eine kleine Welt, ersetzen aber keine Spieler.** Ihre Stärke k ∈ [0, 1] sinkt erst, wenn echte Spieler die Mechanik messbar tragen (R-4, F-NPC-04).
2. **Aggregiert statt einzeln.** NPCs sind Ströme und Zustände je (Stadt, Ware) bzw. Route, keine Einzelfiguren. Das ist günstig im Tick, testbar und reicht für interessante Entscheidungen.
3. **Unterschiedliches Verhalten.** Jeder Typ hat eigene Bedürfnisse, eigene Kaufkraft, eigene Risikobereitschaft und eine eigene Reaktionszeit (§2).
4. **Nachvollziehbar.** NPC-Ströme tragen im Preisjournal die Ursache `NPC` (Anforderung T-6, [GAME_ECONOMY.md §7](GAME_ECONOMY.md#7-anforderungen-an-die-technische-umsetzung-agent-3)). Jede Änderung von k landet im Journal (ADR-016, F-NPC-04).
5. **Satirisch, nicht realistisch** (ADR-013). Anzeigenamen stehen in `parameters.toml` (`name`), die technischen Schlüssel bleiben stabil.

## 2. NPC-Typen

| ID | Typ | Status | Bedürfnis | Kaufkraft | Risikobereitschaft | Loyalität | Verhalten über die Zeit | Wirkung im Spiel |
|---|---|---|---|---|---|---|---|---|
| NPC-1a | Stadtbevölkerung (Konsum) | [Regel] F-ECO-01/02 | Grundnachfrage | W^β (Wohlstand) | – | – | Ereignisse F-ECO-09; [Design] Zyklus/Krise F-ECO-10/12 | Nachfrage D, Angebot A |
| NPC-1b | Stammkundschaft | **[Design]** | verlässliche Versorgung | mittel | – | **Kundenbindung** bei guter Versorgung (bis +10 %), **Abwanderung** bei Knappheit (bis −25 %) | Gedächtnis über Tage | Wer einen Markt dauerhaft leer kauft, verliert dort Kundschaft. Zuverlässiges Liefern lohnt sich. |
| NPC-2 | NPC-Händler | **[Regel] F-NPC-01** | Marge über Schwelle θ = θ₀ + θ_km · d | fließt mit k · η · min(A_a, D_b) | über θ abgebildet: weite Strecken brauchen mehr Marge | – | reagiert jeden Tick auf den rauschfreien Preis | gleicht Preisunterschiede aus. Die Top-Route verliert gut die Hälfte ihrer Marge (EX-NPC-01: Preisverhältnis 3,05 → 1,98). |
| NPC-3a | Kuriere | [Regel] F-NPC-02 (Agent 2, Kampf) | – | 5 Stufen, Bargeld 500 € · 2^(t−1) | gering | – | k · 4 pro Stadt und Tag, Abklingzeit 18 Ticks | **Ziele** für das Feld Gewalt, auch ohne Mitspieler |
| NPC-3b | Banden | [Regel] F-NPC-03 (Agent 2, Kampf) | Beute | Stärke 0,8 · K_Spieler | hoch | Revier | p = k · 0,0007/Tick, nur ab 10.000 € Bargeld, ohne Neulingsschutz | **Risiko** für reiche Händler mit viel Bargeld. Beute ist eine Senke (F-CMB-05). |
| NPC-4 | Polizei (systemisch) | **[Design]** | Ordnung | – | – | – | Druck steigt mit dem Handelsvolumen einer Stadt und klingt 1 %/Tick ab | mehr Kontrollen in „überhitzten“ Städten, Handel verteilt sich |

NPC-3a/3b gehören zu Agent 2s Kampfsystem und sind in der Simulation **noch nicht** umgesetzt (Phase P2).

## 3. Formeln

### 3.1 F-NPC-01 NPC-Händler [Regel]

```math
m = \frac{P_b (1 - s/2)}{P_a (1 + s/2)} - 1, \quad \theta = \theta_0 + \theta_{km} d, \quad f = \operatorname{clamp}\Big(\frac{m - \theta}{\theta_s}, 0, 1\Big), \quad q_{a\to b} = k \, \eta \, \min(A_a, D_b) \, f
```

Die Preise werden ohne Rauschen berechnet. Alle Flüsse eines Ticks entstehen aus demselben Zustand und werden gleichzeitig angewendet, danach folgt F-ECO-04. NPC-Ware ist abstrakt: kein Geld, kein Transport, keine Kontrollen.

| Parameter | Wert | Grenzen | Bedeutung |
|---|---:|---|---|
| `npc.trader_intensity` η | 0,5 | [0; 2] | Anteil von min(A_a, D_b) pro Tick bei voller Marge |
| `npc.trader_threshold_base` θ₀ | 0,15 | – | Mindestmarge |
| `npc.trader_threshold_per_km` θ_km | 0,0002 | – | Aufschlag je km (Reise und Risiko) |
| `npc.trader_threshold_scale` θ_s | 0,5 | – | volle Aktivität ab θ + 0,5 |

Umsetzung in der Simulation: `sim/src/model/npc.ts` (`npcRouteFlow`, `npcTraderFlows`, `npcEquilibrium`). Golden-Test EX-NPC-01 ist grün.

### 3.2 NPC-1b Kundenbindung/Abwanderung [Design]

```math
\text{sat}_{t+1} = \text{sat}_t + r (z - \text{sat}_t), \qquad z = \begin{cases} d_{min} & v < v_{knapp} \\ d_{max} & v \ge 0{,}8 \\ 1 & \text{sonst} \end{cases}, \qquad v = S / S_{ref}
```

`sat` multipliziert die Nachfrage (M_d in F-ECO-01).

| Parameter (`sim/proposals.toml` `[npc_ext]`) | Vorschlag | Min | Max | Begründung |
|---|---:|---:|---:|---|
| `consumer_satisfaction_rate` r | 0,0005 | 0,0001 | 0,005 | Halbwertszeit ≈ 9,6 Tage, also träge: Ein einzelner Spielabend macht nichts kaputt. |
| `consumer_scarcity_threshold` | 0,5 | 0,3 | 0,8 | identisch mit der Stufe „knapp“ (F-CTY-03), also für Spieler sichtbar |
| `consumer_demand_min` | 0,75 | 0,5 | 1,0 | spürbar, kein Zusammenbruch |
| `consumer_demand_max` | 1,10 | 1,0 | 1,3 | Belohnung für zuverlässige Versorgung |

### 3.3 NPC-4 Polizeidruck [Design]

```math
\pi_{eff} = \min(1, \pi (1 + \text{druck})), \quad \text{druck} \mathrel{+}= \kappa \cdot V/100\,000 \text{ je Order}, \quad \text{druck} \leftarrow \text{druck}(1-\delta) \text{ je Tick}, \quad \text{druck} \le 0{,}3
```

Vorschlag: κ = 0,00002, Obergrenze 0,3, δ = 0,01. Der Polizeidruck wirkt über π auf die Kontrollen (F-TRV-04) und auf den Heat-Zerfall (F-CTY-01).

## 4. Rückbau der NPCs: F-NPC-04 [Regel] und R-4

Vorgabe des Product Owners (Q12): *„Erst wenn genug Spieler regelmäßig Online sind um die Spielmechanik zu tragen.“* Agent 2 hat dafür folgende Kennzahlen festgelegt, alle ausschließlich aus echten Spielern berechnet:

| Kennzahl | Ziel | Parameter |
|---|---|---|
| Routen-Konkurrenz: Anteil der 10 margenstärksten Routen (F-NPC-01 bei k = 0) mit ≥ 2 Verkäufern in 1 008 Ticks | ≥ 0,5 | `npc.handover_route_competition` |
| Ziel-Verfügbarkeit: Anteil aktiver Spieler mit ≥ 1 gültigem PvP-Ziel zur Tagesspitze | ≥ 0,3 | `npc.handover_target_availability` |
| Marktaktivität: Anteil der Erdmärkte mit Spielerhandel in 144 Ticks | ≥ 0,6 | `npc.handover_market_activity` |
| Spitzen-Online in 144 Ticks | ≥ 15 | `npc.handover_min_peak_online` |

Sind alle Ziele 14 Tage am Stück erfüllt, sinkt k um 0,1. Danach sinkt k alle 7 weiteren erfüllten Tage um 0,1. Wird 7 Tage verfehlt, steigt k um 0,1, danach wöchentlich. Der Wertebereich ist k ∈ [0, 1] (EX-NPC-04, Golden-Test grün).

**Prognose [gemessen]:** Szenario `s8-handover` (Zustrom 10 → 150 Spieler über 180 Tage) liefert, ab welcher Spielerzahl die Kennzahlen typischerweise erfüllt sind (siehe [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md)).
- **[Annahme]:** Die Ziel-Verfügbarkeit ist ohne Kampfsystem nicht simulierbar und gilt als erfüllt. Die Prognose ist daher eine **Untergrenze**.
- **[Annahme]:** Die Bots haben keine echte Tagesspitze, ihre Sitzungen sind gleichverteilt. Echte Spieler ballen sich abends, das Spitzen-Online wird live also schneller erreicht.

## 5. Erwartete Wirkung und Messung

| Hypothese | Messgröße | Ergebnis |
|---|---|---|
| H-NPC-1: F-NPC-01 verringert die Preisspreizung und bremst das Wachstum aller Händlerprofile. Die Startroute bleibt profitabel. | NW und Meilensteine A–E, Marge | `npc`, `npc-half` |
| H-NPC-2: Die Wirkung ist monoton in k. | NW E bei k = 0 / 0,5 / 1 | `base-short`, `npc-half`, `npc` |
| H-NPC-3: Kundenbindung bestraft das Leerkaufen, Polizeidruck verteilt den Handel. | knappe Markt-Ticks, Volumen der Top-Märkte, Kontrollquote | `npc-ext` |

## 6. Komplexität

| Mechanik | Rechenaufwand je Tick | Zustand |
|---|---|---|
| F-NPC-01 | O(Waren × Städte²) = 8 × 56 Flüsse, keine Zufallszüge | keiner |
| NPC-1b | 1 Multiplikation je Markt | 1 Zahl je Markt |
| NPC-4 | 1 Multiplikation je Stadt | 1 Zahl je Stadt |
| F-NPC-04 | 1× täglich | k, met, miss (Weltzustand, Journal) |

## 7. Offene Punkte

- F-NPC-02/03 (Kuriere, Banden) in die Simulation aufnehmen (Phase P2). Erst damit lässt sich die Ziel-Verfügbarkeit messen.
- NPC-1b und NPC-4: Abstimmung mit Agent 2. Bei Beschluss kommt ein Abschnitt `[npc]` in `parameters.toml` und Golden Vectors in `verify.py`.
- In F-NPC-01 reagieren NPC-Händler im selben Tick auf Preisänderungen. Eine verzögerte Wahrnehmung (z. B. 36 Ticks) würde Spielern mehr Reaktionszeit lassen. **[Hypothese]**, ungetestet.
