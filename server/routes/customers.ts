import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  addressBodySchema,
  childIdParamSchema,
  customerListQuerySchema,
  customerUpdateSchema,
  idParamSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
  validateQuery,
} from "../validate.js";
import { writeAudit } from "../services/account.js";

export const customersRouter = Router();

customersRouter.get(
  "/api/stores/:subdomain/customers/export",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const rows = await prisma.customer.findMany({
      where: { storeId: req.ownedStore!.id },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const columns = ["name", "phone", "email", "notes", "createdAt"];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="customers-${Date.now()}.csv"`);
    res.send(
      "\uFEFF" +
        [columns.join(","), ...rows.map((r) => columns.map((c) => escape((r as Record<string, unknown>)[c])).join(","))].join("\n")
    );
  })
);

customersRouter.get(
  "/api/stores/:subdomain/customers",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateQuery(customerListQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, pageSize, search, hasOrders } = req.query as unknown as {
      page: number;
      pageSize: number;
      search?: string;
      hasOrders?: string;
    };
    const storeId = req.ownedStore!.id;
    const where: Prisma.CustomerWhereInput = { storeId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (hasOrders === "true") where.orders = { some: {} };
    if (hasOrders === "false") where.orders = { none: {} };
    const [total, customers] = await prisma.$transaction([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { orders: true, addresses: true } } },
      }),
    ]);
    const ids = customers.map((c) => c.id);
    const totals = ids.length
      ? await prisma.order.groupBy({
          by: ["customerId"],
          where: { storeId, customerId: { in: ids } },
          _sum: { amountEgp: true },
          _max: { createdAt: true },
        })
      : [];
    const byCustomer = new Map(totals.map((t) => [t.customerId, t]));
    res.json({
      customers: customers.map((c) => ({
        ...c,
        ordersCount: c._count.orders,
        addressesCount: c._count.addresses,
        totalSpent: byCustomer.get(c.id)?._sum.amountEgp ?? 0,
        lastOrderAt: byCustomer.get(c.id)?._max.createdAt ?? null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  })
);

customersRouter.get(
  "/api/stores/:subdomain/customers/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, storeId },
      include: {
        addresses: true,
        loyalty: true,
        orders: { orderBy: { createdAt: "desc" }, take: 50, include: { items: true } },
      },
    });
    if (!customer) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    const totalSpent = customer.orders.reduce((s, o) => s + o.amountEgp, 0);
    res.json({ customer: { ...customer, totalSpent } });
  })
);

customersRouter.patch(
  "/api/stores/:subdomain/customers/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(customerUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    const b = req.body;
    const customer = await prisma.customer.update({
      where: { id: existing.id },
      data: {
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.phone !== undefined ? { phone: b.phone } : {}),
        ...(b.email !== undefined ? { email: b.email } : {}),
        ...(b.notes !== undefined ? { notes: b.notes } : {}),
      },
    });
    await writeAudit({
      storeId,
      merchantId: req.auth!.merchantId,
      action: "customer.updated",
      entity: "customer",
      entityId: customer.id,
      ip: req.ip,
    });
    res.json({ customer });
  })
);

customersRouter.delete(
  "/api/stores/:subdomain/customers/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    await prisma.customer.delete({ where: { id: existing.id } });
    await writeAudit({
      storeId,
      merchantId: req.auth!.merchantId,
      action: "customer.deleted",
      entity: "customer",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);

customersRouter.post(
  "/api/stores/:subdomain/customers/:id/addresses",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(addressBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!customer) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    const b = req.body;
    const address = await prisma.$transaction(async (tx) => {
      if (b.isDefault) {
        await tx.customerAddress.updateMany({ where: { storeId, customerId: customer.id }, data: { isDefault: false } });
      }
      return tx.customerAddress.create({
        data: {
          id: newId("addr_"),
          storeId,
          customerId: customer.id,
          label: b.label,
          address: b.address,
          city: b.city,
          governorate: b.governorate,
          phone: b.phone,
          isDefault: b.isDefault,
        },
      });
    });
    res.status(201).json({ address });
  })
);

customersRouter.patch(
  "/api/stores/:subdomain/customers/:id/addresses/:childId",
  asyncHandler(requireAuth),
  validateParams(childIdParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(addressBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.customerAddress.findFirst({
      where: { id: req.params.childId, customerId: req.params.id, storeId },
    });
    if (!existing) throw new ApiError(404, "ADDRESS_NOT_FOUND", "Address not found.");
    const b = req.body;
    const address = await prisma.$transaction(async (tx) => {
      if (b.isDefault) {
        await tx.customerAddress.updateMany({
          where: { storeId, customerId: req.params.id },
          data: { isDefault: false },
        });
      }
      return tx.customerAddress.update({
        where: { id: existing.id },
        data: {
          label: b.label,
          address: b.address,
          city: b.city,
          governorate: b.governorate,
          phone: b.phone,
          isDefault: b.isDefault,
        },
      });
    });
    res.json({ address });
  })
);

customersRouter.delete(
  "/api/stores/:subdomain/customers/:id/addresses/:childId",
  asyncHandler(requireAuth),
  validateParams(childIdParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.customerAddress.findFirst({
      where: { id: req.params.childId, customerId: req.params.id, storeId },
      select: { id: true },
    });
    if (!existing) throw new ApiError(404, "ADDRESS_NOT_FOUND", "Address not found.");
    await prisma.customerAddress.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);
