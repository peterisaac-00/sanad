-- The bootstrapped first administrator must replace the shared setup
-- credentials before the rest of the admin API becomes available.
ALTER TABLE "platform_admins"
  ADD COLUMN "must_change_credentials" BOOLEAN NOT NULL DEFAULT false;
