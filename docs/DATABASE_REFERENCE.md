# Sanad - Database Reference

Generated from `prisma/schema.prisma`, which is the single source of truth for the schema.

## 1. Inventory

| Item | Value |
|---|---|
| Engine | PostgreSQL 16 |
| ORM / client | Prisma 7.10 + `@prisma/adapter-pg` (`pg` driver) |
| Prisma models / physical tables | 51 |
| Physical columns | 581 |
| Relation fields in the schema (virtual, not columns) | 152 |
| Foreign keys | 76 |
| Secondary indexes | 86 |
| Composite unique constraints | 14 |
| Single-column unique constraints (excluding primary keys) | 13 |
| Migration folders | 17 |

All money columns are `DOUBLE PRECISION` (`Float` in Prisma), not `DECIMAL`. See section 7.

## 2. Tables and columns

### `stores` - 38 columns

Prisma model: `Store` | foreign keys: 0 | composite unique: 0 | indexes: 0

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_name` | `storeName` | TEXT NOT NULL | - |
| `subdomain` | `subdomain` | TEXT NOT NULL | UNIQUE |
| `custom_domain` | `customDomain` | TEXT NULL | UNIQUE |
| `phone` | `phone` | TEXT NOT NULL | DEFAULT "" |
| `country_code` | `countryCode` | TEXT NOT NULL | DEFAULT "EG" |
| `currency` | `currency` | TEXT NOT NULL | DEFAULT "EGP" |
| `plan` | `plan` | TEXT NOT NULL | DEFAULT "annual" |
| `status` | `status` | TEXT NOT NULL | DEFAULT "pending" |
| `publish_status` | `publishStatus` | TEXT NOT NULL | DEFAULT "draft" |
| `publish_reason` | `publishReason` | TEXT NOT NULL | DEFAULT "" |
| `status_reason` | `statusReason` | TEXT NOT NULL | DEFAULT "" |
| `activated_at` | `activatedAt` | TIMESTAMP(3) NULL | - |
| `subscription_paid_until` | `subscriptionPaidUntil` | TIMESTAMP(3) NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |
| `next_order_number` | `nextOrderNumber` | INTEGER NOT NULL | DEFAULT 4824 |
| `onboarding_step` | `onboardingStep` | INTEGER NOT NULL | DEFAULT 1 |
| `onboarding_completed` | `onboardingCompleted` | BOOLEAN NOT NULL | DEFAULT false |
| `business_type` | `businessType` | TEXT NOT NULL | DEFAULT "other" |
| `description` | `description` | TEXT NOT NULL | DEFAULT "" |
| `country` | `country` | TEXT NOT NULL | DEFAULT "EG" |
| `governorate` | `governorate` | TEXT NOT NULL | DEFAULT "" |
| `primary_language` | `primaryLanguage` | TEXT NOT NULL | DEFAULT "ar" |
| `time_zone` | `timeZone` | TEXT NOT NULL | DEFAULT "Africa/Cairo" |
| `logo_url` | `logoUrl` | TEXT NOT NULL | DEFAULT "" |
| `cover_url` | `coverUrl` | TEXT NOT NULL | DEFAULT "" |
| `whatsapp` | `whatsapp` | TEXT NOT NULL | DEFAULT "" |
| `return_policy` | `returnPolicy` | TEXT NOT NULL | DEFAULT "" |
| `cod_enabled` | `codEnabled` | BOOLEAN NOT NULL | DEFAULT true |
| `online_payment_enabled` | `onlinePaymentEnabled` | BOOLEAN NOT NULL | DEFAULT false |
| `template_key` | `templateKey` | TEXT NOT NULL | DEFAULT "general" |
| `published_at` | `publishedAt` | TIMESTAMP(3) NULL | - |
| `seo_title` | `seoTitle` | TEXT NOT NULL | DEFAULT "" |
| `seo_description` | `seoDescription` | TEXT NOT NULL | DEFAULT "" |
| `support_email` | `supportEmail` | TEXT NOT NULL | DEFAULT "" |
| `notification_prefs` | `notificationPrefs` | JSONB NOT NULL | DEFAULT "{}" |
| `onboarding_draft` | `onboardingDraft` | JSONB NOT NULL | DEFAULT "{}" |

### `store_branding` - 15 columns

Prisma model: `StoreBranding` | foreign keys: 1 | composite unique: 0 | indexes: 0

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | UNIQUE |
| `primary_color` | `primaryColor` | TEXT NOT NULL | DEFAULT "#047857" |
| `secondary_color` | `secondaryColor` | TEXT NOT NULL | DEFAULT "#0F2A24" |
| `text_color` | `textColor` | TEXT NOT NULL | DEFAULT "#0F172A" |
| `theme_mode` | `themeMode` | TEXT NOT NULL | DEFAULT "light" |
| `arabic_font` | `arabicFont` | TEXT NOT NULL | DEFAULT "IBM Plex Sans Arabic" |
| `template_key` | `templateKey` | TEXT NOT NULL | DEFAULT "general" |
| `header_config` | `headerConfig` | JSONB NOT NULL | DEFAULT "{}" |
| `footer_config` | `footerConfig` | JSONB NOT NULL | DEFAULT "{}" |
| `hero_config` | `heroConfig` | JSONB NOT NULL | DEFAULT "{}" |
| `homepage_sections` | `homepageSections` | JSONB NOT NULL | DEFAULT "[]" |
| `draft_config` | `draftConfig` | JSONB NOT NULL | DEFAULT "{}" |
| `published_at` | `publishedAt` | TIMESTAMP(3) NULL | - |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

### `store_themes` - 6 columns

Prisma model: `StoreTheme` | foreign keys: 1 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `name` | `name` | TEXT NOT NULL | - |
| `config` | `config` | JSONB NOT NULL | DEFAULT "{}" |
| `is_active` | `isActive` | BOOLEAN NOT NULL | DEFAULT false |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([storeId])`

### `store_domains` - 12 columns

Prisma model: `StoreDomain` | foreign keys: 1 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `domain` | `domain` | TEXT NOT NULL | UNIQUE |
| `status` | `status` | TEXT NOT NULL | DEFAULT "pending" |
| `verification_token` | `verificationToken` | TEXT NOT NULL | - |
| `tls_status` | `tlsStatus` | TEXT NOT NULL | DEFAULT "pending" |
| `tls_mode` | `tlsMode` | TEXT NOT NULL | DEFAULT "external_proxy" |
| `tls_provisioned_at` | `tlsProvisionedAt` | TIMESTAMP(3) NULL | - |
| `tls_error` | `tlsError` | TEXT NOT NULL | DEFAULT "" |
| `last_checked_at` | `lastCheckedAt` | TIMESTAMP(3) NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `verified_at` | `verifiedAt` | TIMESTAMP(3) NULL | - |

Indexes: `([storeId])`, `([domain, status])`

### `subscription_payments` - 16 columns

Prisma model: `SubscriptionPayment` | foreign keys: 1 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `plan` | `plan` | TEXT NOT NULL | - |
| `amount` | `amount` | DOUBLE PRECISION NOT NULL | - |
| `currency` | `currency` | TEXT NOT NULL | DEFAULT "EGP" |
| `method` | `method` | TEXT NOT NULL | DEFAULT "bank_transfer" |
| `reference` | `reference` | TEXT NOT NULL | DEFAULT "" |
| `payer_name` | `payerName` | TEXT NOT NULL | DEFAULT "" |
| `note` | `note` | TEXT NOT NULL | DEFAULT "" |
| `status` | `status` | TEXT NOT NULL | DEFAULT "pending" |
| `review_note` | `reviewNote` | TEXT NOT NULL | DEFAULT "" |
| `submitted_by_id` | `submittedById` | TEXT NULL | - |
| `reviewed_by_id` | `reviewedById` | TEXT NULL | - |
| `reviewed_at` | `reviewedAt` | TIMESTAMP(3) NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([storeId, createdAt])`, `([status, createdAt])`

### `store_visits` - 4 columns

Prisma model: `StoreVisit` | foreign keys: 1 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `path` | `path` | TEXT NOT NULL | DEFAULT "/" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([storeId, createdAt])`, `([createdAt])`

### `merchants` - 17 columns

Prisma model: `Merchant` | foreign keys: 1 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NULL | - |
| `store_handle` | `storeHandle` | TEXT NOT NULL | DEFAULT "" |
| `email` | `email` | TEXT NOT NULL | UNIQUE |
| `password_hash` | `passwordHash` | TEXT NOT NULL | - |
| `password_salt` | `passwordSalt` | TEXT NULL | - |
| `password_algo` | `passwordAlgo` | TEXT NOT NULL | DEFAULT "argon2id" |
| `role` | `role` | TEXT NOT NULL | DEFAULT "merchant" |
| `name` | `name` | TEXT NOT NULL | DEFAULT "" |
| `first_name` | `firstName` | TEXT NOT NULL | DEFAULT "" |
| `last_name` | `lastName` | TEXT NOT NULL | DEFAULT "" |
| `phone` | `phone` | TEXT NOT NULL | DEFAULT "" |
| `email_verified_at` | `emailVerifiedAt` | TIMESTAMP(3) NULL | - |
| `two_factor_secret` | `twoFactorSecret` | TEXT NULL | - |
| `two_factor_enabled` | `twoFactorEnabled` | BOOLEAN NOT NULL | DEFAULT false |
| `two_factor_recovery_codes` | `twoFactorRecoveryCodes` | JSONB NOT NULL | DEFAULT "[]" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([storeId])`

### `team_members` - 15 columns

Prisma model: `TeamMember` | foreign keys: 1 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `name` | `name` | TEXT NOT NULL | DEFAULT "" |
| `email` | `email` | TEXT NOT NULL | UNIQUE |
| `role` | `role` | TEXT NOT NULL | DEFAULT "staff" |
| `status` | `status` | TEXT NOT NULL | DEFAULT "invited" |
| `password_hash` | `passwordHash` | TEXT NULL | - |
| `password_salt` | `passwordSalt` | TEXT NULL | - |
| `password_algo` | `passwordAlgo` | TEXT NOT NULL | DEFAULT "argon2id" |
| `invite_token_hash` | `inviteTokenHash` | TEXT NULL | UNIQUE |
| `invite_expires_at` | `inviteExpiresAt` | TIMESTAMP(3) NULL | - |
| `accepted_at` | `acceptedAt` | TIMESTAMP(3) NULL | - |
| `last_login_at` | `lastLoginAt` | TIMESTAMP(3) NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([storeId])`, `([email, status])`

### `platform_admins` - 15 columns

Prisma model: `PlatformAdmin` | foreign keys: 0 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `email` | `email` | TEXT NOT NULL | UNIQUE |
| `name` | `name` | TEXT NOT NULL | DEFAULT "" |
| `password_hash` | `passwordHash` | TEXT NOT NULL | - |
| `password_salt` | `passwordSalt` | TEXT NULL | - |
| `password_algo` | `passwordAlgo` | TEXT NOT NULL | DEFAULT "argon2id" |
| `role` | `role` | TEXT NOT NULL | DEFAULT "readonly" |
| `status` | `status` | TEXT NOT NULL | DEFAULT "active" |
| `must_change_credentials` | `mustChangeCredentials` | BOOLEAN NOT NULL | DEFAULT false |
| `two_factor_secret` | `twoFactorSecret` | TEXT NULL | - |
| `two_factor_enabled` | `twoFactorEnabled` | BOOLEAN NOT NULL | DEFAULT false |
| `two_factor_recovery_codes` | `twoFactorRecoveryCodes` | JSONB NOT NULL | DEFAULT "[]" |
| `last_login_at` | `lastLoginAt` | TIMESTAMP(3) NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([status])`

### `admin_sessions` - 6 columns

Prisma model: `AdminSession` | foreign keys: 1 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `token` | `tokenHash` | TEXT NOT NULL | PK |
| `admin_id` | `adminId` | TEXT NOT NULL | - |
| `expires_at` | `expiresAt` | TIMESTAMP(3) NOT NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `ip` | `ip` | TEXT NOT NULL | DEFAULT "" |
| `user_agent` | `userAgent` | TEXT NOT NULL | DEFAULT "" |

Indexes: `([adminId])`, `([expiresAt])`

### `categories` - 12 columns

Prisma model: `Category` | foreign keys: 1 | composite unique: 1 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `name` | `name` | TEXT NOT NULL | - |
| `name_ar` | `nameAr` | TEXT NOT NULL | DEFAULT "" |
| `name_en` | `nameEn` | TEXT NOT NULL | DEFAULT "" |
| `slug` | `slug` | TEXT NOT NULL | - |
| `description` | `description` | TEXT NOT NULL | DEFAULT "" |
| `image_url` | `imageUrl` | TEXT NOT NULL | DEFAULT "" |
| `sort_order` | `sortOrder` | INTEGER NOT NULL | DEFAULT 0 |
| `is_active` | `isActive` | BOOLEAN NOT NULL | DEFAULT true |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Composite unique constraints: `([storeId, slug])`

Indexes: `([storeId])`

### `products` - 29 columns

Prisma model: `Product` | foreign keys: 2 | composite unique: 1 | indexes: 4

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `category_id` | `categoryId` | TEXT NULL | - |
| `sku` | `sku` | TEXT NOT NULL | - |
| `slug` | `slug` | TEXT NOT NULL | DEFAULT "" |
| `name_ar` | `nameAr` | TEXT NOT NULL | DEFAULT "" |
| `name_en` | `nameEn` | TEXT NOT NULL | DEFAULT "" |
| `short_description_ar` | `shortDescriptionAr` | TEXT NOT NULL | DEFAULT "" |
| `short_description_en` | `shortDescriptionEn` | TEXT NOT NULL | DEFAULT "" |
| `description_ar` | `descriptionAr` | TEXT NOT NULL | DEFAULT "" |
| `description_en` | `descriptionEn` | TEXT NOT NULL | DEFAULT "" |
| `price_egp` | `priceEgp` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `price_sar` | `priceSar` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `base_price` | `basePrice` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `compare_at_price` | `compareAtPrice` | DOUBLE PRECISION NULL | - |
| `cost_price` | `costPrice` | DOUBLE PRECISION NULL | - |
| `stock` | `stock` | INTEGER NOT NULL | DEFAULT 0 |
| `low_stock_threshold` | `lowStockThreshold` | INTEGER NOT NULL | DEFAULT 5 |
| `barcode` | `barcode` | TEXT NOT NULL | DEFAULT "" |
| `weight` | `weight` | DOUBLE PRECISION NULL | - |
| `width` | `width` | DOUBLE PRECISION NULL | - |
| `height` | `height` | DOUBLE PRECISION NULL | - |
| `length` | `length` | DOUBLE PRECISION NULL | - |
| `status` | `status` | TEXT NOT NULL | DEFAULT "active" |
| `is_featured` | `isFeatured` | BOOLEAN NOT NULL | DEFAULT false |
| `seo_title` | `seoTitle` | TEXT NOT NULL | DEFAULT "" |
| `seo_description` | `seoDescription` | TEXT NOT NULL | DEFAULT "" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | DEFAULT now(), auto-updated |

Composite unique constraints: `([storeId, sku])`

Indexes: `([storeId, slug])`, `([storeId])`, `([storeId, status])`, `([storeId, categoryId])`

### `product_images` - 6 columns

Prisma model: `ProductImage` | foreign keys: 1 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `product_id` | `productId` | TEXT NOT NULL | - |
| `url` | `url` | TEXT NOT NULL | - |
| `alt` | `alt` | TEXT NOT NULL | DEFAULT "" |
| `sort_order` | `sortOrder` | INTEGER NOT NULL | DEFAULT 0 |

Indexes: `([storeId])`, `([productId])`

### `product_options` - 6 columns

Prisma model: `ProductOption` | foreign keys: 1 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `product_id` | `productId` | TEXT NOT NULL | - |
| `name` | `name` | TEXT NOT NULL | - |
| `name_ar` | `nameAr` | TEXT NOT NULL | DEFAULT "" |
| `position` | `position` | INTEGER NOT NULL | DEFAULT 0 |

Indexes: `([storeId])`, `([productId])`

### `product_option_values` - 6 columns

Prisma model: `ProductOptionValue` | foreign keys: 1 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `option_id` | `optionId` | TEXT NOT NULL | - |
| `value` | `value` | TEXT NOT NULL | - |
| `value_ar` | `valueAr` | TEXT NOT NULL | DEFAULT "" |
| `position` | `position` | INTEGER NOT NULL | DEFAULT 0 |

Indexes: `([storeId])`, `([optionId])`

### `product_variants` - 10 columns

Prisma model: `ProductVariant` | foreign keys: 1 | composite unique: 1 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `product_id` | `productId` | TEXT NOT NULL | - |
| `sku` | `sku` | TEXT NOT NULL | - |
| `price` | `price` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `compare_at_price` | `compareAtPrice` | DOUBLE PRECISION NULL | - |
| `stock` | `stock` | INTEGER NOT NULL | DEFAULT 0 |
| `option_values` | `optionValues` | JSONB NOT NULL | DEFAULT "{}" |
| `image_url` | `imageUrl` | TEXT NOT NULL | DEFAULT "" |
| `is_active` | `isActive` | BOOLEAN NOT NULL | DEFAULT true |

Composite unique constraints: `([storeId, sku])`

Indexes: `([storeId])`, `([productId])`

### `customers` - 8 columns

Prisma model: `Customer` | foreign keys: 1 | composite unique: 0 | indexes: 3

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `name` | `name` | TEXT NOT NULL | DEFAULT "" |
| `phone` | `phone` | TEXT NOT NULL | DEFAULT "" |
| `email` | `email` | TEXT NOT NULL | DEFAULT "" |
| `notes` | `notes` | TEXT NOT NULL | DEFAULT "" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([storeId])`, `([storeId, phone])`, `([storeId, email])`

### `customer_addresses` - 10 columns

Prisma model: `CustomerAddress` | foreign keys: 2 | composite unique: 1 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `customer_id` | `customerId` | TEXT NOT NULL | - |
| `address_key` | `addressKey` | TEXT NOT NULL | - |
| `label` | `label` | TEXT NOT NULL | DEFAULT "" |
| `address` | `address` | TEXT NOT NULL | DEFAULT "" |
| `city` | `city` | TEXT NOT NULL | DEFAULT "" |
| `governorate` | `governorate` | TEXT NOT NULL | DEFAULT "" |
| `phone` | `phone` | TEXT NOT NULL | DEFAULT "" |
| `is_default` | `isDefault` | BOOLEAN NOT NULL | DEFAULT false |

Composite unique constraints: `([storeId, customerId, addressKey])`

Indexes: `([storeId])`, `([customerId])`

### `orders` - 29 columns

Prisma model: `Order` | foreign keys: 2 | composite unique: 2 | indexes: 4

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `order_number` | `orderNumber` | INTEGER NOT NULL | - |
| `customer_id` | `customerId` | TEXT NULL | - |
| `customer_name` | `customerName` | TEXT NOT NULL | DEFAULT "" |
| `customer_phone` | `customerPhone` | TEXT NOT NULL | DEFAULT "" |
| `customer_email` | `customerEmail` | TEXT NOT NULL | DEFAULT "" |
| `address` | `address` | TEXT NOT NULL | DEFAULT "" |
| `city` | `city` | TEXT NOT NULL | DEFAULT "" |
| `governorate` | `governorate` | TEXT NOT NULL | DEFAULT "" |
| `items_summary` | `itemsSummary` | TEXT NOT NULL | DEFAULT "" |
| `amount_text` | `amountText` | TEXT NOT NULL | DEFAULT "" |
| `amount_egp` | `amountEgp` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `subtotal` | `subtotal` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `discount` | `discount` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `shipping_fee` | `shippingFee` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `coupon_code` | `couponCode` | TEXT NOT NULL | DEFAULT "" |
| `shipping_zone_id` | `shippingZoneId` | TEXT NULL | - |
| `payment_method` | `paymentMethod` | TEXT NOT NULL | DEFAULT "COD" |
| `payment_status` | `paymentStatus` | TEXT NOT NULL | DEFAULT "unpaid" |
| `source` | `source` | TEXT NOT NULL | DEFAULT "storefront" |
| `status` | `status` | TEXT NOT NULL | DEFAULT "pending" |
| `stock_restored` | `stockRestored` | BOOLEAN NOT NULL | DEFAULT false |
| `idempotency_key` | `idempotencyKey` | TEXT NULL | - |
| `courier` | `courier` | TEXT NOT NULL | DEFAULT "" |
| `notes` | `notes` | TEXT NOT NULL | DEFAULT "" |
| `internal_notes` | `internalNotes` | TEXT NOT NULL | DEFAULT "" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | DEFAULT now(), auto-updated |

Composite unique constraints: `([storeId, orderNumber])`, `([storeId, idempotencyKey])`

Indexes: `([storeId])`, `([storeId, status])`, `([storeId, paymentStatus])`, `([storeId, customerPhone])`

### `order_items` - 10 columns

Prisma model: `OrderItem` | foreign keys: 2 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `order_id` | `orderId` | TEXT NOT NULL | - |
| `product_id` | `productId` | TEXT NULL | - |
| `variant_id` | `variantId` | TEXT NULL | - |
| `variant_label` | `variantLabel` | TEXT NOT NULL | DEFAULT "" |
| `sku` | `sku` | TEXT NOT NULL | DEFAULT "" |
| `name` | `name` | TEXT NOT NULL | DEFAULT "" |
| `qty` | `qty` | INTEGER NOT NULL | DEFAULT 1 |
| `unit_price_egp` | `unitPriceEgp` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `image_url` | `imageUrl` | TEXT NOT NULL | DEFAULT "" |

Indexes: `([orderId])`

### `order_events` - 8 columns

Prisma model: `OrderEvent` | foreign keys: 2 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `order_id` | `orderId` | TEXT NOT NULL | - |
| `type` | `type` | TEXT NOT NULL | - |
| `message` | `message` | TEXT NOT NULL | DEFAULT "" |
| `actor` | `actor` | TEXT NOT NULL | DEFAULT "merchant" |
| `metadata` | `metadata` | JSONB NOT NULL | DEFAULT "{}" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([storeId])`, `([orderId])`

### `shipping_zones` - 16 columns

Prisma model: `ShippingZone` | foreign keys: 1 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `name` | `name` | TEXT NOT NULL | - |
| `governorates` | `governorates` | JSONB NOT NULL | DEFAULT "[]" |
| `cities` | `cities` | JSONB NOT NULL | DEFAULT "[]" |
| `fee` | `fee` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `free_shipping_threshold` | `freeShippingThreshold` | DOUBLE PRECISION NULL | - |
| `cod_fee` | `codFee` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `estimated_days_min` | `estimatedDaysMin` | INTEGER NOT NULL | DEFAULT 1 |
| `estimated_days_max` | `estimatedDaysMax` | INTEGER NOT NULL | DEFAULT 3 |
| `carrier` | `carrier` | TEXT NOT NULL | DEFAULT "" |
| `tracking_supported` | `trackingSupported` | BOOLEAN NOT NULL | DEFAULT false |
| `is_active` | `isActive` | BOOLEAN NOT NULL | DEFAULT true |
| `is_fallback` | `isFallback` | BOOLEAN NOT NULL | DEFAULT false |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([storeId])`

### `shipping_rates` - 10 columns

Prisma model: `ShippingRate` | foreign keys: 2 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `zone_id` | `zoneId` | TEXT NOT NULL | - |
| `governorate` | `governorate` | TEXT NOT NULL | DEFAULT "" |
| `city` | `city` | TEXT NOT NULL | DEFAULT "" |
| `district` | `district` | TEXT NOT NULL | DEFAULT "" |
| `fee` | `fee` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `cod_fee` | `codFee` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `estimated_days` | `estimatedDays` | INTEGER NOT NULL | DEFAULT 2 |
| `is_active` | `isActive` | BOOLEAN NOT NULL | DEFAULT true |

Indexes: `([storeId])`, `([zoneId])`

### `coupons` - 17 columns

Prisma model: `Coupon` | foreign keys: 1 | composite unique: 1 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `code` | `code` | TEXT NOT NULL | - |
| `type` | `type` | TEXT NOT NULL | DEFAULT "percentage" |
| `value` | `value` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `starts_at` | `startsAt` | TIMESTAMP(3) NULL | - |
| `ends_at` | `endsAt` | TIMESTAMP(3) NULL | - |
| `min_order_value` | `minOrderValue` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `max_uses` | `maxUses` | INTEGER NULL | - |
| `per_customer_limit` | `perCustomerLimit` | INTEGER NULL | - |
| `first_order_only` | `firstOrderOnly` | BOOLEAN NOT NULL | DEFAULT false |
| `free_shipping` | `freeShipping` | BOOLEAN NOT NULL | DEFAULT false |
| `product_ids` | `productIds` | JSONB NOT NULL | DEFAULT "[]" |
| `category_ids` | `categoryIds` | JSONB NOT NULL | DEFAULT "[]" |
| `is_active` | `isActive` | BOOLEAN NOT NULL | DEFAULT true |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Composite unique constraints: `([storeId, code])`

Indexes: `([storeId])`

### `coupon_usages` - 7 columns

Prisma model: `CouponUsage` | foreign keys: 4 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `coupon_id` | `couponId` | TEXT NOT NULL | - |
| `order_id` | `orderId` | TEXT NOT NULL | UNIQUE |
| `customer_id` | `customerId` | TEXT NULL | - |
| `discount` | `discount` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([storeId])`, `([couponId])`

### `upsell_rules` - 18 columns

Prisma model: `UpsellRule` | foreign keys: 3 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `name` | `name` | TEXT NOT NULL | DEFAULT "" |
| `trigger_product_id` | `triggerProductId` | TEXT NULL | - |
| `offer_product_id` | `offerProductId` | TEXT NOT NULL | - |
| `discount_type` | `discountType` | TEXT NOT NULL | DEFAULT "percentage" |
| `discount_value` | `discountValue` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `priority` | `priority` | INTEGER NOT NULL | DEFAULT 0 |
| `is_active` | `isActive` | BOOLEAN NOT NULL | DEFAULT true |
| `placement` | `placement` | TEXT NOT NULL | DEFAULT "cart" |
| `starts_at` | `startsAt` | TIMESTAMP(3) NULL | - |
| `ends_at` | `endsAt` | TIMESTAMP(3) NULL | - |
| `impressions` | `impressions` | INTEGER NOT NULL | DEFAULT 0 |
| `additions` | `additions` | INTEGER NOT NULL | DEFAULT 0 |
| `conversions` | `conversions` | INTEGER NOT NULL | DEFAULT 0 |
| `revenue` | `revenue` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([storeId])`

### `related_products` - 7 columns

Prisma model: `RelatedProduct` | foreign keys: 3 | composite unique: 1 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `product_id` | `productId` | TEXT NOT NULL | - |
| `related_product_id` | `relatedProductId` | TEXT NOT NULL | - |
| `sort_order` | `sortOrder` | INTEGER NOT NULL | DEFAULT 0 |
| `is_active` | `isActive` | BOOLEAN NOT NULL | DEFAULT true |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Composite unique constraints: `([storeId, productId, relatedProductId])`

Indexes: `([storeId])`

### `pages` - 12 columns

Prisma model: `Page` | foreign keys: 1 | composite unique: 1 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `title` | `title` | TEXT NOT NULL | - |
| `slug` | `slug` | TEXT NOT NULL | - |
| `type` | `type` | TEXT NOT NULL | DEFAULT "custom" |
| `content` | `content` | TEXT NOT NULL | DEFAULT "" |
| `seo_title` | `seoTitle` | TEXT NOT NULL | DEFAULT "" |
| `seo_description` | `seoDescription` | TEXT NOT NULL | DEFAULT "" |
| `status` | `status` | TEXT NOT NULL | DEFAULT "draft" |
| `published_at` | `publishedAt` | TIMESTAMP(3) NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Composite unique constraints: `([storeId, slug])`

Indexes: `([storeId])`

### `blog_posts` - 17 columns

Prisma model: `BlogPost` | foreign keys: 1 | composite unique: 1 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `title` | `title` | TEXT NOT NULL | - |
| `slug` | `slug` | TEXT NOT NULL | - |
| `excerpt` | `excerpt` | TEXT NOT NULL | DEFAULT "" |
| `author` | `author` | TEXT NOT NULL | DEFAULT "" |
| `featured_image` | `featuredImage` | TEXT NOT NULL | DEFAULT "" |
| `content` | `content` | TEXT NOT NULL | DEFAULT "" |
| `categories` | `categories` | JSONB NOT NULL | DEFAULT "[]" |
| `tags` | `tags` | JSONB NOT NULL | DEFAULT "[]" |
| `seo_title` | `seoTitle` | TEXT NOT NULL | DEFAULT "" |
| `seo_description` | `seoDescription` | TEXT NOT NULL | DEFAULT "" |
| `status` | `status` | TEXT NOT NULL | DEFAULT "draft" |
| `published_at` | `publishedAt` | TIMESTAMP(3) NULL | - |
| `scheduled_at` | `scheduledAt` | TIMESTAMP(3) NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Composite unique constraints: `([storeId, slug])`

Indexes: `([storeId])`

### `affiliates` - 10 columns

Prisma model: `Affiliate` | foreign keys: 1 | composite unique: 1 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `name` | `name` | TEXT NOT NULL | - |
| `phone` | `phone` | TEXT NOT NULL | DEFAULT "" |
| `email` | `email` | TEXT NOT NULL | DEFAULT "" |
| `referral_code` | `referralCode` | TEXT NOT NULL | - |
| `commission_rate` | `commissionRate` | DOUBLE PRECISION NOT NULL | DEFAULT 5 |
| `is_active` | `isActive` | BOOLEAN NOT NULL | DEFAULT true |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Composite unique constraints: `([storeId, referralCode])`

Indexes: `([storeId])`

### `affiliate_attributions` - 8 columns

Prisma model: `AffiliateAttribution` | foreign keys: 3 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `affiliate_id` | `affiliateId` | TEXT NOT NULL | - |
| `order_id` | `orderId` | TEXT NOT NULL | UNIQUE |
| `commission_amount` | `commissionAmount` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `status` | `status` | TEXT NOT NULL | DEFAULT "pending" |
| `settled_at` | `settledAt` | TIMESTAMP(3) NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([storeId])`, `([affiliateId])`

### `wallet_accounts` - 6 columns

Prisma model: `WalletAccount` | foreign keys: 1 | composite unique: 0 | indexes: 0

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | UNIQUE |
| `balance` | `balance` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `currency` | `currency` | TEXT NOT NULL | DEFAULT "EGP" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

### `wallet_transactions` - 15 columns

Prisma model: `WalletTransaction` | foreign keys: 2 | composite unique: 0 | indexes: 3

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `account_id` | `accountId` | TEXT NOT NULL | - |
| `type` | `type` | TEXT NOT NULL | DEFAULT "deposit" |
| `amount` | `amount` | DOUBLE PRECISION NOT NULL | - |
| `balance_before` | `balanceBefore` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `balance_after` | `balanceAfter` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `status` | `status` | TEXT NOT NULL | DEFAULT "pending" |
| `reference` | `reference` | TEXT NOT NULL | DEFAULT "" |
| `invoice_ref` | `invoiceRef` | TEXT NOT NULL | DEFAULT "" |
| `note` | `note` | TEXT NOT NULL | DEFAULT "" |
| `review_note` | `reviewNote` | TEXT NOT NULL | DEFAULT "" |
| `reviewed_by_admin_id` | `reviewedByAdminId` | TEXT NULL | - |
| `reviewed_at` | `reviewedAt` | TIMESTAMP(3) NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([storeId])`, `([status, createdAt])`, `([accountId])`

### `abandoned_carts` - 13 columns

Prisma model: `AbandonedCart` | foreign keys: 2 | composite unique: 1 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `cart_token` | `cartToken` | TEXT NOT NULL | - |
| `customer_id` | `customerId` | TEXT NULL | - |
| `customer_name` | `customerName` | TEXT NOT NULL | DEFAULT "" |
| `phone` | `phone` | TEXT NOT NULL | DEFAULT "" |
| `email` | `email` | TEXT NOT NULL | DEFAULT "" |
| `items` | `items` | JSONB NOT NULL | DEFAULT "[]" |
| `cart_value` | `cartValue` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `last_activity_at` | `lastActivityAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `recovery_status` | `recoveryStatus` | TEXT NOT NULL | DEFAULT "open" |
| `reminded_at` | `remindedAt` | TIMESTAMP(3) NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Composite unique constraints: `([storeId, cartToken])`

Indexes: `([storeId])`, `([lastActivityAt])`

### `payments` - 12 columns

Prisma model: `Payment` | foreign keys: 2 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `order_id` | `orderId` | TEXT NOT NULL | - |
| `provider` | `provider` | TEXT NOT NULL | DEFAULT "cod" |
| `provider_ref` | `providerRef` | TEXT NOT NULL | DEFAULT "" |
| `amount` | `amount` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `currency` | `currency` | TEXT NOT NULL | DEFAULT "EGP" |
| `status` | `status` | TEXT NOT NULL | DEFAULT "pending" |
| `method` | `method` | TEXT NOT NULL | DEFAULT "COD" |
| `metadata` | `metadata` | JSONB NOT NULL | DEFAULT "{}" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([storeId])`, `([orderId])`

### `refunds` - 8 columns

Prisma model: `Refund` | foreign keys: 2 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `order_id` | `orderId` | TEXT NOT NULL | - |
| `amount` | `amount` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `reason` | `reason` | TEXT NOT NULL | DEFAULT "" |
| `status` | `status` | TEXT NOT NULL | DEFAULT "pending" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `processed_at` | `processedAt` | TIMESTAMP(3) NULL | - |

Indexes: `([storeId])`, `([orderId])`

### `reviews` - 12 columns

Prisma model: `Review` | foreign keys: 3 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `product_id` | `productId` | TEXT NOT NULL | - |
| `customer_id` | `customerId` | TEXT NULL | - |
| `customer_name` | `customerName` | TEXT NOT NULL | DEFAULT "" |
| `rating` | `rating` | INTEGER NOT NULL | DEFAULT 5 |
| `content` | `content` | TEXT NOT NULL | DEFAULT "" |
| `status` | `status` | TEXT NOT NULL | DEFAULT "pending" |
| `merchant_reply` | `merchantReply` | TEXT NOT NULL | DEFAULT "" |
| `reported` | `reported` | BOOLEAN NOT NULL | DEFAULT false |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([storeId])`, `([productId])`

### `notifications` - 9 columns

Prisma model: `Notification` | foreign keys: 2 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `merchant_id` | `merchantId` | TEXT NULL | - |
| `type` | `type` | TEXT NOT NULL | DEFAULT "system" |
| `title` | `title` | TEXT NOT NULL | - |
| `body` | `body` | TEXT NOT NULL | DEFAULT "" |
| `read` | `read` | BOOLEAN NOT NULL | DEFAULT false |
| `link` | `link` | TEXT NOT NULL | DEFAULT "" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([storeId])`

### `audit_logs` - 12 columns

Prisma model: `AuditLog` | foreign keys: 2 | composite unique: 0 | indexes: 5

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NULL | - |
| `merchant_id` | `merchantId` | TEXT NULL | - |
| `team_member_id` | `teamMemberId` | TEXT NULL | - |
| `platform_admin_id` | `platformAdminId` | TEXT NULL | - |
| `actor_type` | `actorType` | TEXT NOT NULL | DEFAULT "merchant" |
| `action` | `action` | TEXT NOT NULL | - |
| `entity` | `entity` | TEXT NOT NULL | DEFAULT "" |
| `entity_id` | `entityId` | TEXT NOT NULL | DEFAULT "" |
| `metadata` | `metadata` | JSONB NOT NULL | DEFAULT "{}" |
| `ip` | `ip` | TEXT NOT NULL | DEFAULT "" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([storeId])`, `([merchantId])`, `([teamMemberId])`, `([platformAdminId])`, `([createdAt])`

### `support_tickets` - 12 columns

Prisma model: `SupportTicket` | foreign keys: 1 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NULL | - |
| `merchant_id` | `merchantId` | TEXT NULL | - |
| `subject` | `subject` | TEXT NOT NULL | - |
| `message` | `message` | TEXT NOT NULL | - |
| `category` | `category` | TEXT NOT NULL | DEFAULT "other" |
| `priority` | `priority` | TEXT NOT NULL | DEFAULT "normal" |
| `status` | `status` | TEXT NOT NULL | DEFAULT "open" |
| `assigned_admin_id` | `assignedAdminId` | TEXT NULL | - |
| `resolution` | `resolution` | TEXT NOT NULL | DEFAULT "" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([storeId])`, `([status, createdAt])`

### `feature_flags` - 6 columns

Prisma model: `FeatureFlag` | foreign keys: 0 | composite unique: 0 | indexes: 0

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `key` | `key` | TEXT NOT NULL | PK |
| `label` | `label` | TEXT NOT NULL | DEFAULT "" |
| `description` | `description` | TEXT NOT NULL | DEFAULT "" |
| `enabled` | `enabled` | BOOLEAN NOT NULL | DEFAULT false |
| `updated_by_admin_id` | `updatedByAdminId` | TEXT NULL | - |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

### `media_assets` - 11 columns

Prisma model: `MediaAsset` | foreign keys: 1 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `file_name` | `fileName` | TEXT NOT NULL | - |
| `mime_type` | `mimeType` | TEXT NOT NULL | - |
| `size` | `size` | INTEGER NOT NULL | - |
| `url` | `url` | TEXT NOT NULL | - |
| `storage_key` | `storageKey` | TEXT NOT NULL | - |
| `provider` | `provider` | TEXT NOT NULL | DEFAULT "local" |
| `width` | `width` | INTEGER NULL | - |
| `height` | `height` | INTEGER NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([storeId])`

### `loyalty_rules` - 10 columns

Prisma model: `LoyaltyRule` | foreign keys: 1 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `name` | `name` | TEXT NOT NULL | - |
| `type` | `type` | TEXT NOT NULL | DEFAULT "earn" |
| `points` | `points` | INTEGER NOT NULL | DEFAULT 1 |
| `per_amount` | `perAmount` | DOUBLE PRECISION NOT NULL | DEFAULT 1 |
| `min_order_value` | `minOrderValue` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `is_active` | `isActive` | BOOLEAN NOT NULL | DEFAULT true |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([storeId])`

### `loyalty_accounts` - 6 columns

Prisma model: `LoyaltyAccount` | foreign keys: 2 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `customer_id` | `customerId` | TEXT NOT NULL | UNIQUE |
| `points` | `points` | INTEGER NOT NULL | DEFAULT 0 |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([storeId])`

### `loyalty_transactions` - 8 columns

Prisma model: `LoyaltyTransaction` | foreign keys: 3 | composite unique: 1 | indexes: 3

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `account_id` | `accountId` | TEXT NOT NULL | - |
| `order_id` | `orderId` | TEXT NULL | - |
| `points` | `points` | INTEGER NOT NULL | - |
| `type` | `type` | TEXT NOT NULL | DEFAULT "earn" |
| `note` | `note` | TEXT NOT NULL | DEFAULT "" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Composite unique constraints: `([accountId, orderId, type])`

Indexes: `([storeId])`, `([accountId])`, `([storeId, orderId])`

### `suppliers` - 11 columns

Prisma model: `Supplier` | foreign keys: 1 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `name` | `name` | TEXT NOT NULL | - |
| `contact_name` | `contactName` | TEXT NOT NULL | DEFAULT "" |
| `email` | `email` | TEXT NOT NULL | DEFAULT "" |
| `phone` | `phone` | TEXT NOT NULL | DEFAULT "" |
| `integration_key` | `integrationKey` | TEXT NULL | - |
| `status` | `status` | TEXT NOT NULL | DEFAULT "active" |
| `notes` | `notes` | TEXT NOT NULL | DEFAULT "" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([storeId])`

### `dropship_products` - 9 columns

Prisma model: `DropshipProduct` | foreign keys: 3 | composite unique: 1 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `store_id` | `storeId` | TEXT NOT NULL | - |
| `product_id` | `productId` | TEXT NOT NULL | - |
| `supplier_id` | `supplierId` | TEXT NOT NULL | - |
| `cost_price` | `costPrice` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `suggested_price` | `suggestedPrice` | DOUBLE PRECISION NOT NULL | DEFAULT 0 |
| `fulfillment_status` | `fulfillmentStatus` | TEXT NOT NULL | DEFAULT "manual" |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Composite unique constraints: `([storeId, productId])`

Indexes: `([storeId])`

### `leads` - 5 columns

Prisma model: `Lead` | foreign keys: 1 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `type` | `type` | TEXT NOT NULL | - |
| `payload` | `payload` | JSONB NOT NULL | DEFAULT "{}" |
| `store_id` | `storeId` | TEXT NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([storeId])`, `([type])`

### `sessions` - 5 columns

Prisma model: `Session` | foreign keys: 2 | composite unique: 0 | indexes: 3

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `token` | `tokenHash` | TEXT NOT NULL | PK |
| `merchant_id` | `merchantId` | TEXT NULL | - |
| `team_member_id` | `teamMemberId` | TEXT NULL | - |
| `expires_at` | `expiresAt` | TIMESTAMP(3) NOT NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([merchantId])`, `([teamMemberId])`, `([expiresAt])`

### `auth_tokens` - 7 columns

Prisma model: `AuthToken` | foreign keys: 1 | composite unique: 0 | indexes: 2

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `id` | `id` | TEXT NOT NULL | PK |
| `merchant_id` | `merchantId` | TEXT NOT NULL | - |
| `type` | `type` | TEXT NOT NULL | - |
| `token_hash` | `tokenHash` | TEXT NOT NULL | UNIQUE |
| `expires_at` | `expiresAt` | TIMESTAMP(3) NOT NULL | - |
| `used_at` | `usedAt` | TIMESTAMP(3) NULL | - |
| `created_at` | `createdAt` | TIMESTAMP(3) NOT NULL | DEFAULT now() |

Indexes: `([merchantId, type])`, `([expiresAt])`

### `rate_limit_buckets` - 4 columns

Prisma model: `RateLimitBucket` | foreign keys: 0 | composite unique: 0 | indexes: 1

| Column (database) | Prisma field | Type | Keys / flags |
|---|---|---|---|
| `key` | `key` | TEXT NOT NULL | PK |
| `count` | `count` | INTEGER NOT NULL | DEFAULT 0 |
| `reset_at` | `resetAt` | TIMESTAMP(3) NOT NULL | - |
| `updated_at` | `updatedAt` | TIMESTAMP(3) NOT NULL | auto-updated |

Indexes: `([resetAt])`

## 3. Data types used across the database

| PostgreSQL type | Prisma type | NOT NULL | NULL allowed | Total columns |
|---|---|---|---|---|
| `TEXT` | `String` | 332 | 36 | 368 |
| `TIMESTAMP(3)` (no time zone) | `DateTime` | 71 | 25 | 96 |
| `DOUBLE PRECISION` | `Float` | 32 | 8 | 40 |
| `INTEGER` | `Int` | 25 | 4 | 29 |
| `BOOLEAN` | `Boolean` | 26 | 0 | 26 |
| `JSONB` | `Json` | 22 | 0 | 22 |
| **Total** | | **508** | **73** | **581** |

Notes:

- There are no `DECIMAL` / `NUMERIC`, `BIGINT`, `BYTEA`, enum, array, or UUID column types. All identifiers are `TEXT`.
- All timestamps are `TIMESTAMP(3)` without time zone, written by Prisma in UTC.
- All `JSONB` columns are validated in application code, not by the database.
- The only database-level `CHECK` constraint in the whole schema is `products_stock_nonnegative` (`stock >= 0`).

## 4. Relationships and multi-tenant design

- 51 tables, 76 foreign keys, 86 secondary indexes, 14 composite unique constraints and 51 primary keys.
- 43 of the 51 tables carry `store_id`, so every merchant-owned row belongs to exactly one store. Four of those are nullable (`merchants`, `audit_logs`, `support_tickets`, `leads`), which is why platform-wide rows can exist.
- Most store-owned foreign keys use `ON DELETE CASCADE`: deleting a row in `stores` deletes its products, orders, customers and related data. A few optional links use `SET NULL` (`orders.customer_id`, `order_items.product_id`, `reviews.customer_id`, `notifications.merchant_id`, `audit_logs.store_id`, etc.).
- IDs are application-generated `TEXT`: a short prefix plus the first 8 characters of a UUID (for example `store_2489cd72`). They are not database sequences or UUID columns.
- Tenant isolation is enforced in the application layer: every merchant query filters by `store_id`. PostgreSQL Row-Level Security (RLS) is **not** enabled.
- Authentication identities are separated: `merchants` (store owners/staff owner), `team_members` (staff), and `platform_admins` (Sanad staff). `sessions` and `admin_sessions` are different tables with different cookies.

Key relation shape:

- `stores` 1-N `merchants`, `team_members`, `products`, `categories`, `orders`, `customers`, `coupons`, `shipping_zones`, `payments`, `refunds`, `reviews`, `media_assets`, etc.
- `orders` 1-N `order_items`, 1-N `order_events`, 1-N `payments`, 1-N `refunds`, 0/1 `coupon_usages`, 0/1 `affiliate_attributions`.
- `products` 1-N `product_images`, `product_options` (1-N `product_option_values`), `product_variants`, `reviews`, `related_products`, `upsell_rules`.
- `customers` 1-N `customer_addresses`, 1-N `orders`, 0/1 `loyalty_accounts` (1-N `loyalty_transactions`).
- `wallet_accounts` 1-N `wallet_transactions`.
- `suppliers` 1-N `dropship_products`.
- `stores` 1-0/1 `store_branding`, 1-0/1 `wallet_accounts`.

## 5. How sensitive data is stored

| Data | Table / column | Storage method | Reversible from the database alone? |
|---|---|---|---|
| Account passwords | `merchants.password_hash`, `team_members.password_hash`, `platform_admins.password_hash` | Argon2id hash (legacy scrypt rows carry `password_salt`; upgraded on next login) | No |
| TOTP / 2FA seeds | `merchants.two_factor_secret`, `platform_admins.two_factor_secret` | AES-256-GCM ciphertext, format `v1.<iv>.<tag>.<ciphertext>` (base64url) | Only with the encryption key, not from the database |
| 2FA recovery codes | `*.two_factor_recovery_codes` (JSONB) | HMAC-SHA256 hashes; each code removed when used | No |
| Session cookies | `sessions.token`, `admin_sessions.token` | HMAC-SHA256 of the random token; the raw token exists only in the browser cookie | No |
| Email verification / password reset tokens | `auth_tokens.token_hash` | HMAC-SHA256, single-use, expiring | No |
| Team invitations | `team_members.invite_token_hash` | HMAC-SHA256, single-use, expiring | No |
| Custom-domain DNS challenge | `store_domains.verification_token` | Plain text (`sanad-verify=<random hex>`) | Yes, but it is a public DNS challenge, not a credential |
| Customer PII | `customers`, `customer_addresses`, `orders` (name, phone, email, address), `abandoned_carts`, `leads.payload` | **Plain text** | Yes |
| Admin/audit network data | `audit_logs.ip`, `admin_sessions.ip`, `admin_sessions.user_agent` | Plain text | Yes |
| Supplier integration key | `suppliers.integration_key` | Plain text | Yes |
| Payment provider references | `payments.provider_ref`, `wallet_transactions.reference` | Plain text | Yes |

## 6. Is the database encrypted?

Short answer for the client:

- **The database as a whole is not encrypted by this application.** There is no Transparent Data Encryption, no `pgcrypto`, no encrypted tablespace and no column-level encryption for customer data. Anyone who can read the PostgreSQL data directory, a dump, or a backup can read names, phones, emails, addresses and order history.
- **Specific credentials are protected, not encrypted-readable:** passwords are Argon2id hashes; session/auth/invite tokens are HMAC hashes; 2FA recovery codes are HMAC hashes. These cannot be reversed from the database.
- **Only one kind of secret is reversibly encrypted:** TOTP seeds (`two_factor_secret`) use AES-256-GCM. The key comes from `TOTP_ENCRYPTION_KEY`, or is derived from `SESSION_SECRET` when the dedicated variable is absent. Rotating that key without migrating the stored values breaks MFA until users re-enroll.
- **In transit:** the connection uses whatever `DATABASE_URL` specifies. The repository's local URL has no `sslmode`, and the Docker Compose setup keeps PostgreSQL on a private container network (`expose`, not `ports`). Managed production PostgreSQL should use `?sslmode=require` (or stricter) in `DATABASE_URL`; this is an operator decision, not enforced by the code.
- **At rest:** any disk-level encryption is provided by the hosting provider / Docker volume encryption. It is not configured in this repository. Backups created by `scripts/backup.mjs` are plain `pg_dump` files (plus a `tar.gz` of uploads) and are **not encrypted** by the script; protect the backup directory or encrypt it externally.

## 7. Where the database lives

There is **no database file inside the project**. The repository contains no `.db`, `.sqlite`, `.sqlite3`, `-wal` or `-shm` file. The `data/` folder holds uploaded images only (`data/uploads/<store_id>/...`).

The database is PostgreSQL, addressed by `DATABASE_URL`:

- Development value in `.env`: `postgresql://sanad:sanad@localhost:5432/sanad`
- Docker Compose (`docker-compose.yml`) runs `postgres:16-alpine` with database `sanad`, user `sanad`, and a **named volume** `sanad-pgdata` mounted at `/var/lib/postgresql/data` in the container.
- The Compose service uses `expose: 5432`, not `ports: 5432`, so the database is reachable only inside the Compose network; the app connects with `db:5432`.

Physical location depends on how it was deployed:

1. **Docker Compose on this Windows machine (current setup):** the cluster files are inside Docker's Linux VM, in the named volume, not in a normal Windows folder. Concretely:
   - Inside the Docker VM: `/var/lib/docker/volumes/<compose-project>_sanad-pgdata/_data`
   - The volume name is usually `sanad-commerce_sanad-pgdata` (Compose derives the prefix from the folder name; non-ASCII folder names are sanitized).
   - The VM disk on Windows is `C:\Users\Peto\AppData\Local\Docker\wsl\disk\docker_data.vhdx` (about 11.3 GB on this machine). The files are not individually visible in Explorer; they live inside that virtual disk.
   - To locate it exactly: `docker volume inspect <compose-project>_sanad-pgdata` and read `Mountpoint`.
   - To get a normal file copy: `npm run db:backup`, or `docker compose exec db pg_dump -U sanad -F c sanad > sanad.dump`.
2. **Managed PostgreSQL (recommended production):** there is no path you can open. The data lives on the provider's block storage; `DATABASE_URL` is the only address. Backups are provider snapshots plus `pg_dump`.
3. **Self-managed PostgreSQL on a server:** the data directory is the server's `data_directory` (typically `/var/lib/postgresql/16/main` on Debian/Ubuntu, `/var/lib/pgsql/16/data` on RHEL). It contains many files (`base/`, `global/`, `pg_wal/`, etc.), not a single portable database file.

Current machine status: Docker is not running and nothing is listening on port 5432, so the local database cannot be opened right now. The only trace found is the Docker virtual disk above. No `backups/` folder exists yet.

## 8. Backups, restore and retention

- `npm run db:backup` runs `scripts/backup.mjs` and creates `backups/sanad-<timestamp>/` containing:
  - `database.dump` - `pg_dump --format=custom --no-owner --no-acl`
  - `uploads.tar.gz` - the `STORAGE_DIR` (default `data/uploads`)
  - `manifest.json` - sizes and file names
- `npm run db:restore <dir>` runs `scripts/restore.mjs`. It refuses to run unless `RESTORE_DATABASE_URL` and `CONFIRM_RESTORE=yes` are set, rejects the `postgres` maintenance database, rejects production unless `ALLOW_PRODUCTION_RESTORE=yes`, and rejects restoring over the live `DATABASE_URL` unless `ALLOW_SAME_DATABASE_RESTORE=yes`.
- The schedule is not built into the application. The handover guide says to run dumps daily, keep them off-site and test restores quarterly.
- Automatic retention sweeps run at boot and every 24 hours:
  - abandoned carts older than `CART_RETENTION_DAYS` (default 30)
  - audit logs older than `AUDIT_RETENTION_DAYS` (default 365)
  - expired sessions, expired auth tokens, expired rate-limit buckets

## 9. Migrations and day-to-day commands

- 17 versioned migrations in `prisma/migrations`, applied with `npm run db:migrate` (`prisma migrate deploy`). In Docker, a one-shot `migrate` service applies them before the app starts.
- The app never creates or alters tables at boot; it only connects.
- Useful commands:
  - `npm run db:migrate` - apply pending migrations
  - `npm run db:migrate:dev` - create a migration in development
  - `npm run db:seed` - demo data (requires `DEMO_MODE=true`)
  - `npm run db:backup` / `npm run db:restore <dir>`
  - `npm run db:reset` - destructive local reset guard-railed by `scripts/db-reset.mjs`
  - `GET /api/health` returns `db: "up"` or HTTP 503 when PostgreSQL is unreachable
- Tests use real PostgreSQL databases named `sanad_test_*`, one per Vitest worker, created and migrated by `tests/setup.ts`. There is no in-memory or SQLite test database.

## 10. Known limitations to be ready to explain

1. **Money precision:** amounts are `DOUBLE PRECISION` (`Float`), not exact decimals. The project audit lists migrating to `DECIMAL` or integer minor units as an open high-priority item.
2. **No tenant RLS:** isolation depends on application queries always filtering by `store_id`; the database itself would allow cross-store reads for a privileged connection.
3. **PII is plaintext:** customer names, phones, emails and addresses are readable in the database and in backups. This is the main point to align on if the client asks about privacy or GDPR-style obligations.
4. **Only one CHECK constraint:** business rules such as non-negative prices, valid statuses and enum-like values are enforced in the API, not by the database, except `products.stock >= 0`.
5. **Cascade deletion:** deleting a store deletes its operational history through cascading foreign keys. Account deletion is a hard delete, not a soft delete.
6. **Backups are manual:** no built-in scheduler, no encryption, no off-site copy; these are operator responsibilities.
7. **No data volumes/row counts in this document:** row counts can only be read from a running database (`SELECT relname, n_live_tup FROM pg_stat_user_tables`), which was not available while writing this.
