-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "customer_phone" TEXT NOT NULL DEFAULT '';
