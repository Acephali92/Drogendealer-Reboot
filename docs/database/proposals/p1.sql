-- ═══════════════════════════════════════════════════════════════════════════════
-- Vorschlag P1 zum Datenmodell v2 (Agent-5-Review, docs/database/REVIEW-v2.md)
-- ═══════════════════════════════════════════════════════════════════════════════
-- KEINE Migration und kein zweites Schema (ADR-010/022). Das Skript zeigt die Vorschläge
-- G-1 bis G-5 und G-8 vollständig und ausführbar. Getestet auf PostgreSQL 16 gegen eine
-- Datenbank im Stand von main (alle Migrationen bis 20261112120000_data_model_v2), danach
-- mit proposals/selftest.sql. Agent 3 übernimmt, ändert oder verwirft es in Prisma-Migrationen.
-- Die passenden Prisma-Deklarationen stehen in REVIEW-v2.md.
--
-- Leitidee: Der Service setzt pro Transaktion EINEN Journalkontext (Tick, correlationId, Akteur).
-- Die neuen Spalten holen ihre Werte als DB-Default aus diesem Kontext. bookMoney() und die
-- übrigen create()-Aufrufe ändern sich dadurch nicht, und eine Buchung ohne Kontext scheitert
-- (fail-closed), statt stillschweigend ohne Tick gespeichert zu werden.
--
--   1. Journalkontext                                   G-1, G-2, G-6
--   2. WorldTick, ParameterSet                          G-1, G-7
--   3. Journalkopf an allen Journalen                   G-1, G-2, G-3b, G-6
--   4. Marktjournal v2: fail-closed, Version, Detail    G-3
--   5. Saldo-Kette und Projektion in der DB prüfen      G-8
--   6. Append-only inkl. TRUNCATE-Schutz                G-3c
--   7. Wäsche- und Ereignisjournal                      G-4
--   8. Clan: Mitgliedschaftsjournal, Wahl, Kassensperre G-5
--   9. CHECK für Kontolöschung                          G-10a
-- ═══════════════════════════════════════════════════════════════════════════════


-- ───────────────────────── 1. Journalkontext ─────────────────────────

CREATE TYPE "ActorType" AS ENUM ('PLAYER', 'NPC', 'SYSTEM', 'ADMIN');

-- Einmal je Transaktion aufrufen (wie setMarketChangeContext, transaktionslokal).
CREATE FUNCTION "set_journal_context"(p_tick int, p_correlation uuid, p_actor_type text, p_actor_player text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config('app.tick', p_tick::text, true),
         set_config('app.correlation_id', p_correlation::text, true),
         set_config('app.actor_type', p_actor_type, true),
         set_config('app.actor_player_id', COALESCE(p_actor_player, ''), true),
         -- Kompatibilität: der Markt-Trigger liest bisher app.market_change_tick
         set_config('app.market_change_tick', p_tick::text, true);
$$;

-- Liest eine Kontext-Einstellung; fehlt sie, bricht die Anweisung mit klarer Meldung ab.
CREATE FUNCTION "journal_context"(p_name text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE v text := NULLIF(current_setting(p_name, true), '');
BEGIN
  IF v IS NULL THEN
    RAISE EXCEPTION 'JOURNAL_CONTEXT_MISSING: % is not set (call set_journal_context first)', p_name
      USING ERRCODE = 'not_null_violation';
  END IF;
  RETURN v;
END;
$$;


-- ───────────────────────── 2. Zeit und Parameter ─────────────────────────

-- Jede geladene Fassung von parameters.toml (append-only). Der Hash wird beim Start berechnet;
-- ist er neu, wird die Zeile angelegt. So ist jede historische Preisformel bestimmbar.
CREATE TABLE "ParameterSet" (
  "hash"     TEXT PRIMARY KEY,
  "version"  TEXT NOT NULL,
  "content"  JSONB NOT NULL,
  "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Eine Zeile je begonnenem Tick (T-104: Tick-Nummer als PK = kein Tick doppelt).
-- Spieleraktionen zwischen zwei Ticks tragen den zuletzt begonnenen Tick.
CREATE TABLE "WorldTick" (
  "tick"             INTEGER PRIMARY KEY CHECK ("tick" >= 0),
  "startedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"       TIMESTAMP(3),
  "parameterSetHash" TEXT NOT NULL REFERENCES "ParameterSet"("hash") ON DELETE RESTRICT,
  -- SHA-256 des geheimen Server-Seeds (game-design README §3), nie der Seed selbst
  "seedFingerprint"  TEXT NOT NULL
);


-- ───────────────────────── 3. Journalkopf ─────────────────────────
-- seq: fortlaufende Nummer = eindeutige Reihenfolge (cuid + createdAt sind es nicht, G-3b).
-- Drei Schritte, weil PostgreSQL einen STABLE-Default beim ADD COLUMN sofort auswertet:
-- Spalte anlegen → vorhandene Zeilen nachtragen (Tick 0, SYSTEM, je Zeile eigene correlationId;
-- vor dem Release sind das nur Testdaten) → Default und NOT NULL setzen.

-- Tick 0 = Welterzeugung; die Parameterfassung "pre-v2" steht für alles vor diesem Schritt.
INSERT INTO "ParameterSet" ("hash", "version", "content") VALUES ('pre-v2', 'pre-v2', '{}') ON CONFLICT DO NOTHING;
INSERT INTO "WorldTick" ("tick", "parameterSetHash", "seedFingerprint") VALUES (0, 'pre-v2', 'unknown') ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['MoneyTransaction', 'InventoryMovement', 'TradeTransaction', 'ClanTreasuryTransaction'] LOOP
    EXECUTE format($f$
      ALTER TABLE %1$I
        ADD COLUMN "seq" BIGINT GENERATED ALWAYS AS IDENTITY,
        ADD COLUMN "tick" INTEGER,
        ADD COLUMN "correlationId" UUID,
        ADD COLUMN "actorType" "ActorType",
        ADD COLUMN "actorPlayerId" TEXT
    $f$, t);
    EXECUTE format('ALTER TABLE %I DISABLE TRIGGER %I', t, t || '_append_only');
    EXECUTE format($f$
      UPDATE %1$I SET "tick" = 0, "correlationId" = gen_random_uuid(), "actorType" = 'SYSTEM'
    $f$, t);
    EXECUTE format('ALTER TABLE %I ENABLE TRIGGER %I', t, t || '_append_only');
    EXECUTE format($f$
      ALTER TABLE %1$I
        ALTER COLUMN "tick" SET DEFAULT ("journal_context"('app.tick'))::integer,
        ALTER COLUMN "tick" SET NOT NULL,
        ALTER COLUMN "correlationId" SET DEFAULT ("journal_context"('app.correlation_id'))::uuid,
        ALTER COLUMN "correlationId" SET NOT NULL,
        ALTER COLUMN "actorType" SET DEFAULT ("journal_context"('app.actor_type'))::"ActorType",
        ALTER COLUMN "actorType" SET NOT NULL,
        ALTER COLUMN "actorPlayerId" SET DEFAULT NULLIF(current_setting('app.actor_player_id', true), ''),
        ADD CONSTRAINT %2$I UNIQUE ("seq"),
        ADD CONSTRAINT %3$I FOREIGN KEY ("tick") REFERENCES "WorldTick"("tick") ON DELETE RESTRICT,
        ADD CONSTRAINT %4$I FOREIGN KEY ("actorPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT %5$I CHECK (("actorType" = 'PLAYER') = ("actorPlayerId" IS NOT NULL))
    $f$, t, t || '_seq_key', t || '_tick_fkey', t || '_actorPlayerId_fkey', t || '_actor_shape');
    EXECUTE format('CREATE INDEX %I ON %I ("correlationId")', t || '_correlationId_idx', t);
    EXECUTE format('CREATE INDEX %I ON %I ("tick")', t || '_tick_idx', t);
  END LOOP;
END $$;


-- ───────────────────────── 4. Marktjournal v2 ─────────────────────────
-- Änderungen gegenüber market_state_journal() aus der v2-Migration:
--   * fail-closed: UPDATE ohne Ursache oder ohne Tick bricht ab (statt UNSPECIFIED / tick NULL),
--   * fortlaufende Version je Markt (lückenlose Kette, unabhängig von createdAt),
--   * correlationId verbindet die Zeile mit Handel, Geld und Ware derselben Aktion,
--   * Restdauer des Ereignisses und Zwischenwerte der Formel (detail) werden mitgeschrieben,
--   * eine TRADE-Zeile braucht refId (= TradeTransaction.id).

ALTER TABLE "MarketState" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MarketStateChange"
  ADD COLUMN "seq" BIGINT GENERATED ALWAYS AS IDENTITY,
  ADD COLUMN "version" INTEGER,
  ADD COLUMN "newEventTicksLeft" INTEGER,
  ADD COLUMN "detail" JSONB,
  ADD COLUMN "correlationId" UUID;

-- Bestehende Zeilen nachtragen (vor dem Release nur Testdaten): Version in bisheriger Reihenfolge,
-- fehlender Tick = 0, UNSPECIFIED wird als ADMIN gekennzeichnet (Ursache unbekannt).
ALTER TABLE "MarketStateChange" DISABLE TRIGGER "MarketStateChange_append_only";
UPDATE "MarketStateChange" m SET
  "version" = r.rn, "newEventTicksLeft" = 0, "tick" = COALESCE(m."tick", 0),
  "cause" = CASE WHEN m."cause" = 'UNSPECIFIED' THEN 'ADMIN' ELSE m."cause" END
FROM (SELECT "id", row_number() OVER (PARTITION BY "cityId", "commodityId" ORDER BY "createdAt", "id") AS rn
      FROM "MarketStateChange") r
WHERE r."id" = m."id";
ALTER TABLE "MarketStateChange" ENABLE TRIGGER "MarketStateChange_append_only";
UPDATE "MarketState" s SET "version" = COALESCE((SELECT max(m."version") FROM "MarketStateChange" m
  WHERE m."cityId" = s."cityId" AND m."commodityId" = s."commodityId"), 0);

ALTER TABLE "MarketStateChange"
  ALTER COLUMN "version" SET NOT NULL,
  ALTER COLUMN "newEventTicksLeft" SET NOT NULL,
  ALTER COLUMN "tick" SET NOT NULL,
  ADD CONSTRAINT "MarketStateChange_seq_key" UNIQUE ("seq"),
  ADD CONSTRAINT "MarketStateChange_version_key" UNIQUE ("cityId", "commodityId", "version"),
  ADD CONSTRAINT "MarketStateChange_tick_fkey" FOREIGN KEY ("tick") REFERENCES "WorldTick"("tick") ON DELETE RESTRICT,
  ADD CONSTRAINT "MarketStateChange_trade_ref" CHECK ("cause" <> 'TRADE' OR "refId" IS NOT NULL),
  ADD CONSTRAINT "MarketStateChange_no_unspecified" CHECK ("cause" <> 'UNSPECIFIED');
CREATE INDEX "MarketStateChange_refId_idx" ON "MarketStateChange" ("refId");
CREATE INDEX "MarketStateChange_correlationId_idx" ON "MarketStateChange" ("correlationId");

-- Die Countdown-Änderung von eventTicksLeft allein zählt wie bisher nicht als Änderung;
-- sie ist deterministisch und steht beim nächsten echten Eintrag in newEventTicksLeft.
CREATE FUNCTION "market_state_version"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."version" := 1;
  ELSIF (OLD."stock", OLD."noise", OLD."activeEvent", OLD."cityId", OLD."commodityId")
        IS DISTINCT FROM (NEW."stock", NEW."noise", NEW."activeEvent", NEW."cityId", NEW."commodityId") THEN
    NEW."version" := OLD."version" + 1;
  ELSE
    NEW."version" := OLD."version";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "MarketState_version" BEFORE INSERT OR UPDATE ON "MarketState"
FOR EACH ROW EXECUTE FUNCTION "market_state_version"();

CREATE OR REPLACE FUNCTION "market_state_journal"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_cause text := NULLIF(current_setting('app.market_change_cause', true), '');
  v_tick  text := COALESCE(NULLIF(current_setting('app.market_change_tick', true), ''),
                           NULLIF(current_setting('app.tick', true), ''));
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."version" = OLD."version" THEN
    RETURN NEW;
  END IF;
  IF v_cause IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      v_cause := 'INITIAL';
    ELSE
      RAISE EXCEPTION 'MARKET_CONTEXT_MISSING: MarketState changed without cause (call setMarketChangeContext first)'
        USING ERRCODE = 'not_null_violation';
    END IF;
  END IF;
  IF v_tick IS NULL THEN
    RAISE EXCEPTION 'MARKET_CONTEXT_MISSING: MarketState changed without tick' USING ERRCODE = 'not_null_violation';
  END IF;

  INSERT INTO "MarketStateChange" (
    "id", "cityId", "commodityId", "version",
    "oldStock", "newStock", "oldNoise", "newNoise", "oldEvent", "newEvent", "newEventTicksLeft",
    "cause", "refId", "tick", "detail", "correlationId", "createdAt"
  ) VALUES (
    gen_random_uuid()::text, NEW."cityId", NEW."commodityId", NEW."version",
    CASE WHEN TG_OP = 'UPDATE' THEN OLD."stock" END, NEW."stock",
    CASE WHEN TG_OP = 'UPDATE' THEN OLD."noise" END, NEW."noise",
    CASE WHEN TG_OP = 'UPDATE' THEN OLD."activeEvent" END, NEW."activeEvent", NEW."eventTicksLeft",
    v_cause::"MarketChangeCause",
    NULLIF(current_setting('app.market_change_ref', true), ''),
    v_tick::integer,
    NULLIF(current_setting('app.market_change_detail', true), '')::jsonb,
    NULLIF(current_setting('app.correlation_id', true), '')::uuid,
    clock_timestamp()
  );
  RETURN NEW;
END;
$$;
-- (Trigger "MarketState_journal" existiert bereits und ruft die ersetzte Funktion auf.)


-- ───────────────────────── 5. Saldo-Kette und Projektion (G-8) ─────────────────────────
-- bookMoney() bleibt unverändert (bedingtes Update, dann Journalzeile). Die DB prüft zusätzlich:
--   a) jede neue Zeile setzt die Kette fort: balanceAfter = letzter Saldo + amount,
--   b) am Transaktionsende stimmt die Projektion mit dem letzten balanceAfter überein.
-- Damit fällt ein direktes player.update({ cash }) ohne Buchung beim COMMIT auf.

CREATE FUNCTION "money_chain_check"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_prev   bigint;
  v_status "PlayerStatus";
BEGIN
  SELECT "status" INTO v_status FROM "Player" WHERE "id" = NEW."playerId";
  IF v_status = 'DELETED' AND NEW."reason" <> 'ACCOUNT_DELETION' THEN
    RAISE EXCEPTION 'MoneyTransaction: player % is deleted', NEW."playerId" USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT "balanceAfter" INTO v_prev FROM "MoneyTransaction"
   WHERE "playerId" = NEW."playerId" AND "account" = NEW."account" ORDER BY "seq" DESC LIMIT 1;
  IF NEW."balanceAfter" <> COALESCE(v_prev, 0) + NEW."amount" THEN
    RAISE EXCEPTION 'MONEY_CHAIN_BROKEN: % % balanceAfter % <> % + %', NEW."playerId", NEW."account",
      NEW."balanceAfter", COALESCE(v_prev, 0), NEW."amount" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "MoneyTransaction_chain" BEFORE INSERT ON "MoneyTransaction"
FOR EACH ROW EXECUTE FUNCTION "money_chain_check"();

CREATE FUNCTION "clan_chain_check"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_prev bigint;
BEGIN
  SELECT "balanceAfter" INTO v_prev FROM "ClanTreasuryTransaction"
   WHERE "clanId" = NEW."clanId" AND "account" = NEW."account" ORDER BY "seq" DESC LIMIT 1;
  IF NEW."balanceAfter" <> COALESCE(v_prev, 0) + NEW."amount" THEN
    RAISE EXCEPTION 'CLAN_CHAIN_BROKEN: % % balanceAfter % <> % + %', NEW."clanId", NEW."account",
      NEW."balanceAfter", COALESCE(v_prev, 0), NEW."amount" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ClanTreasuryTransaction_chain" BEFORE INSERT ON "ClanTreasuryTransaction"
FOR EACH ROW EXECUTE FUNCTION "clan_chain_check"();

-- Deferred: läuft beim COMMIT, liest den dann gültigen Stand.
CREATE FUNCTION "player_money_projection_check"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record; v_cash bigint; v_bank bigint;
BEGIN
  SELECT "cash", "bank" INTO p FROM "Player" WHERE "id" = NEW."id";
  SELECT "balanceAfter" INTO v_cash FROM "MoneyTransaction" WHERE "playerId" = NEW."id" AND "account" = 'CASH' ORDER BY "seq" DESC LIMIT 1;
  SELECT "balanceAfter" INTO v_bank FROM "MoneyTransaction" WHERE "playerId" = NEW."id" AND "account" = 'BANK' ORDER BY "seq" DESC LIMIT 1;
  IF p."cash" <> COALESCE(v_cash, 0) OR p."bank" <> COALESCE(v_bank, 0) THEN
    RAISE EXCEPTION 'MONEY_PROJECTION_MISMATCH: player % cash %/% bank %/% (projection/journal)',
      NEW."id", p."cash", COALESCE(v_cash, 0), p."bank", COALESCE(v_bank, 0) USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Player_money_projection" AFTER INSERT OR UPDATE OF "cash", "bank" ON "Player"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "player_money_projection_check"();

CREATE FUNCTION "clan_treasury_projection_check"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record; v_cash bigint; v_bank bigint;
BEGIN
  SELECT "treasuryCash", "treasuryBank" INTO c FROM "Clan" WHERE "id" = NEW."id";
  SELECT "balanceAfter" INTO v_cash FROM "ClanTreasuryTransaction" WHERE "clanId" = NEW."id" AND "account" = 'CASH' ORDER BY "seq" DESC LIMIT 1;
  SELECT "balanceAfter" INTO v_bank FROM "ClanTreasuryTransaction" WHERE "clanId" = NEW."id" AND "account" = 'BANK' ORDER BY "seq" DESC LIMIT 1;
  IF c."treasuryCash" <> COALESCE(v_cash, 0) OR c."treasuryBank" <> COALESCE(v_bank, 0) THEN
    RAISE EXCEPTION 'CLAN_PROJECTION_MISMATCH: clan % cash %/% bank %/% (projection/journal)',
      NEW."id", c."treasuryCash", COALESCE(v_cash, 0), c."treasuryBank", COALESCE(v_bank, 0) USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Clan_treasury_projection" AFTER INSERT OR UPDATE OF "treasuryCash", "treasuryBank" ON "Clan"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "clan_treasury_projection_check"();


-- ───────────────────────── 7. Wäsche- und Ereignisjournal (G-4, ADR-023) ─────────────────────────

-- Jede Wäsche: Methode (Schlüssel aus parameters.toml, z. B. Glücksspiel, Betrieb, Offshore),
-- eingesetztes Bargeld, Gutschrift aufs Bankkonto, Kurs und – bei riskanten Methoden – p und U.
-- Die zugehörigen MoneyTransaction-Zeilen (LAUNDERING) tragen dieselbe correlationId.
CREATE TABLE "LaunderingEntry" (
  "id"            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "playerId"      TEXT NOT NULL REFERENCES "Player"("id") ON DELETE RESTRICT,
  "method"        TEXT NOT NULL,
  "cashIn"        BIGINT NOT NULL CHECK ("cashIn" > 0),
  "bankCredit"    BIGINT NOT NULL CHECK ("bankCredit" >= 0),
  "rate"          DOUBLE PRECISION NOT NULL,
  "probability"   DOUBLE PRECISION,
  "roll"          DOUBLE PRECISION,
  "detected"      BOOLEAN NOT NULL DEFAULT false,
  "refId"         TEXT,
  "tick"          INTEGER NOT NULL DEFAULT ("journal_context"('app.tick'))::integer REFERENCES "WorldTick"("tick"),
  "correlationId" UUID NOT NULL DEFAULT ("journal_context"('app.correlation_id'))::uuid,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "LaunderingEntry_player_tick_idx" ON "LaunderingEntry" ("playerId", "tick");
CREATE INDEX "LaunderingEntry_correlationId_idx" ON "LaunderingEntry" ("correlationId");

-- Zufallsentscheidungen der Welt: Polizeikontrolle, Marktereignis, Razzia, Banden-Überfall …
-- probability/roll machen jede Entscheidung prüfbar (F-GLB-01: Ereignis ⇔ roll < probability).
-- Folgen (Beschlagnahme von Bargeld und Ware) stehen in Geld- und Warenjournal mit derselben correlationId.
CREATE TABLE "GameEvent" (
  "id"            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "type"          TEXT NOT NULL,
  "cityId"        TEXT REFERENCES "City"("id") ON DELETE RESTRICT,
  "commodityId"   TEXT REFERENCES "Commodity"("id") ON DELETE RESTRICT,
  "playerId"      TEXT REFERENCES "Player"("id") ON DELETE RESTRICT,
  "probability"   DOUBLE PRECISION,
  "roll"          DOUBLE PRECISION,
  "occurred"      BOOLEAN NOT NULL,
  "params"        JSONB,
  "tick"          INTEGER NOT NULL DEFAULT ("journal_context"('app.tick'))::integer REFERENCES "WorldTick"("tick"),
  "correlationId" UUID NOT NULL DEFAULT ("journal_context"('app.correlation_id'))::uuid,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameEvent_roll_consistent" CHECK ("probability" IS NULL OR "roll" IS NULL OR ("roll" < "probability") = "occurred")
);
CREATE INDEX "GameEvent_type_tick_idx" ON "GameEvent" ("type", "tick");
CREATE INDEX "GameEvent_player_tick_idx" ON "GameEvent" ("playerId", "tick");
CREATE INDEX "GameEvent_correlationId_idx" ON "GameEvent" ("correlationId");


-- ───────────────────────── 8. Clan: Historie, Wahl, Kassensperre (G-5, ADR-018) ─────────────────────────

CREATE TYPE "ClanMembershipChange" AS ENUM ('FOUNDED', 'JOINED', 'LEFT', 'KICKED', 'ROLE_CHANGED', 'DISSOLVED');
CREATE TYPE "ClanBallotKind" AS ENUM ('ELECTION', 'NO_CONFIDENCE');
CREATE TYPE "ClanBallotStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- Wahlen und Misstrauensvoten (clans.md F-CLN-08/09). Regeln und Dauer kommen aus parameters.toml;
-- festgeschrieben wird, wer kandidiert, wer wählen darf und wie das Ergebnis zustande kam.
CREATE TABLE "ClanBallot" (
  "id"         TEXT PRIMARY KEY,
  "clanId"     TEXT NOT NULL REFERENCES "Clan"("id") ON DELETE RESTRICT,
  "kind"       "ClanBallotKind" NOT NULL,
  "status"     "ClanBallotStatus" NOT NULL DEFAULT 'OPEN',
  -- Anlass, z. B. GODFATHER_DELETED, GODFATHER_LEFT, RESIGNED, NO_CONFIDENCE_PASSED, MOTION
  "trigger"    TEXT NOT NULL,
  "openedById" TEXT REFERENCES "Player"("id") ON DELETE RESTRICT,
  "opensTick"  INTEGER NOT NULL REFERENCES "WorldTick"("tick"),
  "closesTick" INTEGER NOT NULL,
  "closedTick" INTEGER,
  "winnerId"   TEXT REFERENCES "Player"("id") ON DELETE RESTRICT,
  "yesVotes"   INTEGER,
  "neededVotes" INTEGER,
  "passed"     BOOLEAN,
  -- "votes", "tiebreak:rank", "tiebreak:tenure", "tiebreak:id", "single_member", "fallback"
  "resolution" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("closesTick" > "opensTick"),
  CHECK ("status" <> 'CLOSED' OR ("closedTick" IS NOT NULL AND "resolution" IS NOT NULL))
);
-- Höchstens eine offene Wahl und ein offenes Misstrauensvotum je Clan.
CREATE UNIQUE INDEX "ClanBallot_one_open_per_kind" ON "ClanBallot" ("clanId", "kind") WHERE "status" = 'OPEN';

CREATE TABLE "ClanBallotCandidate" (
  "ballotId"    TEXT NOT NULL REFERENCES "ClanBallot"("id") ON DELETE RESTRICT,
  "playerId"    TEXT NOT NULL REFERENCES "Player"("id") ON DELETE RESTRICT,
  "rankAtOpen"  "ClanRole" NOT NULL,
  "tenureTicks" INTEGER NOT NULL,
  PRIMARY KEY ("ballotId", "playerId")
);

CREATE TABLE "ClanBallotVoter" (
  "ballotId"   TEXT NOT NULL REFERENCES "ClanBallot"("id") ON DELETE RESTRICT,
  "playerId"   TEXT NOT NULL REFERENCES "Player"("id") ON DELETE RESTRICT,
  "rankAtOpen" "ClanRole" NOT NULL,
  PRIMARY KEY ("ballotId", "playerId")
);

-- Append-only: jede Stimmabgabe eine Zeile; es zählt die letzte je Wähler (Stimme änderbar).
CREATE TABLE "ClanBallotVote" (
  "id"          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ballotId"    TEXT NOT NULL REFERENCES "ClanBallot"("id") ON DELETE RESTRICT,
  "voterId"     TEXT NOT NULL REFERENCES "Player"("id") ON DELETE RESTRICT,
  "candidateId" TEXT REFERENCES "Player"("id") ON DELETE RESTRICT,
  "approve"     BOOLEAN,
  "tick"        INTEGER NOT NULL DEFAULT ("journal_context"('app.tick'))::integer REFERENCES "WorldTick"("tick"),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (("candidateId" IS NULL) <> ("approve" IS NULL))
);
CREATE INDEX "ClanBallotVote_ballot_voter_idx" ON "ClanBallotVote" ("ballotId", "voterId", "id");

-- Append-only: Beitritt, Austritt, Rangwechsel (Grundlage für Mitgliedsdauer und Gleichstandsregel).
CREATE TABLE "ClanMembershipEvent" (
  "id"            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "clanId"        TEXT NOT NULL REFERENCES "Clan"("id") ON DELETE RESTRICT,
  "playerId"      TEXT NOT NULL REFERENCES "Player"("id") ON DELETE RESTRICT,
  "change"        "ClanMembershipChange" NOT NULL,
  "roleBefore"    "ClanRole",
  "roleAfter"     "ClanRole",
  "ballotId"      TEXT REFERENCES "ClanBallot"("id") ON DELETE RESTRICT,
  "reason"        TEXT,
  "tick"          INTEGER NOT NULL DEFAULT ("journal_context"('app.tick'))::integer REFERENCES "WorldTick"("tick"),
  "actorType"     "ActorType" NOT NULL DEFAULT ("journal_context"('app.actor_type'))::"ActorType",
  "actorPlayerId" TEXT REFERENCES "Player"("id") ON DELETE RESTRICT DEFAULT NULLIF(current_setting('app.actor_player_id', true), ''),
  "correlationId" UUID NOT NULL DEFAULT ("journal_context"('app.correlation_id'))::uuid,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ClanMembershipEvent_clan_idx" ON "ClanMembershipEvent" ("clanId", "id");
CREATE INDEX "ClanMembershipEvent_player_idx" ON "ClanMembershipEvent" ("playerId", "id");

-- Prüfbare Bedingung für Service und UI (ADR-018 Nr. 3).
CREATE FUNCTION "clan_payouts_locked"(p_clan text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM "ClanBallot" WHERE "clanId" = p_clan AND "kind" = 'ELECTION' AND "status" = 'OPEN');
$$;

-- Sperre in der DB: Abgänge, die der Clan selbst auslöst, sind während einer Wahl verboten.
-- Einzahlungen, Steuern, Schutzgeld und die Auflösung laufen weiter (clans.md „Während der Wahl“).
CREATE FUNCTION "clan_payout_lock"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."amount" < 0 AND NEW."reason" IN ('PAYOUT', 'UPGRADE', 'DISTRICT', 'WAR')
     AND "clan_payouts_locked"(NEW."clanId") THEN
    RAISE EXCEPTION 'CLAN_PAYOUT_LOCKED: clan % has an open election', NEW."clanId"
      USING ERRCODE = 'restrict_violation', HINT = 'ADR-018: payouts are locked until the election closes';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ClanTreasuryTransaction_payout_lock" BEFORE INSERT ON "ClanTreasuryTransaction"
FOR EACH ROW EXECUTE FUNCTION "clan_payout_lock"();

-- Stimme nur von festgeschriebenen Wahlberechtigten, nur solange offen, nur für Kandidaten.
CREATE FUNCTION "clan_ballot_vote_check"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b "ClanBallot"%ROWTYPE;
BEGIN
  SELECT * INTO b FROM "ClanBallot" WHERE "id" = NEW."ballotId" FOR SHARE;
  IF b."status" <> 'OPEN' THEN
    RAISE EXCEPTION 'BALLOT_CLOSED: ballot % is %', b."id", b."status" USING ERRCODE = 'restrict_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "ClanBallotVoter" WHERE "ballotId" = NEW."ballotId" AND "playerId" = NEW."voterId") THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: player % may not vote in ballot %', NEW."voterId", b."id" USING ERRCODE = 'restrict_violation';
  END IF;
  IF b."kind" = 'ELECTION' THEN
    IF NEW."candidateId" IS NULL
       OR NOT EXISTS (SELECT 1 FROM "ClanBallotCandidate" WHERE "ballotId" = NEW."ballotId" AND "playerId" = NEW."candidateId") THEN
      RAISE EXCEPTION 'INVALID_CANDIDATE: % is not a candidate of ballot %', NEW."candidateId", b."id" USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW."approve" IS NULL THEN
    RAISE EXCEPTION 'INVALID_VOTE: no-confidence votes need approve' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ClanBallotVote_check" BEFORE INSERT ON "ClanBallotVote"
FOR EACH ROW EXECUTE FUNCTION "clan_ballot_vote_check"();

-- Gültige Stimmen = letzte Stimme je Wähler.
CREATE VIEW "ClanBallotTally" AS
SELECT DISTINCT ON (v."ballotId", v."voterId")
       v."ballotId", v."voterId", v."candidateId", v."approve", v."tick", v."id" AS "voteId"
FROM "ClanBallotVote" v
ORDER BY v."ballotId", v."voterId", v."id" DESC;


-- ───────────────────────── 6. Append-only inkl. TRUNCATE-Schutz (G-3c) ─────────────────────────
-- Steht hinter 7./8., weil es auch die neuen Journale abdeckt. journal_append_only() existiert
-- bereits (v2-Migration). TRUNCATE nur mit ausdrücklicher Freigabe der Sitzung
-- (test/helpers.ts truncateAll(): vorher SELECT set_config('app.allow_truncate', 'on', false)).

CREATE FUNCTION "journal_no_truncate"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.allow_truncate', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION '% is append-only (TRUNCATE needs app.allow_truncate)', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NULL;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['LaunderingEntry', 'GameEvent', 'ClanBallotVote', 'ClanMembershipEvent', 'ParameterSet'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION "journal_append_only"()',
                   t || '_append_only', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['MoneyTransaction', 'InventoryMovement', 'TradeTransaction', 'ClanTreasuryTransaction',
                           'MarketStateChange', 'LaunderingEntry', 'GameEvent', 'ClanBallotVote',
                           'ClanMembershipEvent', 'ParameterSet'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION "journal_no_truncate"()',
                   t || '_no_truncate', t);
  END LOOP;
END $$;


-- ───────────────────────── 9. Kontolöschung als Constraint (G-10a) ─────────────────────────
-- Heute nur durch deleteAccount() garantiert; die DB soll es ebenfalls festhalten.
ALTER TABLE "Player" ADD CONSTRAINT "Player_user_iff_not_deleted" CHECK (("userId" IS NULL) = ("status" = 'DELETED'));
ALTER TABLE "Player" ADD CONSTRAINT "Player_deletedAt_iff_deleted" CHECK (("deletedAt" IS NOT NULL) = ("status" = 'DELETED'));
