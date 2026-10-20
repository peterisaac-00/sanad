-- Align new and unconfigured stores with the central Sanad light-first brand.
-- Only rows that still carry the complete legacy default palette are migrated;
-- any merchant that customised even one branding value is left untouched.

ALTER TABLE "store_branding"
  ALTER COLUMN "primary_color" SET DEFAULT '#047857',
  ALTER COLUMN "secondary_color" SET DEFAULT '#0F2A24',
  ALTER COLUMN "text_color" SET DEFAULT '#0F172A',
  ALTER COLUMN "theme_mode" SET DEFAULT 'light',
  ALTER COLUMN "arabic_font" SET DEFAULT 'IBM Plex Sans Arabic';

UPDATE "store_branding"
SET
  "primary_color" = '#047857',
  "secondary_color" = '#0F2A24',
  "text_color" = '#0F172A',
  "theme_mode" = 'light',
  "arabic_font" = 'IBM Plex Sans Arabic'
WHERE
  "primary_color" = '#2563EB'
  AND "secondary_color" = '#0F172A'
  AND "text_color" = '#F8FAFC'
  AND "theme_mode" = 'dark'
  AND "arabic_font" = 'Cairo';
