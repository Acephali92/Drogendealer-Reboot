# Kampfsystem – Angriff, Verteidigung, Kampfkraft

## 1. Zweck & Spielgefühl

Kampf ist die direkte Konfrontation zwischen Spielern (PvP) und – im Weltraum – mit Piraten. Er soll
**berechenbar, aber nicht deterministisch** sein: Wer stärker ist, gewinnt meistens, nie immer. Beute ist
begrenzt (nur Bargeld und mitgeführte Ware), damit Kämpfe Spieler schwächen, aber nicht vernichten.
Schutzregeln verhindern das Abfarmen neuer oder deutlich schwächerer Spieler.

Kämpfe werden **sofort aufgelöst** (eine Aktion, ein Ergebnis); es gibt keine Kampfrunden.

## 2. Zustandsvariablen (pro Spieler)

| Symbol | Bedeutung | Typ | Wertebereich |
|---|---|---|---|
| HP | Gesundheit | float64 | $[0, 100]$ |
| Waffe, Rüstung | ausgerüstete Gegenstände | enum / null | siehe 3.2 |
| Crew | Anzahl je Crew-Typ | map<enum,int> | $\ge 0$ |
| $t_{KH}$ | Krankenhaus bis Tick | int | – |
| Cooldowns | letzter Angriff (eigener), letzter Angriff auf Ziel | int | – |

## 3. Parameter

### 3.1 Kampfregeln (`combat.*`)

| Symbol | Schlüssel | Default | Bedeutung |
|---|---|---|---|
| $B$ | `combat.base_strength` | 10 | Grundkraft jedes Spielers |
| $w_R$ | `combat.armor_attack_weight` | 0,5 | Rüstung zählt im Angriff halb |
| $w_W$ | `combat.weapon_defense_weight` | 0,5 | Waffe zählt in der Verteidigung halb |
| – | `combat.morale_min` / `combat.morale_span` | 0,8 / 0,4 | Moral = 0,8 + 0,4 · HP/100 |
| $\alpha$ | `combat.alpha` | 1,5 | Schärfe der Siegchance |
| $p_{min}, p_{max}$ | `combat.win_chance_min` / `combat.win_chance_max` | 0,05 / 0,95 | Siegchance immer in diesem Band |
| $h$ | `combat.home_defense_bonus` | 1,2 | Verteidiger besitzt einen Betrieb in der Stadt |
| $c_w$, $c_l$ | `combat.loss_coeff_winner` / `combat.loss_coeff_loser` | 0,4 / 0,8 | Crew-Verluste |
| – | `combat.loss_max_winner` / `combat.loss_max_loser` | 0,5 / 0,8 | Obergrenzen |
| $r_c$, $r_g$ | `combat.loot_cash_rate` / `combat.loot_goods_rate` | 0,25 / 0,25 | Beute |
| – | `combat.hp_loss_winner` / `combat.hp_loss_loser` | 10 / 30 | HP-Verlust |
| – | `combat.hp_regen_per_tick` / `combat.hospital_ticks` | 2 / 18 | Erholung |
| – | `combat.newbie_protection_ticks` / `combat.newbie_protection_networth` | 1 008 / 50 000 € | Anfängerschutz |
| $\kappa$ | `combat.loot_daily_cap_rate` / `combat.loot_cap_window_ticks` | 0,35 / 144 | Opfer verliert pro 144 Ticks max. 35 % seines Bargelds |
| $d$ | `combat.loot_repeat_decay` / `combat.loot_repeat_window_ticks` | 0,5 / 1 008 | Beute halbiert sich je früherem Erfolg desselben Angreifers (7 Tage) |
| $f_H$ | `combat.loot_fence_rate` | 0,15 | Hehlerabschlag: Anteil der Beute, der das Spiel verlässt |
| – | `combat.networth_band` | 0,5 | Vermögensband |
| – | `combat.networth_history_ticks` | 1 008 | Angreifer-Vermögen = Höchstwert der letzten 7 Tage |
| – | `combat.target_cooldown_ticks` / `combat.attack_cooldown_ticks` | 36 / 3 | Cooldowns |
| – | `combat.heat_attack` | 15 | Heat für den Angreifer |

### 3.2 Ausrüstung und Crew

| Waffe | Stärke | Preis | | Rüstung | Stärke | Preis |
|---|---:|---:|---|---|---:|---:|
| Buttermesser deluxe (`messer`) | 5 | 500 € | | Rockerjacke vom Flohmarkt (`lederjacke`) | 5 | 300 € |
| Taschenkanone (`pistole`) | 20 | 3 000 € | | Kugelweste (gebraucht) (`weste`) | 15 | 2 500 € |
| Rattermaschine (`mp`, Gewalt L5) | 45 | 15 000 € | | Panzerplatten-Kombi (`plattenweste`) | 35 | 12 000 € |
| Dauerfeuer 3000 (`sturmgewehr`, Gewalt L10) | 80 | 40 000 € | | | | |

| Crew | Stärke je Person | Anheuern | Unterhalt pro Tick (pro Tag) |
|---|---:|---:|---:|
| Schrankwand (`schlaeger`) | 8 | 1 000 € | 150 ct (216 €) |
| Herr Meier vom Inkasso (`profi`, Gewalt L8) | 20 | 5 000 € | 400 ct (576 €) |

Schlüssel z. B. `weapons.pistole.strength`, `armor.weste.strength`, `crew.schlaeger.upkeep`.
Kann der Crew-Unterhalt nicht bezahlt werden, verlässt pro Tick eine Person (die teuerste) die Crew.

## 4. Formeln

**F-CMB-01 – Angriffskraft**

```math
K_A = \big(B + W + w_R R + \textstyle\sum \text{Crew}\big) \cdot (1 + b_{Gewalt}) \cdot M \cdot (1 + b_{Clan})
```

mit Moral $M = 0{,}8 + 0{,}4 \cdot HP/100$, $b_{Gewalt} = \min(0{,}6;\; 0{,}03\,L_{Gewalt})$ (F-PRF-03) und
Clan-Präsenzbonus $b_{Clan}$ (F-CLN-05).

**F-CMB-02 – Verteidigungskraft**

```math
K_D = \big(B + w_W W + R + \textstyle\sum \text{Crew}\big) \cdot (1 + b_{Gewalt}) \cdot M \cdot (1 + b_{Clan}) \cdot h
```

$h = 1{,}2$, wenn der Verteidiger in dieser Stadt einen Betrieb besitzt, sonst 1.

**F-CMB-03 – Siegchance des Angreifers**

```math
p = \operatorname{clamp}\!\Big(\frac{K_A^{\alpha}}{K_A^{\alpha} + K_D^{\alpha}},\; 0{,}05,\; 0{,}95\Big)
```

Gewürfelt mit $U(\text{seed}, t, \texttt{fight/<id>}, 0) < p$. Bei $K_A = K_D$ ist $p = 0{,}5$;
bei doppelter Stärke $p = 2^{1{,}5}/(2^{1{,}5} + 1) = 0{,}739$.

**F-CMB-04 – Crew-Verluste**

Mit Sieger-Kraft $K_w$ und Verlierer-Kraft $K_l$:

```math
f_w = \min\Big(0{,}5;\; c_w \frac{K_l}{K_w + K_l}\Big), \qquad f_l = \min\Big(0{,}8;\; c_l \frac{K_w}{K_w + K_l}\Big)
```

Verlorene Crew je Typ: $\operatorname{round}(n \cdot f)$ (kaufmännisch). Knappe Siege kosten den Sieger mehr.

**F-CMB-05 – Beute (nur bei Sieg des Angreifers)**

Mit Bargeld $B$ (Schwarzgeld) des Opfers, $L_{24}$ = dem Opfer in den letzten 144 Ticks bereits geraubtes
Bargeld (alle Angreifer) und $k$ = Anzahl früherer erfolgreicher Angriffe **desselben** Angreifers auf
dieses Opfer in den letzten 1 008 Ticks:

```math
L_{cash} = \min\Big(\big\lfloor B \cdot r_c \cdot d^{\,k} \big\rfloor,\;\; \max\big(0,\; \lfloor \kappa\,(B + L_{24}) \rfloor - L_{24}\big)\Big)
```

```math
L_g = \big\lfloor q_g \cdot r_g \cdot d^{\,k} \big\rfloor, \qquad \text{Gutschrift}_{Angreifer} = \big\lfloor L \cdot (1 - f_H) \big\rfloor \;\text{(Geld und je Ware)}
```

- **Tageslimit:** $B + L_{24}$ ist das Bargeld des Opfers vor allen Überfällen im Fenster (ohne Einnahmen).
  Ein Opfer verliert in jedem 144-Tick-Fenster höchstens $\kappa = 35\,\%$ davon, egal wie viele Angreifer es gibt.
- **Wiederholungsabschlag:** Derselbe Angreifer erhält beim zweiten Erfolg innerhalb von 7 Tagen nur die
  halbe Rate, beim dritten ein Viertel usw.
- **Hehlerabschlag:** 15 % der Beute verlassen das Spiel (Geldsenke). Das macht Beuteübertragungen zwischen
  eigenen Accounts verlustreich.

Weißgeld (Bank), Fahrzeuge, Betriebe und Lagerhaus-Bestände sind **nie** plünderbar. Gewinnt der
Verteidiger, erhält er keine Beute, aber die XP und der Angreifer trägt die höheren Verluste.

**F-CMB-06 – Zulässigkeit eines Angriffs**

Ein Angriff ist nur erlaubt, wenn alle Bedingungen gelten (Prüfung in dieser Reihenfolge):

1. **Anfängerschutz:** Ziel ist ≥ 1 008 Ticks (7 Tage) alt **oder** hat Nettovermögen ≥ 50 000 €.
2. **Vermögensband:** $NW_{Ziel} \ge 0{,}5 \cdot \max_{7\,\text{Tage}} NW_{Angreifer}$.
   Für den Angreifer zählt das höchste Nettovermögen der letzten `combat.networth_history_ticks` = 1 008 Ticks
   (gespeichert als 7 Tageshöchstwerte, rollierend), für das Ziel das aktuelle. Wer Vermögen kurzfristig
   auslagert, um als „armer“ Räuber Schwächere anzugreifen, bleibt 7 Tage lang an seinem Höchstwert gemessen.
   Nettovermögen nach F-GLB-03, inklusive Pro-Kopf-Anteil der Clankasse.
3. **Ziel-Cooldown:** letzter Angriff (durch irgendwen) auf das Ziel ≥ 36 Ticks her.
4. **Angriffs-Cooldown:** eigener letzter Angriff ≥ 3 Ticks her.
5. Beide in derselben Stadt, keiner auf Reise oder im Krankenhaus.

**F-CMB-07 – Gesundheit**

- Sieger −10 HP, Verlierer −30 HP. Fällt HP auf ≤ 0: Krankenhaus für 18 Ticks (keine Aktionen), danach
  HP = 0 und Regeneration.
- Regeneration +2 HP pro Tick bis 100.
- Niedrige HP senken die Moral und damit $K$ (Kaskaden­schutz: wer verliert, wird nicht sofort wieder
  angegriffen, siehe Ziel-Cooldown).

## 5. Ablauf

```text
function attack(att, def):
    ok, reason = attack_allowed(...)              # F-CMB-06
    if not ok: reject(reason)
    KA = attack_strength(att); KD = defense_strength(def)   # F-CMB-01/02
    p = win_chance(KA, KD)                         # F-CMB-03
    att_wins = U(seed, t, fight_id, 0) < p
    (w, l) = (att, def) if att_wins else (def, att)
    apply losses(K_w, K_l)                          # F-CMB-04
    if att_wins: transfer loot(def)                 # F-CMB-05
    hp updates                                      # F-CMB-07
    att.heat[city] += 15; xp.gewalt (50 / 10)       # F-PRF-02
    if both in clans at war: war_points(K_w, K_l)   # F-CLN-06
    write fight log (KA, KD, p, U, Ergebnis)        # auditierbar
```

## 6. Grenzwerte & Edge-Cases

- $p \in [0{,}05; 0{,}95]$: Auch ein extrem starker Spieler kann verlieren; ein extrem schwacher kann gewinnen.
- $K > 0$ immer (Grundkraft $B = 10$, Moral ≥ 0,8).
- Beute wird abgerundet; bei 0 Bargeld gibt es 0 Beute.
- Gleichzeitige Angriffe auf dasselbe Ziel: Der erste gewinnt die Sperre, alle weiteren scheitern am
  Ziel-Cooldown.

## 7. Beispielrechnungen

**EX-CMB-01 – Überfall in der Stadt des Verteidigers**

| | Angreifer | Verteidiger |
|---|---|---|
| Ausrüstung | Taschenkanone (20), Kugelweste (15) | Buttermesser deluxe (5), Rockerjacke (5) |
| Crew | 3 × Schrankwand (24) | 2 × Schrankwand (16) |
| Rohkraft | $10 + 20 + 0{,}5 \cdot 15 + 24 = 61{,}5$ | $10 + 0{,}5 \cdot 5 + 5 + 16 = 33{,}5$ |
| Gewalt-Level | 6 → × 1,18 | 3 → × 1,09 |
| HP / Moral | 100 / 1,20 | 80 / 1,12 |
| Heimbonus | – | × 1,2 (besitzt Bar in der Stadt) |
| **Kampfkraft** | **87,084** | **49,076** |

- Siegchance: $87{,}084^{1{,}5} / (87{,}084^{1{,}5} + 49{,}076^{1{,}5}) =$ **0,7027**
- Falls der Angreifer gewinnt:
  - $f_w = 0{,}4 \cdot 49{,}076 / 136{,}16 =$ **0,1442** → $\operatorname{round}(3 \cdot 0{,}1442) =$ **0** Crew verloren
  - $f_l = 0{,}8 \cdot 87{,}084 / 136{,}16 =$ **0,5117** → $\operatorname{round}(2 \cdot 0{,}5117) =$ **1** Crew verloren
  - Beute bei 5 000 € Bargeld und 40 Schneegestöber (erster Überfall des Tages, $k = 0$):
    Opfer verliert $\min(125\,000;\; 175\,000) =$ **125 000 ct** und **10** Schneegestöber,
    der Angreifer erhält nach Hehlerabschlag **106 250 ct** und **8** Schneegestöber
  - HP Verteidiger: 80 − 30 = **50**

**EX-CMB-02 – Zulässigkeit** (Angreifer-Nettovermögen 100 000 €, sofern nicht anders angegeben)

| Fall | Ziel-NW | Ziel-Alter | letzter Angriff auf Ziel | Ergebnis |
|---|---:|---:|---:|---|
| a | 40 000 € | 5 000 Ticks | 999 Ticks | **Vermögensband** |
| b | 60 000 € | 5 000 Ticks | 999 Ticks | **erlaubt** |
| c | 60 000 € | 500 Ticks | 999 Ticks | **erlaubt** (Schutz endet durch NW ≥ 50 000 €) |
| d | 60 000 € | 5 000 Ticks | 20 Ticks | **Ziel-Cooldown** |
| e | 40 000 € | 5 000 Ticks | 999 Ticks | **Vermögensband** – Angreifer hat aktuell nur 30 000 €, in den letzten 7 Tagen aber bis zu 100 000 € besessen |

**EX-CMB-03 – Tageslimit der Beute**

Ein Opfer mit 10 000 € (1 000 000 ct) Bargeld wird alle 36 Ticks (Ziel-Cooldown) von einem **anderen**
Angreifer ausgeraubt und nimmt nichts ein:

| Überfall (Tick) | Rate × Bargeld | Restbudget $\lfloor 0{,}35 (B + L_{24}) \rfloor - L_{24}$ | Verlust |
|---|---:|---:|---:|
| 1 (0) | 250 000 | 350 000 | **250 000 ct** |
| 2 (36) | 187 500 | 100 000 | **100 000 ct** |
| 3 (72) | 162 500 | 0 | **0 ct** |
| 4 (108) | 162 500 | 0 | **0 ct** |
| Summe 1 Tag | | | **350 000 ct = 0,35** |

Ohne Limit wären es $1 - 0{,}75^4 = 68{,}4\,\%$ gewesen. Greift am nächsten Tag (Fenster leer) derselbe
Angreifer wie bei Überfall 1 erneut an ($k = 1$), erhält er nur die halbe Rate:
$\lfloor 650\,000 \cdot 0{,}25 \cdot 0{,}5 \rfloor =$ **81 250 ct**.

## 8. Balancing-Ziele & Exploit-Analyse

| Ziel | Umsetzung / Prüfung |
|---|---|
| Stärke zählt, Glück bleibt | $\alpha = 1{,}5$, Band 5–95 % (INV-07) |
| Verteidigung lohnt sich | Rüstung voll in $K_D$, Heimbonus, Waffe halb |
| Kein Abfarmen Schwacher | Vermögensband (7-Tage-Höchstwert), Anfängerschutz, Ziel-Cooldown |
| Kein Ausbluten eines Opfers | Tageslimit 35 %, Wiederholungsabschlag (INV-12) |
| Beute ist Geldsenke | Hehlerabschlag 15 % |
| Bargeld tragen ist riskant, Bank ist sicher | nur Schwarzgeld plünderbar → Anreiz zur Geldwäsche |
| Crew ist laufender Kostenfaktor | Unterhalt pro Tick |

**Multi-Account-Beuteübertragung** (Zweitaccount lässt sich ausrauben): Beute ist auf 25 % je Überfall und
35 % pro Tag begrenzt, 15 % gehen beim Hehler verloren, wiederholte Überfälle bringen immer weniger, und das
Vermögensband verhindert Transfers von kleinen zu großen Accounts; Kampfprotokolle sind wegen
deterministischem RNG vollständig auditierbar.

## 9. Schnittstellen

| Richtung | System | Größe |
|---|---|---|
| ← | [professions.md](professions.md) | Gewalt-Bonus; → Gewalt-XP |
| ← | [clans.md](clans.md) | Präsenzbonus; → Kriegspunkte |
| ← | [real-estate.md](real-estate.md) | Heimbonus |
| → | [cities.md](cities.md) | Heat |
| → | [space.md](space.md) | F-CMB-03 für Piratenkämpfe |

## 10. Offene Fragen

- Soll der Verteidiger einen Teil der Angreifer-Ausrüstung erbeuten können?
- NPC-Ziele (Kuriere) und NPC-Überfälle (Banden) wegen R-1 sind in [npc.md](npc.md) spezifiziert
  (F-NPC-02/03) und nutzen die Kampfformeln dieses Dokuments.
- NPC-Gegner (Polizei-Einsatzkommando bei sehr hohem Heat)?
