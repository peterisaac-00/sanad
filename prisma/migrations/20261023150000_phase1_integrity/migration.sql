-- Phase 1: checkout idempotency and auditable loyalty ledger entries.

-- A retried checkout with the same Idempotency-Key must return the original
-- order instead of creating a second one. PostgreSQL permits multiple NULLs
-- in a unique index, so existing orders remain valid.
ALTER TABLE "orders" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "orders_store_id_idempotency_key_key" ON "orders"("store_id", "idempotency_key");

-- Loyalty earn/revoke rows are linked to the order that produced them so the
-- ledger is idempotent and returns can reverse the exact grant.
ALTER TABLE "loyalty_transactions" ADD COLUMN "order_id" TEXT;
CREATE UNIQUE INDEX "loyalty_transactions_account_id_order_id_type_key"
  ON "loyalty_transactions"("account_id", "order_id", "type");
CREATE INDEX "loyalty_transactions_store_id_order_id_idx"
  ON "loyalty_transactions"("store_id", "order_id");
ALTER TABLE "loyalty_transactions"
  ADD CONSTRAINT "loyalty_transactions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
