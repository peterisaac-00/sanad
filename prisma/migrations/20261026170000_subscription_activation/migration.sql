-- Backfill an initial paid-through date for stores that were already active before subscription enforcement.
UPDATE "stores"
SET "subscription_paid_until" = CASE
  WHEN "plan" = 'monthly' THEN "activated_at" + INTERVAL '30 days'
  ELSE "activated_at" + INTERVAL '365 days'
END
WHERE "status" = 'active'
  AND "subscription_paid_until" IS NULL
  AND "activated_at" IS NOT NULL;
