# Clans – Zusammenschlüsse, Hierarchien, Paten

## 1. Zweck & Spielgefühl

Clans sind die soziale Ebene des Multiplayer-Spiels: Spieler schließen sich unter einem **Paten** zusammen,
teilen eine **Clankasse**, kontrollieren **Viertel** in Städten (Schutzgeld) und führen **Clankriege**.
Ein Clan macht seine Mitglieder stärker (Präsenzbonus im Kampf), verlangt aber Abgaben und Loyalität
(Austritts-Cooldown).

## 2. Zustandsvariablen

| Entität | Feld | Typ | Wertebereich |
|---|---|---|---|
| Clan | Stufe | int | 1–5 |
| Clan | Kasse schwarz / weiß | int64 ct | ≥ 0 |
| Clan | Steuersatz $\tau$ | float | $[0; 0{,}10]$ |
| Clan | Mitglieder mit Rang | Liste | ≤ Mitgliederlimit |
| Viertel $(c, i)$ | kontrollierender Clan | Clan-ID / null | 4 Viertel je Stadt |
| Krieg | Angreifer, Verteidiger, Start, Ende, Punkte je Seite | Datensatz | – |
| Spieler | Austrittssperre bis Tick | int | – |

## 3. Parameter (`clans.*`)

| Symbol | Schlüssel | Default | Bedeutung |
|---|---|---|---|
| – | `clans.founding_cost` | 50 000 € (Weißgeld) | Gründung = Stufe 1 |
| – | `clans.member_base` / `clans.member_per_level` | 8 / 4 | Mitgliederlimit |
| – | `clans.upgrade_base_cost` / `clans.upgrade_growth` | 100 000 € / 2,0 | Ausbaukosten |
| $\tau_{max}$ | `clans.tax_max` | 0,10 | Höchststeuersatz |
| – | `clans.presence_bonus_per_member` / `clans.presence_bonus_max` | 0,05 / 0,25 | Kampfbonus |
| – | `clans.districts_per_city` | 4 | Viertel je Stadt |
| $e_0$ | `clans.district_income_base` | 20 ct | Schutzgeld-Basis |
| – | `clans.district_claim_cost` | 20 000 € | freies Viertel beanspruchen |
| – | `clans.war_declaration_cost` | 10 000 € | Kriegserklärung |
| – | `clans.war_lead_ticks` / `clans.war_duration_ticks` | 36 / 1 008 | Vorlauf 6 h, Dauer 7 Tage |
| – | `clans.war_points_base` / `clans.war_points_upset` | 10 / 10 | Kriegspunkte |
| – | `clans.war_reparation_rate` | 0,10 | Reparation des Verlierers |
| – | `clans.leave_cooldown_ticks` / `clans.leave_cooldown_war_ticks` | 432 / 1 008 | Austrittssperre |
| – | `clans.capo_daily_payout_limit` | 0,05 | Auszahlungslimit Capo |

Gründungsvoraussetzung: Summe aller fünf Level ≥ 15 (`unlocks.clan_gruendung.level_sum`).

### 3.1 Ränge und Rechte

| Recht | Pate | Consigliere | Capo | Soldat | Mitläufer |
|---|:-:|:-:|:-:|:-:|:-:|
| Anzahl | 1 | ≤ 1 | ≤ ⌈m/8⌉ | beliebig | beliebig |
| Mitglieder aufnehmen | ✔ | ✔ | ✔ | – | – |
| Mitglieder ausschließen | ✔ | ✔ | nur Mitläufer | – | – |
| Ränge vergeben | ✔ | bis Capo | – | – | – |
| Steuersatz setzen | ✔ | – | – | – | – |
| Kasse auszahlen | unbegrenzt | unbegrenzt | ≤ 5 % der Kasse pro Tag | – | – |
| Viertel beanspruchen | ✔ | ✔ | ✔ | – | – |
| Krieg erklären / Frieden schließen | ✔ | – | – | – | – |
| Clan ausbauen | ✔ | ✔ | – | – | – |
| Präsenzbonus & Schutz | ✔ | ✔ | ✔ | ✔ | ✔ |

Neue Mitglieder starten als **Mitläufer** (Probezeit `clans.probation_ticks` = 144 Ticks), danach kann ein Capo sie zum Soldaten machen.
Ist der Pate länger als `clans.inactive_pate_ticks` = 1 008 Ticks (7 Tage) inaktiv, wird der Consigliere automatisch Pate (sonst der dienstälteste Capo).

## 4. Formeln

**F-CLN-01 – Mitgliederlimit**

```math
m_{max}(n) = 8 + 4n \qquad (n = \text{Clanstufe})
```

**F-CLN-02 – Ausbaukosten**

```math
C(1) = \text{Gründungskosten}, \qquad C(n) = 100\,000\,€ \cdot 2^{\,n-2} \quad (n \ge 2)
```

Bezahlt aus der Weißgeld-Clankasse.

**F-CLN-03 – Clansteuer**

```math
\text{Abgabe} = \lfloor \text{Betrag} \cdot \min(\tau, \tau_{max}) \rfloor
```

Erhoben auf Verkaufserlöse (→ schwarze Kasse) und Betriebserträge (→ weiße Kasse) aller Mitglieder,
automatisch bei der Gutschrift.

**F-CLN-04 – Schutzgeld pro kontrolliertem Viertel**

```math
E_{Viertel} = \lfloor e_0 \cdot W \cdot \sqrt{\text{pop}} \rfloor \text{ ct pro Tick}
```

Fließt in die schwarze Clankasse. Wurzel aus der Bevölkerung, damit Großstädte attraktiv, aber nicht
dominant sind.

**F-CLN-05 – Präsenzbonus im Kampf**

```math
b_{Clan} = \min\big(0{,}25;\; 0{,}05 \cdot (n_{anwesend} - 1)\big)
```

$n_{anwesend}$ = Clanmitglieder (inkl. Kämpfer) in derselben Stadt, nicht auf Reise. Wirkt in F-CMB-01/02.

**F-CLN-06 – Kriegspunkte und Kriegsende**

Jeder Kampf zwischen Mitgliedern verfeindeter Clans während des Krieges bringt der Siegerseite

```math
\text{Punkte} = \operatorname{round}\Big(10 + 10 \cdot \frac{2 K_l}{K_w + K_l}\Big)
```

Siege gegen Stärkere bringen mehr (bis 30), Siege gegen viel Schwächere weniger (min. 10).
Bei Kriegsende gewinnt die Seite mit mehr Punkten:

- Reparation: $\lfloor \text{Kasse}_{Verlierer} \cdot 0{,}10 \rfloor$ (schwarz und weiß getrennt).
- Gebietsgewinn: je volle 50 Punkte Vorsprung ein Viertel des Verlierers (der Sieger wählt, in Städten,
  in denen er Punkte erzielt hat).

**F-CLN-07 – Ranglimits und Auszahlungslimit**

```math
n_{Capo} \le \lceil m / 8 \rceil, \qquad \text{Auszahlung}_{Capo,Tag} \le \lfloor \text{Kasse} \cdot 0{,}05 \rfloor
```

## 5. Abläufe

```text
claim_district(clan, city, i):
    require district free, >= clans.district_min_members (3) Mitglieder in city, Rang >= Capo
    pay 20 000 € from clan.black
    district.owner = clan

tick:
    for district in owned: clan.black += district_income(city)   # F-CLN-04
    wars: Vorlauf (36 Ticks) -> aktiv (1 008 Ticks) -> Abrechnung (F-CLN-06)

leave_clan(player):
    player.join_block_until = t + (1008 if clan at war else 432)
```

Freie Viertel entstehen, wenn ein Clan aufgelöst wird oder ein Viertel `clans.district_abandon_ticks` = 1 008 Ticks
lang keine Mitgliedspräsenz hatte. Zum Beanspruchen müssen `clans.district_min_members` = 3 Mitglieder in der
Stadt anwesend sein.

## 6. Grenzwerte & Edge-Cases

- Ein Spieler ist in höchstens einem Clan.
- Ein Clan kann höchstens einen Krieg gleichzeitig **erklären**, aber mehrfach angegriffen werden.
- Während eines Krieges sind Austritte möglich, aber mit 1 008 Ticks Sperre (gegen „Seitenwechsel“).
- Mitglieder desselben Clans können sich nicht angreifen.
- Clanauflösung: Kasse wird zu gleichen Teilen an Mitglieder ausgezahlt (abgerundet), Viertel werden frei.

## 7. Beispielrechnungen

**EX-CLN-01 – Stufen, Limits und Kosten**

| Stufe | Mitgliederlimit | Kosten der Stufe |
|---:|---:|---:|
| 1 | **12** | **5 000 000 ct** (Gründung) |
| 2 | **16** | **10 000 000 ct** |
| 3 | **20** | **20 000 000 ct** |
| 4 | **24** | **40 000 000 ct** |
| 5 | **28** | **80 000 000 ct** |
| Summe | | **155 000 000 ct** (1,55 Mio. €) |

**EX-CLN-02 – Schutzgeld pro Viertel**

- Berlin: $\lfloor 20 \cdot 1{,}0 \cdot \sqrt{3700} \rfloor =$ **1 216 ct/Tick** → **175 104 ct/Tag** (1 751 €)
- München: $\lfloor 20 \cdot 1{,}6 \cdot \sqrt{1500} \rfloor =$ **1 239 ct/Tick** → **178 416 ct/Tag**

Ein Clan mit allen vier Berliner Vierteln verdient ≈ 7 000 €/Tag – vergleichbar mit einer gut laufenden
Handelsroute, aber dauerhaft umkämpft.

**EX-CLN-03 – Kriegspunkte**

| Kampf | $K_w$ | $K_l$ | Punkte |
|---|---:|---:|---:|
| gleich stark | 100 | 100 | **20** |
| Außenseiter gewinnt | 100 | 200 | **23** |
| Stärkerer gewinnt deutlich | 100 | 25 | **14** |

Reparation bei 300 000 € Verliererkasse: **3 000 000 ct**.

**EX-CLN-04 – Steuer und Ränge**

- Mitglied verkauft für 10 000 €, $\tau = 8\,\%$: Abgabe **80 000 ct**; bei eingestellten 15 % wird auf
  10 % begrenzt: **100 000 ct**.
- Clan mit 20 Mitgliedern: max. **3** Capos; bei 1 Mio. € Kasse darf ein Capo **5 000 000 ct** pro Tag auszahlen.

## 8. Balancing-Ziele & Exploit-Analyse

| Ziel | Umsetzung |
|---|---|
| Clans lohnen sich ab ~5 aktiven Spielern | Präsenzbonus bis +25 %, Schutzgeld |
| Großclans wachsen nicht unbegrenzt | Limit 28, exponentielle Ausbaukosten |
| Kasse kann nicht von einem Capo geplündert werden | 5 %-Tageslimit |
| Krieg ist eine Entscheidung, kein Dauerzustand | Kosten, Vorlauf, feste Dauer |
| Kein Ränge-Hopping | Austrittssperren |

**Clan als Geldwäsche-Umweg?** Schwarze Kasse bleibt schwarz, weiße bleibt weiß – Auszahlungen behalten die
Geldart. Eine Umwandlung über den Clan ist nicht möglich.

## 9. Schnittstellen

| Richtung | System | Größe |
|---|---|---|
| → | [combat.md](combat.md) | Präsenzbonus; ← Kampfergebnisse für Kriegspunkte |
| ← | [cities.md](cities.md) | Viertel, pop, $W$ |
| ← | [trade.md](trade.md), [real-estate.md](real-estate.md) | Steuerbasis |
| ← | [professions.md](professions.md) | Gründungsvoraussetzung |

## 10. Offene Fragen

- Clan-Gebäude (gemeinsames Lagerhaus, Clan-Labor)?
- Allianzen zwischen Clans (Nichtangriffspakt) als eigenes Objekt?
