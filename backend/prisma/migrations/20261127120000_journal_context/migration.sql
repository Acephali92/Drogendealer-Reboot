-- Journalkontext (TD-022): Tick, Korrelation, Akteur und Reihenfolge an allen Journalen,
-- Marktjournal fail-closed mit Version und Formel-Details, TRUNCATE-Schutz, Löschstatus als CHECK.
-- Grundlage: docs/database/REVIEW-v2.md G-1, G-2, G-3, G-3b, G-3c, G-6, G-10a und
-- docs/database/proposals/p1.sql §1, §3, §4, §6, §9. Erzeugt mit `prisma migrate diff`, von Hand ergänzt.
-- Vorhandene Zeilen (vor dem Release nur Testdaten) bekommen Tick 0, Akteur SYSTEM und je Zeile
-- eine eigene correlationId. WorldTick und der FK darauf folgen mit T-104.

-- ───────────────────────── 1. Journalkontext ─────────────────────────

-- Einmal je schreibender Transaktion aufrufen (transaktionslokal, verschwindet mit COMMIT/ROLLBACK).
CREATE FUNCTION "set_journal_context"(p_tick integer, p_correlation uuid, p_actor_type text, p_actor_player text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config('app.tick', p_tick::text, true),
         set_config('app.correlation_id', p_correlation::text, true),
         set_config('app.actor_type', p_actor_type, true),
         set_config('app.actor_player_id', COALESCE(p_actor_player, ''), true);
$$;

-- Liest eine Kontext-Einstellung; fehlt sie, bricht die Anweisung ab (fail-closed).
CREATE FUNCTION "journal_context"(p_name text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE v text := NULLIF(current_setting(p_name, true), '');
BEGIN
  IF v IS NULL THEN
    -- Default SQLSTATE P0001: Prisma passes the message through (not_null_violation would become a
    -- bare P2011 without text).
    RAISE EXCEPTION 'JOURNAL_CONTEXT_MISSING: % is not set (call set_journal_context first)', p_name;
  END IF;
  RETURN v;
END;
$$;

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('PLAYER', 'NPC', 'SYSTEM', 'ADMIN');

-- ───────────────────────── 2. Journalkopf an den Buchungsjournalen ─────────────────────────
-- Drei Schritte, weil ein Default mit journal_context() beim ADD COLUMN sofort ausgewertet würde:
-- Spalten anlegen → Altzeilen nachtragen (Trigger kurz aus) → Default und NOT NULL setzen.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['MoneyTransaction', 'InventoryMovement', 'TradeTransaction', 'ClanTreasuryTransaction'] LOOP
    EXECUTE format($f$
      ALTER TABLE %1$I
        ADD COLUMN "seq" BIGSERIAL NOT NULL,
        ADD COLUMN "tick" INTEGER,
        ADD COLUMN "correlationId" UUID,
        ADD COLUMN "actorType" "ActorType",
        ADD COLUMN "actorPlayerId" TEXT
    $f$, t);
    EXECUTE format('ALTER TABLE %I DISABLE TRIGGER %I', t, t || '_append_only');
    EXECUTE format($f$UPDATE %1$I SET "tick" = 0, "correlationId" = gen_random_uuid(), "actorType" = 'SYSTEM'$f$, t);
    EXECUTE format('ALTER TABLE %I ENABLE TRIGGER %I', t, t || '_append_only');
    EXECUTE format($f$
      ALTER TABLE %1$I
        ALTER COLUMN "tick" SET DEFAULT (journal_context('app.tick'::text))::integer,
        ALTER COLUMN "tick" SET NOT NULL,
        ALTER COLUMN "correlationId" SET DEFAULT (journal_context('app.correlation_id'::text))::uuid,
        ALTER COLUMN "correlationId" SET NOT NULL,
        ALTER COLUMN "actorType" SET DEFAULT (journal_context('app.actor_type'::text))::"ActorType",
        ALTER COLUMN "actorType" SET NOT NULL,
        ADD CONSTRAINT %2$I CHECK ("tick" >= 0),
        ADD CONSTRAINT %3$I CHECK (("actorType" = 'PLAYER') = ("actorPlayerId" IS NOT NULL))
    $f$, t, t || '_tick_check', t || '_actor_check');
  END LOOP;
END $$;

-- Akteur-Spieler aus dem Journalkontext. Als Trigger statt Default, weil Prisma einen
-- dbgenerated-Default auf einer nullable Spalte nicht stabil introspektiert (Drift).
CREATE FUNCTION "journal_actor_player"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."actorPlayerId" IS NULL THEN
    NEW."actorPlayerId" := NULLIF(current_setting('app.actor_player_id', true), '');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['MoneyTransaction', 'InventoryMovement', 'TradeTransaction', 'ClanTreasuryTransaction'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION "journal_actor_player"()',
                   t || '_actor_player', t);
  END LOOP;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "ClanTreasuryTransaction_seq_key" ON "ClanTreasuryTransaction"("seq");
CREATE INDEX "ClanTreasuryTransaction_correlationId_idx" ON "ClanTreasuryTransaction"("correlationId");
CREATE INDEX "ClanTreasuryTransaction_tick_idx" ON "ClanTreasuryTransaction"("tick");
CREATE UNIQUE INDEX "InventoryMovement_seq_key" ON "InventoryMovement"("seq");
CREATE INDEX "InventoryMovement_correlationId_idx" ON "InventoryMovement"("correlationId");
CREATE INDEX "InventoryMovement_tick_idx" ON "InventoryMovement"("tick");
CREATE UNIQUE INDEX "MoneyTransaction_seq_key" ON "MoneyTransaction"("seq");
CREATE INDEX "MoneyTransaction_correlationId_idx" ON "MoneyTransaction"("correlationId");
CREATE INDEX "MoneyTransaction_tick_idx" ON "MoneyTransaction"("tick");
CREATE UNIQUE INDEX "TradeTransaction_seq_key" ON "TradeTransaction"("seq");
CREATE INDEX "TradeTransaction_correlationId_idx" ON "TradeTransaction"("correlationId");
CREATE INDEX "TradeTransaction_tick_idx" ON "TradeTransaction"("tick");

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_actorPlayerId_fkey" FOREIGN KEY ("actorPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorPlayerId_fkey" FOREIGN KEY ("actorPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TradeTransaction" ADD CONSTRAINT "TradeTransaction_actorPlayerId_fkey" FOREIGN KEY ("actorPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClanTreasuryTransaction" ADD CONSTRAINT "ClanTreasuryTransaction_actorPlayerId_fkey" FOREIGN KEY ("actorPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────────────────── 3. Marktjournal: Version, Detail, fail-closed ─────────────────────────

ALTER TABLE "MarketState" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MarketStateChange"
  ADD COLUMN "seq" BIGSERIAL NOT NULL,
  ADD COLUMN "version" INTEGER,
  ADD COLUMN "newEventTicksLeft" INTEGER,
  ADD COLUMN "detail" JSONB,
  ADD COLUMN "correlationId" UUID;

-- Altzeilen: Version in bisheriger Reihenfolge, fehlender Tick = 0, UNSPECIFIED → ADMIN (Ursache unbekannt).
-- seq wurde eben in Einfügereihenfolge vergeben (append-only, Heap-Reihenfolge); er entscheidet bei
-- gleichem createdAt (Millisekunden), sonst wäre die Reihenfolge zufällig (G-3b).
ALTER TABLE "MarketStateChange" DISABLE TRIGGER "MarketStateChange_append_only";
UPDATE "MarketStateChange" m SET
  "version" = r.rn,
  "newEventTicksLeft" = 0,
  "tick" = COALESCE(m."tick", 0),
  "correlationId" = gen_random_uuid(),
  "cause" = CASE WHEN m."cause" = 'UNSPECIFIED' THEN 'ADMIN'::"MarketChangeCause" ELSE m."cause" END
FROM (SELECT "id", row_number() OVER (PARTITION BY "cityId", "commodityId" ORDER BY "createdAt", "seq") AS rn
      FROM "MarketStateChange") r
WHERE r."id" = m."id";
ALTER TABLE "MarketStateChange" ENABLE TRIGGER "MarketStateChange_append_only";

UPDATE "MarketState" s SET "version" = COALESCE((SELECT max(m."version") FROM "MarketStateChange" m
  WHERE m."cityId" = s."cityId" AND m."commodityId" = s."commodityId"), 0);

ALTER TABLE "MarketStateChange"
  ALTER COLUMN "version" SET NOT NULL,
  ALTER COLUMN "newEventTicksLeft" SET NOT NULL,
  ALTER COLUMN "correlationId" SET NOT NULL,
  ALTER COLUMN "tick" SET NOT NULL,
  ADD CONSTRAINT "MarketStateChange_tick_check" CHECK ("tick" >= 0),
  ADD CONSTRAINT "MarketStateChange_no_unspecified" CHECK ("cause" <> 'UNSPECIFIED'),
  ADD CONSTRAINT "MarketStateChange_trade_ref" CHECK ("cause" <> 'TRADE' OR "refId" IS NOT NULL),
  -- Pflichtschlüssel der Formel-Zwischenwerte je Ursache (REVIEW-v2 §5, Namen wie in verify.py).
  -- COALESCE: ein fehlendes detail (NULL) muss ablehnen, ein CHECK ließe NULL sonst durch.
  ADD CONSTRAINT "MarketStateChange_detail_keys" CHECK (
    CASE "cause"
      WHEN 'TICK'  THEN COALESCE("detail" ?& ARRAY['S_before', 'S_target', 'x_before', 'z', 'x_after'], false)
      WHEN 'EVENT' THEN COALESCE("detail" ?& ARRAY['event', 'u', 'shock', 'duration'], false)
      WHEN 'NPC'   THEN COALESCE("detail" ?& ARRAY['from', 'to', 'q', 'margin', 'theta', 'f', 'k'], false)
      WHEN 'TRADE' THEN COALESCE("detail" ?& ARRAY['q', 'l_handel', 'spread'], false)
      ELSE TRUE
    END
  ) NOT VALID;
-- Altzeilen vor dieser Migration kennen kein detail; die Prüfung gilt für alle neuen Zeilen.

-- CreateIndex
CREATE UNIQUE INDEX "MarketStateChange_seq_key" ON "MarketStateChange"("seq");
CREATE INDEX "MarketStateChange_correlationId_idx" ON "MarketStateChange"("correlationId");
CREATE INDEX "MarketStateChange_refId_idx" ON "MarketStateChange"("refId");
CREATE UNIQUE INDEX "MarketStateChange_cityId_commodityId_version_key" ON "MarketStateChange"("cityId", "commodityId", "version");

-- Version je Markt: zählt nur bei echten Änderungen hoch (der reine Countdown von eventTicksLeft nicht).
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

-- Ersetzt die Fassung aus data_model_v2: fail-closed statt UNSPECIFIED, Tick und correlationId aus dem
-- Journalkontext, Version, Restdauer und Detail. Der Trigger "MarketState_journal" bleibt bestehen.
CREATE OR REPLACE FUNCTION "market_state_journal"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_cause text := NULLIF(current_setting('app.market_change_cause', true), '');
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."version" = OLD."version" THEN
    RETURN NEW;
  END IF;
  IF v_cause IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      v_cause := 'INITIAL';
    ELSE
      RAISE EXCEPTION 'MARKET_CONTEXT_MISSING: MarketState changed without cause (call setMarketChangeContext first)';
    END IF;
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
    journal_context('app.tick')::integer,
    NULLIF(current_setting('app.market_change_detail', true), '')::jsonb,
    journal_context('app.correlation_id')::uuid,
    clock_timestamp()
  );
  RETURN NEW;
END;
$$;

-- ───────────────────────── 4. TRUNCATE-Schutz (G-3c) ─────────────────────────
-- Der Append-only-Trigger greift nicht bei TRUNCATE. Erlaubt nur mit app.allow_truncate = 'on'
-- (die Test-Hilfe truncateAll() setzt das transaktionslokal).

CREATE FUNCTION "journal_no_truncate"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(current_setting('app.allow_truncate', true), '') <> 'on' THEN
    RAISE EXCEPTION '% is append-only (TRUNCATE needs app.allow_truncate)', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NULL;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['MoneyTransaction', 'InventoryMovement', 'TradeTransaction',
                           'ClanTreasuryTransaction', 'MarketStateChange'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION "journal_no_truncate"()',
                   t || '_no_truncate', t);
  END LOOP;
END $$;

-- ───────────────────────── 5. Kontolöschung als Constraint (G-10a) ─────────────────────────

ALTER TABLE "Player"
  ADD CONSTRAINT "Player_user_iff_not_deleted" CHECK (("userId" IS NULL) = ("status" = 'DELETED')),
  ADD CONSTRAINT "Player_deletedAt_iff_deleted" CHECK (("deletedAt" IS NOT NULL) = ("status" = 'DELETED'));
