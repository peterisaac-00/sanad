import { env } from "../env.js";
import { ApiError } from "../errors.js";

/**
 * Integration boundaries. Each service either performs a real operation or
 * throws INTEGRATION_NOT_CONFIGURED — it never pretends to succeed.
 */

export type AiTask =
  | "product_description"
  | "seo"
  | "ad_copy"
  | "coupon_suggestions"
  | "whatsapp_message"
  | "blog_topics";

export interface AiResult {
  text: string;
  provider: string;
  model: string;
}

export interface AiService {
  readonly configured: boolean;
  generate(task: AiTask, input: Record<string, unknown>): Promise<AiResult>;
}

class OpenAiCompatibleService implements AiService {
  readonly configured = true;
  constructor(private baseUrl: string, private apiKey: string, private model: string) {}

  async generate(task: AiTask, input: Record<string, unknown>): Promise<AiResult> {
    const prompts: Record<AiTask, string> = {
      product_description:
        "اكتب وصفاً تجارياً عربياً واضحاً للمنتج في 2-3 فقرات. لا تختلق مواصفات غير موجودة.",
      seo: "اقترح عنوان SEO (حتى 60 حرفاً) ووصف ميتا (حتى 155 حرفاً) بالعربية. أعد النص بصيغة: العنوان: ...\\nالوصف: ...",
      ad_copy: "اكتب 3 نصوص إعلانية قصيرة بالعربية لمنتج، مع دعوة واضحة لاتخاذ إجراء.",
      coupon_suggestions: "اقترح 3 أفكار كوبونات عملية مع الكود ونوع الخصم والقيمة والسبب.",
      whatsapp_message: "اكتب رسالة واتساب عربية قصيرة وودّية لاستعادة سلة متروكة، بدون إلحاح.",
      blog_topics: "اقترح 5 عناوين مقالات مدونة عربية مرتبطة بالمتجر، مع سبب لكل عنوان.",
    };
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.6,
        messages: [
          { role: "system", content: "أنت مساعد تسويق لتجار التجارة الإلكترونية في المنطقة العربية. اكتب بالعربية الفصحى المبسطة." },
          { role: "user", content: `${prompts[task]}\n\nبيانات المتجر/المنتج:\n${JSON.stringify(input)}` },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(502, "AI_PROVIDER_ERROR", `AI provider returned ${res.status}.`, text.slice(0, 500));
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new ApiError(502, "AI_EMPTY_RESPONSE", "AI provider returned an empty response.");
    return { text, provider: "openai-compatible", model: this.model };
  }
}

class UnconfiguredAiService implements AiService {
  readonly configured = false;
  async generate(): Promise<AiResult> {
    throw new ApiError(
      503,
      "AI_NOT_CONFIGURED",
      "المساعد الذكي غير متصل بعد. أضف AI_BASE_URL و AI_API_KEY في إعدادات الخادم لتفعيله. لن يتم إنشاء أي محتوى تلقائياً."
    );
  }
}

export const aiService: AiService = env.ai.configured
  ? new OpenAiCompatibleService(env.ai.baseUrl, env.ai.apiKey, env.ai.model)
  : new UnconfiguredAiService();

export interface PaymentIntent {
  provider: string;
  reference: string;
  redirectUrl?: string;
  status: "pending" | "requires_action";
}

export interface PaymentService {
  readonly configured: boolean;
  readonly provider: string;
  createIntent(input: {
    orderId: string;
    amount: number;
    currency: string;
    customerPhone?: string;
    returnUrl: string;
  }): Promise<PaymentIntent>;
}

class UnconfiguredPaymentService implements PaymentService {
  readonly configured = false;
  readonly provider = "none";
  async createIntent(): Promise<PaymentIntent> {
    throw new ApiError(
      503,
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "بوابة الدفع الإلكتروني غير مهيأة. فعّل الدفع عند الاستلام أو أضف مزود دفع (PAYMENT_PROVIDER و PAYMENT_SECRET_KEY) أولاً."
    );
  }
}

/**
 * When credentials are present we still require a provider-specific adapter.
 * We deliberately refuse to invent a charge without one; the merchant sees a
 * clear configuration state instead of a fake successful payment.
 */
class CredentialsWithoutAdapter implements PaymentService {
  readonly configured = false;
  constructor(readonly provider: string) {}
  async createIntent(): Promise<PaymentIntent> {
    throw new ApiError(
      503,
      "PAYMENT_ADAPTER_MISSING",
      `تم حفظ مزود الدفع (${this.provider}) لكن محوّل الدفع غير مثبت بعد. أضف المحوّل قبل قبول المدفوعات الإلكترونية.`
    );
  }
}

export const paymentService: PaymentService = env.payments.configured
  ? new CredentialsWithoutAdapter(env.payments.provider)
  : new UnconfiguredPaymentService();

export function whatsappLink(phone: string, message = ""): string {
  const digits = phone.replace(/\D/g, "");
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export interface WhatsAppService {
  readonly autoSendConfigured: boolean;
  link(phone: string, message?: string): string;
  send(phone: string, message: string): Promise<{ sent: boolean; reason?: string }>;
}

class WhatsAppServiceBoundary implements WhatsAppService {
  readonly autoSendConfigured = env.whatsapp.cloudConfigured;
  link(phone: string, message = ""): string {
    return whatsappLink(phone, message);
  }
  async send(): Promise<{ sent: boolean; reason?: string }> {
    if (!this.autoSendConfigured) {
      return { sent: false, reason: "WHATSAPP_NOT_CONFIGURED" };
    }
    // Cloud API credentials exist but sending requires an approved template.
    return { sent: false, reason: "WHATSAPP_TEMPLATE_REQUIRED" };
  }
}

export const whatsappService: WhatsAppService = new WhatsAppServiceBoundary();

export interface ShippingCarrierService {
  readonly configured: boolean;
  readonly provider: string;
  trackingUrl(carrier: string, trackingNumber: string): string | null;
}

class ManualShippingService implements ShippingCarrierService {
  readonly configured = env.shipping.configured;
  readonly provider = env.shipping.provider || "manual";
  trackingUrl(carrier: string, trackingNumber: string): string | null {
    if (!trackingNumber) return null;
    if (/aramex/i.test(carrier)) return `https://www.aramex.com/track/results?ShipmentNumber=${encodeURIComponent(trackingNumber)}`;
    if (/bosta/i.test(carrier)) return `https://bosta.co/tracking-shipment?trackingNumber=${encodeURIComponent(trackingNumber)}`;
    return null;
  }
}

export const shippingService: ShippingCarrierService = new ManualShippingService();

export function integrationStatus() {
  return {
    ai: { configured: aiService.configured, label: aiService.configured ? "configured" : "not_configured" },
    payments: {
      configured: paymentService.configured,
      provider: paymentService.provider,
      label: paymentService.configured ? "configured" : "not_configured",
    },
    whatsapp: {
      autoSendConfigured: whatsappService.autoSendConfigured,
      linksAvailable: true,
      label: whatsappService.autoSendConfigured ? "configured" : "manual_links_only",
    },
    shipping: {
      configured: shippingService.configured,
      provider: shippingService.provider,
      label: shippingService.configured ? "configured" : "manual_carriers",
    },
    storage: { driver: env.storageDriver, label: env.storageDriver === "local" ? "local_disk" : "s3" },
  };
}
