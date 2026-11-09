# BALANCING_PARAMETERS – Parameterverzeichnis

> Agent 5 – Game Balancing & Simulation · Stand 2026-11-09
> **Single Source of Truth für Werte ist `docs/game-design/parameters.toml`.** Dieses Verzeichnis ergänzt Beschreibung, Einheit, Grenzen, Einflussbereich, Abhängigkeiten, Begründung, Eigentümer und letzte Änderung. Abschnitt 2 ist **generiert** und darf nicht von Hand bearbeitet werden.

## 1. Konventionen

| Thema | Regel |
|---|---|
| Geld | ganzzahlige Cent (ADR-019). Zahlt der Spieler, wird aufgerundet, erhält er, wird abgerundet (`verify.py` `ceil_ct`/`floor_ct`, `backend/src/domain/money.ts` `debitAmount`/`creditAmount`) |
| Zeit | Raten gelten **pro Tick**. Ein Tick dauert `meta.tick_minutes` = 10 min, `meta.ticks_per_day` = 144 |
| Wahrscheinlichkeiten | Floats in [0, 1], immer geklemmt |
| Grenzen | `[bounds]` in `parameters.toml` (geprüft von `verify.py` INV-01 und `sim/src/params.ts` beim Laden). Wo `[bounds]` fehlt: Min/Max aus `sim/parameter-meta.toml`, Vorschlag Agent 5 |
| Eigentum | Werte: Agent 2 pflegt die Datei. Fachlich: Wirtschaft, Handel, NPC und Progression = Agent 5. Kampf, Clans, Geldwäsche, Immobilien, Weltraum und Reisen = Agent 2 (PO-Entscheidung 2026-11-09) |
| Änderung | Genau ein Parameter je Änderung, vorher und nachher ein Simulationslauf (ADR-016 Konsequenz). Eintrag in §3 und Pull Request gegen `parameters.toml` |
| Erweiterung | Neue Metadaten kommen nach `sim/parameter-meta.toml`, danach `npm run sim -- registry` ausführen und Abschnitt 2 ersetzen |

## 2. Verzeichnis (generiert)

Befehl: `cd sim && npm run sim -- registry`. Die Spalten „Einflussbereich“, „Abhängigkeiten“ und „Begründung“ stammen aus `sim/parameter-meta.toml`. Bisher ist das für die 24 zentralen Wirtschafts- und Progressionsparameter gepflegt. Kampf-, Clan-, Geldwäsche-, Immobilien- und Weltraumparameter dokumentiert Agent 2 in den jeweiligen Systemdokumenten (`docs/game-design/*.md`, Abschnitt „Parameter“).

<!-- generiert mit `npm run sim -- registry` aus parameters.toml (SHA-256 1072bd270762…, Version 0.1.0) -->

### 2.1 Globale Wirtschafts- und Progressionsparameter

| Schlüssel | Beschreibung | Wert | Min | Max | Einheit | Einflussbereich | Abhängigkeiten | Aktualisierung | Begründung | Eigentümer | Letzte Änderung |
|---|---|---:|---:|---:|---|---|---|---|---|---|---|
| `meta.tick_minutes` | Länge eines Server-Ticks | 10 | 1 | 60 | min | alle zeitabhängigen Raten | meta.ticks_per_day, alle *_ticks, reversion_rate | fest | 10 min: Reisen dauern Minuten bis Stunden, Märkte reagieren spürbar innerhalb einer Sitzung | Agent 2 / Agent 1 (ADR-006) | v0.1.0 (Agent 2) |
| `player.start_cash_black` | Startkapital (Schwarzgeld) | 200.000 | 50000 | 1000000 | ct | Progression Phase I, erste Erfolgserlebnisse | goods.*.base_price, player.backpack_capacity, travel.train_price_per_km | einmalig bei Registrierung | 2 000 € reichen für eine volle Rucksackladung günstiger Ware plus Bahnticket (INV-04) | Agent 5 | v0.1.0 (Agent 2) |
| `player.backpack_capacity` | Tragekapazität ohne Fahrzeug | 60 | 20 | 200 | Volumeneinheiten | Progression Phase I→II (Transport-Engpass), Bahnreisen | vehicles.*.capacity, goods.*.volume | fest | Begrenzt das Wachstum vor dem ersten Fahrzeug; macht den Kleinwagen zum ersten Ziel | Agent 5 | v0.1.0 (Agent 2) |
| `economy.elasticity` | ε: Preiselastizität bzgl. Knappheit | 0,5 | 0.2 | 1 | – | Preisspreizung zwischen Städten (P* ∝ (m_d/m_s)^ε), Slippage, Marktreaktion | city.*.supply/demand, trade.spread_base | wirkt bei jedem Preis (Order sofort, Tick) | 0,5: 25 % Bestandsentnahme hebt den Preis um ≈ 15 %; Spreizung Faktor 2–3 zwischen Erzeuger- und Verbraucherstädten | Agent 5 | v0.1.0 (Agent 2) |
| `economy.wealth_price_exponent` | ω: Wohlstand hebt das Preisniveau | 0,3 | 0 | 1 | – | regionale Preisunterschiede | city.*.wealth | Tick | 0,3: reiche Städte zahlen spürbar, aber nicht dominant mehr | Agent 5 | v0.1.0 (Agent 2) |
| `economy.cover_ticks` | Lagerreichweite im Gleichgewicht | 144 | 36 | 1008 | Ticks | Markttiefe (S_ref, S_target) → Slippage, Gewinnpool je Route | goods.*.consumption, city.*.pop | Tick | 144 = 1 Tag Nachfrage auf Lager: große Orders bewegen den Preis deutlich | Agent 5 | v0.1.0 (Agent 2) |
| `economy.reversion_rate` | λ: Rückkehr des Bestands zum Ziel pro Tick | 0,02 | 0.001 | 0.2 | 1/Tick | Erholung nach Spieler-Orders (T½), Routensättigung | meta.tick_minutes | Tick | 0,02 → T½ ≈ 34 Ticks (5,7 h): ein ausgebeuteter Markt erholt sich innerhalb eines Spieltags | Agent 5 | v0.1.0 (Agent 2) |
| `economy.noise_rho` | ρ: Autokorrelation des Preisrauschens | 0,95 | 0 | 0.99 | – | Preisbewegung ohne Spieler | goods.*.volatility | Tick | 0,95: Trends über Stunden statt Zufallszittern; stationär σ/√(1−ρ²) ≈ 3,2 σ | Agent 5 | v0.1.0 (Agent 2) |
| `economy.price_min_factor` | Preisuntergrenze relativ zu P_base | 0,25 | 0.05 | 1 | × P_base | Schutz vor Preisverfall (Überangebot) | economy.price_max_factor | jede Preisberechnung | 0,25: Dumping bleibt teuer, Preise fallen nie gegen null | Agent 5 | v0.1.0 (Agent 2) |
| `economy.price_max_factor` | Preisobergrenze relativ zu P_base | 4 | 1 | 10 | × P_base | Schutz vor Preisexplosion (Knappheit, Cornering E-03) | economy.price_min_factor, INV-02 | jede Preisberechnung | 4,0: Knappheit lohnt sich, aber ohne Ausreißer; Gleichgewichtspreise liegen nicht am Clamp (INV-02) | Agent 5 | v0.1.0 (Agent 2) |
| `economy.min_stock` | Mindestbestand eines Marktes | 1 | 1 | 1 | Einheiten | Edge-Case Leerkauf | trade.max_trade_share | Tick/Order | Division durch null vermeiden | Agent 5 | v0.1.0 (Agent 2) |
| `cities.demand_wealth_exponent` | β: reiche Städte konsumieren mehr | 1 | 0 | 2 | – | Marktgröße und -tiefe je Stadt | city.*.wealth, city.*.pop | Tick | 1,0: Nachfrage proportional zur Kaufkraft | Agent 5 | v0.1.0 (Agent 2) |
| `trade.spread_base` | Spanne zwischen Kauf- und Verkaufspreis | 0,1 | 0.02 | 0.3 | Anteil | Händlerpreise, Rund-Trip-Verlust (INV-03), Geldsenke | professions.handel_spread_reduction(_cap) | jede Order | 10 %, mit Handel L20 4 %: sofortige Arbitrage verliert immer | Agent 5 | v0.1.0 (Agent 2) |
| `trade.max_trade_share` | Max. Anteil des Bestands je Order | 0,9 | 0.1 | 1 | Anteil | Cornering (E-03), Slippage | economy.min_stock | jede Order | 90 %: Markt nie ganz leer | Agent 5 | v0.1.0 (Agent 2) |
| `heat.trade_heat_per_keur` | Heat je 1 000 € Handelsvolumen × Heat-Faktor der Ware | 0,5 | 0 | 5 | Heat/1 000 € | Risiko/Belohnung: Kontrollwahrscheinlichkeit | goods.*.heat, travel.control_base, heat.decay_base | jede Order; Zerfall pro Tick | großer Umsatz in einer Stadt macht auffällig | Agent 2 (Kontrollen) / Agent 5 (Handel) | v0.1.0 (Agent 2) |
| `heat.decay_base` | Grundzerfall der Heat pro Tick | 0,01 | 0.001 | 0.1 | 1/Tick | Erholung nach Kontrollen/Handel | heat.police_decay_damping, city.*.police | Tick (lazy) | ≈ 1 Tag bis zur Halbierung in Städten mit mittlerer Polizei | Agent 2 | v0.1.0 (Agent 2) |
| `travel.control_base` | Grundwahrscheinlichkeit einer Kontrolle je 100-km-Segment | 0,02 | 0 | 0.1 | Wahrscheinlichkeit | Risiko/Belohnung, Verlustquote, Sackgassen | travel.segment_km, city.*.police, goods.*.heat, vehicles.*.hide | bei Abfahrt gewürfelt | 2 % je Segment → ≈ 14 % je langer Fahrt mit voller Ladung (EX-TRV-02) | Agent 2 | v0.1.0 (Agent 2) |
| `travel.fine_rate` | Strafe als Anteil des Ladungs-Basiswerts | 0,2 | 0 | 1 | Anteil | Rückschläge, Geldsenke | travel.debt_repayment_rate | bei Kontrolle | zusätzlich zur Beschlagnahme; erzeugt bei leerem Konto Schulden | Agent 2 | v0.1.0 (Agent 2) |
| `travel.debt_repayment_rate` | Anteil künftiger Verkaufserlöse, der Schulden tilgt | 0,5 | 0 | 1 | Anteil | Rückschläge ohne Sackgasse | travel.fine_rate, safety_net.* | bei jedem Verkauf | 50 %: Spieler bleibt handlungsfähig, Schuld verschwindet aber spürbar | Agent 2 | v0.1.0 (Agent 2) |
| `travel.vehicle_resale_rate` | Wiederverkaufswert von Fahrzeugen | 0,6 | 0 | 1 | Anteil des Kaufpreises | Erholung nach Totalverlust, Exploit E-08 | vehicles.*.price | bei Verkauf | 60 %: Fahrzeuge sind Investition, kein Geldspeicher | Agent 2 | v0.1.0 (Agent 2) |
| `travel.train_price_per_km` | Bahnticket je km | 15 | 1 | 50 | ct/km | Einstieg ohne Fahrzeug | player.backpack_capacity | bei Abfahrt | 15 ct/km: lohnt sich nur mit voller Rucksackladung (INV-04) | Agent 2 | v0.1.0 (Agent 2) |
| `professions.xp_per_level_k` | k der Level-Kurve XP(L) = k · L² | 100 | 10 | 1000 | XP | Progression der Betätigungsfelder, Freischaltungen (LKW: Schmuggel L5) | professions.*_xp_*, unlocks.* | bei XP-Gewinn | quadratisch: frühe Level schnell, späte Level langsam | Agent 5 (Progression) | v0.1.0 (Agent 2) |
| `professions.handel_spread_reduction` | Spread-Rabatt je Handel-Level | 0,03 | 0 | 0.05 | Anteil je Level | Belohnung für Spezialisierung, Marge | professions.handel_spread_reduction_cap, trade.spread_base | jede Order | 3 %/Level, Deckel 60 % → Spread nie unter 4 % (INV-03) | Agent 5 | v0.1.0 (Agent 2) |
| `professions.handel_xp_per_eur` | Handels-XP je Euro Umsatz | 0,01 | 0 | 0.1 | XP/€ | Progression Handel | professions.xp_per_level_k | jede Order | 1 XP je 100 € Umsatz: L10 nach ≈ 1 Mio. € Umsatz | Agent 5 | v0.1.0 (Agent 2) |

### 2.2 Waren (`goods.*`, Inhalt)

| Schlüssel | Welt | P_base (ct) | Verbrauch je 1 000 Einw. und Tick | Volatilität σ | Volumen | Verderb/Tick | Heat-Faktor |
|---|---|---:|---:|---:|---:|---:|---:|
| `gras` | earth | 1.000 | 0,02 | 0,015 | 2 | 0,0001 | 0,5 |
| `haschisch` | earth | 1.200 | 0,01 | 0,015 | 1 | 0 | 0,6 |
| `pilze` | earth | 1.500 | 0,004 | 0,02 | 2 | 0,002 | 0,7 |
| `speed` | earth | 2.000 | 0,008 | 0,02 | 1 | 0 | 1 |
| `ecstasy` | earth | 1.000 | 0,008 | 0,02 | 1 | 0 | 1 |
| `lsd` | earth | 1.500 | 0,003 | 0,025 | 1 | 0 | 1 |
| `kokain` | earth | 8.000 | 0,004 | 0,02 | 1 | 0 | 1,5 |
| `heroin` | earth | 6.000 | 0,002 | 0,025 | 1 | 0 | 2 |
| `sternenstaub` | space | 50.000 | 0,01 | 0,04 | 1 | 0 | 3 |
| `mondkristall` | space | 30.000 | 0,01 | 0,03 | 1 | 0 | 1 |
| `marsmoos` | space | 20.000 | 0,015 | 0,035 | 2 | 0,001 | 1,5 |
| `nullgrav` | space | 80.000 | 0,005 | 0,04 | 1 | 0 | 2,5 |

Grenzen: P_base > 0; Gleichgewichtspreise aller Märkte in [P_min, P_max] (INV-02); Volatilität ≤ 0,05 (Vorschlag Agent 5, damit P/P* im Korridor 0,85–1,15 bleibt).

### 2.3 Städte (`city.*`, Inhalt)

| Schlüssel | Bevölkerung (Tsd.) | Wohlstand W | Polizei | Treibstoff ct/l | Angebot m_s (≠ 1) | Nachfrage m_d (≠ 1) |
|---|---:|---:|---:|---:|---|---|
| `berlin` | 3.700 | 1 | 0,55 | 185 | speed 1,5, ecstasy 1,5 | speed 1,4, ecstasy 1,6 |
| `hamburg` | 1.850 | 1,2 | 0,65 | 185 | kokain 2, heroin 1,5 | – |
| `muenchen` | 1.500 | 1,6 | 0,8 | 190 | kokain 0,5, gras 0,6, haschisch 0,7 | kokain 1,4 |
| `koeln` | 1.080 | 1,1 | 0,6 | 185 | – | gras 1,3 |
| `frankfurt` | 770 | 1,5 | 0,7 | 185 | heroin 1,3, sternenstaub 0,2, mondkristall 0,2, marsmoos 0,2, nullgrav 0,2 | kokain 1,5, sternenstaub 1, mondkristall 1, marsmoos 1, nullgrav 1 |
| `leipzig` | 620 | 0,8 | 0,5 | 180 | speed 2,5 | – |
| `amsterdam` | 900 | 1,3 | 0,3 | 200 | gras 3, haschisch 3, pilze 3, ecstasy 2 | – |
| `rotterdam` | 650 | 1 | 0,45 | 200 | kokain 2,5, heroin 1,8 | – |

### 2.4 Marktereignisse (`events.*`)

| Schlüssel | Wahrscheinlichkeit/Tick/Markt | Dauer (Ticks) | Bestandsschock | Angebot × | Nachfrage × |
|---|---:|---:|---:|---:|---:|
| `razzia` | 0,0005 | 36 | 0,5 | 0,5 | 1 |
| `lieferung` | 0,0005 | 36 | 2 | 1,5 | 1 |
| `party` | 0,0003 | 72 | 1 | 1 | 1,8 |

### 2.5 NPCs (`npc.*`, Regel F-NPC-01…04, Agent 2 / fachlich Agent 5)

| Schlüssel | Wert | Grenzen ([bounds]) |
|---|---:|---|
| `npc.k_start` | 1 | – |
| `npc.k_min` | 0 | – |
| `npc.k_max` | 1 | – |
| `npc.trader_intensity` | 0,5 | [0; 2] |
| `npc.trader_threshold_base` | 0,15 | – |
| `npc.trader_threshold_per_km` | 0,0002 | – |
| `npc.trader_threshold_scale` | 0,5 | – |
| `npc.couriers_per_city_day` | 4 | – |
| `npc.courier_tiers` | 5 | – |
| `npc.courier_strength_base` | 40 | – |
| `npc.courier_strength_growth` | 1,8 | – |
| `npc.courier_cash_base` | 50.000 | – |
| `npc.courier_cash_growth` | 2 | – |
| `npc.courier_cooldown_ticks` | 18 | – |
| `npc.gang_attack_base` | 0,0007 | [0; 0.005] |
| `npc.gang_min_cash` | 1.000.000 | – |
| `npc.gang_cooldown_ticks` | 144 | – |
| `npc.gang_strength_factor` | 0,8 | – |
| `npc.handover_route_competition` | 0,5 | – |
| `npc.handover_target_availability` | 0,3 | – |
| `npc.handover_market_activity` | 0,6 | – |
| `npc.handover_min_peak_online` | 15 | – |
| `npc.handover_hold_days` | 14 | – |
| `npc.handover_miss_days` | 7 | – |
| `npc.handover_step` | 0,1 | [0.01; 0.5] |
| `npc.handover_step_days` | 7 | – |
| `npc.handover_top_routes` | 10 | – |

### 2.6 Vorschläge von Agent 5 (`sim/proposals.toml`, SHA-256 a631ba892620…, Status: Vorschlag – nur Simulation)

| Schlüssel | Vorschlag |
|---|---:|
| `economy_ext.wealth_cycle_amplitude` | 0,08 |
| `economy_ext.wealth_cycle_period_days` | 56 |
| `economy_ext.crisis_probability_per_day` | 0,004 |
| `economy_ext.crisis_demand_mult` | 0,7 |
| `economy_ext.crisis_duration_days` | 5, 14 |
| `economy_ext.regional_noise_share` | 0,5 |
| `economy_ext.supply_response_rate` | 0,0005 |
| `economy_ext.supply_response_min` | 0,7 |
| `economy_ext.supply_response_max` | 1,5 |
| `economy_ext.weekend_demand_mult` | 1,15 |
| `economy_ext.weekend_goods` | ecstasy, speed, lsd, pilze |
| `npc_ext.consumer_satisfaction_rate` | 0,0005 |
| `npc_ext.consumer_scarcity_threshold` | 0,5 |
| `npc_ext.consumer_demand_min` | 0,75 |
| `npc_ext.consumer_demand_max` | 1,1 |
| `npc_ext.police_pressure_per_keur_day` | 0,00002 |
| `npc_ext.police_pressure_max` | 0,3 |
| `npc_ext.police_pressure_decay` | 0,01 |
| `safety_net.start_loan_ct` | 100.000 |
| `safety_net.min_cash_threshold_ct` | 20.000 |
| `safety_net.cooldown_days` | 7 |


## 3. Änderungsprotokoll

| Datum | Parameter | Alt → Neu | Grund | Quelle |
|---|---|---|---|---|
| 2026-11-08 | alle | – → v0.1.0 | Erstfassung | Agent 2, PR #4 |
| 2026-11-08 | `city.*` Mond: `supply.gras` / `demand.gras` | 0,1 / 30 → 0,5 / 4 | Gleichgewichtspreis lag dauerhaft am Clamp (E-17) | Agent 2 nach Befund Agent 5 |
| 2026-11-08 | `combat.loot_daily_cap_rate`, `loot_repeat_decay`, `loot_fence_rate` | neu: 0,35 / 0,5 / 0,15 | Opfer verlor bis zu 68 % des Bargelds pro Tag (B-5) | Agent 2 nach Befund Agent 5 |
| 2026-11-08 | `combat.networth_history_ticks`, `clans.networth_treasury_share` | neu: 1008 / 1,0 | Vermögensband ließ sich durch Vermögens-Parken umgehen (B-6) | Agent 2 nach Befund Agent 5 |
| 2026-11-09 | `[npc]` | neu | F-NPC-01…04 (T-506, R-4) | Agent 2, `npc.md` |
| 2026-11-09 | `[account] deletion_policy` | neu: `forfeit` | ADR-017 | Agent 2 |
| 2026-11-09 | `clans.election_*`, `no_confidence_*` | neu | ADR-018 | Agent 2 |

## 4. Offene Änderungsvorschläge von Agent 5

Jeder Vorschlag betrifft genau einen Parameter und ist durch einen Simulationslauf belegt (siehe [GAME_BALANCING.md §6](GAME_BALANCING.md#6-befunde-und-empfehlungen) und [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md)). Status: **vorgeschlagen**, noch nicht in `parameters.toml`.
