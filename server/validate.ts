import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { ApiError } from "./errors.js";

/**
 * Request validation (body, params, query) with zod.
 * Unknown fields are rejected (.strictObject): clients get a clear 400
 * instead of silently ignored input.
 */

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "valid email is required" });

const subdomainField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,40}$/, { message: "subdomain must be 3-40 chars: a-z, 0-9, hyphen" });

export const RESERVED_SUBDOMAINS = new Set([
  "www", "api", "admin", "app", "mail", "static", "assets", "cdn", "status",
  "health", "docs", "blog", "shop", "store", "stores", "support", "help",
  "billing", "pay", "auth", "login", "signup", "dashboard", "console",
]);

const registerSubdomainField = subdomainField
  .refine((v) => !RESERVED_SUBDOMAINS.has(v), { message: "subdomain is reserved" })
  .refine((v) => !v.startsWith("-") && !v.endsWith("-"), { message: "subdomain cannot start or end with a hyphen" });

const passwordField = z.string().min(8, { message: "password must be at least 8 characters" }).max(128);

export const SUPPORTED_STORE_CURRENCIES = ["EGP", "SAR"] as const;
const storeCurrencyField = z.enum(SUPPORTED_STORE_CURRENCIES, { message: "Only EGP and SAR are supported for store pricing." });

const optionalUrl = z.union([z.literal(""), z.string().trim().max(2000)]).optional();

export const registerSchema = z.strictObject({
  email: emailField,
  password: passwordField,
  name: z.string().trim().max(120).default(""),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(32).default(""),
  storeName: z.string().trim().min(2, { message: "storeName is required (min 2 chars)" }).max(120).optional(),
  subdomain: registerSubdomainField.optional(),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, { message: "countryCode must be a 2-letter code" }).default("EG"),
  storeCurrency: storeCurrencyField.default("EGP"),
  acceptTerms: z.boolean().optional(),
});

export const loginSchema = z.strictObject({
  email: emailField,
  password: z.string().min(1, { message: "password is required" }).max(128),
  // Second factor is collected in a separate step after the password check.
  totp: z.string().trim().max(16).optional(),
  recovery_code: z.string().trim().max(64).optional(),
});

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1, { message: "currentPassword is required" }).max(128),
    newPassword: passwordField,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "newPassword must be different from currentPassword",
    path: ["newPassword"],
  });

// ---- account recovery / 2FA ----
export const emailOnlySchema = z.strictObject({ email: emailField });

export const verifyEmailSchema = z.strictObject({
  token: z.string().trim().min(20).max(128),
});

export const resetPasswordSchema = z.strictObject({
  token: z.string().trim().min(20).max(128),
  newPassword: passwordField,
});

export const twoFactorSetupSchema = z.strictObject({
  password: z.string().min(1, { message: "password is required" }).max(128),
});

export const twoFactorCodeSchema = z.strictObject({
  code: z.string().trim().min(6).max(64),
});

export const twoFactorDisableSchema = z.strictObject({
  password: z.string().min(1, { message: "password is required" }).max(128),
  code: z.string().trim().min(6).max(64),
});

export const subdomainParamSchema = z.strictObject({ subdomain: subdomainField });

// ---- products ----
const imageInputSchema = z.strictObject({
  id: z.string().trim().max(64).optional(),
  url: z.string().trim().min(1).max(2000),
  alt: z.string().trim().max(300).default(""),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const optionValueInputSchema = z.strictObject({
  id: z.string().trim().max(64).optional(),
  value: z.string().trim().min(1).max(120),
  valueAr: z.string().trim().max(120).default(""),
  position: z.number().int().min(0).max(9999).optional(),
});

const optionInputSchema = z.strictObject({
  id: z.string().trim().max(64).optional(),
  name: z.string().trim().min(1).max(80),
  nameAr: z.string().trim().max(80).default(""),
  position: z.number().int().min(0).max(9999).optional(),
  values: z.array(optionValueInputSchema).max(50).default([]),
});

const variantInputSchema = z.strictObject({
  id: z.string().trim().max(64).optional(),
  sku: z.string().trim().min(1).max(64),
  price: z.number().min(0).max(1e12).default(0),
  compareAtPrice: z.number().min(0).max(1e12).nullable().optional(),
  stock: z.number().int().min(0).max(1e9).default(0),
  optionValues: z.record(z.string().max(80), z.string().max(120)).default({}),
  imageUrl: z.string().trim().max(2000).default(""),
  isActive: z.boolean().default(true),
});

const productCommon = {
  name_ar: z.string().trim().max(200).optional(),
  name_en: z.string().trim().max(200).optional(),
  nameAr: z.string().trim().max(200).optional(),
  nameEn: z.string().trim().max(200).optional(),
  slug: z.string().trim().max(120).optional(),
  categoryId: z.string().trim().max(64).nullable().optional(),
  shortDescriptionAr: z.string().trim().max(2000).optional(),
  shortDescriptionEn: z.string().trim().max(2000).optional(),
  descriptionAr: z.string().trim().max(20000).optional(),
  descriptionEn: z.string().trim().max(20000).optional(),
  price_egp: z.number().min(0).max(1e12).optional(),
  price_sar: z.number().min(0).max(1e12).optional(),
  basePrice: z.number().min(0).max(1e12).optional(),
  compareAtPrice: z.number().min(0).max(1e12).nullable().optional(),
  costPrice: z.number().min(0).max(1e12).nullable().optional(),
  barcode: z.string().trim().max(120).optional(),
  lowStockThreshold: z.number().int().min(0).max(1e9).optional(),
  weight: z.number().min(0).max(1e9).nullable().optional(),
  width: z.number().min(0).max(1e9).nullable().optional(),
  height: z.number().min(0).max(1e9).nullable().optional(),
  length: z.number().min(0).max(1e9).nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  isFeatured: z.boolean().optional(),
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(400).optional(),
  images: z.array(imageInputSchema).max(20).optional(),
  options: z.array(optionInputSchema).max(10).optional(),
  variants: z.array(variantInputSchema).max(200).optional(),
};

export const productBodySchema = z
  .strictObject({
    sku: z.string().trim().min(1, { message: "sku is required" }).max(64),
    ...productCommon,
    price_egp: z.number().min(0).max(1e12).default(0),
    price_sar: z.number().min(0).max(1e12).default(0),
    stock: z.number().int().min(0).max(1e9).default(0),
    name_ar: z.string().trim().max(200).default(""),
    name_en: z.string().trim().max(200).default(""),
  })
  .refine((v) => v.compareAtPrice == null || v.compareAtPrice === 0 || v.compareAtPrice > Math.max(v.basePrice ?? 0, v.price_egp ?? 0, v.price_sar ?? 0), {
    message: "compareAtPrice must be greater than the selling price",
    path: ["compareAtPrice"],
  });

export const productUpdateSchema = z
  .strictObject({
    sku: z.string().trim().min(1, { message: "sku is required" }).max(64).optional(),
    stock: z.number().int().min(0).max(1e9).optional(),
    ...productCommon,
  })
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" })
  .refine((v) => v.compareAtPrice == null || v.compareAtPrice === 0 || v.basePrice === undefined || v.compareAtPrice > v.basePrice, {
    message: "compareAtPrice must be greater than the selling price",
    path: ["compareAtPrice"],
  });

export const productListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().trim().max(64).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  stock: z.enum(["in", "low", "out"]).optional(),
  sort: z.enum(["newest", "oldest", "name", "price_asc", "price_desc"]).optional(),
});

// ---- categories ----
export const categoryBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  nameAr: z.string().trim().max(120).default(""),
  nameEn: z.string().trim().max(120).default(""),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).default(""),
  imageUrl: z.string().trim().max(2000).default(""),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
}).refine((v) => Boolean(v.name || v.nameAr || v.nameEn), { message: "category name is required", path: ["name"] });

export const categoryUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120).optional(),
    nameAr: z.string().trim().max(120).optional(),
    nameEn: z.string().trim().max(120).optional(),
    slug: z.string().trim().max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    imageUrl: z.string().trim().max(2000).optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

export const reorderSchema = z.strictObject({
  ids: z.array(z.string().trim().min(1).max(64)).min(1).max(500),
});

export const idParamSchema = subdomainParamSchema.extend({ id: z.string().trim().min(1).max(64) });
export const childIdParamSchema = idParamSchema.extend({ childId: z.string().trim().min(1).max(64) });

// ---- orders ----
export const ORDER_STATUSES = [
  "pending",
  "needs_confirmation",
  "confirmed",
  "preparing",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
] as const;

export const PAYMENT_STATUSES = ["unpaid", "paid", "partially_refunded", "refunded", "failed"] as const;

/**
 * Orders in these terminal loss states never count as revenue, discounts or
 * shipping collected. Keep this list in one place so dashboard, reports and
 * exports cannot drift apart.
 */
export const EXCLUDED_REVENUE_STATUSES = ["cancelled", "returned"] as const;

export const orderListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  paymentMethod: z.string().trim().max(80).optional(),
  governorate: z.string().trim().max(120).optional(),
  from: z.string().datetime({ message: "from must be an ISO datetime" }).optional(),
  to: z.string().datetime({ message: "to must be an ISO datetime" }).optional(),
});

export const productIdParamSchema = idParamSchema;
export const orderIdParamSchema = idParamSchema;

export const orderStatusSchema = z.strictObject({ status: z.enum(ORDER_STATUSES) });

/** Valid order status transitions (server-enforced, legacy names kept). */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ["needs_confirmation", "confirmed", "cancelled"],
  needs_confirmation: ["pending", "confirmed", "cancelled"],
  confirmed: ["preparing", "ready_to_ship", "shipped", "cancelled"],
  preparing: ["ready_to_ship", "shipped", "cancelled"],
  ready_to_ship: ["shipped", "out_for_delivery", "cancelled"],
  shipped: ["out_for_delivery", "delivered", "cancelled", "returned"],
  out_for_delivery: ["delivered", "cancelled", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export const bulkOrderStatusSchema = z.strictObject({
  ids: z.array(z.string().trim().min(1).max(64)).min(1).max(200),
  status: z.enum(ORDER_STATUSES),
});

export const merchantOrderBodySchema = z.strictObject({
  customer_name: z.string().trim().min(1, { message: "customer_name is required" }).max(200),
  customer_phone: z.string().trim().max(32).default(""),
  customer_email: z.string().trim().max(254).default(""),
  address: z.string().trim().max(300).default(""),
  city: z.string().trim().max(200).default(""),
  governorate: z.string().trim().max(200).default(""),
  items_summary: z.string().trim().max(1000).default(""),
  amount_text: z.string().trim().max(120).default(""),
  amount_egp: z.number().min(0).max(1e12).default(0),
  payment_method: z.string().trim().max(80).default("COD"),
  status: z.enum(ORDER_STATUSES).default("pending"),
  courier: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(2000).default(""),
  internal_notes: z.string().trim().max(4000).default(""),
});

export const orderNoteSchema = z.strictObject({
  note: z.string().trim().min(1).max(4000),
  internal: z.boolean().default(true),
});

export const orderPaymentStatusSchema = z.strictObject({ paymentStatus: z.enum(PAYMENT_STATUSES) });

/**
 * Payment status is a separate ledger from fulfilment status. A paid order
 * cannot silently become unpaid again; refund states are driven by the refund
 * workflow. Setting the current status is a no-op (idempotent retry).
 */
export const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  unpaid: ["paid", "failed"],
  failed: ["unpaid", "paid"],
  paid: ["refunded"],
  partially_refunded: ["refunded"],
  refunded: [],
};

export const refundSchema = z.strictObject({
  amount: z.number().min(0.01).max(1e12),
  reason: z.string().trim().max(1000).default(""),
});

export const refundProcessSchema = z.strictObject({
  status: z.enum(["processed", "cancelled"]),
});


// ---- checkout / storefront ----
export const checkoutItemSchema = z
  .strictObject({
    sku: z.string().trim().min(1).max(64).optional(),
    variantId: z.string().trim().min(1).max(64).optional(),
    variant_id: z.string().trim().min(1).max(64).optional(),
    qty: z.number().int().min(1).max(99),
  })
  .refine((v) => Boolean(v.sku || v.variantId || v.variant_id), {
    message: "each item requires sku or variantId",
  });

export const checkoutBodySchema = z.strictObject({
  customer_name: z.string().trim().min(1, { message: "customer_name is required" }).max(200),
  customer_phone: z.string().trim().max(32).default(""),
  customer_email: z.string().trim().max(254).default(""),
  address: z.string().trim().max(300).default(""),
  city: z.string().trim().max(200).default(""),
  governorate: z.string().trim().max(200).default(""),
  payment_method: z.string().trim().max(80).default("COD"),
  courier: z.string().trim().max(200).default(""),
  coupon_code: z.string().trim().max(80).default(""),
  shipping_zone_id: z.string().trim().max(64).default(""),
  affiliate_code: z.string().trim().max(80).default(""),
  cart_token: z.string().trim().max(80).default(""),
  notes: z.string().trim().max(2000).default(""),
  items: z.array(checkoutItemSchema).min(1, { message: "at least one item is required" }).max(50),
});

export const couponCodeSchema = z.strictObject({
  code: z.string().trim().min(1).max(80),
  subtotal: z.number().min(0).max(1e12).default(0),
  customer_phone: z.string().trim().max(32).default(""),
});

export const shippingQuoteSchema = z.strictObject({
  governorate: z.string().trim().max(120).default(""),
  city: z.string().trim().max(120).default(""),
  subtotal: z.number().min(0).max(1e12).default(0),
  zoneId: z.string().trim().max(64).default(""),
  payment_method: z.string().trim().max(80).default("COD"),
});

export const cartTrackSchema = z.strictObject({
  cartToken: z.string().trim().min(8).max(80),
  customerName: z.string().trim().max(200).default(""),
  phone: z.string().trim().max(32).default(""),
  email: z.string().trim().max(254).default(""),
  items: z.array(z.strictObject({
    sku: z.string().trim().max(64).default(""),
    variantId: z.string().trim().max(64).default(""),
    qty: z.number().int().min(1).max(99),
  })).max(50),
});

export const publicReviewSchema = z.strictObject({
  productId: z.string().trim().min(1).max(64),
  customerName: z.string().trim().min(1).max(120),
  rating: z.number().int().min(1).max(5),
  content: z.string().trim().min(1).max(3000),
});

// ---- shipping ----
const shippingRateInput = z.strictObject({
  governorate: z.string().trim().max(120).default(""),
  city: z.string().trim().max(120).default(""),
  district: z.string().trim().max(120).default(""),
  fee: z.number().min(0).max(1e9).default(0),
  codFee: z.number().min(0).max(1e9).default(0),
  estimatedDays: z.number().int().min(0).max(90).default(2),
  isActive: z.boolean().default(true),
});

export const shippingZoneBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  governorates: z.array(z.string().trim().max(120)).max(50).default([]),
  cities: z.array(z.string().trim().max(120)).max(200).default([]),
  fee: z.number().min(0).max(1e9).default(0),
  freeShippingThreshold: z.number().min(0).max(1e12).nullable().optional(),
  codFee: z.number().min(0).max(1e9).default(0),
  estimatedDaysMin: z.number().int().min(0).max(90).default(1),
  estimatedDaysMax: z.number().int().min(0).max(90).default(3),
  carrier: z.string().trim().max(200).default(""),
  trackingSupported: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isFallback: z.boolean().default(false),
  rates: z.array(shippingRateInput).max(200).optional(),
});

export const shippingZoneUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120).optional(),
    governorates: z.array(z.string().trim().max(120)).max(50).optional(),
    cities: z.array(z.string().trim().max(120)).max(200).optional(),
    fee: z.number().min(0).max(1e9).optional(),
    freeShippingThreshold: z.number().min(0).max(1e12).nullable().optional(),
    codFee: z.number().min(0).max(1e9).optional(),
    estimatedDaysMin: z.number().int().min(0).max(90).optional(),
    estimatedDaysMax: z.number().int().min(0).max(90).optional(),
    carrier: z.string().trim().max(200).optional(),
    trackingSupported: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isFallback: z.boolean().optional(),
    rates: z.array(shippingRateInput).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

// ---- coupons ----
export const couponBodySchema = z.strictObject({
  code: z.string().trim().toUpperCase().min(2).max(80),
  type: z.enum(["percentage", "fixed", "free_shipping"]).default("percentage"),
  value: z.number().min(0).max(1e12).default(0),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  minOrderValue: z.number().min(0).max(1e12).default(0),
  maxUses: z.number().int().min(1).max(1e9).nullable().optional(),
  perCustomerLimit: z.number().int().min(1).max(1e9).nullable().optional(),
  firstOrderOnly: z.boolean().default(false),
  freeShipping: z.boolean().default(false),
  productIds: z.array(z.string().trim().max(64)).max(500).default([]),
  categoryIds: z.array(z.string().trim().max(64)).max(200).default([]),
  isActive: z.boolean().default(true),
});

export const couponUpdateSchema = z
  .strictObject({
    code: z.string().trim().toUpperCase().min(2).max(80).optional(),
    type: z.enum(["percentage", "fixed", "free_shipping"]).optional(),
    value: z.number().min(0).max(1e12).optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    minOrderValue: z.number().min(0).max(1e12).optional(),
    maxUses: z.number().int().min(1).max(1e9).nullable().optional(),
    perCustomerLimit: z.number().int().min(1).max(1e9).nullable().optional(),
    firstOrderOnly: z.boolean().optional(),
    freeShipping: z.boolean().optional(),
    productIds: z.array(z.string().trim().max(64)).max(500).optional(),
    categoryIds: z.array(z.string().trim().max(64)).max(200).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

// ---- upsells / related ----
export const upsellBodySchema = z.strictObject({
  name: z.string().trim().max(160).default(""),
  triggerProductId: z.string().trim().max(64).nullable().optional(),
  offerProductId: z.string().trim().min(1).max(64),
  discountType: z.enum(["percentage", "fixed"]).default("percentage"),
  discountValue: z.number().min(0).max(1e12).default(0),
  priority: z.number().int().min(0).max(1e6).default(0),
  isActive: z.boolean().default(true),
  placement: z.enum(["cart", "product", "checkout"]).default("cart"),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export const upsellUpdateSchema = z
  .strictObject({
    name: z.string().trim().max(160).optional(),
    triggerProductId: z.string().trim().max(64).nullable().optional(),
    offerProductId: z.string().trim().min(1).max(64).optional(),
    discountType: z.enum(["percentage", "fixed"]).optional(),
    discountValue: z.number().min(0).max(1e12).optional(),
    priority: z.number().int().min(0).max(1e6).optional(),
    isActive: z.boolean().optional(),
    placement: z.enum(["cart", "product", "checkout"]).optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

export const relatedProductBodySchema = z.strictObject({
  productId: z.string().trim().min(1).max(64),
  relatedProductId: z.string().trim().min(1).max(64).optional(),
  relatedProductIds: z.array(z.string().trim().min(1).max(64)).max(30).optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
}).refine((v) => Boolean(v.relatedProductId || v.relatedProductIds?.length), {
  message: "relatedProductId or relatedProductIds is required",
});

export const relatedProductUpdateSchema = z.strictObject({
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

// ---- content ----
const slugField = z.string().trim().min(1).max(160).regex(/^[a-z0-9\u0600-\u06FF-]+$/i, {
  message: "slug may contain letters, numbers and hyphens",
});

export const pageBodySchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  slug: slugField.optional(),
  type: z.enum(["custom", "about", "contact", "faq", "policy", "shipping", "returns"]).default("custom"),
  content: z.string().max(100000).default(""),
  seoTitle: z.string().trim().max(200).default(""),
  seoDescription: z.string().trim().max(400).default(""),
  status: z.enum(["draft", "published"]).default("draft"),
  publishNow: z.boolean().default(false),
});

export const pageUpdateSchema = pageBodySchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: "at least one field must be provided",
});

export const blogBodySchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  slug: slugField.optional(),
  excerpt: z.string().trim().max(1000).default(""),
  author: z.string().trim().max(120).default(""),
  featuredImage: z.string().trim().max(2000).default(""),
  content: z.string().max(100000).default(""),
  categories: z.array(z.string().trim().max(80)).max(20).default([]),
  tags: z.array(z.string().trim().max(80)).max(50).default([]),
  seoTitle: z.string().trim().max(200).default(""),
  seoDescription: z.string().trim().max(400).default(""),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export const blogUpdateSchema = blogBodySchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: "at least one field must be provided",
});

export const affiliateBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(32).default(""),
  email: z.string().trim().max(254).default(""),
  referralCode: z.string().trim().toUpperCase().min(3).max(40).optional(),
  commissionRate: z.number().min(0).max(100).default(5),
  isActive: z.boolean().default(true),
});

export const affiliateUpdateSchema = affiliateBodySchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: "at least one field must be provided",
});

export const reviewUpdateSchema = z.strictObject({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  merchantReply: z.string().trim().max(4000).optional(),
  reported: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

// ---- loyalty / dropshipping ----
export const loyaltyRuleBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  type: z.enum(["earn", "redeem"]).default("earn"),
  points: z.number().int().min(1).max(1e9).default(1),
  perAmount: z.number().min(0).max(1e12).default(1),
  minOrderValue: z.number().min(0).max(1e12).default(0),
  isActive: z.boolean().default(true),
});

export const loyaltyAdjustSchema = z.strictObject({
  customerId: z.string().trim().min(1).max(64),
  points: z.number().int().min(-1e9).max(1e9),
  note: z.string().trim().max(500).default(""),
});

export const supplierBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  contactName: z.string().trim().max(160).default(""),
  email: z.string().trim().max(254).default(""),
  phone: z.string().trim().max(32).default(""),
  integrationKey: z.string().trim().max(120).nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: z.string().trim().max(2000).default(""),
});

export const supplierUpdateSchema = supplierBodySchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });


export const dropshipProductBodySchema = z.strictObject({
  productId: z.string().trim().min(1).max(64),
  supplierId: z.string().trim().min(1).max(64),
  costPrice: z.number().min(0).max(1e12).default(0),
  suggestedPrice: z.number().min(0).max(1e12).default(0),
  fulfillmentStatus: z.enum(["manual", "imported", "fulfilled", "cancelled"]).default("manual"),
});

export const dropshipProductUpdateSchema = z.strictObject({
  supplierId: z.string().trim().min(1).max(64).optional(),
  costPrice: z.number().min(0).max(1e12).optional(),
  suggestedPrice: z.number().min(0).max(1e12).optional(),
  fulfillmentStatus: z.enum(["manual", "imported", "fulfilled", "cancelled"]).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

// ---- cursor/customer/general ----
export const customerListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  hasOrders: z.enum(["true", "false"]).optional(),
});

export const customerUpdateSchema = z
  .strictObject({
    name: z.string().trim().max(160).optional(),
    phone: z.string().trim().max(32).optional(),
    email: z.string().trim().max(254).optional(),
    notes: z.string().trim().max(4000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

export const addressBodySchema = z.strictObject({
  label: z.string().trim().max(80).default(""),
  address: z.string().trim().max(300).default(""),
  city: z.string().trim().max(120).default(""),
  governorate: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(32).default(""),
  isDefault: z.boolean().default(false),
});

export const paginationQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export const abandonedCartUpdateSchema = z.strictObject({
  recoveryStatus: z.enum(["open", "reminded", "recovered", "ignored"]),
});

// ---- onboarding / settings ----
export const onboardingBrandingSchema = z.strictObject({
  logoUrl: z.string().trim().max(2000).optional(),
  coverUrl: z.string().trim().max(2000).optional(),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  textColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  themeMode: z.enum(["light", "dark", "system"]).optional(),
  arabicFont: z.enum(["Cairo", "IBM Plex Sans Arabic", "Tajawal", "Almarai"]).optional(),
  templateKey: z.enum(["fashion", "electronics", "restaurant", "beauty", "general", "services"]).optional(),
  heroConfig: z.record(z.string(), z.unknown()).optional(),
  homepageSections: z.array(z.record(z.string(), z.unknown())).max(30).optional(),
});

export const onboardingPatchSchema = z.strictObject({
  step: z.number().int().min(1).max(5).optional(),
  storeName: z.string().trim().min(2).max(120).optional(),
  subdomain: registerSubdomainField.optional(),
  businessType: z.enum(["fashion", "electronics", "restaurant", "beauty", "furniture", "digital", "services", "other"]).optional(),
  description: z.string().trim().max(3000).optional(),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  governorate: z.string().trim().max(120).optional(),
  currency: storeCurrencyField.optional(),
  primaryLanguage: z.enum(["ar", "en"]).optional(),
  timeZone: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(32).optional(),
  whatsapp: z.string().trim().max(32).optional(),
  returnPolicy: z.string().trim().max(3000).optional(),
  codEnabled: z.boolean().optional(),
  onlinePaymentEnabled: z.boolean().optional(),
  templateKey: z.enum(["fashion", "electronics", "restaurant", "beauty", "general", "services"]).optional(),
  branding: onboardingBrandingSchema.optional(),
  selling: z.strictObject({
    whatsapp: z.string().trim().max(32).optional(),
    returnPolicy: z.string().trim().max(3000).optional(),
    codEnabled: z.boolean().optional(),
    onlinePaymentEnabled: z.boolean().optional(),
    shipping: z.strictObject({
      governorates: z.array(z.string().trim().max(120)).max(50).optional(),
      fee: z.number().min(0).max(1e9).optional(),
      freeShippingThreshold: z.number().min(0).max(1e12).nullable().optional(),
    }).optional(),
  }).optional(),
});

export const notificationPrefsSchema = z.strictObject({
  newOrders: z.boolean().optional(),
  lowStock: z.boolean().optional(),
  abandonedCarts: z.boolean().optional(),
  reviews: z.boolean().optional(),
  marketing: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "at least one preference is required" });

export const domainBodySchema = z.strictObject({
  domain: z.string().trim().toLowerCase().min(3).max(253).regex(
    /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/,
    { message: "enter a valid domain such as shop.example.com" }
  ),
});

export const teamBodySchema = z.strictObject({
  name: z.string().trim().max(160).default(""),
  email: emailField,
  role: z.enum(["admin", "manager", "staff", "viewer"]).default("staff"),
});

export const teamUpdateSchema = z.strictObject({
  role: z.enum(["admin", "manager", "staff", "viewer"]).optional(),
  status: z.enum(["invited", "active", "suspended"]).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

// ---- team authentication ----
export const teamAcceptSchema = z.strictObject({
  token: z.string().trim().min(20).max(200),
  password: passwordField,
  name: z.string().trim().max(160).optional(),
});

export const teamLoginSchema = z.strictObject({
  email: emailField,
  password: z.string().min(1).max(128),
});

export const teamInviteTokenParamSchema = z.strictObject({
  token: z.string().trim().min(20).max(200),
});

// ---- platform-admin authentication ----
export const adminLoginSchema = z.strictObject({
  email: emailField,
  password: z.string().min(1).max(128),
  totp: z.string().trim().max(16).optional(),
  recovery_code: z.string().trim().max(64).optional(),
});

export const adminPasswordSchema = changePasswordSchema;

export const adminTwoFactorSetupSchema = twoFactorSetupSchema;
export const adminTwoFactorCodeSchema = twoFactorCodeSchema;
export const adminTwoFactorDisableSchema = twoFactorDisableSchema;

// ---- wallet deposits ----
export const walletDepositSchema = z.strictObject({
  amount: z.number().finite().min(1).max(1_000_000),
  reference: z.string().trim().max(200).default(""),
  note: z.string().trim().max(1000).default(""),
  method: z.enum(["bank_transfer", "instapay", "vodafone_cash", "wallet", "other"]).default("bank_transfer"),
});

export const adminWalletReviewSchema = z.strictObject({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).default(""),
});

// ---- support desk ----
export const supportTicketSchema = z.strictObject({
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(3).max(5000),
  category: z.enum(["billing", "technical", "domains", "account", "other"]).default("other"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export const adminSupportUpdateSchema = z.strictObject({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  resolution: z.string().trim().max(3000).optional(),
  assignToMe: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

// ---- admin-managed records ----
export const featureFlagUpdateSchema = z.strictObject({
  enabled: z.boolean(),
});

export const adminDomainReviewSchema = z.strictObject({
  verified: z.boolean(),
  note: z.string().trim().max(1000).default(""),
});

export const adminDomainTlsSchema = z.strictObject({
  status: z.enum(["pending", "active", "failed"]),
  error: z.string().trim().max(1000).default(""),
});

export const publishingActionSchema = z.strictObject({
  action: z.enum(["publish", "unpublish"]),
  reason: z.string().trim().max(1000).default(""),
});

export const reportsRangeQuerySchema = z.strictObject({
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
});

export const deleteAccountSchema = z.strictObject({
  password: z.string().min(1).max(128),
  confirmation: z.literal("DELETE"),
});

export const storeUpdateSchema = z
  .strictObject({
    storeName: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(32).optional(),
    countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, { message: "countryCode must be a 2-letter code" }).optional(),
    storeCurrency: storeCurrencyField.optional(),
    description: z.string().trim().max(3000).optional(),
    supportEmail: z.string().trim().max(254).optional(),
    seoTitle: z.string().trim().max(200).optional(),
    seoDescription: z.string().trim().max(400).optional(),
    whatsapp: z.string().trim().max(32).optional(),
    codEnabled: z.boolean().optional(),
    onlinePaymentEnabled: z.boolean().optional(),
    primaryLanguage: z.enum(["ar", "en"]).optional(),
    timeZone: z.string().trim().max(80).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

export const leadBodySchema = z.strictObject({
  type: z.string().trim().min(1, { message: "type is required" }).max(64),
  payload: z.unknown().default({}).refine(
    (v) => {
      if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
      const keys = Object.keys(v);
      if (keys.length > 64) return false;
      try {
        return JSON.stringify(v).length <= 8192;
      } catch {
        return false;
      }
    },
    { message: "payload must be a JSON object with at most 64 keys and 8KB serialized" }
  ),
});

// ---- platform admin / subscription billing / analytics ----
export const adminIdParamSchema = z.strictObject({
  id: z.string().trim().min(1).max(64),
});

const safeMediaUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("/uploads/") || /^data:image\//i.test(v),
    { message: "must be an http(s), /uploads/ or image data URL" }
  );

export const adminStoreSettingsSchema = z
  .strictObject({
    storeName: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(3000).optional(),
    logoUrl: safeMediaUrl.optional(),
    coverUrl: safeMediaUrl.optional(),
    primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    secondaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    textColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    themeMode: z.enum(["light", "dark", "system"]).optional(),
    arabicFont: z.enum(["Cairo", "IBM Plex Sans Arabic", "Tajawal", "Almarai"]).optional(),
    templateKey: z.enum(["fashion", "electronics", "restaurant", "beauty", "general", "services"]).optional(),
    seoTitle: z.string().trim().max(200).optional(),
    seoDescription: z.string().trim().max(400).optional(),
    supportEmail: z.string().trim().max(254).optional(),
    whatsapp: z.string().trim().max(32).optional(),
    phone: z.string().trim().max(32).optional(),
    countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

export const adminStoreReviewSchema = z.strictObject({
  note: z.string().trim().max(1000).default(""),
});

export const subscriptionPaymentSchema = z.strictObject({
  plan: z.enum(["monthly", "annual"]),
  method: z.enum(["bank_transfer", "instapay", "vodafone_cash", "wallet", "other"]).default("bank_transfer"),
  reference: z.string().trim().min(3).max(200),
  payerName: z.string().trim().max(160).default(""),
  note: z.string().trim().max(1000).default(""),
});

export const adminSubscriptionReviewSchema = z.strictObject({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).default(""),
});

export const storefrontVisitSchema = z.strictObject({
  path: z.string().trim().max(300).default("/"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

function toDetails(issues: z.core.$ZodIssue[]) {
  return issues.map((i) => ({
    path: (i.path ?? []).join("."),
    message: i.message,
    code: i.code,
  }));
}

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = (schema as unknown as z.ZodType).safeParse(req.body ?? {});
    if (!result.success) {
      next(new ApiError(400, "VALIDATION_ERROR", "Invalid request body.", toDetails(result.error.issues)));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = (schema as unknown as z.ZodType).safeParse(req.params ?? {});
    if (!result.success) {
      next(new ApiError(400, "VALIDATION_ERROR", "Invalid request params.", toDetails(result.error.issues)));
      return;
    }
    req.params = result.data as Request["params"];
    next();
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = (schema as unknown as z.ZodType).safeParse(req.query ?? {});
    if (!result.success) {
      next(new ApiError(400, "VALIDATION_ERROR", "Invalid query params.", toDetails(result.error.issues)));
      return;
    }
    req.query = result.data as Request["query"];
    next();
  };
}
