-- Phase 4: separate platform administration, real team identities/RBAC,
-- custom-domain routing state, and a single publishing lifecycle.

-- ---------- publishing lifecycle ----------
ALTER TABLE "stores" ADD COLUMN "publish_status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "stores" ADD COLUMN "publish_reason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "stores" ADD COLUMN "status_reason" TEXT NOT NULL DEFAULT '';

UPDATE "stores"
SET
  "publish_status" = CASE
    WHEN "onboarding_completed" = TRUE AND "status" = 'active' THEN 'published'
    WHEN "onboarding_completed" = TRUE THEN 'ready'
    ELSE 'draft'
  END,
  "publish_reason" = CASE
    WHEN "onboarding_completed" = TRUE AND "status" = 'active' THEN ''
    WHEN "onboarding_completed" = TRUE AND "status" = 'pending' THEN 'بانتظار موافقة إدارة سند قبل فتح المتجر للعملاء.'
    WHEN "onboarding_completed" = TRUE AND "status" = 'suspended' THEN 'المتجر موقوف من إدارة سند.'
    WHEN "onboarding_completed" = TRUE THEN 'يلزم اعتماد المتجر قبل النشر.'
    ELSE 'لم يكتمل إعداد المتجر بعد.'
  END,
  "status_reason" = CASE
    WHEN "status" = 'rejected' THEN 'طلب فتح المتجر يحتاج تعديلاً من المالك.'
    WHEN "status" = 'suspended' THEN 'تم إيقاف المتجر من إدارة سند.'
    ELSE ''
  END;

-- ---------- custom domains ----------
ALTER TABLE "store_domains" ADD COLUMN "tls_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "store_domains" ADD COLUMN "tls_mode" TEXT NOT NULL DEFAULT 'external_proxy';
ALTER TABLE "store_domains" ADD COLUMN "tls_provisioned_at" TIMESTAMP(3);
ALTER TABLE "store_domains" ADD COLUMN "tls_error" TEXT NOT NULL DEFAULT '';
ALTER TABLE "store_domains" ADD COLUMN "last_checked_at" TIMESTAMP(3);
CREATE INDEX "store_domains_domain_status_idx" ON "store_domains"("domain", "status");

-- ---------- team members become real identities ----------
ALTER TABLE "team_members" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "team_members" ADD COLUMN "password_salt" TEXT;
ALTER TABLE "team_members" ADD COLUMN "password_algo" TEXT NOT NULL DEFAULT 'argon2id';
ALTER TABLE "team_members" ADD COLUMN "invite_token_hash" TEXT;
ALTER TABLE "team_members" ADD COLUMN "invite_expires_at" TIMESTAMP(3);
ALTER TABLE "team_members" ADD COLUMN "accepted_at" TIMESTAMP(3);
ALTER TABLE "team_members" ADD COLUMN "last_login_at" TIMESTAMP(3);
ALTER TABLE "team_members" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "team_members" DROP CONSTRAINT IF EXISTS "team_members_store_id_email_key";
CREATE INDEX "team_members_email_status_idx" ON "team_members"("email", "status");
CREATE UNIQUE INDEX "team_members_email_key" ON "team_members"("email");
CREATE UNIQUE INDEX "team_members_invite_token_hash_key" ON "team_members"("invite_token_hash");

-- ---------- sessions may belong to a team member ----------
ALTER TABLE "sessions" ALTER COLUMN "merchant_id" DROP NOT NULL;
ALTER TABLE "sessions" ADD COLUMN "team_member_id" TEXT;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_team_member_id_fkey"
  FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "sessions_team_member_id_idx" ON "sessions"("team_member_id");

-- ---------- separate platform admin identity and sessions ----------
CREATE TABLE "platform_admins" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "password_hash" TEXT NOT NULL,
  "password_salt" TEXT,
  "password_algo" TEXT NOT NULL DEFAULT 'argon2id',
  "role" TEXT NOT NULL DEFAULT 'readonly',
  "status" TEXT NOT NULL DEFAULT 'active',
  "two_factor_secret" TEXT,
  "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  "two_factor_recovery_codes" JSONB NOT NULL DEFAULT '[]',
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");
CREATE INDEX "platform_admins_status_idx" ON "platform_admins"("status");

CREATE TABLE "admin_sessions" (
  "token" TEXT NOT NULL,
  "admin_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" TEXT NOT NULL DEFAULT '',
  "user_agent" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("token")
);
CREATE INDEX "admin_sessions_admin_id_idx" ON "admin_sessions"("admin_id");
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey"
  FOREIGN KEY ("admin_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- audit attribution ----------
ALTER TABLE "audit_logs" ADD COLUMN "team_member_id" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "platform_admin_id" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "actor_type" TEXT NOT NULL DEFAULT 'merchant';
CREATE INDEX "audit_logs_team_member_id_idx" ON "audit_logs"("team_member_id");
CREATE INDEX "audit_logs_platform_admin_id_idx" ON "audit_logs"("platform_admin_id");

-- ---------- wallet deposits have a review trail ----------
ALTER TABLE "wallet_transactions" ADD COLUMN "review_note" TEXT NOT NULL DEFAULT '';
ALTER TABLE "wallet_transactions" ADD COLUMN "reviewed_by_admin_id" TEXT;
ALTER TABLE "wallet_transactions" ADD COLUMN "reviewed_at" TIMESTAMP(3);
CREATE INDEX "wallet_transactions_status_created_at_idx" ON "wallet_transactions"("status", "created_at");

-- ---------- support desk + feature flags ----------
CREATE TABLE "support_tickets" (
  "id" TEXT NOT NULL,
  "store_id" TEXT,
  "merchant_id" TEXT,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'other',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "status" TEXT NOT NULL DEFAULT 'open',
  "assigned_admin_id" TEXT,
  "resolution" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_tickets_store_id_idx" ON "support_tickets"("store_id");
CREATE INDEX "support_tickets_status_created_at_idx" ON "support_tickets"("status", "created_at");
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "feature_flags" (
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updated_by_admin_id" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

INSERT INTO "feature_flags" ("key", "label", "description", "enabled") VALUES
  ('online_payments', 'المدفوعات الإلكترونية', 'تفعيل اختيار الدفع الإلكتروني في المتجر عند توفر مزود دفع.', false),
  ('wallet_deposits', 'إيداعات المحفظة', 'السماح للتجار بإرسال طلبات إيداع للمراجعة الإدارية.', true),
  ('custom_domains', 'النطاقات المخصصة', 'السماح للتجار بربط نطاق موثّق بالمتجر.', true),
  ('support_center', 'مركز الدعم', 'تمكين تذاكر الدعم من لوحة التاجر ولوحة الإدارة.', true)
ON CONFLICT ("key") DO NOTHING;
