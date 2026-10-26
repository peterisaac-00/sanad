import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError } from "../errors.js";
import { allocateOrderNumber } from "./orders.js";
import { paymentService, whatsappLink } from "./integrations.js";
import { canonicalAddressKey, customerIdentity, normalizePhone } from "../identity.js";
import { createTrackingToken, trackingUrl } from "./tracking.js";

export interface CheckoutItemInput {
  sku?: string;
  variantId?: string;
  qty: number;
}

export interface ResolvedLine {
  productId: string;
  variantId: string | null;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  imageUrl: string;
  variantLabel: string;
}

export interface CouponResult {
  couponId: string;
  code: string;
  discount: number;
  freeShipping: boolean;
}

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Transaction-scoped PostgreSQL advisory lock. Locks are released
 * automatically on commit/rollback, which makes them safe for serialising
 * coupon redemption and customer creation without a global table lock.
 */
async function advisoryLock(tx: Prisma.TransactionClient, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

function priceOf(
  product: { priceEgp: number; priceSar: number },
  currency: string,
  sku: string
): number {
  const column = currency === "EGP" ? product.priceEgp : null;
  if (column === null) {
    throw new ApiError(
      400,
      "CHECKOUT_CURRENCY_UNSUPPORTED",
      `Checkout supports EGP-priced catalogs; this store uses ${currency}.`
    );
  }
  if (!(column > 0)) {
    throw new ApiError(400, "PRODUCT_NOT_PRICED", `Product ${sku} has no ${currency} price.`, { sku });
  }
  return column;
}

/** Merge duplicate lines by variant/SKU so stock can never be split to oversell. */
export function mergeItems(items: CheckoutItemInput[]): CheckoutItemInput[] {
  const merged = new Map<string, CheckoutItemInput>();
  for (const item of items) {
    const key = item.variantId ? `v:${item.variantId}` : `s:${item.sku}`;
    const existing = merged.get(key);
    if (existing) existing.qty += item.qty;
    else merged.set(key, { ...item });
  }
  return [...merged.values()];
}

export async function resolveCheckoutLines(input: {
  storeId: string;
  currency: string;
  items: CheckoutItemInput[];
}): Promise<ResolvedLine[]> {
  const items = mergeItems(input.items);
  if (!items.length) throw new ApiError(400, "VALIDATION_ERROR", "At least one item is required.");

  const skus = items.filter((i) => !i.variantId && i.sku).map((i) => i.sku!);
  const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId!);

  const [products, variants] = await Promise.all([
    prisma.product.findMany({
      where: {
        storeId: input.storeId,
        ...(skus.length ? { sku: { in: skus } } : { id: "__none__" }),
      },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, variants: true },
    }),
    prisma.productVariant.findMany({
      where: {
        storeId: input.storeId,
        ...(variantIds.length ? { id: { in: variantIds } } : { id: "__none__" }),
      },
      include: { product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } } },
    }),
  ]);

  const bySku = new Map(products.map((p) => [p.sku, p]));
  const byVariant = new Map(variants.map((v) => [v.id, v]));
  const missing = items
    .filter((i) => (i.variantId ? !byVariant.has(i.variantId) : !i.sku || !bySku.has(i.sku)))
    .map((i) => i.variantId ?? i.sku ?? "unknown");
  if (missing.length) {
    throw new ApiError(400, "UNKNOWN_SKU", `Unknown product(s): ${missing.join(", ")}.`, { missing });
  }

  const lines: ResolvedLine[] = [];
  const short: string[] = [];
  for (const item of items) {
    if (item.variantId) {
      const variant = byVariant.get(item.variantId)!;
      if (!variant.isActive) throw new ApiError(400, "UNKNOWN_SKU", `Unknown product(s): ${item.variantId}.`);
      if (variant.stock < item.qty) short.push(variant.sku);
      const unit =
        variant.price > 0
          ? variant.price
          : priceOf(variant.product, input.currency, variant.sku);
      const label = Object.entries((variant.optionValues ?? {}) as Record<string, string>)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" / ");
      lines.push({
        productId: variant.productId,
        variantId: variant.id,
        sku: variant.sku,
        name: variant.product.nameAr || variant.product.nameEn || variant.sku,
        qty: item.qty,
        unitPrice: unit,
        imageUrl: variant.imageUrl || variant.product.images[0]?.url || "",
        variantLabel: label,
      });
    } else {
      const product = bySku.get(item.sku!)!;
      if (product.variants.some((variant) => variant.isActive)) {
        throw new ApiError(
          400,
          "VARIANT_REQUIRED",
          `Product ${product.sku} requires a variant selection.`,
          { sku: product.sku }
        );
      }
      if (product.stock < item.qty) short.push(product.sku);
      lines.push({
        productId: product.id,
        variantId: null,
        sku: product.sku,
        name: product.nameAr || product.nameEn || product.sku,
        qty: item.qty,
        unitPrice: priceOf(product, input.currency, product.sku),
        imageUrl: product.images[0]?.url || "",
        variantLabel: "",
      });
    }
  }
  if (short.length) {
    throw new ApiError(409, "INSUFFICIENT_STOCK", `Not enough stock for: ${short.join(", ")}.`, { short });
  }
  return lines;
}

export async function validateCoupon(
  input: {
    storeId: string;
    code: string;
    subtotal: number;
    customerPhone?: string;
    customerEmail?: string;
    lines?: Array<{ productId: string; categoryId?: string | null; qty: number; unitPrice: number }>;
  },
  db: Db = prisma
): Promise<CouponResult | null> {
  const code = input.code.trim().toUpperCase();
  if (!code) return null;
  const coupon = await db.coupon.findUnique({ where: { storeId_code: { storeId: input.storeId, code } } });
  if (!coupon || !coupon.isActive) throw new ApiError(400, "COUPON_INVALID", "كود الخصم غير صالح.");
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new ApiError(400, "COUPON_NOT_STARTED", "كود الخصم لم يبدأ بعد.");
  if (coupon.endsAt && coupon.endsAt < now) throw new ApiError(400, "COUPON_EXPIRED", "انتهت صلاحية كود الخصم.");
  if (input.subtotal < coupon.minOrderValue) {
    throw new ApiError(400, "COUPON_MIN_ORDER", `الحد الأدنى لاستخدام الكوبون هو ${coupon.minOrderValue}.`);
  }

  const phone = normalizePhone(input.customerPhone);
  const email = String(input.customerEmail ?? "").trim().toLowerCase();
  const identityFilters: Prisma.OrderWhereInput[] = [];
  if (phone) identityFilters.push({ customerPhone: phone });
  if (email) identityFilters.push({ customerEmail: email });
  const needsIdentity = Boolean(coupon.perCustomerLimit || coupon.firstOrderOnly);
  if (needsIdentity && identityFilters.length === 0) {
    throw new ApiError(400, "COUPON_CUSTOMER_REQUIRED", "أدخل رقم الهاتف أو البريد الإلكتروني لاستخدام هذا الكوبون.");
  }

  if (coupon.maxUses) {
    const uses = await db.couponUsage.count({ where: { couponId: coupon.id } });
    if (uses >= coupon.maxUses) throw new ApiError(400, "COUPON_LIMIT_REACHED", "تم الوصول إلى الحد الأقصى لاستخدام الكوبون.");
  }
  if (coupon.perCustomerLimit && identityFilters.length) {
    const uses = await db.couponUsage.count({
      where: { couponId: coupon.id, order: { OR: identityFilters } },
    });
    if (uses >= coupon.perCustomerLimit) {
      throw new ApiError(400, "COUPON_CUSTOMER_LIMIT", "استخدمت هذا الكوبون بالحد الأقصى المسموح.");
    }
  }
  if (coupon.firstOrderOnly && identityFilters.length) {
    const previous = await db.order.count({
      where: { storeId: input.storeId, OR: identityFilters },
    });
    if (previous > 0) throw new ApiError(400, "COUPON_FIRST_ORDER_ONLY", "هذا الكوبون للطلب الأول فقط.");
  }
  const productIds = (coupon.productIds ?? []) as string[];
  const categoryIds = (coupon.categoryIds ?? []) as string[];
  const lines = input.lines ?? [];
  const eligibleSubtotal =
    productIds.length || categoryIds.length
      ? lines
          .filter((l) => productIds.includes(l.productId) || (l.categoryId ? categoryIds.includes(l.categoryId) : false))
          .reduce((s, l) => s + l.qty * l.unitPrice, 0)
      : input.subtotal;
  if (eligibleSubtotal <= 0) {
    throw new ApiError(400, "COUPON_NOT_APPLICABLE", "لا ينطبق هذا الكوبون على المنتجات المختارة.");
  }
  let discount = 0;
  const freeShipping = coupon.freeShipping || coupon.type === "free_shipping";
  if (coupon.type === "percentage") discount = Math.min(eligibleSubtotal, (eligibleSubtotal * Math.min(coupon.value, 100)) / 100);
  if (coupon.type === "fixed") discount = Math.min(eligibleSubtotal, coupon.value);
  return {
    couponId: coupon.id,
    code: coupon.code,
    discount: Math.round(discount * 100) / 100,
    freeShipping,
  };
}

export interface ShippingQuote {
  zoneId: string | null;
  zoneName: string;
  fee: number;
  codFee: number;
  total: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  carrier: string;
  freeShippingApplied: boolean;
}

export async function quoteShipping(
  input: {
    storeId: string;
    zoneId?: string;
    governorate?: string;
    city?: string;
    subtotal: number;
    paymentMethod?: string;
  },
  db: Db = prisma
): Promise<ShippingQuote> {
  const zones = await db.shippingZone.findMany({
    where: { storeId: input.storeId, isActive: true },
    include: { rates: { where: { isActive: true } } },
  });
  const configuredGovernorates = new Set(
    zones.flatMap((zone) => Array.isArray(zone.governorates)
      ? (zone.governorates as string[]).map((value) => String(value).trim()).filter(Boolean)
      : [])
  );
  if (input.governorate && configuredGovernorates.size && !configuredGovernorates.has(input.governorate.trim())) {
    throw new ApiError(422, "SHIPPING_GOVERNORATE_UNAVAILABLE", "The selected governorate is not covered by this store.");
  }
  let zone = input.zoneId ? zones.find((z) => z.id === input.zoneId) : undefined;
  if (!zone && (input.governorate || input.city)) {
    const list = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
    zone = zones.find((z) => {
      const govMatch = input.governorate && list(z.governorates).some((g) => g.trim() === input.governorate!.trim());
      const cityMatch = input.city && list(z.cities).some((c) => c.trim() === input.city!.trim());
      return govMatch || cityMatch;
    });
  }
  if (!zone) zone = zones.find((z) => z.isFallback);
  if (!zone) {
    return {
      zoneId: null,
      zoneName: "",
      fee: 0,
      codFee: 0,
      total: 0,
      estimatedDaysMin: 0,
      estimatedDaysMax: 0,
      carrier: "",
      freeShippingApplied: false,
    };
  }
  const rate = zone.rates.find(
    (r) =>
      (r.city && input.city && r.city.trim() === input.city.trim()) ||
      (r.governorate && input.governorate && r.governorate.trim() === input.governorate.trim())
  );
  let fee = rate?.fee ?? zone.fee;
  const codFee = /cod|cash|استلام/i.test(input.paymentMethod ?? "COD") ? rate?.codFee ?? zone.codFee : 0;
  const freeShippingApplied =
    zone.freeShippingThreshold !== null &&
    zone.freeShippingThreshold !== undefined &&
    input.subtotal >= zone.freeShippingThreshold;
  if (freeShippingApplied) fee = 0;
  return {
    zoneId: zone.id,
    zoneName: zone.name,
    fee,
    codFee,
    total: fee + codFee,
    estimatedDaysMin: rate?.estimatedDays ?? zone.estimatedDaysMin,
    estimatedDaysMax: rate?.estimatedDays ?? zone.estimatedDaysMax,
    carrier: zone.carrier,
    freeShippingApplied,
  };
}

function trackingForOrder(input: {
  order: { id: string; storeId: string; orderNumber: number };
  subdomain: string;
}) {
  const token = createTrackingToken({
    orderId: input.order.id,
    storeId: input.order.storeId,
    orderNumber: input.order.orderNumber,
  });
  return {
    tracking_token: token,
    tracking_url: trackingUrl({ subdomain: input.subdomain, orderNumber: input.order.orderNumber, token }),
  };
}

function shippingFromStoredOrder(order: {
  shippingZoneId: string | null;
  shippingFee: number;
  courier: string;
}): ShippingQuote {
  return {
    zoneId: order.shippingZoneId,
    zoneName: "",
    fee: order.shippingFee,
    codFee: 0,
    total: order.shippingFee,
    estimatedDaysMin: 0,
    estimatedDaysMax: 0,
    carrier: order.courier,
    freeShippingApplied: false,
  };
}

export async function createCheckout(input: {
  storeId: string;
  store: {
    subdomain: string;
    currency: string;
    codEnabled: boolean;
    onlinePaymentEnabled: boolean;
    whatsapp: string;
  };
  idempotencyKey?: string;
  body: {
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    address: string;
    city: string;
    governorate: string;
    payment_method: string;
    courier: string;
    coupon_code: string;
    shipping_zone_id: string;
    affiliate_code: string;
    cart_token: string;
    notes: string;
    items: CheckoutItemInput[];
  };
}) {
  const body = input.body;
  const idempotencyKey = input.idempotencyKey?.trim() || undefined;

  // A client that retries after a timeout must receive the original order
  // rather than a duplicate. The unique index is the final race guard; this
  // fast path avoids re-resolving stock for the common retry case.
  if (idempotencyKey) {
    const existing = await prisma.order.findFirst({
      where: { storeId: input.storeId, idempotencyKey },
      include: { items: true, payments: true },
    });
    if (existing) {
      return {
        order: existing,
        shipping: shippingFromStoredOrder(existing),
        whatsapp_url: input.store.whatsapp ? whatsappLink(input.store.whatsapp, `طلب جديد SND-${existing.orderNumber}`) : null,
        ...trackingForOrder({ order: existing, subdomain: input.store.subdomain }),
      };
    }
  }

  const lines = await resolveCheckoutLines({ storeId: input.storeId, currency: input.store.currency, items: body.items });
  const subtotal = Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100;

  const productIds = [...new Set(lines.map((l) => l.productId))];
  const categories = await prisma.product.findMany({
    where: { storeId: input.storeId, id: { in: productIds } },
    select: { id: true, categoryId: true },
  });
  const categoryByProduct = new Map(categories.map((p) => [p.id, p.categoryId]));

  const isCod = /cod|cash|استلام/i.test(body.payment_method || "COD");
  if (!isCod) {
    if (!input.store.onlinePaymentEnabled) {
      throw new ApiError(400, "ONLINE_PAYMENT_DISABLED", "الدفع الإلكتروني غير مفعّل لهذا المتجر. اختر الدفع عند الاستلام.");
    }
    if (!paymentService.configured) {
      throw new ApiError(503, "PAYMENT_PROVIDER_NOT_CONFIGURED", "بوابة الدفع الإلكتروني غير مهيأة بعد.");
    }
  }
  if (isCod && !input.store.codEnabled) {
    throw new ApiError(400, "COD_DISABLED", "الدفع عند الاستلام غير متاح لهذا المتجر.");
  }

  const phone = normalizePhone(body.customer_phone);
  const email = body.customer_email.trim().toLowerCase();
  const identity = customerIdentity({ phone, email });
  const orderNumber = await allocateOrderNumber(input.storeId);
  let shippingForResponse: ShippingQuote | null = null;

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      // Serialise concurrent checkout attempts for the same shopper so
      // customer rows and per-customer coupon limits cannot race.
      if (identity) await advisoryLock(tx, `customer:${input.storeId}:${identity}`);

      let coupon: CouponResult | null = null;
      if (body.coupon_code) {
        const code = body.coupon_code.trim().toUpperCase();
        const couponRow = await tx.coupon.findUnique({
          where: { storeId_code: { storeId: input.storeId, code } },
          select: { id: true },
        });
        // A per-coupon lock serialises maxUses checks and usage inserts.
        if (couponRow) await advisoryLock(tx, `coupon:${couponRow.id}`);
        coupon = await validateCoupon(
          {
            storeId: input.storeId,
            code,
            subtotal,
            customerPhone: phone,
            customerEmail: email,
            lines: lines.map((l) => ({
              productId: l.productId,
              categoryId: categoryByProduct.get(l.productId) ?? null,
              qty: l.qty,
              unitPrice: l.unitPrice,
            })),
          },
          tx
        );
      }

      const shipping = await quoteShipping(
        {
          storeId: input.storeId,
          zoneId: body.shipping_zone_id || undefined,
          governorate: body.governorate,
          city: body.city,
          subtotal: subtotal - (coupon?.discount ?? 0),
          paymentMethod: body.payment_method,
        },
        tx
      );
      shippingForResponse = shipping;
      const shippingFee = coupon?.freeShipping ? 0 : shipping.fee;
      const codFee = coupon?.freeShipping ? 0 : shipping.codFee;
      const total = Math.round((subtotal - (coupon?.discount ?? 0) + shippingFee + codFee) * 100) / 100;

      let customerId: string | null = null;
      if (phone || email) {
        const identityFilters: Prisma.CustomerWhereInput[] = [];
        if (phone) identityFilters.push({ phone });
        if (email) identityFilters.push({ email });
        const existing = await tx.customer.findFirst({
          where: { storeId: input.storeId, OR: identityFilters },
        });
        const customer = existing
          ? await tx.customer.update({
              where: { id: existing.id },
              data: {
                name: body.customer_name || existing.name,
                ...(email && !existing.email ? { email } : {}),
                ...(phone && !existing.phone ? { phone } : {}),
              },
            })
          : await tx.customer.create({
              data: {
                id: newId("cus_"),
                storeId: input.storeId,
                name: body.customer_name,
                phone,
                email,
              },
            });
        customerId = customer.id;
        if (body.address) {
          const addresses = await tx.customerAddress.findMany({ where: { storeId: input.storeId, customerId: customer.id } });
          const key = canonicalAddressKey({ address: body.address, city: body.city, governorate: body.governorate, phone });
          const duplicate = addresses.find((saved) => saved.addressKey === key);
          if (!duplicate) {
            const hasDefault = addresses.some((saved) => saved.isDefault);
            await tx.customerAddress.create({
              data: {
                id: newId("addr_"),
                storeId: input.storeId,
                customerId: customer.id,
                addressKey: key,
                label: hasDefault ? "" : "العنوان الأساسي",
                address: body.address,
                city: body.city,
                governorate: body.governorate,
                phone,
                isDefault: !hasDefault,
              },
            });
          } else if (!addresses.some((saved) => saved.isDefault)) {
            await tx.customerAddress.update({ where: { id: duplicate.id }, data: { isDefault: true, label: "العنوان الأساسي" } });
          }
        }
      }

      const created = await tx.order.create({
        data: {
          id: newId("ord_"),
          storeId: input.storeId,
          orderNumber,
          idempotencyKey: idempotencyKey ?? null,
          customerId,
          customerName: body.customer_name,
          customerPhone: phone,
          customerEmail: email,
          address: body.address,
          city: body.city,
          governorate: body.governorate,
          itemsSummary: lines.map((l) => `${l.name} ×${l.qty}`).join(" + "),
          amountText: `${total} ${input.store.currency}`,
          amountEgp: total,
          subtotal,
          discount: coupon?.discount ?? 0,
          shippingFee: shippingFee + codFee,
          couponCode: coupon?.code ?? "",
          shippingZoneId: shipping.zoneId,
          paymentMethod: body.payment_method,
          paymentStatus: "unpaid",
          status: "pending",
          courier: body.courier || shipping.carrier,
          notes: body.notes,
          items: {
            create: lines.map((l) => ({
              id: newId("item_"),
              productId: l.productId,
              variantId: l.variantId,
              variantLabel: l.variantLabel,
              sku: l.sku,
              name: l.name,
              qty: l.qty,
              unitPriceEgp: l.unitPrice,
              imageUrl: l.imageUrl,
            })),
          },
        },
        include: { items: true },
      });

      for (const line of lines) {
        if (line.variantId) {
          const moved = await tx.productVariant.updateMany({
            where: { id: line.variantId, storeId: input.storeId, stock: { gte: line.qty } },
            data: { stock: { decrement: line.qty } },
          });
          if (moved.count !== 1) {
            throw new ApiError(409, "INSUFFICIENT_STOCK", `Not enough stock for: ${line.sku}.`, { short: [line.sku] });
          }
        } else {
          const moved = await tx.product.updateMany({
            where: { id: line.productId, storeId: input.storeId, stock: { gte: line.qty } },
            data: { stock: { decrement: line.qty } },
          });
          if (moved.count !== 1) {
            throw new ApiError(409, "INSUFFICIENT_STOCK", `Not enough stock for: ${line.sku}.`, { short: [line.sku] });
          }
        }
      }

      if (coupon) {
        await tx.couponUsage.create({
          data: {
            id: newId("cusg_"),
            storeId: input.storeId,
            couponId: coupon.couponId,
            orderId: created.id,
            customerId,
            discount: coupon.discount,
          },
        });
        await tx.coupon.update({ where: { id: coupon.couponId }, data: { updatedAt: new Date() } }).catch(() => null);
      }

      if (body.affiliate_code) {
        const affiliate = await tx.affiliate.findUnique({
          where: { storeId_referralCode: { storeId: input.storeId, referralCode: body.affiliate_code.toUpperCase() } },
        });
        if (affiliate && affiliate.isActive) {
          await tx.affiliateAttribution.create({
            data: {
              id: newId("att_"),
              storeId: input.storeId,
              affiliateId: affiliate.id,
              orderId: created.id,
              commissionAmount: Math.round((total * affiliate.commissionRate) / 100 * 100) / 100,
              status: "pending",
            },
          });
        }
      }

      await tx.payment.create({
        data: {
          id: newId("pay_"),
          storeId: input.storeId,
          orderId: created.id,
          provider: isCod ? "cod" : paymentService.provider,
          amount: total,
          currency: input.store.currency,
          status: "pending",
          method: body.payment_method,
        },
      });

      if (body.cart_token) {
        await tx.abandonedCart
          .update({
            where: { storeId_cartToken: { storeId: input.storeId, cartToken: body.cart_token } },
            data: { recoveryStatus: "recovered" },
          })
          .catch(() => null);
      }

      await tx.orderEvent.create({
        data: {
          id: newId("evt_"),
          storeId: input.storeId,
          orderId: created.id,
          type: "created",
          message: "",
          actor: "customer",
          metadata: { source: "storefront" } as Prisma.InputJsonValue,
        },
      });

      // Loyalty points are intentionally NOT granted here. They are earned
      // only when the order reaches `delivered` and reversed on return; see
      // services/orders.ts.
      return created;
    });
  } catch (err) {
    if (
      idempotencyKey &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.order.findFirst({
        where: { storeId: input.storeId, idempotencyKey },
        include: { items: true, payments: true },
      });
      if (existing) {
        return {
          order: existing,
          shipping: shippingFromStoredOrder(existing),
          whatsapp_url: input.store.whatsapp
            ? whatsappLink(input.store.whatsapp, `طلب جديد SND-${existing.orderNumber}`)
            : null,
          ...trackingForOrder({ order: existing, subdomain: input.store.subdomain }),
        };
      }
    }
    throw err;
  }

  const refreshed = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true, payments: true },
  });
  return {
    order: refreshed,
    shipping: shippingForResponse ?? shippingFromStoredOrder(order),
    whatsapp_url: input.store.whatsapp ? whatsappLink(input.store.whatsapp, `طلب جديد SND-${orderNumber}`) : null,
    ...trackingForOrder({ order, subdomain: input.store.subdomain }),
  };
}
