# PROGRESSION_MODEL – Spielerprogression

> Agent 5 – Game Balancing & Simulation · Stand 2026-11-09
> Kennzeichnung: [gemessen] · [Regel] · [Design] · [Annahme] · [Hypothese]. Messwerte aus [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md) (`base`, `base-short`, `h-confiscation`, `npc-conf`, `h-wealth-sink`).

## 1. Ziel

Der Spieler soll früh Erfolge erleben. Er baut Kapital nachvollziehbar auf und stößt regelmäßig auf neue Ziele und Grenzen. Dabei darf er **weder** so schnell vorankommen, dass Geld bedeutungslos wird, **noch** durch eine einzelne Fehlentscheidung oder ein Zufallsereignis dauerhaft festsitzen.

## 2. Startbedingungen [Regel]

| Wert | Parameter | Wirkung |
|---|---|---|
| 2.000 € Schwarzgeld | `player.start_cash_black` = 200 000 ct | reicht für eine volle Rucksackladung günstiger Ware plus Bahnticket (INV-04: Leipzig → Berlin, Speed, +317 €) |
| 60 Volumeneinheiten Rucksack | `player.backpack_capacity` | Engpass vor dem ersten Fahrzeug |
| kein Fahrzeug, Bahn 15 ct/km | `travel.train_price_per_km` | kurze Routen lohnen, lange nur mit wertvoller Ware |

**Anfangsschwierigkeit [gemessen]:** Mit Startkapital und Bahn sind nur 13 % aller Routen profitabel. Die beste (`rotterdam → amsterdam`, Kokain) bringt ≈ 1.460 €/h, der Median der profitablen Routen nur ≈ 53 €/h. Der Einstieg ist also **eng, aber für informierte Spieler sehr ertragreich**. Erste Erfolge kommen schnell, sofern man die richtige Route findet. Siehe dazu Befund B-2 in [GAME_BALANCING.md](GAME_BALANCING.md#6-befunde-und-empfehlungen).

## 3. Wachstumsphasen

| Phase | Engpass | Wachstum | Ist [gemessen, `base`] |
|---|---|---|---|
| I | Kapital | exponentiell | Tag 0–7: E auf das 9- bis 17-Fache, B auf das 5- bis 8-Fache des Startkapitals |
| II | Transportkapazität | sprunghaft je Fahrzeug | Kleinwagen E Tag 2, B Tag 5–7. Transporter E Tag 5, B Tag 14–18. LKW E Tag 22, B Tag 37–44. |
| III | Markttiefe und Konkurrenz | linear | Tag 180→365: E ≈ +8.000 €/Tag, B ≈ +3.200 €/Tag (nahezu konstant) |

Die Kapitalrendite pro Tag fällt bei E von ≈ 40–50 % in Woche 1 auf 0,3–0,8 % zwischen Tag 180 und 365. Die Struktur sinkender Rendite funktioniert also, aber das absolute Wachstum endet nicht (§7).

## 4. Entwicklungsleiter

Kosten aus `parameters.toml` [Regel]. Meilensteintage [gemessen] als Median über die Läufe, in Klammern der Anteil der Läufe, die den Meilenstein erreichen. Ziele sind [Design].

| # | Schritt | Kosten / Bedingung | Ziel aktiv (B/E) | Ist `base` B · E | Ist `npc-conf` (empfohlene Konfiguration) B · E |
|---|---|---|---|---|---|
| 1 | Kleinwagen | 8.000 € | Tag 1–2 (E), ≤ 7 (B) | 7,2 (92 %) · 2,1 (83 %) | 11,0 (100 %) · 2,6 (100 %) |
| 2 | NW ≥ 50.000 € | – | Woche 2–3 | 19 (92 %) · 7,5 (67 %) | 29 (100 %) · 14 (100 %) |
| 3 | Transporter | 25.000 € | Tag 5–20 | 18,1 (92 %) · 5,2 (67 %) | 29,5 (100 %) · 8,5 (100 %) |
| 4 | LKW | 90.000 € + Schmuggel L5 | Woche 3–8 | 43,5 (92 %) · 21,7 (67 %) | 78,5 (17 %) · 27,6 (100 %) |
| 5 | Clan gründen | 50.000 € **Weißgeld** + Level-Summe 15 | Woche 2–5 | nicht simuliert (Weißgeld) | – |
| 6 | Erster Betrieb | 60.000–500.000 € Weißgeld | Woche 2–8 | nicht simuliert | – |
| 7 | NW ≥ 500.000 € | – | Monat 2–4 | 172 (92 %) · 82,5 (67 %) | – · – (Tag 90: E 335.000 €) |
| 8 | Weltraum | 5 Mio. € NW + Schmuggel L10 + Raumhafen | Monat 3–6 | nicht erreicht in 365 Tagen | – |

**Amortisation** [Regel/gemessen]: Ein Kleinwagen (8.000 €) erhöht die Kapazität von 60 auf 360 und amortisiert sich in weniger als einer Fahrt. Betriebe brauchen 30–93 Tage (INV-06). Der Sprung zwischen beiden Investitionsarten ist groß. Laut Agent 2 ist das gewollt, weil Weißgeld der eigentliche Engpass ist (Geldwäsche nicht simuliert).

**Bewertung:**
- Die Schritte 1–4 sind im Zielkorridor, mit der empfohlenen Konfiguration etwas langsamer und **dafür verlässlich** (100 % statt 67–92 %).
- Der Weltraum (Schritt 8) ist mit reinem Handel nach einem Jahr nicht erreichbar (E: ≈ 2,5 Mio. €). Das Spätspiel braucht Betriebe und Clans, also Agent 2s Systeme. Prüfung folgt in Phase P3.

## 5. Laufende Kosten

| Kosten | Regel | Größenordnung [gemessen, `base`, 365 Tage, je Spieler] |
|---|---|---|
| Treibstoff/Bahn | F-TRV-02/03 | B ≈ 193.000 €, E ≈ 199.000 € (≈ 2 % des Umsatzes) |
| Strafen, Bestechung, Schuldentilgung | F-TRV-06 | B ≈ 195.000 €, C ≈ 305.000 € |
| Unterhalt Betriebe, Crew | F-RE-02, `crew.*.upkeep` | nicht simuliert |
| [Design] Organisationskosten | F-PRG-01 | siehe §7 |

Die laufenden Kosten sind **klein im Verhältnis zum Umsatz**. Sie bremsen das Wachstum kaum (B-3).

## 6. Rückschläge ohne Sackgasse

**Problem [gemessen]:** Eine Kontrolle mit voller Ladung (F-TRV-06: Beschlagnahme der **ganzen** Ladung + 20 % Strafe, Rest als Schuld) wirft Spieler auf null zurück. Mit Schulden und ohne Kapital gibt es oft keine profitable Option mehr. Das ist eine **wirtschaftliche Sackgasse**:

| Szenario (90 Tage) | Ende unter Startkapital B · C · E | Sackgassen-Tage B · C · E | P10 Nettovermögen E |
|---|---|---|---|
| `base-short` (Regel) | 50 % · 67 % · 29 % | 36 · 49 · 18 | −2.215 € |
| `safety-net` ([Design] Startkredit 1.000 €) | 8 % · 17 % · 0 % | 11 · 5 · 2 | 202.590 € |
| `h-confiscation` ([Design] 50 % Beschlagnahme) | **0 % · 0 % · 0 %** | **0 · 0 · 0** | **452.551 €** |
| `npc-conf` (50 % Beschlagnahme + NPC-Händler k = 1) | **0 % · 0 % · 0 %** | **0 · 0 · 0** | 306.915 € |

**Empfehlung (genau ein neuer Parameter):** `travel.confiscation_share` = 0,5. Eine Kontrolle beschlagnahmt dann die Hälfte der illegalen Ladung, und die Strafe bezieht sich auf den beschlagnahmten Teil. Spielerisch heißt das „Die Polizei findet nicht alles“. Der Rückschlag bleibt spürbar, beendet aber nicht das Spiel. Zuständig ist Agent 2 (Reisen/Kontrollen). Das Sicherheitsnetz (Startkredit) wäre die zweitbeste Lösung. Es wirkt schwächer und erzeugt eine zusätzliche Geldquelle.

Profil D (ineffizient) bleibt auch dann in der Hälfte der Läufe unter dem Startkapital. Das ist gewollt: Schlechte Entscheidungen sollen Folgen haben. Eine Sackgasse entsteht für D durch eigene Fehlkäufe, nicht durch Zufall.

## 7. Langfristige Ziele und vermögensabhängige Senken

R-2 (keine Resets) und Befund B-3 (ungebremste Geldmenge) machen Senken, die mit dem Vermögen wachsen, zur **Pflicht** (ADR-016, T-505). Die folgenden Vorschläge sind **[Design]**. Jeder Vorschlag hat genau einen Hauptparameter.

| ID | Mechanik | Formel | Vorschlag | Spielerische Begründung |
|---|---|---|---|---|
| **F-PRG-01** | **Organisationskosten** (Lebensstil, Leute, Schweigegeld): täglich fällig, sobald das Nettovermögen eine Schwelle übersteigt | K_Tag = r · max(0, NW − NW₀), abgebucht beim Tageswechsel, zuerst vom Bargeld; bei Nichtzahlung `heat` +10 in der aktuellen Stadt | r = 0,5 %/Tag, NW₀ = 500 000 € | Wer groß ist, muss den Apparat bezahlen. Für Einsteiger unsichtbar, ab der Mittelklasse spürbar. Wächst linear mit dem Vermögen, deshalb wirksam gegen exponentielles Wachstum. |
| **F-PRG-02** | **Aufhol-XP** für Spieler unter dem Server-Median | XP_eff = XP · (1 + b · max(0, 1 − L / L_Median)) je Feld | b = 0,5 | Neue Spieler holen bei den Fähigkeiten auf (Spread-Rabatt, Kontrollbonus), nicht beim Geld. Der Vorsprung bleibt erkennbar, ist aber nicht uneinholbar. |
| **F-PRG-03** | **Zuwachs-Ranglisten** (T-508) | Rang nach ΔNW_Woche / max(NW_Wochenanfang, 50 000 €) | Untergrenze 50 000 € | Neue Spieler können Wochen- und Monatssieger werden. Keine Resets (R-2). |
| **F-PRG-04** | **Prestigekäufe** (rein kosmetisch: Titel, Statussymbole, Clan-Embleme) | Preis steigt mit dem Besitz: P_n = P₀ · 2^n | P₀ = 50 000 € | freiwillige Senke für Spieler, „die schon alles haben“. Gibt Geld eine Bedeutung über den Handel hinaus. |

**Wirkung von F-PRG-01 [gemessen, `h-wealth-sink` vs. `base`, 365 Tage]:**

| Kennzahl | `base` | `h-wealth-sink` |
|---|---:|---:|
| Geldmenge Tag 365 (35 Spieler) | 18,7 Mio. € | 13,0 Mio. € |
| Wachstum der Geldmenge, letzte 30 Tage | +10,2 % | +4,5 % |
| Reichster Spieler ÷ Median | 26,7 | **17,4** (Ziel ≤ 20 ✅) |
| E Nettovermögen Tag 365 (Median) | 2,45 Mio. € | 1,59 Mio. € |
| B Nettovermögen Tag 365 (Median) | 1,10 Mio. € | 0,97 Mio. € |
| A (unter der Schwelle) | 95.000 € | 121.000 € (unberührt, Unterschied = Rauschen) |

Überschlag [Annahme]: Das Gleichgewicht liegt bei Tagesgewinn = r · (NW − NW₀). Bei ≈ 8.000 €/Tag (E, Phase III) ergibt das NW ≈ 0,5 Mio. € + 8.000 € / 0,005 ≈ 2,1 Mio. €. Das Wachstum bleibt möglich, flacht aber ab, anstatt unbegrenzt weiterzulaufen.

## 8. Langzeitmotivation und Monotonie

| Risiko | Gegenmittel | Stand |
|---|---|---|
| Immer dieselbe Route (B-2) | NPC-Händler gleichen Preisunterschiede aus (F-NPC-01). Erholung T½ ≈ 5,7 h verhindert Dauerausbeutung. [Design] Kundenbindung NPC-1b, Polizeidruck NPC-4, Krisen F-ECO-12. | F-NPC-01 [Regel]; Rest [Design] |
| „Geld hat keine Bedeutung mehr“ | F-PRG-01 und F-PRG-04, Weltraum als Spätspiel (Agent 2), Clans | [Design] / [Regel] |
| Kein Ziel nach dem LKW | Betriebe und Geldwäsche, weil Weißgeld der Engpass ist (Clan 50 000 € Weißgeld, Weltraum 5 Mio. € NW + Schmuggel L10) | [Regel, Agent 2] |
| Neue Spieler sehen nur uneinholbare Veteranen | F-PRG-02 und F-PRG-03, Vermögensband im PvP (F-CMB-06) | [Design] / [Regel] |

## 9. Testfälle

| ID | Prüfung | Erwartet |
|---|---|---|
| PRG-T1 | Kleinwagen-Meilenstein (empfohlene Konfiguration) | E ≤ Tag 3, B ≤ Tag 14, Erreichungsquote ≥ 90 % |
| PRG-T2 | Anteil B/C/E unter Startkapital nach 90 Tagen | ≤ 10 % |
| PRG-T3 | Reichster ÷ Median nach 365 Tagen | ≤ 20 |
| PRG-T4 | Wachstum der Geldmenge in den letzten 30 von 365 Tagen | ≤ 5 % |
| PRG-T5 | Profil A (vorsichtig) wächst monoton, kein Lauf endet unter Startkapital | erfüllt in `base` |
