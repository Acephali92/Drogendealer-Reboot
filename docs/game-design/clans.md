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
| Kasse auszahlen (gesperrt während einer Wahl) | unbegrenzt | unbegrenzt | ≤ 5 % der Kasse pro Tag | – | – |
| Viertel beanspruchen | ✔ | ✔ | ✔ | – | – |
| Krieg erklären / Frieden schließen | ✔ | – | – | – | – |
| Misstrauensvotum beantragen | – | ✔ | ✔ | – | – |
| An Wahl / Misstrauensvotum teilnehmen | – | ✔ | ✔ | ✔ | – |
| Freiwillig zurücktreten (→ Wahl) | ✔ | – | – | – | – |
| Clan ausbauen | ✔ | ✔ | – | – | – |
| Präsenzbonus & Schutz | ✔ | ✔ | ✔ | ✔ | ✔ |

#### Rang-Schlüssel (verbindlich für Backend und Frontend)

Die API verwendet ausschließlich diese Werte aus `clans.ranks` (Reihenfolge = Hierarchie, höchster zuerst):

| Schlüssel | Anzeige | Übergangs-Mapping vom aktuellen Backend |
|---|---|---|
| `PATE` | Pate | `LEADER` |
| `CONSIGLIERE` | Consigliere | – (fehlt im Backend, muss ergänzt werden) |
| `CAPO` | Capo | `OFFICER` |
| `SOLDAT` | Soldat | `MEMBER` |
| `MITLAEUFER` | Mitläufer | – (fehlt im Backend, muss ergänzt werden) |

Das Mapping ist nur eine Übergangslösung; Ziel ist, dass Backend und Frontend die fünf Schlüssel direkt nutzen.

Neue Mitglieder starten als **Mitläufer** (Probezeit `clans.probation_ticks` = 144 Ticks), danach kann ein Capo sie zum Soldaten machen.
Einen neuen Paten bestimmt der Clan per **Wahl** (ADR-018, F-CLN-08). Eine Wahl wird ausgelöst, wenn der Pate
- sein Konto löscht,
- länger als `clans.inactive_pate_ticks` = 1 008 Ticks (7 Tage) inaktiv ist,
- freiwillig zurücktritt (er wird dann Capo) oder
- durch ein Misstrauensvotum abgesetzt wird (F-CLN-09).

Das **Clan-Guthaben** (schwarze und weiße Kasse) gehört dem Clan, nicht dem Paten, und bleibt bei jedem
Wechsel unverändert.

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

**F-CLN-08 – Wahl eines neuen Paten**

| Regel | Festlegung | Schlüssel |
|---|---|---|
| Ein einziges Mitglied | wird sofort Pate, keine Wahl | – |
| Wahlberechtigt | Rang ≥ SOLDAT (Mitläufer nicht) | `clans.election_voter_min_rank` |
| Wählbar | Rang ≥ CAPO **und** ≥ 1 008 Ticks Mitgliedschaft; gibt es niemanden: jeder ab SOLDAT; sonst alle | `clans.election_candidate_min_rank`, `clans.election_candidate_min_tenure_ticks` |
| Nicht wählbar | ein per Misstrauensvotum abgesetzter Pate (in genau dieser Wahl), außer er ist der Letzte | – |
| Dauer | 72 Ticks (12 h); jede wahlberechtigte Person hat eine Stimme, Selbstwahl erlaubt, Stimme änderbar bis Ende | `clans.election_duration_ticks` |
| Sieger | meiste gültige Stimmen (einfache Mehrheit der abgegebenen Stimmen) | – |
| Gleichstand / keine Stimmen | höherer Rang → längere Mitgliedschaft → kleinere Spieler-ID | – |

Formal, mit Kandidatenmenge $\mathcal{K}$ und Stimmen $v(c)$:

```math
\text{Pate} = \operatorname*{arg\,min}_{c \in \mathcal{K}} \big(-v(c),\; \text{Rangindex}(c),\; -\text{Mitgliedschaft}(c),\; \text{ID}(c)\big)
```

(lexikografischer Vergleich, Rangindex 0 = PATE … 4 = MITLAEUFER). Das Ergebnis ist immer eindeutig (INV-13).

**Während der Wahl:** Auszahlungen aus der Clankasse gesperrt, Einzahlungen erlaubt, Steuern und Schutzgeld
laufen weiter. Keine Kriegserklärung, kein Friedensschluss, keine Rangänderungen, keine Ausschlüsse. Laufende
Kriege gehen weiter. Aufnahmen neuer Mitglieder sind möglich; sie sind in dieser Wahl nicht wahlberechtigt.

**F-CLN-09 – Misstrauensvotum**

- Beantragen darf jedes Mitglied ab `clans.no_confidence_min_rank` = CAPO. Abstimmungsdauer 72 Ticks
  (`clans.no_confidence_duration_ticks`).
- Abstimmungsberechtigt: alle Wahlberechtigten **außer dem Paten**, Anzahl $n$.
- Angenommen, wenn

```math
\text{Ja} \ge \Big\lceil \frac{2 \cdot n}{3} \Big\rceil \qquad (\texttt{no\_confidence\_quorum\_num} / \texttt{\_den} = 2/3)
```

  Ganzzahlig: $\text{needed} = \lfloor (2n + 2) / 3 \rfloor$. Enthaltungen und Nichtabstimmen zählen wie Nein.
- Bei Annahme wird der Pate zum Capo herabgestuft und die Wahl (F-CLN-08) startet sofort; er ist in dieser
  Wahl nicht wählbar.
- Nach jedem Misstrauensvotum (angenommen oder nicht) ist für `clans.no_confidence_cooldown_ticks` = 1 008 Ticks
  kein weiteres möglich.

## 5. Abläufe

```text
claim_district(clan, city, i):
    require district free, >= clans.district_min_members (3) Mitglieder in city, Rang >= Capo
    pay 20 000 € from clan.black
    district.owner = clan

tick:
    for district in owned: clan.black += district_income(city)   # F-CLN-04
    wars: Vorlauf (36 Ticks) -> aktiv (1 008 Ticks) -> Abrechnung (F-CLN-06)

leave_clan(player):                  # auch bei Kontolöschung
    player.join_block_until = t + (1008 if clan at war else 432)
    if clan has no members left: dissolve(clan, payout = False)   # Kasse verfällt
    elif player was PATE: start_election(clan)                    # F-CLN-08

start_election(clan):
    if len(clan.members) == 1: make_pate(the member); return
    clan.payouts_locked = True; clan.election_end = t + 72
on t == clan.election_end:
    make_pate(election_result(members, votes)); clan.payouts_locked = False
```

Freie Viertel entstehen, wenn ein Clan aufgelöst wird oder ein Viertel `clans.district_abandon_ticks` = 1 008 Ticks
lang keine Mitgliedspräsenz hatte. Zum Beanspruchen müssen `clans.district_min_members` = 3 Mitglieder in der
Stadt anwesend sein.

## 6. Grenzwerte & Edge-Cases

- Ein Spieler ist in höchstens einem Clan.
- Ein Clan kann höchstens einen Krieg gleichzeitig **erklären**, aber mehrfach angegriffen werden.
- Während eines Krieges sind Austritte möglich, aber mit 1 008 Ticks Sperre (gegen „Seitenwechsel“).
- Mitglieder desselben Clans können sich nicht angreifen.
- **Auflösung durch den Paten:** Kasse wird zu gleichen Teilen an die Mitglieder ausgezahlt (abgerundet,
  schwarz bleibt schwarz, weiß bleibt weiß), Viertel werden frei. Nicht möglich während einer Wahl.
- **Letztes Mitglied geht oder löscht sein Konto:** Der Clan wird aufgelöst, die Kasse **verfällt ersatzlos**
  (Geldsenke, inflationsneutral nach ADR-016), Viertel werden frei.
- Rundungsreste bei Auszahlungen verfallen ebenfalls.

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

- Pleitenberg: $\lfloor 20 \cdot 1{,}0 \cdot \sqrt{3700} \rfloor =$ **1 216 ct/Tick** → **175 104 ct/Tag** (1 751 €)
- Protzingen: $\lfloor 20 \cdot 1{,}6 \cdot \sqrt{1500} \rfloor =$ **1 239 ct/Tick** → **178 416 ct/Tag**

Ein Clan mit allen vier Pleitenberger Vierteln verdient ≈ 7 000 €/Tag – vergleichbar mit einer gut laufenden
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

**EX-CLN-05 – Wahl nach Kontolöschung des Paten**

| Mitglied | Rang | Mitgliedschaft | wahlberechtigt | wählbar |
|---|---|---:|:-:|:-:|
| A | Consigliere | 3 000 Ticks | ✔ | ✔ |
| B | Capo | 2 000 Ticks | ✔ | ✔ |
| C | Capo | 500 Ticks | ✔ | – (zu kurz dabei) |
| D | Soldat | 5 000 Ticks | ✔ | – |
| E | Soldat | 300 Ticks | ✔ | – |
| F | Mitläufer | 50 Ticks | – | – |

Kandidaten: **AB**.

- Stimmen A→B, B→B, C→A, D→A, E→B, F→A (ungültig, Mitläufer): B 3 : A 2 → Pate **B**
- Nur A→A und B→B (Gleichstand 1 : 1): höherer Rang → Pate **A**
- Niemand stimmt ab: Pate **A** (höchster Rang unter den Kandidaten)
- Clan besteht nur noch aus D: **D** wird sofort Pate

**EX-CLN-06 – Misstrauensvotum**

- Pate + 14 Soldaten: **14** Abstimmungsberechtigte, nötig $\lceil 28/3 \rceil =$ **10** Ja-Stimmen;
  9 Ja → **abgelehnt** (False), 10 Ja → **angenommen** (True).
- Pate + 3 Wahlberechtigte (Capo, 2 Soldaten): nötig **2**; 2 Ja → **angenommen** (True).

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

- Soll eine Wahl auch nach Erreichen der absoluten Mehrheit vorzeitig enden dürfen (schnellere Handlungsfähigkeit)?

- Clan-Gebäude (gemeinsames Lagerhaus, Clan-Labor)?
- Allianzen zwischen Clans (Nichtangriffspakt) als eigenes Objekt?
