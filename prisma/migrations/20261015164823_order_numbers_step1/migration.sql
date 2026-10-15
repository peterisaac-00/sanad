-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "order_number" INTEGER;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "next_order_number" INTEGER NOT NULL DEFAULT 4824;
