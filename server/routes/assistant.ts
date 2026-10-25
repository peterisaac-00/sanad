import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../errors.js";
import { requireAuth, requireStoreOwnership } from "../middleware.js";
import { subdomainParamSchema, validateBody, validateParams } from "../validate.js";
import { aiService, integrationStatus } from "../services/integrations.js";
import { auditActor, writeAudit } from "../services/account.js";

export const assistantRouter = Router();

const taskEnum = z.enum([
  "product_description",
  "seo",
  "ad_copy",
  "coupon_suggestions",
  "whatsapp_message",
  "blog_topics",
]);

const generateSchema = z.strictObject({
  task: taskEnum,
  input: z.record(z.string(), z.unknown()).default({}),
});

assistantRouter.get(
  "/api/stores/:subdomain/assistant",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  asyncHandler(async (req, res) => {
    res.json({
      configured: aiService.configured,
      status: integrationStatus().ai,
      capabilities: {
        product_description: "وصف منتج عربي",
        seo: "عنوان ووصف SEO",
        ad_copy: "نصوص إعلانية",
        coupon_suggestions: "أفكار كوبونات",
        whatsapp_message: "رسائل واتساب",
        blog_topics: "مواضيع مدونة",
      },
      note: aiService.configured
        ? "المساعد متصل بمزود ذكاء اصطناعي متوافق مع OpenAI. راجع أي نص قبل نشره."
        : "المساعد غير متصل. أضف AI_BASE_URL و AI_API_KEY في بيئة الخادم. لن نولّد محتوى وهمياً بدون مزود حقيقي.",
    });
  })
);

assistantRouter.post(
  "/api/stores/:subdomain/assistant/generate",
  asyncHandler(requireAuth),
  validateParams(subdomainParamSchema),
  asyncHandler(requireStoreOwnership),
  validateBody(generateSchema),
  asyncHandler(async (req, res) => {
    const { task, input } = req.body as { task: z.infer<typeof taskEnum>; input: Record<string, unknown> };
    const result = await aiService.generate(task, input);
    await writeAudit({
      storeId: req.ownedStore!.id,
      ...auditActor(req.auth!),
      action: "assistant.generated",
      entity: "assistant",
      metadata: { task, provider: result.provider },
      ip: req.ip,
    });
    res.json({ result });
  })
);
