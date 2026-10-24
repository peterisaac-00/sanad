-- Phase 4: platform admin, activation, subscription billing, and visits.

-- Stores now start pending until a platform admin activates them. Existing
-- stores keep working and receive their original creation time as the
-- activation date so the admin overview is immediately useful.
ALTER TABLE "stores" ADD COLUMN "activated_at" TIMESTAMP(3);
ALTER TABLE "stores" ADD COLUMN "subscription_paid_until" TIMESTAMP(3);
UPDATE "stores" SET "activated_at" = "created_at" WHERE "status" = 'active';
ALTER TABLE "stores" ALTER COLUMN "status" SET DEFAULT 'pending';

CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "reference" TEXT NOT NULL DEFAULT '',
    "payer_name" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "review_note" TEXT NOT NULL DEFAULT '',
    "submitted_by_id" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "store_visits" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '/',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "store_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscription_payments_store_id_created_at_idx"
    ON "subscription_payments"("store_id", "created_at");
CREATE INDEX "subscription_payments_status_created_at_idx"
    ON "subscription_payments"("status", "created_at");
CREATE INDEX "store_visits_store_id_created_at_idx"
    ON "store_visits"("store_id", "created_at");
CREATE INDEX "store_visits_created_at_idx"
    ON "store_visits"("created_at");

ALTER TABLE "subscription_payments"
    ADD CONSTRAINT "subscription_payments_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_visits"
    ADD CONSTRAINT "store_visits_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
