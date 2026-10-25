-- Phase 6: deterministic customer-address identity.
-- The column is introduced nullable so legacy rows can be backfilled before constraints.
ALTER TABLE "customer_addresses" ADD COLUMN "address_key" TEXT;

UPDATE "customer_addresses"
SET "address_key" = md5(
  regexp_replace(lower(trim(coalesce("address", ''))), '[[:space:]]+', ' ', 'g') || '|' ||
  regexp_replace(lower(trim(coalesce("city", ''))), '[[:space:]]+', ' ', 'g') || '|' ||
  regexp_replace(lower(trim(coalesce("governorate", ''))), '[[:space:]]+', ' ', 'g') || '|' ||
  regexp_replace(regexp_replace(coalesce("phone", ''), '[^0-9]', '', 'g'), '^00', '')
)
WHERE "address_key" IS NULL;

-- Keep the oldest default row when legacy data contains duplicates. If no row was
-- default, the oldest row is kept and made default below.
WITH ranked AS (
  SELECT ctid,
         row_number() OVER (
           PARTITION BY "store_id", "customer_id", "address_key"
           ORDER BY "is_default" DESC, "id" ASC
         ) AS rn
  FROM "customer_addresses"
)
DELETE FROM "customer_addresses" a
USING ranked r
WHERE a.ctid = r.ctid AND r.rn > 1;

WITH ranked AS (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "store_id", "customer_id"
           ORDER BY "is_default" DESC, "id" ASC
         ) AS rn
  FROM "customer_addresses"
)
UPDATE "customer_addresses" a
SET "is_default" = (r.rn = 1),
    "label" = CASE WHEN r.rn = 1 AND a."label" = '' THEN 'العنوان الأساسي' ELSE a."label" END
FROM ranked r
WHERE a."id" = r."id";

ALTER TABLE "customer_addresses" ALTER COLUMN "address_key" SET NOT NULL;
CREATE UNIQUE INDEX "customer_addresses_store_customer_address_key_key"
  ON "customer_addresses" ("store_id", "customer_id", "address_key");
CREATE UNIQUE INDEX "customer_addresses_one_default_idx"
  ON "customer_addresses" ("store_id", "customer_id")
  WHERE "is_default" = true;
