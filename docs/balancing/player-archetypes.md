# Spielertypen für die Simulation

> Agent 6 · Konzept v0.1 · Stand 2026-11-08

Die Simulation bildet Spieler als **Bots** ab. Jeder Bot besteht aus drei Bausteinen:

1. **Aktivitätsprofil**: Wann ist der Bot online, und wie lange? Gemessen in Ticks, 1 Tick = 10 min.
2. **Policy**: Welche Aktion wählt er, wenn er online ist?
3. **Parameter**: Risikobereitschaft, Planungstiefe, Fehlerrate.

Offline-Zeit ist **nicht** wertlos: Laufende Reisen, Betriebe und Produktion arbeiten weiter (Annahme A-4).
Das Aktivitätsprofil bestimmt nur, wie oft der Bot **Entscheidungen** treffen kann.

## Gemeinsame Schnittstelle

```ts
interface BotPolicy {
  /** Wird pro Tick aufgerufen, in dem der Bot online ist und keine Aktion läuft. */
  decide(view: PlayerView, world: PublicWorldView, rng: Rng): Command | null;
}

interface ActivityProfile {
  sessionsPerDay: number;      // Ø Logins pro Tag (Poisson)
  sessionTicks: [min, max];    // Sitzungslänge in Ticks
  preferredHours?: number[];   // z. B. Abendspitze 18–23 Uhr
  reactionDelayTicks: number;  // Verzögerung zwischen Ankunft und nächster Aktion
}
```

`PublicWorldView` enthält nur Informationen, die auch ein echter Spieler sieht (Preise der aktuellen Stadt,
ggf. veraltete Preise anderer Städte). **Bots dürfen nicht „hellsehen“**, sonst überschätzt die Simulation
die Effizienz der Spieler.

Ausnahme: der `Optimierer` mit Parameter `perfectInfo = true` dient als Obergrenze (Worst Case für das Balancing).

---

## Reguläre Spielertypen

### T1 Gelegenheitsspieler (`casual`)
- **Ziel**: Vermögen mehren, wenig Aufwand.
- **Aktivität**: 2 Sitzungen pro Tag à 3–6 Ticks (≈ 1 h/Tag).
- **Policy**: Wählt eine von drei zuletzt profitablen Routen, die er kennt. Kauft Fahrzeuge, sobald das Geld reicht. Nutzt die Bank, wenn er offline geht (Wahrscheinlichkeit 0,6).
- **Risiko**: niedrig, meidet Waren mit `heat` ≥ 1,5.
- **Fehlerrate**: 10 % suboptimale Käufe.

### T2 Aktiver Händler (`trader`)
- **Ziel**: maximaler Handelsgewinn.
- **Aktivität**: 4 Sitzungen à 6–12 Ticks (≈ 4 h/Tag).
- **Policy**: **Greedy**. Wählt in der aktuellen Stadt die Route mit dem höchsten erwarteten $G_r(q)$ nach Kosten und Risiko, basierend auf den Preisen, die er zuletzt gesehen hat.
- **Risiko**: mittel.

### T3 Optimierer (`optimizer`)
- **Ziel**: wie T2, aber mit Rundkursen (Rückfahrt beladen) und Lookahead über 2–3 Fahrten.
- **Aktivität**: wie T2 oder 24/7 (siehe T9).
- **Policy**: Beam-Search über Routen-Sequenzen, berücksichtigt die eigene Slippage und die Erholungszeit $T_{1/2}$.
- **Parameter**: `perfectInfo` (true = obere Schranke).

### T4 Schmuggler (`smuggler`)
- **Ziel**: hohe Marge über Waren mit viel Heat und über den Weltraum.
- **Policy**: bevorzugt Waren mit `heat` ≥ 1,5, investiert früh in Fahrzeuge mit hohem `hide` (Sportwagen, LKW) und in Schmuggel-XP.
- **Risiko**: hoch. Nimmt Kontrollen in Kauf und besticht, wenn $EV_{Bestechung} > EV_{Strafe}$.

### T5 Räuber (`raider`)
- **Ziel**: Einkommen über PvP.
- **Policy**: Kauft zuerst Waffen und Crew. Greift das Ziel mit dem höchsten $EV_A$ an, sofern es gültig ist (Vermögensband, Cooldowns, Neulingsschutz). Handelt nebenbei, wenn kein lohnendes Ziel verfügbar ist.
- **Varianten**: `raider.opportunist` greift nur bei $p_{win}$ ≥ 0,7 an, `raider.aggressive` bei ≥ 0,4.

### T6 Investor (`investor`)
- **Ziel**: passives Einkommen und Weißgeld.
- **Policy**: Handelt nur bis zum ersten Betrieb, dann Reinvestition in Betriebe, Ausbau und Geldwäsche. Bevorzugt Betriebe mit der kürzesten Amortisation inkl. Waschwert.
- **Risiko**: niedrig bis mittel (Waschrisiko).

### T7 Clan-Kollektiv (`clan`)
- **Ziel**: gemeinsame Macht, Bezirke, Clankriege.
- **Zusammensetzung**: 8–20 Bots verschiedener Typen mit gemeinsamer Clankasse (Steuersatz ≤ `clans.tax_max`).
- **Policy (Clan-Ebene)**: beansprucht Bezirke mit dem besten Verhältnis Einnahmen/Kosten, erklärt Kriege, wenn die Erfolgswahrscheinlichkeit hoch ist, und koordiniert Händler, damit sie sich auf Routen nicht gegenseitig die Marge wegnehmen.

### T8 Neuling (`newbie`)
- **Ziel**: realistisches Verhalten in den ersten 14 Tagen.
- **Policy**: Startet als T1 mit 25 % Fehlerrate (falsche Route, zu teuer gekauft, keine Bank). Die Fehlerrate sinkt linear auf 5 % bis Tag 14, danach Wechsel zu T2.
- **Zweck**: Messung von Neulings-Bindung, `GAP14` und PvP-Schutz.

### T9 Veteran / No-Lifer (`veteran`)
- **Ziel**: Obergrenze menschlicher Aktivität.
- **Aktivität**: 16 h/Tag (≈ 96 Ticks), sofortige Reaktion.
- **Policy**: T3 mit Diversifikation (Handel, Betriebe, Clan, Weltraum).
- **Zweck**: Untergrenze für `GAP14`, Obergrenze für `TTM`.

---

## Adversariale Bots

Diese Bots verhalten sich **nicht** wie normale Spieler. Sie suchen gezielt nach Schwachstellen.
Ein Exploit gilt als gefunden, wenn ein Bot eine Invariante verletzt (I-1 bis I-5) **oder** sein `IPH`
das des besten regulären Bots um mehr als 10 % übersteigt. Zuordnung zu Exploits: [exploit-catalog.md](exploit-catalog.md).

| ID | Bot | Strategie | Prüft |
|---|---|---|---|
| X1 | `roundtrip` | Kauft und verkauft sofort in derselben Stadt mit allen Mengen und Skill-Leveln | E-01 |
| X2 | `pumpdump` | Kauft eine Ware in Stadt A massiv auf, wartet auf Reaktionen anderer Bots, verkauft dann | E-02, E-03 |
| X3 | `multiaccount` | Ein Haupt- und 1–5 Zweitaccounts; überträgt Vermögen per Raub, Handel und Clan-Kasse | E-04, E-11 |
| X4 | `ticktimer` | Teilt Orders in viele Kleinstorders; handelt genau vor/nach Tick-Grenze und Events | E-05 |
| X5 | `rounding` | Viele Orders mit Menge 1 und Grenzpreisen, um Rundungsdifferenzen zu sammeln | E-06 |
| X6 | `canceller` | Startet Reisen, bricht sie ab, kauft/verkauft Fahrzeuge kurz nach dem Kauf | E-08 |
| X7 | `shield` | Hält Bargeld minimal, alles auf der Bank bzw. in Waren, und greift selbst an | E-09 |
| X8 | `washloop` | Wäscht Geld im Kreis zwischen eigenen Betrieben / Strohmännern | E-12, E-13 |
| X9 | `eventfarmer` | Reist gezielt zu Ereignissen (Razzia, Lieferung) und verwertet Informationsvorsprung | E-14 |
| X10 | `lootfarm` | Zwei kooperierende Accounts greifen sich abwechselnd an (XP- und Beute-Farm) | E-15 |
| X11 | `concurrency` | Sendet parallele, sich widersprechende Commands (nur gegen die Backend-Integrationsumgebung) | E-07 |

---

## Standard-Population

Der Standard-Mix für Szenarien wie `S1-growth` orientiert sich an üblichen Browsergame-Verteilungen und
wird nach dem Live-Start mit echten Telemetriedaten kalibriert (Phase P5 in [simulation-spec.md](simulation-spec.md)).

| Typ | Anteil |
|---|---|
| T1 Gelegenheitsspieler | 40 % |
| T2 Aktiver Händler | 20 % |
| T3 Optimierer | 5 % |
| T4 Schmuggler | 8 % |
| T5 Räuber | 7 % |
| T6 Investor | 8 % |
| T8 Neuling (laufender Zustrom) | 10 % |
| T9 Veteran | 2 % |

Standardgröße: **30 Spieler**, weil anfangs nur wenige Spieler erwartet werden (R-1). Skalierungsvarianten: 10 / 100 / 300.
Bei 30 Spielern ergibt der Mix gerundet 12 / 6 / 2 / 2 / 2 / 2 / 3 / 1.

T7 (Clan) ist eine **Gruppierung** und kein eigener Anteil: ca. 40 % der Bots aus T2 bis T9 sind Clans zugeordnet.

### NPC-Akteure (Vorschlag N-1/N-2, abhängig von R-1)
Bei wenigen Spielern simuliert die Welt zusätzlich **NPC-Händler**, die profitable Routen abschöpfen, sowie
**NPC-Kuriere und -Banden** als Ziele und Gegner. Sie sind keine Bots mit Policy, sondern Teil von `applyTick`
(Spielregel von Agent 2). Ihre Stärke sinkt erst, wenn echte Spieler die Mechanik messbar tragen (R-4, siehe
[balancing-concept.md §2](balancing-concept.md#rückbau-der-npc-mechaniken-q12-r-4)).
Adversariale Bots laufen **nicht** im Standard-Mix, sondern in eigenen Szenarien (`S7-*`), damit sie die
Wirtschafts-KPIs nicht verfälschen.
