-- ═══════════════════════════════════════════════════════════════════════════════
-- Zusätzliche Invarianten, sobald die Vorschläge aus proposals/p1.sql umgesetzt sind
-- ═══════════════════════════════════════════════════════════════════════════════
-- Ergänzt docs/database/invariants.sql (C-01 … C-12). Gleiche Konvention: eine Zeile je Verstoß.
--   psql "$DATABASE_URL" -f docs/database/proposals/invariants-p1.sql

CREATE OR REPLACE FUNCTION pg_temp.p1_journal_violations()
RETURNS TABLE (check_name text, subject text, detail text)
LANGUAGE sql STABLE AS $$

  -- X-01 Marktjournal: Version lückenlos 1..n je Markt, Kette über die Version statt createdAt
  SELECT 'X-01 market_version_chain', c."cityId" || '/' || c."commodityId", 'version ' || c."version" || ' at position ' || c.rn
  FROM (SELECT m.*, row_number() OVER w AS rn,
               lag(m."newStock") OVER w AS ps, lag(m."newNoise") OVER w AS pn, lag(m."newEvent") OVER w AS pe
        FROM "MarketStateChange" m
        WINDOW w AS (PARTITION BY m."cityId", m."commodityId" ORDER BY m."version")) c
  WHERE c."version" <> c.rn
     OR (c.rn > 1 AND (c."oldStock" IS DISTINCT FROM c.ps OR c."oldNoise" IS DISTINCT FROM c.pn OR c."oldEvent" IS DISTINCT FROM c.pe))

  UNION ALL
  -- X-02 MarketState.version = höchste Journalversion
  SELECT 'X-02 market_version_projection', s."cityId" || '/' || s."commodityId",
         'state version ' || s."version" || ' vs journal ' || COALESCE(max(m."version")::text, 'none')
  FROM "MarketState" s
  LEFT JOIN "MarketStateChange" m ON m."cityId" = s."cityId" AND m."commodityId" = s."commodityId"
  GROUP BY s."cityId", s."commodityId", s."version"
  HAVING s."version" IS DISTINCT FROM max(m."version")

  UNION ALL
  -- X-03 Handel vollständig: je TradeTransaction genau eine Marktzeile (TRADE, refId) und dazu
  --      Geld und Ware mit derselben correlationId, betragsgleich
  SELECT 'X-03 trade_complete', t."id",
         'market rows ' || (SELECT count(*) FROM "MarketStateChange" m WHERE m."cause" = 'TRADE' AND m."refId" = t."id")
         || ', money ' || COALESCE((SELECT sum(x."amount") FROM "MoneyTransaction" x WHERE x."correlationId" = t."correlationId"
                                    AND x."reason" IN ('TRADE_BUY', 'TRADE_SELL'))::text, 'none')
         || ' vs total ' || t."total"
         || ', goods ' || COALESCE((SELECT sum(i."delta") FROM "InventoryMovement" i WHERE i."correlationId" = t."correlationId"
                                    AND i."reason" IN ('TRADE_BUY', 'TRADE_SELL'))::text, 'none')
  FROM "TradeTransaction" t
  WHERE (SELECT count(*) FROM "MarketStateChange" m WHERE m."cause" = 'TRADE' AND m."refId" = t."id") <> 1
     OR NOT EXISTS (SELECT 1 FROM "MarketStateChange" m WHERE m."refId" = t."id" AND m."correlationId" = t."correlationId")
     OR COALESCE((SELECT sum(x."amount") FROM "MoneyTransaction" x WHERE x."correlationId" = t."correlationId"
                  AND x."reason" IN ('TRADE_BUY', 'TRADE_SELL')), 0)
        <> CASE t."side" WHEN 'BUY' THEN -t."total" ELSE t."total" END
     OR COALESCE((SELECT sum(i."delta") FROM "InventoryMovement" i WHERE i."correlationId" = t."correlationId"
                  AND i."reason" IN ('TRADE_BUY', 'TRADE_SELL')), 0)
        <> CASE t."side" WHEN 'BUY' THEN t."quantity" ELSE -t."quantity" END

  UNION ALL
  -- X-04 Umbuchungen Spieler ↔ Clan: Summe beider Seiten je correlationId = 0
  SELECT 'X-04 clan_transfer_zero_sum', x."correlationId"::text, 'sum ' || sum(x."amount")
  FROM (SELECT "correlationId", "amount" FROM "MoneyTransaction" WHERE "reason" IN ('CLAN_DEPOSIT', 'CLAN_PAYOUT', 'CLAN_TAX')
        UNION ALL
        SELECT "correlationId", "amount" FROM "ClanTreasuryTransaction" WHERE "reason" IN ('DEPOSIT', 'PAYOUT', 'TAX')) x
  GROUP BY x."correlationId"
  HAVING sum(x."amount") <> 0

  UNION ALL
  -- X-05 Wäsche: Bargeld-Abgang = cashIn, Bank-Zugang = bankCredit (Differenz ist die Gebühr bzw. der Kursverlust)
  SELECT 'X-05 laundering_money', l."id"::text, 'cashIn ' || l."cashIn" || ', bankCredit ' || l."bankCredit"
  FROM "LaunderingEntry" l
  WHERE COALESCE((SELECT sum("amount") FROM "MoneyTransaction" WHERE "correlationId" = l."correlationId"
                  AND "reason" = 'LAUNDERING' AND "account" = 'CASH'), 0) <> -l."cashIn"
     OR COALESCE((SELECT sum("amount") FROM "MoneyTransaction" WHERE "correlationId" = l."correlationId"
                  AND "reason" = 'LAUNDERING' AND "account" = 'BANK'), 0) <> l."bankCredit"

  UNION ALL
  -- X-06 Jede LAUNDERING-Buchung gehört zu einem LaunderingEntry
  SELECT 'X-06 laundering_without_entry', m."id", m."account" || ' ' || m."amount"
  FROM "MoneyTransaction" m
  WHERE m."reason" = 'LAUNDERING'
    AND NOT EXISTS (SELECT 1 FROM "LaunderingEntry" l WHERE l."correlationId" = m."correlationId")

  UNION ALL
  -- X-07 Beute erzeugt kein Geld: je correlationId Σ LOOT_GAINED ≤ Σ |LOOT_LOST| (Rest = Hehlerabschlag);
  --      NPC-Kuriere (Quelle) haben keine LOOT_LOST-Gegenseite und stehen mit actorType NPC im GameEvent.
  SELECT 'X-07 loot_creates_money', m."correlationId"::text,
         'gained ' || sum(m."amount") FILTER (WHERE m."reason" = 'LOOT_GAINED') || ' lost ' || sum(m."amount") FILTER (WHERE m."reason" = 'LOOT_LOST')
  FROM "MoneyTransaction" m
  WHERE m."reason" IN ('LOOT_GAINED', 'LOOT_LOST')
  GROUP BY m."correlationId"
  HAVING count(*) FILTER (WHERE m."reason" = 'LOOT_LOST') > 0
     AND COALESCE(sum(m."amount") FILTER (WHERE m."reason" = 'LOOT_GAINED'), 0)
         > -COALESCE(sum(m."amount") FILTER (WHERE m."reason" = 'LOOT_LOST'), 0)

  UNION ALL
  -- X-08 Wahl: abgeschlossene ELECTION hat einen Sieger aus der Kandidatenliste
  SELECT 'X-08 election_result', b."id", 'winner ' || COALESCE(b."winnerId", 'none')
  FROM "ClanBallot" b
  WHERE b."kind" = 'ELECTION' AND b."status" = 'CLOSED'
    AND NOT EXISTS (SELECT 1 FROM "ClanBallotCandidate" c WHERE c."ballotId" = b."id" AND c."playerId" = b."winnerId")

  UNION ALL
  -- X-09 Höchstens ein Pate je Clan; ohne offene Wahl genau einer (aktive Clans mit Mitgliedern)
  SELECT 'X-09 one_godfather', c."id", count(*) FILTER (WHERE m."role" = 'GODFATHER') || ' godfathers'
  FROM "Clan" c JOIN "ClanMember" m ON m."clanId" = c."id"
  WHERE c."dissolvedAt" IS NULL
  GROUP BY c."id"
  HAVING count(*) FILTER (WHERE m."role" = 'GODFATHER') > 1
      OR (count(*) FILTER (WHERE m."role" = 'GODFATHER') = 0 AND NOT "clan_payouts_locked"(c."id"))

  UNION ALL
  -- X-11 Strenge Saldo-Kette über seq: balanceAfter = laufende Summe (Geld und Clankasse)
  SELECT 'X-11 money_chain_seq', x.k, 'seq ' || x."seq" || ': balanceAfter ' || x."balanceAfter" || ' <> running sum ' || x.s
  FROM (SELECT "playerId" || '/' || "account" AS k, "seq", "balanceAfter",
               sum("amount") OVER (PARTITION BY "playerId", "account" ORDER BY "seq") AS s
        FROM "MoneyTransaction"
        UNION ALL
        SELECT 'clan ' || "clanId" || '/' || "account", "seq", "balanceAfter",
               sum("amount") OVER (PARTITION BY "clanId", "account" ORDER BY "seq")
        FROM "ClanTreasuryTransaction") x
  WHERE x."balanceAfter" <> x.s

  UNION ALL
  -- X-12 Strenge Warenkette über seq
  SELECT 'X-12 inventory_chain_seq', i."playerId" || '/' || i."commodityId", 'seq ' || i."seq" || ': quantityAfter ' || i."quantityAfter" || ' <> ' || i.s
  FROM (SELECT t.*, sum(t."delta") OVER (PARTITION BY t."playerId", t."commodityId" ORDER BY t."seq") AS s
        FROM "InventoryMovement" t) i
  WHERE i."quantityAfter" <> i.s

  UNION ALL
  -- X-10 Keine Buchung nach dem letzten begonnenen Tick
  SELECT 'X-10 tick_in_future', x.t || ' ' || x.id, 'tick ' || x.tick
  FROM (SELECT 'money' AS t, "id", "tick" FROM "MoneyTransaction"
        UNION ALL SELECT 'inventory', "id", "tick" FROM "InventoryMovement"
        UNION ALL SELECT 'trade', "id", "tick" FROM "TradeTransaction"
        UNION ALL SELECT 'clan', "id", "tick" FROM "ClanTreasuryTransaction"
        UNION ALL SELECT 'market', "id", "tick" FROM "MarketStateChange") x
  WHERE x.tick > (SELECT max("tick") FROM "WorldTick")
$$;

SELECT * FROM pg_temp.p1_journal_violations() ORDER BY 1, 2;
