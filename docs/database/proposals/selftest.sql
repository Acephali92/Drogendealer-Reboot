-- ═══════════════════════════════════════════════════════════════════════════════
-- Selbsttest für proposals/p1.sql (Agent-5-Review)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Voraussetzung: leere Datenbank, alle Migrationen von main (prisma migrate deploy), danach p1.sql.
-- Aufruf (aus docs/database/proposals/):
--   psql "$URL" -v ON_ERROR_STOP=1 -f selftest.sql
-- Läuft in EINER Transaktion und rollt am Ende alles zurück. Jede erwartete Ablehnung wird geprüft;
-- am Ende müssen invariants.sql und invariants-p1.sql leer sein.
-- pg_temp.book() bildet bookMoney() aus backend/src/modules/money/ledger.ts nach
-- (bedingtes Update der Projektion, dann Journalzeile mit balanceAfter).

\set QUIET on
\set VERBOSITY terse
\o /dev/null
BEGIN;

CREATE FUNCTION pg_temp.expect_error(p_sql text, p_pattern text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ p_pattern THEN
      RAISE EXCEPTION 'FAIL: expected error /%/ but got: %', p_pattern, SQLERRM;
    END IF;
    RAISE NOTICE 'ok  rejected: %', left(SQLERRM, 100);
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL: accepted but should fail: %', p_sql;
END $$;

CREATE FUNCTION pg_temp.ok(p_cond boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', p_msg; END IF;
  RAISE NOTICE 'ok  %', p_msg;
END $$;

-- wie bookMoney(): Projektion bedingt ändern, dann Journalzeile
CREATE FUNCTION pg_temp.book(p_player text, p_account "MoneyAccount", p_amount bigint, p_reason "MoneyTransactionReason", p_ref text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  IF p_account = 'CASH' THEN
    UPDATE "Player" SET "cash" = "cash" + p_amount WHERE "id" = p_player AND "cash" + p_amount >= 0 RETURNING "cash" INTO v;
  ELSE
    UPDATE "Player" SET "bank" = "bank" + p_amount WHERE "id" = p_player AND "bank" + p_amount >= 0 RETURNING "bank" INTO v;
  END IF;
  IF v IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
  INSERT INTO "MoneyTransaction" ("id","playerId","account","amount","balanceAfter","reason","refId")
    VALUES (gen_random_uuid()::text, p_player, p_account, p_amount, v, p_reason, p_ref);
  RETURN v;
END $$;

CREATE FUNCTION pg_temp.clan_book(p_clan text, p_player text, p_account "MoneyAccount", p_amount bigint, p_reason "ClanTreasuryReason")
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  IF p_account = 'CASH' THEN
    UPDATE "Clan" SET "treasuryCash" = "treasuryCash" + p_amount WHERE "id" = p_clan RETURNING "treasuryCash" INTO v;
  ELSE
    UPDATE "Clan" SET "treasuryBank" = "treasuryBank" + p_amount WHERE "id" = p_clan RETURNING "treasuryBank" INTO v;
  END IF;
  INSERT INTO "ClanTreasuryTransaction" ("id","clanId","playerId","account","amount","balanceAfter","reason")
    VALUES (gen_random_uuid()::text, p_clan, p_player, p_account, p_amount, v, p_reason);
  RETURN v;
END $$;

-- Marktkontext wie setMarketChangeContext() (+ Detail)
CREATE FUNCTION pg_temp.market_ctx(p_cause text, p_ref text DEFAULT NULL, p_detail jsonb DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('app.market_change_cause', p_cause, true),
         set_config('app.market_change_ref', COALESCE(p_ref, ''), true),
         set_config('app.market_change_detail', COALESCE(p_detail::text, ''), true);
$$;

-- ── Welt ──────────────────────────────────────────────────────────────────────
INSERT INTO "ParameterSet" ("hash","version","content") VALUES ('sha-p1','0.1.0','{"meta":{"tick_minutes":10}}');
INSERT INTO "WorldTick" ("tick","parameterSetHash","seedFingerprint") VALUES (1,'sha-p1','f'), (2,'sha-p1','f');
INSERT INTO "City" ("id","slug") VALUES ('c_ber','berlin'), ('c_ham','hamburg');
INSERT INTO "Commodity" ("id","slug") VALUES ('g_gras','gras');
INSERT INTO "User" ("id","email","username","passwordHash","updatedAt","ageConfirmedAt") VALUES
  ('u_a','a@example.test','anna','x',now(),now()), ('u_b','b@example.test','bert','x',now(),now()), ('u_c','c@example.test','cora','x',now(),now());
INSERT INTO "Player" ("id","userId","name","updatedAt") VALUES
  ('p_a','u_a','Anna',now()), ('p_b','u_b','Bert',now()), ('p_c','u_c','Cora',now());

-- ── G-1/G-2/G-6: Journalkontext ───────────────────────────────────────────────
SELECT pg_temp.expect_error($$SELECT pg_temp.book('p_a','CASH',200000,'START_CAPITAL')$$, 'JOURNAL_CONTEXT_MISSING');
SELECT set_journal_context(1, '00000000-0000-0000-0000-000000000001', 'SYSTEM');
SELECT pg_temp.book(p, 'CASH', 200000, 'START_CAPITAL') FROM unnest(ARRAY['p_a','p_b','p_c']) p;
SELECT pg_temp.ok((SELECT bool_and("tick" = 1 AND "actorType" = 'SYSTEM' AND "seq" IS NOT NULL) FROM "MoneyTransaction"),
                  'bookMoney() unchanged: tick, actor and seq come from the context');
SELECT pg_temp.expect_error(
  $$SELECT set_journal_context(1, gen_random_uuid(), 'PLAYER')$$ || ', ' || $$pg_temp.book('p_a','CASH',-1,'BRIBE')$$, 'MoneyTransaction_actor_shape');

-- ── G-8: Saldo-Kette und Projektion ───────────────────────────────────────────
SELECT pg_temp.expect_error(
  $$INSERT INTO "MoneyTransaction" ("id","playerId","account","amount","balanceAfter","reason") VALUES ('bad','p_a','CASH',-100,1,'BRIBE')$$,
  'MONEY_CHAIN_BROKEN');
SELECT pg_temp.expect_error(
  $q$DO $x$ BEGIN UPDATE "Player" SET "cash" = "cash" + 1 WHERE "id" = 'p_a'; SET CONSTRAINTS ALL IMMEDIATE; END $x$$q$,
  'MONEY_PROJECTION_MISMATCH');
SELECT pg_temp.expect_error($$UPDATE "MoneyTransaction" SET "amount" = 1$$, 'append-only');
SELECT pg_temp.expect_error($$TRUNCATE "MoneyTransaction" CASCADE$$, 'TRUNCATE needs app.allow_truncate');

-- ── G-3: Markt ────────────────────────────────────────────────────────────────
SELECT set_journal_context(1, '00000000-0000-0000-0000-0000000000a0', 'SYSTEM');
INSERT INTO "MarketState" ("id","cityId","commodityId","stock","updatedAt") VALUES ('m1','c_ber','g_gras',1000,now());
SELECT pg_temp.ok((SELECT "version" FROM "MarketState" WHERE "id"='m1') = 1, 'market created with version 1 (INITIAL)');
SELECT pg_temp.expect_error($$UPDATE "MarketState" SET "stock" = 999 WHERE "id"='m1'$$, 'MARKET_CONTEXT_MISSING');

-- Kauf: eine Aktion = eine correlationId über Handel, Markt, Ware, Geld
SELECT set_journal_context(1, '00000000-0000-0000-0000-0000000000a1', 'PLAYER', 'p_a');
INSERT INTO "TradeTransaction" ("id","playerId","cityId","commodityId","side","quantity","unitPrice","total")
  VALUES ('t1','p_a','c_ber','g_gras','BUY',10,844,8440);
SELECT pg_temp.market_ctx('TRADE', 't1', '{"q":10}');
UPDATE "MarketState" SET "stock" = 990 WHERE "id"='m1';
INSERT INTO "InventoryLot" ("id","playerId","commodityId","quantity","costBasis") VALUES ('l1','p_a','g_gras',10,8440);
INSERT INTO "InventoryMovement" ("id","playerId","commodityId","delta","quantityAfter","reason","refId")
  VALUES ('im1','p_a','g_gras',10,10,'TRADE_BUY','t1');
SELECT pg_temp.book('p_a','CASH',-8440,'TRADE_BUY','t1');

-- Tick 2: Ereignis (mit Wurf), NPC-Fluss, Rauschen + Erholung
SELECT set_journal_context(2, '00000000-0000-0000-0000-0000000000b2', 'SYSTEM');
INSERT INTO "GameEvent" ("type","cityId","commodityId","probability","roll","occurred","params")
  VALUES ('market.razzia','c_ber','g_gras',0.004,0.0011,true,'{"stock_shock":0.5,"duration":36}');
SELECT pg_temp.market_ctx('EVENT', (SELECT "id"::text FROM "GameEvent" ORDER BY "id" DESC LIMIT 1));
UPDATE "MarketState" SET "stock" = 495, "activeEvent" = 'razzia', "eventTicksLeft" = 36 WHERE "id"='m1';
SELECT pg_temp.market_ctx('NPC', NULL, '{"from":"hamburg","q":12.5}');
UPDATE "MarketState" SET "stock" = 507.5 WHERE "id"='m1';
SELECT pg_temp.market_ctx('TICK', NULL, '{"S_target":1000,"lambda":0.02,"Z":-1.19}');
UPDATE "MarketState" SET "stock" = 517.35, "noise" = -0.018, "eventTicksLeft" = 35 WHERE "id"='m1';
UPDATE "MarketState" SET "eventTicksLeft" = 34 WHERE "id"='m1';   -- reiner Countdown: keine Zeile
SELECT pg_temp.ok((SELECT string_agg("cause"::text, ',' ORDER BY "version") FROM "MarketStateChange") = 'INITIAL,TRADE,EVENT,NPC,TICK',
                  'market history explains every step, in version order');
SELECT pg_temp.expect_error(
  $$INSERT INTO "GameEvent" ("type","probability","roll","occurred") VALUES ('travel.control',0.1,0.5,true)$$, 'GameEvent_roll_consistent');

-- ── G-4: Wäsche und Polizeikontrolle (ADR-023) ────────────────────────────────
SELECT set_journal_context(2, '00000000-0000-0000-0000-0000000000c1', 'PLAYER', 'p_a');
INSERT INTO "LaunderingEntry" ("playerId","method","cashIn","bankCredit","rate","probability","roll")
  VALUES ('p_a','gambling',10000,7300,0.73,NULL,NULL);
SELECT pg_temp.book('p_a','CASH',-10000,'LAUNDERING');
SELECT pg_temp.book('p_a','BANK',7300,'LAUNDERING');

-- Kontrolle auf Reisen: alles mitgeführte Bargeld und alle Drogen weg (ADR-023)
SELECT set_journal_context(2, '00000000-0000-0000-0000-0000000000c2', 'SYSTEM');
INSERT INTO "GameEvent" ("type","playerId","cityId","probability","roll","occurred","params")
  VALUES ('travel.control','p_a','c_ham',0.12,0.05,true,'{"confiscated_cash":181560,"confiscated_goods":{"gras":10}}');
SELECT pg_temp.book('p_a','CASH',-181560,'CONFISCATION');
INSERT INTO "InventoryMovement" ("id","playerId","commodityId","delta","quantityAfter","reason") VALUES ('im2','p_a','g_gras',-10,0,'CONFISCATION');
UPDATE "InventoryLot" SET "quantity" = 0 WHERE "id" = 'l1';
SELECT pg_temp.ok((SELECT "cash" = 0 AND "bank" = 7300 FROM "Player" WHERE "id"='p_a'), 'bank money survives the control');

-- ── G-5: Clan, Kasse, Wahl (ADR-018) ──────────────────────────────────────────
SELECT set_journal_context(2, '00000000-0000-0000-0000-0000000000d0', 'PLAYER', 'p_a');
INSERT INTO "Clan" ("id","name","tag") VALUES ('cl1','Die Kioskbande','KIO');
INSERT INTO "ClanMember" ("id","clanId","playerId","role") VALUES ('m_a','cl1','p_a','GODFATHER'), ('m_b','cl1','p_b','CAPO'), ('m_c','cl1','p_c','SOLDIER');
INSERT INTO "ClanMembershipEvent" ("clanId","playerId","change","roleAfter") VALUES ('cl1','p_a','FOUNDED','GODFATHER');
SELECT set_journal_context(2, '00000000-0000-0000-0000-0000000000d1', 'PLAYER', 'p_b');
SELECT pg_temp.book('p_b','CASH',-50000,'CLAN_DEPOSIT');
SELECT pg_temp.clan_book('cl1','p_b','CASH',50000,'DEPOSIT');

-- Pate Anna löscht ihr Konto (wie deleteAccount(), mit userId = null im selben UPDATE)
SELECT set_journal_context(2, '00000000-0000-0000-0000-0000000000e1', 'SYSTEM');
SELECT pg_temp.book('p_a','BANK',-7300,'ACCOUNT_DELETION');
INSERT INTO "ClanMembershipEvent" ("clanId","playerId","change","roleBefore","reason") VALUES ('cl1','p_a','LEFT','GODFATHER','ACCOUNT_DELETION');
DELETE FROM "ClanMember" WHERE "playerId"='p_a';
DELETE FROM "InventoryLot" WHERE "playerId"='p_a';
INSERT INTO "ClanBallot" ("id","clanId","kind","trigger","opensTick","closesTick") VALUES ('bal1','cl1','ELECTION','GODFATHER_DELETED',2,74);
INSERT INTO "ClanBallotCandidate" VALUES ('bal1','p_b','CAPO',2);
INSERT INTO "ClanBallotVoter" VALUES ('bal1','p_b','CAPO'), ('bal1','p_c','SOLDIER');
SELECT pg_temp.expect_error(
  $$UPDATE "Player" SET "status"='DELETED', "deletedAt"=now() WHERE "id"='p_a'$$, 'Player_user_iff_not_deleted');
UPDATE "Player" SET "status"='DELETED', "deletedAt"=now(), "userId"=NULL, "name"='Gelöschter Spieler #3fa9c1', "lastSeenAt"=NULL, "currentCityId"=NULL WHERE "id"='p_a';
DELETE FROM "User" WHERE "id"='u_a';
SELECT pg_temp.expect_error($$SELECT pg_temp.book('p_a','CASH',100,'TRADE_SELL')$$, 'is deleted');
SELECT pg_temp.ok((SELECT count(*) FROM "MoneyTransaction" WHERE "playerId"='p_a') = 6, 'journal rows of the deleted player stay');

-- Während der Wahl: Auszahlung gesperrt, Einzahlung erlaubt, keine zweite Wahl
SELECT pg_temp.ok(clan_payouts_locked('cl1'), 'clan_payouts_locked() is true during the election');
SELECT set_journal_context(2, '00000000-0000-0000-0000-0000000000d2', 'PLAYER', 'p_b');
SELECT pg_temp.expect_error($$SELECT pg_temp.clan_book('cl1','p_b','CASH',-1000,'PAYOUT')$$, 'CLAN_PAYOUT_LOCKED');
SELECT set_journal_context(2, '00000000-0000-0000-0000-0000000000d3', 'PLAYER', 'p_c');
SELECT pg_temp.book('p_c','CASH',-1000,'CLAN_DEPOSIT');
SELECT pg_temp.clan_book('cl1','p_c','CASH',1000,'DEPOSIT');
SELECT pg_temp.expect_error(
  $$INSERT INTO "ClanBallot" ("id","clanId","kind","trigger","opensTick","closesTick") VALUES ('bal2','cl1','ELECTION','MOTION',2,74)$$,
  'ClanBallot_one_open_per_kind');

-- Stimmen
SELECT pg_temp.expect_error($$INSERT INTO "ClanBallotVote" ("ballotId","voterId","candidateId") VALUES ('bal1','p_a','p_b')$$, 'NOT_ELIGIBLE');
SELECT pg_temp.expect_error($$INSERT INTO "ClanBallotVote" ("ballotId","voterId","candidateId") VALUES ('bal1','p_c','p_c')$$, 'INVALID_CANDIDATE');
INSERT INTO "ClanBallotVote" ("ballotId","voterId","candidateId") VALUES ('bal1','p_c','p_b'), ('bal1','p_b','p_b'), ('bal1','p_c','p_b');
SELECT pg_temp.ok((SELECT count(*) FROM "ClanBallotTally" WHERE "ballotId"='bal1') = 2, 'tally counts the last vote per voter');

-- Wahl endet: Bert wird Pate, Sperre fällt
UPDATE "ClanBallot" SET "status"='CLOSED', "closedTick"=2, "winnerId"='p_b', "resolution"='votes' WHERE "id"='bal1';
UPDATE "ClanMember" SET "role"='GODFATHER' WHERE "playerId"='p_b';
INSERT INTO "ClanMembershipEvent" ("clanId","playerId","change","roleBefore","roleAfter","ballotId") VALUES ('cl1','p_b','ROLE_CHANGED','CAPO','GODFATHER','bal1');
SELECT pg_temp.expect_error($$INSERT INTO "ClanBallotVote" ("ballotId","voterId","candidateId") VALUES ('bal1','p_c','p_b')$$, 'BALLOT_CLOSED');
SELECT set_journal_context(2, '00000000-0000-0000-0000-0000000000d4', 'PLAYER', 'p_b');
SELECT pg_temp.clan_book('cl1','p_b','CASH',-1000,'PAYOUT');
SELECT pg_temp.book('p_b','CASH',1000,'CLAN_PAYOUT');

-- Deferred-Prüfungen jetzt auslösen (sonst erst beim COMMIT)
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pg_temp.ok(true, 'projection checks pass for all legitimate bookings');

-- ── Invarianten: alle leer ────────────────────────────────────────────────────
\ir ../invariants.sql
\ir invariants-p1.sql
SELECT pg_temp.ok((SELECT count(*) FROM pg_temp.v2_journal_violations()) = 0, 'invariants.sql: no violations');
SELECT pg_temp.ok((SELECT count(*) FROM pg_temp.p1_journal_violations()) = 0, 'invariants-p1.sql: no violations');

-- Gegenprobe: an allen Triggern vorbei manipuliert → Invarianten schlagen an
SET LOCAL session_replication_role = replica;
UPDATE "Player" SET "cash" = "cash" + 1 WHERE "id" = 'p_c';
UPDATE "MarketState" SET "stock" = 1, "version" = 99 WHERE "id" = 'm1';
INSERT INTO "MoneyTransaction" ("id","playerId","account","amount","balanceAfter","reason","tick","correlationId","actorType","actorPlayerId")
  VALUES ('x1','p_b','CASH',-5,146000,'CLAN_DEPOSIT',2,'00000000-0000-0000-0000-0000000000ff','SYSTEM',NULL);
SET LOCAL session_replication_role = origin;
SELECT pg_temp.ok((SELECT string_agg(DISTINCT check_name, ',' ORDER BY check_name) FROM pg_temp.v2_journal_violations())
                  = 'C-01 money_chain,C-02 money_projection,C-11 market_projection', 'invariants.sql detects the manipulation');
SELECT pg_temp.ok((SELECT string_agg(DISTINCT check_name, ',' ORDER BY check_name) FROM pg_temp.p1_journal_violations())
                  = 'X-02 market_version_projection,X-04 clan_transfer_zero_sum,X-11 money_chain_seq', 'invariants-p1.sql detects the manipulation');

ROLLBACK;
\o
\echo 'selftest passed'
