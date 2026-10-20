import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError } from "../errors.js";
import { allocateOrderNumber } from "./orders.js";
import { paymentService, whatsappLink } from "./integrations.js";

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

function priceOf(
  product: { priceEgp: number; priceSar: number },
  currency: string,
  sku: string
): number {
  const column = currency === "EGP" ? product.priceEgp : currency === "SAR" ? product.priceSar : null;
  if (column === null) {
    throw new ApiError(
      400,
      "CHECKOUT_CURRENCY_UNSUPPORTED",
      `Checkout supports EGP and SAR priced catalogs; this store uses ${currency}.`
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

export async function validateCoupon(input: {
  storeId: string;
  code: string;
  subtotal: number;
  customerPhone?: string;
  lines?: Array<{ productId: string; categoryId?: string | null; qty: number; unitPrice: number }>;
}): Promise<CouponResult | null> {
  const code = input.code.trim().toUpperCase();
  if (!code) return null;
  const coupon = await prisma.coupon.findUnique({ where: { storeId_code: { storeId: input.storeId, code } } });
  if (!coupon || !coupon.isActive) throw new ApiError(400, "COUPON_INVALID", "كود الخصم غير صالح.");
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new ApiError(400, "COUPON_NOT_STARTED", "كود الخصم لم يبدأ بعد.");
  if (coupon.endsAt && coupon.endsAt < now) throw new ApiError(400, "COUPON_EXPIRED", "انتهت صلاحية كود الخصم.");
  if (input.subtotal < coupon.minOrderValue) {
    throw new ApiError(400, "COUPON_MIN_ORDER", `الحد الأدنى لاستخدام الكوبون هو ${coupon.minOrderValue}.`);
  }
  if (coupon.maxUses) {
    const uses = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
    if (uses >= coupon.maxUses) throw new ApiError(400, "COUPON_LIMIT_REACHED", "تم الوصول إلى الحد الأقصى لاستخدام الكوبون.");
  }
  if (coupon.perCustomerLimit && input.customerPhone) {
    const uses = await prisma.couponUsage.count({
      where: { couponId: coupon.id, order: { customerPhone: input.customerPhone } },
    });
    if (uses >= coupon.perCustomerLimit) {
      throw new ApiError(400, "COUPON_CUSTOMER_LIMIT", "استخدمت هذا الكوبون بالحد الأقصى المسموح.");
    }
  }
  if (coupon.firstOrderOnly && input.customerPhone) {
    const previous = await prisma.order.count({
      where: { storeId: input.storeId, customerPhone: input.customerPhone },
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

export async function quoteShipping(input: {
  storeId: string;
  zoneId?: string;
  governorate?: string;
  city?: string;
  subtotal: number;
  paymentMethod?: string;
}): Promise<ShippingQuote> {
  const zones = await prisma.shippingZone.findMany({
    where: { storeId: input.storeId, isActive: true },
    include: { rates: { where: { isActive: true } } },
  });
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

export async function createCheckout(input: {
  storeId: string;
  store: {
    subdomain: string;
    currency: string;
    codEnabled: boolean;
    onlinePaymentEnabled: boolean;
    whatsapp: string;
  };
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
  const lines = await resolveCheckoutLines({ storeId: input.storeId, currency: input.store.currency, items: body.items });
  const subtotal = Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100;

  const productIds = [...new Set(lines.map((l) => l.productId))];
  const categories = await prisma.product.findMany({
    where: { storeId: input.storeId, id: { in: productIds } },
    select: { id: true, categoryId: true },
  });
  const categoryByProduct = new Map(categories.map((p) => [p.id, p.categoryId]));

  const coupon = body.coupon_code
    ? await validateCoupon({
        storeId: input.storeId,
        code: body.coupon_code,
        subtotal,
        customerPhone: body.customer_phone,
        lines: lines.map((l) => ({
          productId: l.productId,
          categoryId: categoryByProduct.get(l.productId) ?? null,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
      })
    : null;

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

  const shipping = await quoteShipping({
    storeId: input.storeId,
    zoneId: body.shipping_zone_id || undefined,
    governorate: body.governorate,
    city: body.city,
    subtotal: subtotal - (coupon?.discount ?? 0),
    paymentMethod: body.payment_method,
  });
  const shippingFee = coupon?.freeShipping ? 0 : shipping.fee;
  const codFee = isCod ? (coupon?.freeShipping ? 0 : shipping.codFee) : 0;
  const total = Math.round((subtotal - (coupon?.discount ?? 0) + shippingFee + codFee) * 100) / 100;

  const orderNumber = await allocateOrderNumber(input.storeId);
  const order = await prisma.$transaction(async (tx) => {
    let customerId: string | null = null;
    if (body.customer_phone || body.customer_email) {
      const existing = await tx.customer.findFirst({
        where: {
          storeId: input.storeId,
          ...(body.customer_phone ? { phone: body.customer_phone } : { email: body.customer_email }),
        },
      });
      const customer = existing
        ? await tx.customer.update({
            where: { id: existing.id },
            data: {
              name: body.customer_name || existing.name,
              ...(body.customer_email && !existing.email ? { email: body.customer_email } : {}),
            },
          })
        : await tx.customer.create({
            data: {
              id: newId("cus_"),
              storeId: input.storeId,
              name: body.customer_name,
              phone: body.customer_phone,
              email: body.customer_email,
            },
          });
      customerId = customer.id;
      if (body.address) {
        const addressCount = await tx.customerAddress.count({ where: { storeId: input.storeId, customerId: customer.id } });
        await tx.customerAddress.create({
          data: {
            id: newId("addr_"),
            storeId: input.storeId,
            customerId: customer.id,
            label: addressCount === 0 ? "العنوان الأساسي" : "",
            address: body.address,
            city: body.city,
            governorate: body.governorate,
            phone: body.customer_phone,
            isDefault: addressCount === 0,
          },
        });
      }
    }

    const created = await tx.order.create({
      data: {
        id: newId("ord_"),
        storeId: input.storeId,
        orderNumber,
        customerId,
        customerName: body.customer_name,
        customerPhone: body.customer_phone,
        customerEmail: body.customer_email,
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
        message: "تم استلام الطلب من المتجر",
        actor: "customer",
        metadata: { source: "storefront" } as Prisma.InputJsonValue,
      },
    });

    // Loyalty: apply the first active earn rule. Points and the ledger entry
    // are written in the same transaction as the order.
    if (customerId) {
      const rule = await tx.loyaltyRule.findFirst({
        where: { storeId: input.storeId, type: "earn", isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (rule && total >= rule.minOrderValue) {
        const earned = Math.floor(total / Math.max(rule.perAmount, 0.01)) * rule.points;
        if (earned > 0) {
          const account = await tx.loyaltyAccount.upsert({
            where: { customerId },
            create: { id: newId("lac_"), storeId: input.storeId, customerId, points: 0 },
            update: {},
          });
          await tx.loyaltyTransaction.create({
            data: {
              id: newId("ltx_"),
              storeId: input.storeId,
              accountId: account.id,
              points: earned,
              type: "earn",
              note: `طلب SND-${orderNumber}`,
            },
          });
          await tx.loyaltyAccount.update({ where: { id: account.id }, data: { points: { increment: earned } } });
        }
      }
    }

    return created;
  });

  const refreshed = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true, payments: true },
  });
  return {
    order: refreshed,
    shipping,
    whatsapp_url: input.store.whatsapp ? whatsappLink(input.store.whatsapp, `طلب جديد SND-${orderNumber}`) : null,
  };
}
