-- ═══════════════════════════════════════════════════════════════════════════════
-- Konsistenzprüfungen der Journale – Datenmodell v2
-- ═══════════════════════════════════════════════════════════════════════════════
-- Prüft die Invarianten aus docs/database/DATA_MODEL.md §3 direkt in der Datenbank, unabhängig
-- vom Anwendungscode. Läuft gegen das aktuelle Schema (Migration 20261112120000_data_model_v2).
--
--   psql "$DATABASE_URL" -f docs/database/invariants.sql
--
-- Ergebnis: eine Zeile je Verstoß. KEINE Zeile = konsistent.
-- Liest nur; die Hilfsfunktion liegt in pg_temp und verschwindet mit der Sitzung.
-- Verwendung: Integrationstests, nächtlicher Check im Betrieb, Auswertung für das Balancing.
-- Herkunft: Agent-5-Review, docs/database/REVIEW-v2.md.
--
-- Hinweis zur Reihenfolge: Die v2-Journale haben keine fortlaufende Nummer. createdAt ist innerhalb
-- einer Transaktion gleich (now()) bzw. nur millisekundengenau (Markt-Trigger), und die id (cuid
-- bzw. UUID aus dem Trigger) ist keine verlässliche Reihenfolge (REVIEW-v2.md G-3b). Die Ketten-
-- Prüfungen C-01/C-03/C-05/C-10 sind deshalb reihenfolgeunabhängig: Jeder "Vorher"-Wert einer Zeile
-- muss der "Nachher"-Wert einer anderen Zeile desselben Kontos/Marktes sein (oder der Anfangswert).
-- Die strenge Prüfung über eine fortlaufende Nummer steht in proposals/invariants-p1.sql.

CREATE OR REPLACE FUNCTION pg_temp.v2_journal_violations()
RETURNS TABLE (check_name text, subject text, detail text)
LANGUAGE sql STABLE AS $$

  -- C-01 (M-1) Geld: jede Buchung setzt einen vorhandenen Saldo fort (balanceAfter − amount ist 0
  --      oder der balanceAfter einer anderen Buchung desselben Kontos); genau eine Buchung je
  --      Konto startet bei 0 bzw. hängt an keinem Vorgänger
  SELECT 'C-01 money_chain', m."playerId" || '/' || m."account",
         'id ' || m."id" || ': no predecessor with balance ' || (m."balanceAfter" - m."amount")
  FROM "MoneyTransaction" m
  WHERE m."balanceAfter" - m."amount" <> 0
    AND NOT EXISTS (SELECT 1 FROM "MoneyTransaction" p
                    WHERE p."playerId" = m."playerId" AND p."account" = m."account" AND p."id" <> m."id"
                      AND p."balanceAfter" = m."balanceAfter" - m."amount")

  UNION ALL
  -- C-02 (M-1) Geld: Projektion Player.cash/bank = Summe des Kontobuchs
  SELECT 'C-02 money_projection', p."id",
         'cash ' || p."cash" || ' vs journal ' || COALESCE(j.c, 0) || ', bank ' || p."bank" || ' vs journal ' || COALESCE(j.b, 0)
  FROM "Player" p
  LEFT JOIN (SELECT "playerId",
                    sum("amount") FILTER (WHERE "account" = 'CASH') AS c,
                    sum("amount") FILTER (WHERE "account" = 'BANK') AS b
             FROM "MoneyTransaction" GROUP BY "playerId") j ON j."playerId" = p."id"
  WHERE p."cash" <> COALESCE(j.c, 0) OR p."bank" <> COALESCE(j.b, 0)

  UNION ALL
  -- C-03 (K-1) Clankasse: jede Buchung setzt einen vorhandenen Saldo fort (wie C-01)
  SELECT 'C-03 clan_chain', c."clanId" || '/' || c."account",
         'id ' || c."id" || ': no predecessor with balance ' || (c."balanceAfter" - c."amount")
  FROM "ClanTreasuryTransaction" c
  WHERE c."balanceAfter" - c."amount" <> 0
    AND NOT EXISTS (SELECT 1 FROM "ClanTreasuryTransaction" p
                    WHERE p."clanId" = c."clanId" AND p."account" = c."account" AND p."id" <> c."id"
                      AND p."balanceAfter" = c."balanceAfter" - c."amount")

  UNION ALL
  -- C-04 (K-1) Clankasse: Projektion = Summe des Journals
  SELECT 'C-04 clan_projection', cl."id",
         'treasuryCash ' || cl."treasuryCash" || ' vs ' || COALESCE(j.c, 0) || ', treasuryBank ' || cl."treasuryBank" || ' vs ' || COALESCE(j.b, 0)
  FROM "Clan" cl
  LEFT JOIN (SELECT "clanId",
                    sum("amount") FILTER (WHERE "account" = 'CASH') AS c,
                    sum("amount") FILTER (WHERE "account" = 'BANK') AS b
             FROM "ClanTreasuryTransaction" GROUP BY "clanId") j ON j."clanId" = cl."id"
  WHERE cl."treasuryCash" <> COALESCE(j.c, 0) OR cl."treasuryBank" <> COALESCE(j.b, 0)

  UNION ALL
  -- C-05 (I-1) Waren: jede Bewegung setzt einen vorhandenen Bestand fort (wie C-01)
  SELECT 'C-05 inventory_chain', i."playerId" || '/' || i."commodityId",
         'id ' || i."id" || ': no predecessor with quantity ' || (i."quantityAfter" - i."delta")
  FROM "InventoryMovement" i
  WHERE i."quantityAfter" - i."delta" <> 0
    AND NOT EXISTS (SELECT 1 FROM "InventoryMovement" p
                    WHERE p."playerId" = i."playerId" AND p."commodityId" = i."commodityId" AND p."id" <> i."id"
                      AND p."quantityAfter" = i."quantityAfter" - i."delta")

  UNION ALL
  -- C-06 (I-1) Waren: Σ delta = Σ InventoryLot.quantity je (Spieler, Ware)
  SELECT 'C-06 inventory_projection', k."playerId" || '/' || k."commodityId",
         'journal ' || COALESCE(j.q, 0) || ' vs lots ' || COALESCE(l.q, 0)
  FROM (SELECT "playerId", "commodityId" FROM "InventoryMovement"
        UNION SELECT "playerId", "commodityId" FROM "InventoryLot") k
  LEFT JOIN (SELECT "playerId", "commodityId", sum("delta") AS q FROM "InventoryMovement"
             GROUP BY 1, 2) j USING ("playerId", "commodityId")
  LEFT JOIN (SELECT "playerId", "commodityId", sum("quantity") AS q FROM "InventoryLot"
             GROUP BY 1, 2) l USING ("playerId", "commodityId")
  WHERE COALESCE(j.q, 0) <> COALESCE(l.q, 0)

  UNION ALL
  -- C-07 Vorzeichen je Grund (DATA_MODEL.md §4): Quellen > 0, Senken < 0, Wäsche Bargeld − / Bank +
  SELECT 'C-07 money_sign', m."id", m."reason" || ' ' || m."account" || ' amount ' || m."amount"
  FROM "MoneyTransaction" m
  WHERE (m."reason" IN ('START_CAPITAL', 'TRADE_SELL', 'VEHICLE_SALE', 'EQUIPMENT_SALE', 'LOOT_GAINED',
                        'BUSINESS_INCOME', 'EMERGENCY_LOAN', 'CLAN_PAYOUT') AND m."amount" < 0)
     OR (m."reason" IN ('TRADE_BUY', 'TRAVEL_FUEL', 'TRAVEL_TICKET', 'BRIBE', 'CONFISCATION', 'VEHICLE_BUY',
                        'EQUIPMENT_BUY', 'CREW', 'BUSINESS_UPKEEP', 'LOAN_REPAYMENT', 'LOOT_LOST',
                        'ACCOUNT_DELETION', 'CLAN_DEPOSIT', 'CLAN_TAX') AND m."amount" > 0)
     OR (m."reason" = 'LAUNDERING' AND ((m."account" = 'CASH') <> (m."amount" < 0)))

  UNION ALL
  -- C-08 Kontolöschung (ADR-017): DELETED ⇔ ohne Login; gelöschte Spieler ohne Vermögen und Besitz
  SELECT 'C-08 deleted_player', p."id", 'status ' || p."status" || ', still has: ' || concat_ws(', ',
           CASE WHEN p."userId" IS NOT NULL AND p."status" = 'DELETED' THEN 'user' END,
           CASE WHEN p."userId" IS NULL AND p."status" <> 'DELETED' THEN 'no user but not DELETED' END,
           CASE WHEN p."status" = 'DELETED' AND p."deletedAt" IS NULL THEN 'no deletedAt' END,
           CASE WHEN p."status" = 'DELETED' AND (p."cash" <> 0 OR p."bank" <> 0) THEN 'money' END,
           CASE WHEN p."status" = 'DELETED' AND EXISTS (SELECT 1 FROM "InventoryLot" x WHERE x."playerId" = p."id") THEN 'goods' END,
           CASE WHEN p."status" = 'DELETED' AND EXISTS (SELECT 1 FROM "Vehicle" x WHERE x."playerId" = p."id") THEN 'vehicles' END,
           CASE WHEN p."status" = 'DELETED' AND EXISTS (SELECT 1 FROM "PlayerEquipment" x WHERE x."playerId" = p."id") THEN 'equipment' END,
           CASE WHEN p."status" = 'DELETED' AND EXISTS (SELECT 1 FROM "ClanMember" x WHERE x."playerId" = p."id") THEN 'clan membership' END,
           CASE WHEN p."status" = 'DELETED' AND EXISTS (SELECT 1 FROM "PlayerCityHeat" x WHERE x."playerId" = p."id") THEN 'heat' END)
  FROM "Player" p
  WHERE (p."status" = 'DELETED') <> (p."userId" IS NULL)
     OR (p."status" = 'DELETED' AND (p."deletedAt" IS NULL OR p."cash" <> 0 OR p."bank" <> 0
         OR EXISTS (SELECT 1 FROM "InventoryLot" x WHERE x."playerId" = p."id")
         OR EXISTS (SELECT 1 FROM "Vehicle" x WHERE x."playerId" = p."id")
         OR EXISTS (SELECT 1 FROM "PlayerEquipment" x WHERE x."playerId" = p."id")
         OR EXISTS (SELECT 1 FROM "ClanMember" x WHERE x."playerId" = p."id")
         OR EXISTS (SELECT 1 FROM "PlayerCityHeat" x WHERE x."playerId" = p."id")))

  UNION ALL
  -- C-09 Aufgelöste Clans: keine Mitglieder, leere Kasse
  SELECT 'C-09 dissolved_clan', c."id", 'members ' || (SELECT count(*) FROM "ClanMember" m WHERE m."clanId" = c."id")
         || ', cash ' || c."treasuryCash" || ', bank ' || c."treasuryBank"
  FROM "Clan" c
  WHERE c."dissolvedAt" IS NOT NULL
    AND (c."treasuryCash" <> 0 OR c."treasuryBank" <> 0 OR EXISTS (SELECT 1 FROM "ClanMember" m WHERE m."clanId" = c."id"))

  UNION ALL
  -- C-10 (P-1) Marktjournal: der "alt"-Zustand jeder Zeile ist der "neu"-Zustand einer anderen Zeile
  --      desselben Marktes; nur die Anlage (INITIAL, alt = NULL) hat keinen Vorgänger
  SELECT 'C-10 market_chain', c."cityId" || '/' || c."commodityId", 'id ' || c."id" || ' (' || c."cause" || '): no predecessor'
  FROM "MarketStateChange" c
  WHERE NOT (c."oldStock" IS NULL AND c."cause" = 'INITIAL')
    AND NOT EXISTS (SELECT 1 FROM "MarketStateChange" p
                    WHERE p."cityId" = c."cityId" AND p."commodityId" = c."commodityId" AND p."id" <> c."id"
                      AND p."newStock" = c."oldStock" AND p."newNoise" = c."oldNoise"
                      AND p."newEvent" IS NOT DISTINCT FROM c."oldEvent")

  UNION ALL
  -- C-11 (P-1) Marktzustand: es gibt eine Journalzeile, deren "neu"-Zustand dem aktuellen Zustand
  --      entspricht (reihenfolgeunabhängig, siehe Hinweis oben); jeder Markt hat mindestens eine Zeile
  SELECT 'C-11 market_projection', ms."cityId" || '/' || ms."commodityId",
         'state stock ' || ms."stock" || ' noise ' || ms."noise" || ' event ' || COALESCE(ms."activeEvent", '-')
         || ' not found as new state in the journal'
  FROM "MarketState" ms
  WHERE NOT EXISTS (SELECT 1 FROM "MarketStateChange" m
                    WHERE m."cityId" = ms."cityId" AND m."commodityId" = ms."commodityId"
                      AND m."newStock" = ms."stock" AND m."newNoise" = ms."noise"
                      AND m."newEvent" IS NOT DISTINCT FROM ms."activeEvent")

  UNION ALL
  -- C-12 (P-1) Jede Marktänderung hat eine Ursache und einen Tick (UNSPECIFIED = Kontext vergessen)
  SELECT 'C-12 market_cause', m."id", 'cause ' || m."cause" || ', tick ' || COALESCE(m."tick"::text, 'NULL')
  FROM "MarketStateChange" m
  WHERE m."cause" = 'UNSPECIFIED' OR (m."cause" NOT IN ('INITIAL', 'ADMIN') AND m."tick" IS NULL)
$$;

SELECT * FROM pg_temp.v2_journal_violations() ORDER BY 1, 2;
