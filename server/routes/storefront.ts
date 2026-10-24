import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import {
  cartTrackSchema,
  checkoutBodySchema,
  couponCodeSchema,
  publicReviewSchema,
  shippingQuoteSchema,
  storefrontVisitSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../validate.js";
import { cartLimiter, publicWriteLimiter, trackingLookupLimiter, visitLimiter } from "../middleware.js";
import { createCheckout, quoteShipping, resolveCheckoutLines, validateCoupon } from "../services/checkout.js";
import { paymentService, whatsappLink } from "../services/integrations.js";
import { createTrackingToken, trackingUrl, verifyTrackingToken } from "../services/tracking.js";
import { normalizePhone } from "../identity.js";
import { maskPhone } from "../privacy.js";

export const storefrontRouter = Router();

const productListQuery = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(160).optional(),
  sort: z.enum(["newest", "oldest", "price_asc", "price_desc", "name"]).default("newest"),
  featured: z.enum(["true", "false"]).optional(),
  minPrice: z.coerce.number().min(0).max(1e12).optional(),
  maxPrice: z.coerce.number().min(0).max(1e12).optional(),
});

const productInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
  options: { orderBy: { position: "asc" as const }, include: { values: { orderBy: { position: "asc" as const } } } },
  variants: { where: { isActive: true }, orderBy: { sku: "asc" as const } },
  category: { select: { id: true, name: true, nameAr: true, nameEn: true, slug: true } },
};

function productPrice(product: { priceEgp: number; priceSar: number; basePrice: number }, currency: string) {
  if (currency === "EGP") return product.priceEgp || product.basePrice;
  if (currency === "SAR") return product.priceSar || product.basePrice;
  return product.basePrice;
}

type PublicVariant = {
  id: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  optionValues: unknown;
  imageUrl: string;
  isActive: boolean;
};

/**
 * Whitelist the fields a shopper is allowed to see. Merchant-only columns such
 * as costPrice, barcode, lowStockThreshold and internal status must never leak
 * through the public catalog.
 */
function publicProduct(product: Record<string, unknown>, currency: string) {
  const p = product as unknown as {
    id: string;
    sku: string;
    slug: string;
    nameAr: string;
    nameEn: string;
    descriptionAr: string;
    descriptionEn: string;
    shortDescriptionAr: string;
    shortDescriptionEn: string;
    seoTitle: string;
    seoDescription: string;
    isFeatured: boolean;
    stock: number;
    basePrice: number;
    priceEgp: number;
    priceSar: number;
    compareAtPrice: number | null;
    images?: unknown[];
    options?: unknown[];
    variants?: PublicVariant[];
    category?: unknown;
    reviews?: unknown[];
  };
  const variants = (p.variants ?? []).map((v) => ({
    id: v.id,
    sku: v.sku,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    stock: v.stock,
    optionValues: v.optionValues,
    imageUrl: v.imageUrl,
    isActive: v.isActive,
  }));
  const variantStock = variants.reduce((s, v) => s + v.stock, 0);
  const basePrice = productPrice(p, currency);
  // A zero variant price means "inherit the product price", matching checkout.
  const variantPrices = variants.map((v) => (v.price > 0 ? v.price : basePrice));
  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    descriptionAr: p.descriptionAr,
    descriptionEn: p.descriptionEn,
    shortDescriptionAr: p.shortDescriptionAr,
    shortDescriptionEn: p.shortDescriptionEn,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    isFeatured: p.isFeatured,
    stock: p.stock,
    basePrice,
    compareAtPrice: p.compareAtPrice,
    displayPrice: variantPrices.length ? Math.min(...variantPrices) : basePrice,
    inStock: variants.length ? variantStock > 0 : p.stock > 0,
    totalStock: variants.length ? variantStock : p.stock,
    images: p.images ?? [],
    options: p.options ?? [],
    variants,
    category: p.category ?? null,
    ...(p.reviews ? { reviews: p.reviews } : {}),
  };
}

async function activeStore(subdomain: string) {
  const store = await prisma.store.findUnique({
    where: { subdomain },
    include: { branding: true },
  });
  if (!store || store.status !== "active") throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  return store;
}

function storefrontSettings(store: {
  id: string;
  storeName: string;
  subdomain: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  whatsapp: string;
  currency: string;
  countryCode: string;
  primaryLanguage: string;
  templateKey: string;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  seoTitle: string;
  seoDescription: string;
  supportEmail: string;
  returnPolicy: string;
}) {
  return {
    id: store.id,
    store_name: store.storeName,
    subdomain: store.subdomain,
    description: store.description,
    logo_url: store.logoUrl,
    cover_url: store.coverUrl,
    whatsapp_url: store.whatsapp ? whatsappLink(store.whatsapp) : "",
    currency: store.currency,
    country_code: store.countryCode,
    language: store.primaryLanguage,
    template: store.templateKey,
    cod_enabled: store.codEnabled,
    online_payment_enabled: store.onlinePaymentEnabled && paymentService.configured,
    seo: { title: store.seoTitle || store.storeName, description: store.seoDescription || store.description },
    support_email: store.supportEmail,
    return_policy: store.returnPolicy,
  };
}

storefrontRouter.get(
  "/api/storefront/:subdomain",
  validateParams(subdomainParamSchema),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const [categories, featured, pages, zones] = await prisma.$transaction([
      prisma.category.findMany({
        where: { storeId: store.id, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { _count: { select: { products: { where: { status: "active" } } } } },
      }),
      prisma.product.findMany({
        where: { storeId: store.id, status: "active" },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: 8,
        include: productInclude,
      }),
      prisma.page.findMany({
        where: { storeId: store.id, status: "published" },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, slug: true, type: true },
      }),
      prisma.shippingZone.findMany({
        where: { storeId: store.id, isActive: true },
        orderBy: [{ isFallback: "desc" }, { createdAt: "asc" }],
      }),
    ]);
    res.json({
      store: storefrontSettings(store),
      branding: store.branding,
      categories,
      featured_products: featured.map((p) => publicProduct(p as Record<string, unknown>, store.currency)),
      pages,
      shipping_zones: zones.map((z) => ({
        id: z.id,
        name: z.name,
        governorates: z.governorates,
        cities: z.cities,
        fee: z.fee,
        cod_fee: z.codFee,
        free_shipping_threshold: z.freeShippingThreshold,
        estimated_days_min: z.estimatedDaysMin,
        estimated_days_max: z.estimatedDaysMax,
      })),
      payments: {
        cod_enabled: store.codEnabled,
        online_enabled: store.onlinePaymentEnabled && paymentService.configured,
      },
      published: store.onboardingCompleted,
    });
  })
);

storefrontRouter.post(
  "/api/storefront/:subdomain/visit",
  visitLimiter,
  validateParams(subdomainParamSchema),
  validateBody(storefrontVisitSchema),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    // Only a published storefront counts as a visit; the coming-soon page is
    // not a customer visit. No IP address or user agent is persisted.
    if (store.onboardingCompleted) {
      const path = String(req.body.path || "/").split("?")[0].slice(0, 300) || "/";
      await prisma.storeVisit.create({
        data: { id: newId("visit_"), storeId: store.id, path },
      });
    }
    res.status(204).end();
  })
);

storefrontRouter.get(
  "/api/storefront/:subdomain/products",
  validateParams(subdomainParamSchema),
  validateQuery(productListQuery),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const { page, pageSize, search, category, sort, featured, minPrice, maxPrice } = req.query as unknown as {
      page: number;
      pageSize: number;
      search?: string;
      category?: string;
      sort: string;
      featured?: string;
      minPrice?: number;
      maxPrice?: number;
    };
    const where: Prisma.ProductWhereInput = { storeId: store.id, status: "active" };
    if (search) {
      where.OR = [
        { nameAr: { contains: search } },
        { nameEn: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { descriptionAr: { contains: search } },
      ];
    }
    if (category) where.category = { slug: category, isActive: true };
    if (featured === "true") where.isFeatured = true;
    const priceField = store.currency === "SAR" ? "priceSar" : "priceEgp";
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceRange = {
        ...(minPrice !== undefined ? { gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
      };
      if (priceField === "priceSar") where.priceSar = priceRange;
      else where.priceEgp = priceRange;
    }
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === "oldest" ? { createdAt: "asc" } :
      sort === "name" ? { nameAr: "asc" } :
      sort === "price_asc" ? (priceField === "priceSar" ? { priceSar: "asc" } : { priceEgp: "asc" }) :
      sort === "price_desc" ? (priceField === "priceSar" ? { priceSar: "desc" } : { priceEgp: "desc" }) :
      { createdAt: "desc" };
    const [total, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: productInclude,
      }),
    ]);
    res.json({
      products: products.map((p) => publicProduct(p as Record<string, unknown>, store.currency)),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      currency: store.currency,
    });
  })
);

storefrontRouter.get(
  "/api/storefront/:subdomain/products/:slug",
  validateParams(subdomainParamSchema.extend({ slug: z.string().trim().min(1).max(200) })),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const product = await prisma.product.findFirst({
      where: {
        storeId: store.id,
        status: "active",
        OR: [{ slug: req.params.slug }, { id: req.params.slug }],
      },
      include: {
        ...productInclude,
        reviews: {
          where: { status: "approved" },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        relatedFrom: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: { relatedProduct: { include: productInclude } },
        },
      },
    });
    if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    const reviewAgg = await prisma.review.aggregate({
      where: { storeId: store.id, productId: product.id, status: "approved" },
      _avg: { rating: true },
      _count: { _all: true },
    });
    res.json({
      product: {
        ...publicProduct(product as unknown as Record<string, unknown>, store.currency),
        review_summary: {
          average: Math.round((reviewAgg._avg.rating ?? 0) * 10) / 10,
          count: reviewAgg._count._all,
        },
        related_products: product.relatedFrom.map((r) =>
          publicProduct(r.relatedProduct as unknown as Record<string, unknown>, store.currency)
        ),
      },
      store: storefrontSettings(store),
      branding: store.branding,
    });
  })
);

storefrontRouter.get(
  "/api/storefront/:subdomain/categories",
  validateParams(subdomainParamSchema),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const categories = await prisma.category.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { products: { where: { status: "active" } } } } },
    });
    res.json({ categories });
  })
);

storefrontRouter.get(
  "/api/storefront/:subdomain/pages/:slug",
  validateParams(subdomainParamSchema.extend({ slug: z.string().trim().min(1).max(200) })),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const page = await prisma.page.findFirst({
      where: { storeId: store.id, slug: req.params.slug, status: "published" },
    });
    if (!page) throw new ApiError(404, "PAGE_NOT_FOUND", "Page not found.");
    res.json({ page, store: storefrontSettings(store) });
  })
);

storefrontRouter.get(
  "/api/storefront/:subdomain/blog",
  validateParams(subdomainParamSchema),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const now = new Date();
    const posts = await prisma.blogPost.findMany({
      where: {
        storeId: store.id,
        OR: [{ status: "published" }, { status: "scheduled", scheduledAt: { lte: now } }],
      },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        author: true,
        featuredImage: true,
        categories: true,
        tags: true,
        publishedAt: true,
        createdAt: true,
      },
    });
    res.json({ posts });
  })
);

storefrontRouter.get(
  "/api/storefront/:subdomain/blog/:slug",
  validateParams(subdomainParamSchema.extend({ slug: z.string().trim().min(1).max(200) })),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const now = new Date();
    const post = await prisma.blogPost.findFirst({
      where: {
        storeId: store.id,
        slug: req.params.slug,
        OR: [{ status: "published" }, { status: "scheduled", scheduledAt: { lte: now } }],
      },
    });
    if (!post) throw new ApiError(404, "POST_NOT_FOUND", "Post not found.");
    res.json({ post, store: storefrontSettings(store) });
  })
);

storefrontRouter.get(
  "/api/storefront/:subdomain/reviews/:productId",
  validateParams(subdomainParamSchema.extend({ productId: z.string().trim().min(1).max(64) })),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const reviews = await prisma.review.findMany({
      where: { storeId: store.id, productId: req.params.productId, status: "approved" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, customerName: true, rating: true, content: true, merchantReply: true, createdAt: true },
    });
    res.json({ reviews });
  })
);

storefrontRouter.post(
  "/api/storefront/:subdomain/reviews",
  publicWriteLimiter,
  validateParams(subdomainParamSchema),
  validateBody(publicReviewSchema),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const b = req.body as { productId: string; customerName: string; rating: number; content: string };
    const product = await prisma.product.findFirst({ where: { id: b.productId, storeId: store.id }, select: { id: true } });
    if (!product) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    const review = await prisma.review.create({
      data: {
        id: newId("rev_"),
        storeId: store.id,
        productId: b.productId,
        customerName: b.customerName,
        rating: b.rating,
        content: b.content,
        status: "pending",
      },
    });
    res.status(201).json({
      review,
      note: "تم استلام تقييمك وسيظهر بعد مراجعة المتجر.",
    });
  })
);

storefrontRouter.post(
  "/api/storefront/:subdomain/coupon",
  publicWriteLimiter,
  validateParams(subdomainParamSchema),
  validateBody(couponCodeSchema),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const { code, subtotal, customer_phone } = req.body as { code: string; subtotal: number; customer_phone: string };
    const result = await validateCoupon({ storeId: store.id, code, subtotal, customerPhone: customer_phone });
    res.json({ valid: true, coupon: result });
  })
);

storefrontRouter.post(
  "/api/storefront/:subdomain/shipping-quote",
  publicWriteLimiter,
  validateParams(subdomainParamSchema),
  validateBody(shippingQuoteSchema),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const b = req.body as {
      governorate: string;
      city: string;
      subtotal: number;
      zoneId: string;
      payment_method: string;
    };
    const quote = await quoteShipping({
      storeId: store.id,
      zoneId: b.zoneId || undefined,
      governorate: b.governorate,
      city: b.city,
      subtotal: b.subtotal,
      paymentMethod: b.payment_method,
    });
    res.json({ quote, currency: store.currency });
  })
);

storefrontRouter.post(
  "/api/storefront/:subdomain/cart",
  cartLimiter,
  validateParams(subdomainParamSchema),
  validateBody(cartTrackSchema),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const b = req.body as {
      cartToken: string;
      customerName: string;
      phone: string;
      email: string;
      items: Array<{ sku: string; variantId: string; qty: number }>;
    };
    const phone = normalizePhone(b.phone);
    const email = b.email.trim().toLowerCase();
    // An empty cart is only useful as a recovery lead when the shopper left a
    // contact signal. Anything else is anonymous table flooding.
    if (b.items.length === 0 && !phone && !email) {
      throw new ApiError(
        400,
        "CART_EMPTY",
        "Provide at least one item or a phone/email so the cart can be recovered."
      );
    }
    let lines: Array<{ sku: string; name: string; qty: number; price: number; image: string }> = [];
    let cartValue = 0;
    try {
      const resolved = await resolveCheckoutLines({
        storeId: store.id,
        currency: store.currency,
        items: b.items.map((i) => ({ sku: i.sku || undefined, variantId: i.variantId || undefined, qty: i.qty })),
      });
      lines = resolved.map((l) => ({ sku: l.sku, name: l.name, qty: l.qty, price: l.unitPrice, image: l.imageUrl }));
      cartValue = resolved.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    } catch {
      // Unknown or unpriced items are ignored; the cart value is always
      // derived from this store's real catalog.
      lines = [];
      cartValue = 0;
    }
    const cart = await prisma.abandonedCart.upsert({
      where: { storeId_cartToken: { storeId: store.id, cartToken: b.cartToken } },
      create: {
        id: newId("cart_"),
        storeId: store.id,
        cartToken: b.cartToken,
        customerName: b.customerName,
        phone,
        email,
        items: lines as unknown as Prisma.InputJsonValue,
        cartValue,
        recoveryStatus: "open",
      },
      update: {
        customerName: b.customerName,
        phone,
        email,
        items: lines as unknown as Prisma.InputJsonValue,
        cartValue,
        lastActivityAt: new Date(),
        recoveryStatus: "open",
      },
    });
    res.json({ cart: { id: cart.id, cartValue: cart.cartValue, lastActivityAt: cart.lastActivityAt } });
  })
);

storefrontRouter.get(
  "/api/storefront/:subdomain/orders/:orderNumber",
  trackingLookupLimiter,
  validateParams(subdomainParamSchema.extend({ orderNumber: z.string().regex(/^\d+$/) })),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const orderNumber = Number(req.params.orderNumber);
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    const phone = normalizePhone(typeof req.query.phone === "string" ? req.query.phone : "");

    if (!token && !phone) {
      throw new ApiError(
        400,
        "TRACKING_REQUIRED",
        "Provide the signed tracking token from your confirmation page or the phone number used for the order."
      );
    }

    const publicSelect = {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      amountText: true,
      amountEgp: true,
      customerName: true,
      customerPhone: true,
      createdAt: true,
      items: {
        select: {
          name: true,
          qty: true,
          unitPriceEgp: true,
          imageUrl: true,
          variantLabel: true,
          sku: true,
        },
      },
    } as const;

    let order;
    if (token) {
      const verified = verifyTrackingToken(token, { storeId: store.id, orderNumber });
      if (!verified) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
      order = await prisma.order.findFirst({
        where: { id: verified.orderId, storeId: store.id, orderNumber },
        select: publicSelect,
      });
    } else {
      order = await prisma.order.findFirst({
        where: { storeId: store.id, orderNumber, customerPhone: phone },
        select: publicSelect,
      });
    }
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");

    // The order id is never exposed, and the phone is masked in the response.
    // A fresh signed token lets the customer revisit without a phone number
    // in the URL or browser history.
    const { id: orderId, customerPhone, ...publicOrder } = order;
    const freshToken = createTrackingToken({ orderId, storeId: store.id, orderNumber });
    res.json({
      order: { ...publicOrder, customerPhone: maskPhone(customerPhone) },
      tracking_token: freshToken,
      tracking_url: trackingUrl({ subdomain: store.subdomain, orderNumber, token: freshToken }),
      store: storefrontSettings(store),
    });
  })
);

// Public checkout keeps the legacy URL used by existing clients and tests.
storefrontRouter.post(
  "/api/stores/:subdomain/checkout",
  publicWriteLimiter,
  validateParams(subdomainParamSchema),
  validateBody(checkoutBodySchema),
  asyncHandler(async (req, res) => {
    const store = await activeStore(req.params.subdomain);
    const rawKey = req.get("Idempotency-Key")?.trim() || "";
    if (rawKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(rawKey)) {
      throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 8-128 URL-safe characters.");
    }
    const result = await createCheckout({
      storeId: store.id,
      store,
      body: req.body,
      idempotencyKey: rawKey || undefined,
    });
    res.status(201).json({
      order: result.order,
      shipping: result.shipping,
      whatsapp_url: result.whatsapp_url,
      tracking_token: result.tracking_token,
      tracking_url: result.tracking_url,
    });
  })
);
