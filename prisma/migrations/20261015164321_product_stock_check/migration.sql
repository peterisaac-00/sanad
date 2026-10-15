-- Defense-in-depth: stock can never go negative, even for direct writes.
-- The application enforces this with a guarded conditional decrement;
-- this constraint makes the invariant hold at the database level too.
ALTER TABLE "products" ADD CONSTRAINT "products_stock_nonnegative" CHECK ("stock" >= 0);
