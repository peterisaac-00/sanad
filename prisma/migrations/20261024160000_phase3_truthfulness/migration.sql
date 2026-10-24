-- Phase 3: feature truthfulness data changes.

-- Manual orders are external records, not inventory-linked storefront orders.
ALTER TABLE "orders" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'storefront';

-- Affiliate commissions can be settled manually after delivery.
ALTER TABLE "affiliate_attributions" ADD COLUMN "settled_at" TIMESTAMP(3);

-- No payment adapter is installed, so any legacy "online payment enabled"
-- flag is unsupported. Checkout already ignored it; clear the stored value so
-- settings/onboarding never display a misleading enabled toggle.
UPDATE "stores" SET "online_payment_enabled" = false WHERE "online_payment_enabled" = true;
