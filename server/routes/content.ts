import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma, newId } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import {
  affiliateBodySchema,
  affiliateUpdateSchema,
  blogBodySchema,
  blogUpdateSchema,
  idParamSchema,
  pageBodySchema,
  pageUpdateSchema,
  subdomainParamSchema,
  validateBody,
  validateParams,
} from "../validate.js";
import { auditActor, slugify, writeAudit } from "../services/account.js";

export const contentRouter = Router();

async function uniqueSlug(
  model: "page" | "blogPost",
  storeId: string,
  raw: string,
  ignoreId?: string
): Promise<string> {
  const base = slugify(raw) || "page";
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 2}`;
    const found =
      model === "page"
        ? await prisma.page.findUnique({ where: { storeId_slug: { storeId, slug: candidate } }, select: { id: true } })
        : await prisma.blogPost.findUnique({ where: { storeId_slug: { storeId, slug: candidate } }, select: { id: true } });
    if (!found || found.id === ignoreId) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function uniqueReferralCode(storeId: string, base: string): Promise<string> {
  const root = base.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24) || "AFF";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root}${i + 1}`;
    const found = await prisma.affiliate.findUnique({
      where: { storeId_referralCode: { storeId, referralCode: candidate } },
      select: { id: true },
    });
    if (!found) return candidate;
  }
  return `${root}${Date.now().toString(36).toUpperCase()}`;
}

// ---- pages ----
contentRouter.get(
  "/api/stores/:subdomain/pages",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const pages = await prisma.page.findMany({
      where: { storeId: req.ownedStore!.id },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ pages });
  })
);

contentRouter.post(
  "/api/stores/:subdomain/pages",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(pageBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    const slug = await uniqueSlug("page", storeId, b.slug || b.title);
    const publish = b.status === "published" || b.publishNow;
    const page = await prisma.page.create({
      data: {
        id: newId("page_"),
        storeId,
        title: b.title,
        slug,
        type: b.type,
        content: b.content,
        seoTitle: b.seoTitle,
        seoDescription: b.seoDescription,
        status: publish ? "published" : "draft",
        publishedAt: publish ? new Date() : null,
      },
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "page.created",
      entity: "page",
      entityId: page.id,
      ip: req.ip,
    });
    res.status(201).json({ page });
  })
);

contentRouter.patch(
  "/api/stores/:subdomain/pages/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(pageUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.page.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "PAGE_NOT_FOUND", "Page not found.");
    const b = req.body;
    let slug = existing.slug;
    if (b.slug !== undefined && b.slug !== existing.slug) slug = await uniqueSlug("page", storeId, b.slug, existing.id);
    const publish = b.status === "published" || b.publishNow === true;
    const page = await prisma.page.update({
      where: { id: existing.id },
      data: {
        ...(b.title !== undefined ? { title: b.title } : {}),
        ...(slug !== existing.slug ? { slug } : {}),
        ...(b.type !== undefined ? { type: b.type } : {}),
        ...(b.content !== undefined ? { content: b.content } : {}),
        ...(b.seoTitle !== undefined ? { seoTitle: b.seoTitle } : {}),
        ...(b.seoDescription !== undefined ? { seoDescription: b.seoDescription } : {}),
        ...(b.status !== undefined || b.publishNow !== undefined
          ? {
              status: publish ? "published" : "draft",
              publishedAt: publish ? existing.publishedAt ?? new Date() : null,
            }
          : {}),
      },
    });
    res.json({ page });
  })
);

contentRouter.delete(
  "/api/stores/:subdomain/pages/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.page.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "PAGE_NOT_FOUND", "Page not found.");
    await prisma.page.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);

// ---- blog ----
contentRouter.get(
  "/api/stores/:subdomain/blog",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const posts = await prisma.blogPost.findMany({
      where: { storeId: req.ownedStore!.id },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ posts });
  })
);

contentRouter.post(
  "/api/stores/:subdomain/blog",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(blogBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    const slug = await uniqueSlug("blogPost", storeId, b.slug || b.title);
    const scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : null;
    const post = await prisma.blogPost.create({
      data: {
        id: newId("post_"),
        storeId,
        title: b.title,
        slug,
        excerpt: b.excerpt,
        author: b.author,
        featuredImage: b.featuredImage,
        content: b.content,
        categories: b.categories as Prisma.InputJsonValue,
        tags: b.tags as Prisma.InputJsonValue,
        seoTitle: b.seoTitle,
        seoDescription: b.seoDescription,
        status: b.status,
        scheduledAt,
        publishedAt: b.status === "published" ? new Date() : null,
      },
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "blog.created",
      entity: "blog_post",
      entityId: post.id,
      ip: req.ip,
    });
    res.status(201).json({ post });
  })
);

contentRouter.patch(
  "/api/stores/:subdomain/blog/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(blogUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.blogPost.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "POST_NOT_FOUND", "Post not found.");
    const b = req.body;
    let slug = existing.slug;
    if (b.slug !== undefined && b.slug !== existing.slug) slug = await uniqueSlug("blogPost", storeId, b.slug, existing.id);
    const post = await prisma.blogPost.update({
      where: { id: existing.id },
      data: {
        ...(b.title !== undefined ? { title: b.title } : {}),
        ...(slug !== existing.slug ? { slug } : {}),
        ...(b.excerpt !== undefined ? { excerpt: b.excerpt } : {}),
        ...(b.author !== undefined ? { author: b.author } : {}),
        ...(b.featuredImage !== undefined ? { featuredImage: b.featuredImage } : {}),
        ...(b.content !== undefined ? { content: b.content } : {}),
        ...(b.categories !== undefined ? { categories: b.categories as Prisma.InputJsonValue } : {}),
        ...(b.tags !== undefined ? { tags: b.tags as Prisma.InputJsonValue } : {}),
        ...(b.seoTitle !== undefined ? { seoTitle: b.seoTitle } : {}),
        ...(b.seoDescription !== undefined ? { seoDescription: b.seoDescription } : {}),
        ...(b.status !== undefined
          ? { status: b.status, publishedAt: b.status === "published" ? existing.publishedAt ?? new Date() : existing.publishedAt }
          : {}),
        ...(b.scheduledAt !== undefined ? { scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : null } : {}),
      },
    });
    res.json({ post });
  })
);

contentRouter.delete(
  "/api/stores/:subdomain/blog/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.blogPost.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "POST_NOT_FOUND", "Post not found.");
    await prisma.blogPost.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);

// ---- affiliates ----
contentRouter.get(
  "/api/stores/:subdomain/affiliates",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const affiliates = await prisma.affiliate.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      include: { attributions: { orderBy: { createdAt: "desc" }, take: 20, include: { order: true } } },
    });
    const attributions = await prisma.affiliateAttribution.findMany({
      where: { storeId },
      select: {
        affiliateId: true,
        status: true,
        commissionAmount: true,
        settledAt: true,
        order: { select: { status: true } },
      },
    });
    res.json({
      affiliates: affiliates.map((a) => {
        const rows = attributions.filter((row) => row.affiliateId === a.id);
        const pending = rows.filter((row) => row.status === "pending");
        const settleable = pending.filter((row) => row.order.status === "delivered");
        const paid = rows.filter((row) => row.status === "paid");
        const settledDates = paid.map((row) => row.settledAt).filter((d): d is Date => Boolean(d));
        return {
          ...a,
          ordersCount: rows.length,
          commissionTotal: rows.reduce((s, r) => s + r.commissionAmount, 0),
          commissionPending: pending.reduce((s, r) => s + r.commissionAmount, 0),
          commissionSettleable: settleable.reduce((s, r) => s + r.commissionAmount, 0),
          commissionSettled: paid.reduce((s, r) => s + r.commissionAmount, 0),
          settleableCount: settleable.length,
          lastSettledAt: settledDates.length ? new Date(Math.max(...settledDates.map((d) => d.getTime()))) : null,
        };
      }),
      settlement: {
        enabled: true,
        mode: "manual_external",
        note: "تصفية العمولات تُسجَّل بعد تحويل المبلغ يدوياً خارج سند. لا يوجد صرف آلي أو رصيد قابل للسحب.",
      },
    });
  })
);

contentRouter.post(
  "/api/stores/:subdomain/affiliates/:id/settle",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const affiliate = await prisma.affiliate.findFirst({ where: { id: req.params.id, storeId } });
    if (!affiliate) throw new ApiError(404, "AFFILIATE_NOT_FOUND", "Affiliate not found.");

    const settledAt = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.affiliateAttribution.findMany({
        where: {
          storeId,
          affiliateId: affiliate.id,
          status: "pending",
          order: { status: "delivered" },
        },
        select: { id: true, commissionAmount: true },
      });
      if (!rows.length) return null;
      await tx.affiliateAttribution.updateMany({
        where: { id: { in: rows.map((row) => row.id) }, status: "pending" },
        data: { status: "paid", settledAt },
      });
      return {
        count: rows.length,
        amount: Math.round(rows.reduce((sum, row) => sum + row.commissionAmount, 0) * 100) / 100,
      };
    });

    if (!result) {
      throw new ApiError(
        409,
        "AFFILIATE_NOTHING_TO_SETTLE",
        "لا توجد عمولات مستحقة على طلبات تم توصيلها. لا تُصفّى العمولة قبل اكتمال الطلب."
      );
    }

    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "affiliate.commissions_settled",
      entity: "affiliate",
      entityId: affiliate.id,
      metadata: { count: result.count, amount: result.amount, mode: "manual_external" },
      ip: req.ip,
    });

    res.json({
      settled: { count: result.count, amount: result.amount, settledAt },
      note: "تم تسجيل تصفية العمولات. هذا إقرار بأن التحويل تم يدوياً خارج سند، وليس دفعة آلية.",
    });
  })
);


contentRouter.post(
  "/api/stores/:subdomain/affiliates",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(affiliateBodySchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const b = req.body;
    const referralCode = b.referralCode
      ? await uniqueReferralCode(storeId, b.referralCode)
      : await uniqueReferralCode(storeId, `${b.name}${newId("")}`);
    const affiliate = await prisma.affiliate.create({
      data: {
        id: newId("aff_"),
        storeId,
        name: b.name,
        phone: b.phone,
        email: b.email,
        referralCode,
        commissionRate: b.commissionRate,
        isActive: b.isActive,
      },
    });
    await writeAudit({
      storeId,
      ...auditActor(req.auth!),
      action: "affiliate.created",
      entity: "affiliate",
      entityId: affiliate.id,
      ip: req.ip,
    });
    res.status(201).json({ affiliate });
  })
);

contentRouter.patch(
  "/api/stores/:subdomain/affiliates/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(affiliateUpdateSchema),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.affiliate.findFirst({ where: { id: req.params.id, storeId } });
    if (!existing) throw new ApiError(404, "AFFILIATE_NOT_FOUND", "Affiliate not found.");
    const b = req.body;
    let referralCode: string | undefined;
    if (b.referralCode !== undefined && b.referralCode.toUpperCase() !== existing.referralCode) {
      referralCode = await uniqueReferralCode(storeId, b.referralCode);
    }
    const affiliate = await prisma.affiliate.update({
      where: { id: existing.id },
      data: {
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.phone !== undefined ? { phone: b.phone } : {}),
        ...(b.email !== undefined ? { email: b.email } : {}),
        ...(referralCode ? { referralCode } : {}),
        ...(b.commissionRate !== undefined ? { commissionRate: b.commissionRate } : {}),
        ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
      },
    });
    res.json({ affiliate });
  })
);

contentRouter.delete(
  "/api/stores/:subdomain/affiliates/:id",
  asyncHandler(requireAuth),
  validateParams(idParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    const storeId = req.ownedStore!.id;
    const existing = await prisma.affiliate.findFirst({ where: { id: req.params.id, storeId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "AFFILIATE_NOT_FOUND", "Affiliate not found.");
    await prisma.affiliate.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);
