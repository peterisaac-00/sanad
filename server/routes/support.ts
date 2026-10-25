import { Router } from "express";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  subdomainParamSchema,
  supportTicketSchema,
  validateBody,
  validateParams,
} from "../validate.js";
import { auditActor, writeAudit } from "../services/account.js";
import { isFeatureEnabled } from "../services/features.js";

export const supportRouter = Router();

/**
 * Merchant-side support desk. Tickets belong to the store and may be opened by
 * any authenticated store principal with `operations.write` (owner/staff/admin
 * team roles). Reading is part of the normal store-read surface.
 */
supportRouter.get(
  "/api/stores/:subdomain/support-tickets",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const enabled = await isFeatureEnabled("support_center", true);
    const tickets = enabled
      ? await prisma.supportTicket.findMany({
          where: { storeId: req.ownedStore!.id },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : [];
    res.json({ tickets, enabled });
  })
);

supportRouter.post(
  "/api/stores/:subdomain/support-tickets",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(supportTicketSchema),
  asyncHandler(async (req, res) => {
    if (!(await isFeatureEnabled("support_center", true))) {
      throw new ApiError(503, "SUPPORT_CENTER_DISABLED", "مركز الدعم متوقف مؤقتاً من إدارة المنصة.");
    }
    const storeId = req.ownedStore!.id;
    const ticket = await prisma.supportTicket.create({
      data: {
        id: newId("ticket_"),
        storeId,
        merchantId: req.auth!.merchantId,
        subject: req.body.subject,
        message: req.body.message,
        category: req.body.category,
        priority: req.body.priority,
        status: "open",
      },
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "support.ticket_opened",
      entity: "support_ticket",
      entityId: ticket.id,
      metadata: { category: ticket.category, priority: ticket.priority },
      ip: req.ip,
    });
    res.status(201).json({ ticket });
  })
);
