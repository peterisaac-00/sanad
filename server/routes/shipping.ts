import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  idParamSchema,
  shippingZoneBodySchema,
  shippingZoneUpdateSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
} from "../validate.js";
import { writeAudit } from "../services/account.js";

export const shippingRouter = Router();

const include = { rates: { orderBy: [{ governorate: "asc" as const }, { city: "asc" as const }] } };

shippingRouter.get(
  "/api/stores/:subdomain/shipping-zones",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const zones = await prisma.shippingZone.findMany({
      where: { storeId: req.ownedStore!.id },
      orderBy: [{ isFallback: "desc" }, { createdAt: "asc" }],
      include,
    });
    res.json({ zones });
  })
);

shippingRouter.post(
  "/api/stores/:subdomain/shipping-zones",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(shippingZoneBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    if (b.estimatedDaysMax < b.estimatedDaysMin) {
      throw new ApiError(400, "INVALID_SHIPPING_RANGE", "estimatedDaysMax must be greater than or equal to estimatedDaysMin.");
    }
    const zone = await prisma.$transaction(async (tx) => {
      if (b.isFallback) {
        await tx.shippingZone.updateMany({ where: { storeId }, data: { isFallback: false } });
      }
      const created = await tx.shippingZone.create({
        data: {
          id: newId("zone_"),
          storeId,
          name: b.name,
          governorates: b.governorates as Prisma.InputJsonValue,
          cities: b.cities as Prisma.InputJsonValue,
          fee: b.fee,
          freeShippingThreshold: b.freeShippingThreshold ?? null,
          codFee: b.codFee,
          estimatedDaysMin: b.estimatedDaysMin,
          estimatedDaysMax: b.estimatedDaysMax,
          carrier: b.carrier,
          trackingSupported: b.trackingSupported,
          isActive: b.isActive,
          isFallback: b.isFallback,
        },
      });
      if (b.rates?.length) {
        await tx.shippingRate.createMany({
          data: b.rates.map((r: { governorate: string; city: string; district: string; fee: number; codFee: number; estimatedDays: number; isActive: boolean }) => ({
            id: newId("rate_"),
            storeId,
            zoneId: created.id,
            governorate: r.governorate,
            city: r.city,
            district: r.district,
            fee: r.fee,
            codFee: r.codFee,
            estimatedDays: r.estimatedDays,
            isActive: r.isActive,
          })),
        });
      }
      return tx.shippingZone.findUnique({ where: { id: created.id }, include });
    });
    await writeAudit({
      storeId,
      merchantId: req.auth!.merchantId,
      action: "shipping_zone.created",
      entity: "shipping_zone",
      entityId: zone!.id,
      ip: req.ip,
    });
    res.status(201).json({ zone });
  })
);

shippingRouter.patch(
  "/api/stores/:subdomain/shipping-zones/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(shippingZoneUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.shippingZone.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "SHIPPING_ZONE_NOT_FOUND", "Shipping zone not found.");
    const b = req.body;
    if (b.estimatedDaysMin !== undefined && b.estimatedDaysMax !== undefined && b.estimatedDaysMax < b.estimatedDaysMin) {
      throw new ApiError(400, "INVALID_SHIPPING_RANGE", "estimatedDaysMax must be greater than or equal to estimatedDaysMin.");
    }
    const zone = await prisma.$transaction(async (tx) => {
      if (b.isFallback) {
        await tx.shippingZone.updateMany({ where: { storeId, NOT: { id: existing.id } }, data: { isFallback: false } });
      }
      await tx.shippingZone.update({
        where: { id: existing.id },
        data: {
          ...(b.name !== undefined ? { name: b.name } : {}),
          ...(b.governorates !== undefined ? { governorates: b.governorates as Prisma.InputJsonValue } : {}),
          ...(b.cities !== undefined ? { cities: b.cities as Prisma.InputJsonValue } : {}),
          ...(b.fee !== undefined ? { fee: b.fee } : {}),
          ...(b.freeShippingThreshold !== undefined ? { freeShippingThreshold: b.freeShippingThreshold } : {}),
          ...(b.codFee !== undefined ? { codFee: b.codFee } : {}),
          ...(b.estimatedDaysMin !== undefined ? { estimatedDaysMin: b.estimatedDaysMin } : {}),
          ...(b.estimatedDaysMax !== undefined ? { estimatedDaysMax: b.estimatedDaysMax } : {}),
          ...(b.carrier !== undefined ? { carrier: b.carrier } : {}),
          ...(b.trackingSupported !== undefined ? { trackingSupported: b.trackingSupported } : {}),
          ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
          ...(b.isFallback !== undefined ? { isFallback: b.isFallback } : {}),
        },
      });
      if (b.rates) {
        await tx.shippingRate.deleteMany({ where: { zoneId: existing.id, storeId } });
        if (b.rates.length) {
          await tx.shippingRate.createMany({
            data: b.rates.map((r: { governorate: string; city: string; district: string; fee: number; codFee: number; estimatedDays: number; isActive: boolean }) => ({
              id: newId("rate_"),
              storeId,
              zoneId: existing.id,
              governorate: r.governorate,
              city: r.city,
              district: r.district,
              fee: r.fee,
              codFee: r.codFee,
              estimatedDays: r.estimatedDays,
              isActive: r.isActive,
            })),
          });
        }
      }
      return tx.shippingZone.findUnique({ where: { id: existing.id }, include });
    });
    await writeAudit({
      storeId,
      merchantId: req.auth!.merchantId,
      action: "shipping_zone.updated",
      entity: "shipping_zone",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json({ zone });
  })
);

shippingRouter.delete(
  "/api/stores/:subdomain/shipping-zones/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.shippingZone.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "SHIPPING_ZONE_NOT_FOUND", "Shipping zone not found.");
    await prisma.shippingZone.delete({ where: { id: existing.id } });
    await writeAudit({
      storeId,
      merchantId: req.auth!.merchantId,
      action: "shipping_zone.deleted",
      entity: "shipping_zone",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);
