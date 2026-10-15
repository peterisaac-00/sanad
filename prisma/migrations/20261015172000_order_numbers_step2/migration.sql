-- Preserve existing rows: derive order_number from legacy SND-N ids.
-- On fresh databases these UPDATEs match zero rows and are harmless.
UPDATE "orders" SET "order_number" = CAST(SUBSTRING("id" FROM 5) AS INTEGER)
WHERE "id" ~ '^SND-[0-9]+$' AND "order_number" IS NULL;

-- Fallback for any non-legacy ids: high per-store sequence space.
UPDATE "orders" o SET "order_number" = sub.rn FROM
  (SELECT "id", 9000000 + ROW_NUMBER() OVER (PARTITION BY "store_id" ORDER BY "created_at") AS rn
   FROM "orders" WHERE "order_number" IS NULL) sub
WHERE o."id" = sub."id";

-- Continue each store's sequence after its highest preserved number.
UPDATE "stores" s SET "next_order_number" = sub.mx + 1 FROM
  (SELECT "store_id", MAX("order_number") AS mx FROM "orders" GROUP BY "store_id") sub
WHERE s."id" = sub."store_id";

-- Make the column required and enforce per-store uniqueness.
ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_order_number_key" UNIQUE ("store_id", "order_number");
