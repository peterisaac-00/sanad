-- The platform is Egypt-only: normalize legacy stores and wallet accounts.
UPDATE "stores" SET "country_code" = 'EG', "currency" = 'EGP' WHERE "country_code" <> 'EG' OR "currency" <> 'EGP';
UPDATE "wallet_accounts" SET "currency" = 'EGP' WHERE "currency" <> 'EGP';
