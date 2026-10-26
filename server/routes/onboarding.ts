import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireMerchantSession } from "../middleware.js";
import { validateBody } from "../validate.js";
import { onboardingPatchSchema } from "../validate.js";
import { auditActor, ensureStoreDefaults, writeAudit } from "../services/account.js";
import { env } from "../env.js";
import { paymentService } from "../services/integrations.js";
import { onboardingIdentityTouched, OWNER_IDENTITY_LOCKED_MESSAGE } from "../services/storePolicy.js";
import {
  isPublished,
  publishStateAfterOnboarding,
  publishingSnapshot,
} from "../services/publishing.js";

export const onboardingRouter = Router();

function progressOf(store: {
  storeName: string;
  description: string;
  businessType: string;
  governorate: string;
  logoUrl: string;
  templateKey: string;
  whatsapp: string;
  codEnabled: boolean;
  onboardingCompleted: boolean;
  status: string;
  publishStatus: string;
  publishReason: string;
  statusReason: string;
  publishedAt: Date | null;
}) {
  return {
    brand: Boolean(store.storeName && store.businessType && (store.description || store.governorate)),
    identity: Boolean(store.logoUrl),
    template: Boolean(store.templateKey),
    selling: Boolean(store.whatsapp || store.codEnabled),
    published: isPublished(store),
  };
}

async function ownStore(req: Parameters<typeof requireAuth>[0]) {
  if (!req.auth!.storeId) throw new ApiError(404, "STORE_NOT_FOUND", "No store linked to this account.");
  const store = await prisma.store.findUnique({ where: { id: req.auth!.storeId } });
  if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  return store;
}

onboardingRouter.get(
  "/",
  asyncHandler(requireAuth),
  asyncHandler(requireMerchantSession),
  asyncHandler(async (req, res) => {
    const store = await ownStore(req);
    await ensureStoreDefaults(store.id, store.currency);
    const branding = await prisma.storeBranding.findUnique({ where: { storeId: store.id } });
    const shippingZones = await prisma.shippingZone.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: [{ isFallback: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true, governorates: true, fee: true, freeShippingThreshold: true, isFallback: true },
    });
    res.json({
      store,
      branding,
      shipping_zones: shippingZones,
      progress: progressOf(store),
      publishing: publishingSnapshot(store),
      payments: {
        codEnabled: store.codEnabled,
        onlinePaymentEnabled: store.onlinePaymentEnabled && paymentService.configured,
        providerConfigured: paymentService.configured,
      },
      public_url: `/store/${store.subdomain}`,
      integrations: {
        app_url: env.appUrl,
        storage_driver: env.storageDriver,
      },
    });
  })
);

onboardingRouter.patch(
  "/",
  asyncHandler(requireAuth),
  asyncHandler(requireMerchantSession),
  validateBody(onboardingPatchSchema),
  asyncHandler(async (req, res) => {
    const store = await ownStore(req);
    const body = req.body as z.infer<typeof onboardingPatchSchema>;

    if (body.subdomain && body.subdomain !== store.subdomain) {
      if (store.onboardingCompleted) {
        throw new ApiError(409, "SUBDOMAIN_IMMUTABLE", "Store address cannot change after publishing.");
      }
      const taken = await prisma.store.findUnique({ where: { subdomain: body.subdomain }, select: { id: true } });
      if (taken && taken.id !== store.id) throw new ApiError(409, "SUBDOMAIN_TAKEN", "This store address is already taken.");
    }
    // Identity and branding are chosen once, during onboarding. After the
    // owner submits/publishes the store, only the platform admin may edit them.
    if (store.onboardingCompleted && onboardingIdentityTouched(body)) {
      throw new ApiError(409, "STORE_IDENTITY_ADMIN_ONLY", OWNER_IDENTITY_LOCKED_MESSAGE);
    }
    if ((body.onlinePaymentEnabled === true || body.selling?.onlinePaymentEnabled === true) && !paymentService.configured) {
      throw new ApiError(
        409,
        "PAYMENT_PROVIDER_NOT_CONFIGURED",
        "لا يمكن تفعيل الدفع الإلكتروني قبل إعداد بوابة الدفع. يمكنك المتابعة بالدفع عند الاستلام."
      );
    }

    const storeData: Prisma.StoreUpdateInput = {
      ...(body.step !== undefined ? { onboardingStep: body.step } : {}),
      ...(body.storeName !== undefined ? { storeName: body.storeName } : {}),
      ...(body.subdomain !== undefined ? { subdomain: body.subdomain } : {}),
      ...(body.businessType !== undefined ? { businessType: body.businessType } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.country !== undefined ? { country: body.country } : {}),
      ...(body.countryCode !== undefined ? { countryCode: body.countryCode } : {}),
      ...(body.governorate !== undefined ? { governorate: body.governorate } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.primaryLanguage !== undefined ? { primaryLanguage: body.primaryLanguage } : {}),
      ...(body.timeZone !== undefined ? { timeZone: body.timeZone } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.whatsapp !== undefined ? { whatsapp: body.whatsapp } : {}),
      ...(body.returnPolicy !== undefined ? { returnPolicy: body.returnPolicy } : {}),
      ...(body.codEnabled !== undefined ? { codEnabled: body.codEnabled } : {}),
      ...(body.onlinePaymentEnabled !== undefined ? { onlinePaymentEnabled: body.onlinePaymentEnabled } : {}),
      ...(body.templateKey !== undefined ? { templateKey: body.templateKey } : {}),
      ...(body.branding?.logoUrl !== undefined ? { logoUrl: body.branding.logoUrl } : {}),
      ...(body.branding?.coverUrl !== undefined ? { coverUrl: body.branding.coverUrl } : {}),
      ...(body.selling?.whatsapp !== undefined ? { whatsapp: body.selling.whatsapp } : {}),
      ...(body.selling?.returnPolicy !== undefined ? { returnPolicy: body.selling.returnPolicy } : {}),
      ...(body.selling?.codEnabled !== undefined ? { codEnabled: body.selling.codEnabled } : {}),
      ...(body.selling?.onlinePaymentEnabled !== undefined ? { onlinePaymentEnabled: body.selling.onlinePaymentEnabled } : {}),
    };

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.store.update({ where: { id: store.id }, data: storeData });
      if (body.subdomain && body.subdomain !== store.subdomain && req.auth!.merchantId) {
        await tx.merchant.update({ where: { id: req.auth!.merchantId }, data: { storeHandle: body.subdomain } });
      }
      if (body.branding || body.templateKey) {
        const b = body.branding;
        await tx.storeBranding.upsert({
          where: { storeId: store.id },
          create: {
            id: newId("brand_"),
            storeId: store.id,
            ...(b?.primaryColor ? { primaryColor: b.primaryColor } : {}),
            ...(b?.secondaryColor ? { secondaryColor: b.secondaryColor } : {}),
            ...(b?.textColor ? { textColor: b.textColor } : {}),
            ...(b?.themeMode ? { themeMode: b.themeMode } : {}),
            ...(b?.arabicFont ? { arabicFont: b.arabicFont } : {}),
            ...(b?.templateKey || body.templateKey ? { templateKey: b?.templateKey ?? body.templateKey } : {}),
            ...(b?.heroConfig ? { heroConfig: b.heroConfig as Prisma.InputJsonValue } : {}),
            ...(b?.homepageSections ? { homepageSections: b.homepageSections as Prisma.InputJsonValue } : {}),
          },
          update: {
            ...(b?.primaryColor ? { primaryColor: b.primaryColor } : {}),
            ...(b?.secondaryColor ? { secondaryColor: b.secondaryColor } : {}),
            ...(b?.textColor ? { textColor: b.textColor } : {}),
            ...(b?.themeMode ? { themeMode: b.themeMode } : {}),
            ...(b?.arabicFont ? { arabicFont: b.arabicFont } : {}),
            ...(b?.templateKey || body.templateKey ? { templateKey: b?.templateKey ?? body.templateKey } : {}),
            ...(b?.heroConfig ? { heroConfig: b.heroConfig as Prisma.InputJsonValue } : {}),
            ...(b?.homepageSections ? { homepageSections: b.homepageSections as Prisma.InputJsonValue } : {}),
          },
        });
      }
      const shipping = body.selling?.shipping;
      if (shipping) {
        const fallback = await tx.shippingZone.findFirst({ where: { storeId: store.id, isFallback: true } });
        const data = {
          name: fallback?.name ?? "المنطقة الافتراضية",
          governorates: (shipping.governorates ?? []) as Prisma.InputJsonValue,
          fee: shipping.fee ?? fallback?.fee ?? 0,
          freeShippingThreshold: shipping.freeShippingThreshold ?? fallback?.freeShippingThreshold ?? null,
          isFallback: true,
          isActive: true,
        };
        if (fallback) await tx.shippingZone.update({ where: { id: fallback.id }, data });
        else await tx.shippingZone.create({ data: { id: newId("zone_"), storeId: store.id, ...data } });
      }
      return row;
    });

    await ensureStoreDefaults(updated.id, updated.currency);
    await writeAudit({
      storeId: updated.id,
      ...auditActor(req.auth!),
      action: "onboarding.draft_saved",
      entity: "store",
      entityId: updated.id,
      metadata: { step: body.step ?? updated.onboardingStep },
      ip: req.ip,
    });
    const branding = await prisma.storeBranding.findUnique({ where: { storeId: updated.id } });
    res.json({ store: updated, branding, progress: progressOf(updated), public_url: `/store/${updated.subdomain}` });
  })
);

onboardingRouter.post(
  "/complete",
  asyncHandler(requireAuth),
  asyncHandler(requireMerchantSession),
  asyncHandler(async (req, res) => {
    const store = await ownStore(req);
    if (!store.storeName || !store.businessType) {
      throw new ApiError(400, "ONBOARDING_INCOMPLETE", "Brand name and business type are required before publishing.");
    }
    if (!store.logoUrl && !store.coverUrl) {
      // A brand without any visual asset still publishes, but we ask for at
      // least a template so the storefront isn't blank.
      if (!store.templateKey) {
        throw new ApiError(400, "ONBOARDING_INCOMPLETE", "Choose a store template before publishing.");
      }
    }
    if (store.onlinePaymentEnabled && !paymentService.configured) {
      throw new ApiError(409, "PAYMENT_PROVIDER_NOT_CONFIGURED", "Disable online payment until a gateway is configured.");
    }

    const publish = publishStateAfterOnboarding(store);
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: {
        onboardingCompleted: true,
        onboardingStep: 5,
        ...publish,
      },
    });
    await ensureStoreDefaults(updated.id, updated.currency);
    await prisma.storeBranding.upsert({
      where: { storeId: updated.id },
      create: { id: newId("brand_"), storeId: updated.id, templateKey: updated.templateKey, publishedAt: new Date() },
      update: { templateKey: updated.templateKey, publishedAt: new Date() },
    });
    await writeAudit({
      storeId: updated.id,
      ...auditActor(req.auth!),
      action: "store.submitted_for_review",
      entity: "store",
      entityId: updated.id,
      metadata: { subdomain: updated.subdomain, status: updated.status },
      ip: req.ip,
    });
    const branding = await prisma.storeBranding.findUnique({ where: { storeId: updated.id } });
    res.json({
      store: updated,
      branding,
      approval_required: updated.status !== "active",
      public_url: `/store/${updated.subdomain}`,
      dashboard_url: "/dashboard",
    });
  })
);
