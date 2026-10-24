import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { api } from "../lib/api";
import { dateTime, EGYPT_GOVERNORATES, money, ORDER_STATUS, PAYMENT_STATUS, safeError } from "../lib/format";
import { Link, navigate, useQuery } from "../lib/router";
import { useAsync } from "../lib/useAsync";
import { cn, useToast } from "../components/ui";
import { effectiveSubtotal, useStorefront } from "./StorefrontContext";
import {
  ContinueShoppingLink,
  CouponBox,
  ErrorBlock,
  LoadingBlock,
  ProductImage,
  QuantityStepper,
  RemoveLineButton,
  StorefrontEmpty,
  useStorefrontSeo,
} from "./StorefrontUI";

function checkoutErrorMessage(err: any): string {
  switch (err?.code) {
    case "INSUFFICIENT_STOCK":
      return "بعض المنتجات لم تعد متوفرة بالكمية المطلوبة. راجع السلة ثم حاول مجدداً.";
    case "UNKNOWN_SKU":
      return "أحد المنتجات تغيّر أو أُزيل من المتجر. حدّث السلة ثم حاول مجدداً.";
    case "PRODUCT_NOT_PRICED":
    case "CHECKOUT_CURRENCY_UNSUPPORTED":
      return "تعذر حساب سعر أحد المنتجات بعملة المتجر. تواصل مع المتجر.";
    case "COD_DISABLED":
      return "الدفع عند الاستلام غير متاح حالياً لهذا المتجر.";
    case "ONLINE_PAYMENT_DISABLED":
      return "الدفع الإلكتروني غير مفعّل لهذا المتجر.";
    case "PAYMENT_PROVIDER_NOT_CONFIGURED":
    case "PAYMENT_ADAPTER_MISSING":
      return "بوابة الدفع الإلكتروني غير مهيأة بعد. اختر الدفع عند الاستلام أو تواصل مع المتجر.";
    case "COUPON_INVALID":
    case "COUPON_EXPIRED":
    case "COUPON_NOT_STARTED":
    case "COUPON_MIN_ORDER":
    case "COUPON_LIMIT_REACHED":
    case "COUPON_CUSTOMER_LIMIT":
    case "COUPON_FIRST_ORDER_ONLY":
    case "COUPON_NOT_APPLICABLE":
      return safeError(err);
    default:
      return safeError(err);
  }
}

/* ---------------------------------- cart ---------------------------------- */

export function StorefrontCartPage() {
  const {
    base,
    store,
    cart,
    subtotal,
    coupon,
    currency,
    theme,
    setQty,
    removeItem,
  } = useStorefront();
  const discount = Math.min(coupon?.discount ?? 0, subtotal);
  const total = Math.max(0, subtotal - discount);

  useStorefrontSeo({
    title: `سلة التسوق — ${store.store_name}`,
    description: "راجع منتجات سلة التسوق قبل إتمام الطلب.",
    canonical: `${window.location.origin}${base}/cart`,
  });

  if (!cart.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14">
        <StorefrontEmpty
          icon={<ShoppingBag className="h-6 w-6" />}
          title="سلة التسوق فارغة"
          description="أضف منتجات من المتجر لتظهر هنا، ثم أكمل الطلب بخيارات الشحن المتاحة."
          action={
            <Link
              href={`${base}/products`}
              className="rounded-brand px-4 py-2.5 text-xs font-bold text-on-brand"
              style={{ background: theme.primary }}
            >
              تصفح المنتجات
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={cn("font-heading text-2xl font-extrabold", theme.heading)}>سلة التسوق</h1>
          <p className={cn("mt-1 text-xs", theme.muted)}>
            {cart.length} منتج · {cart.reduce((sum, item) => sum + item.qty, 0)} قطعة
          </p>
        </div>
        <ContinueShoppingLink />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className={cn("divide-y overflow-hidden rounded-brand border", theme.panel, theme.border)}>
          {cart.map((item) => (
            <div key={item.key} className="flex gap-3 p-3.5 sm:p-4">
              <Link
                href={`${base}/products/${encodeURIComponent(item.slug || item.productId)}`}
                className={cn("h-20 w-20 shrink-0 overflow-hidden rounded-brand border sm:h-24 sm:w-24", theme.border)}
              >
                <ProductImage src={item.image} alt={item.name} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`${base}/products/${encodeURIComponent(item.slug || item.productId)}`}
                      className={cn("line-clamp-2 text-sm font-bold leading-6", theme.heading)}
                    >
                      {item.name}
                    </Link>
                    {item.variantLabel ? (
                      <div className={cn("mt-0.5 text-[11px]", theme.muted)}>{item.variantLabel}</div>
                    ) : null}
                    <div className={cn("mt-0.5 font-mono text-[10px]", theme.muted)} dir="ltr">{item.sku}</div>
                  </div>
                  <RemoveLineButton onClick={() => removeItem(item.key)} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <QuantityStepper
                    qty={item.qty}
                    max={item.maxStock}
                    onChange={(next) => setQty(item.key, next)}
                    compact
                  />
                  <div className="text-end">
                    <div className={cn("text-sm font-bold tabular-nums", theme.heading)}>
                      {money(item.price * item.qty, currency)}
                    </div>
                    {item.qty > 1 ? (
                      <div className={cn("text-[10px]", theme.muted)}>{money(item.price, currency)} للقطعة</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-3">
          <div className={cn("space-y-3 rounded-brand border p-4", theme.panel)}>
            <h2 className={cn("font-heading text-base font-bold", theme.heading)}>ملخص الطلب</h2>
            <div className={cn("space-y-2 text-xs", theme.muted)}>
              <div className="flex items-center justify-between gap-2">
                <span>المجموع الفرعي</span>
                <span className={cn("font-semibold tabular-nums", theme.heading)}>{money(subtotal, currency)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex items-center justify-between gap-2 text-success">
                  <span>الخصم {coupon?.freeShipping ? "(شحن مجاني)" : ""}</span>
                  <span className="font-semibold tabular-nums">{coupon?.freeShipping ? "—" : `- ${money(discount, currency)}`}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span>الشحن</span>
                <span className="text-[11px]">يُحسب حسب المحافظة عند إتمام الطلب</span>
              </div>
            </div>
            <div className={cn("flex items-center justify-between border-t pt-3 text-sm", theme.border)}>
              <span className={cn("font-bold", theme.heading)}>الإجمالي التقديري</span>
              <span className="font-heading text-lg font-extrabold tabular-nums" style={{ color: theme.primary }}>
                {money(total, currency)}
              </span>
            </div>
            <CouponBox />
            <Link
              href={`${base}/checkout`}
              className="flex w-full items-center justify-center gap-2 rounded-brand px-4 py-3 text-sm font-bold text-on-brand shadow-lg transition hover:opacity-90"
              style={{ background: theme.primary }}
            >
              <ArrowLeft className="h-4 w-4" /> إتمام الطلب
            </Link>
            {store.cod_enabled ? (
              <p className={cn("flex items-center justify-center gap-1.5 text-[10px]", theme.muted)}>
                <ShieldCheck className="h-3.5 w-3.5" /> الدفع عند الاستلام متاح لهذا المتجر
              </p>
            ) : null}
          </div>
          <div className={cn("rounded-brand border p-4 text-[11px] leading-6", theme.panel, theme.muted)}>
            الأسعار والكميات تُراجع مرة أخرى على الخادم عند تأكيد الطلب. إذا تغيّر المخزون سيظهر لك تنبيه واضح قبل الخصم.
          </div>
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------- checkout -------------------------------- */

interface CheckoutForm {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  address: string;
  city: string;
  governorate: string;
  notes: string;
}

const EMPTY_FORM: CheckoutForm = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  address: "",
  city: "",
  governorate: "",
  notes: "",
};

/**
 * One key per checkout attempt. Retrying after a network timeout must not
 * create a second order, so the key survives failed submissions and is only
 * regenerated once an order has been confirmed.
 */
function newCheckoutKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `chk_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function StorefrontCheckoutPage() {
  const {
    subdomain,
    base,
    store,
    cart,
    subtotal,
    coupon,
    currency,
    theme,
    payments,
    cartToken,
    clearCart,
    trackCart,
  } = useStorefront();
  const toast = useToast();
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [payment, setPayment] = useState(payments.cod_enabled ? "COD" : payments.online_enabled ? "ONLINE" : "");
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [trackedPhone, setTrackedPhone] = useState("");
  const checkoutKey = useRef("");

  const billable = effectiveSubtotal(subtotal, coupon);
  const discount = Math.min(coupon?.discount ?? 0, subtotal);
  const shippingFee = coupon?.freeShipping ? 0 : Number(quote?.fee ?? 0);
  const codFee = coupon?.freeShipping ? 0 : Number(quote?.codFee ?? 0);
  const total = Math.round((billable + shippingFee + codFee) * 100) / 100;
  const methods = [
    ...(payments.cod_enabled ? [{ value: "COD", label: "الدفع عند الاستلام", description: "ادفع نقداً للمندوب عند استلام الطلب." }] : []),
    ...(payments.online_enabled ? [{ value: "ONLINE", label: "دفع إلكتروني", description: "ستتم متابعة الدفع عبر بوابة المتجر." }] : []),
  ];
  const canOrder = methods.length > 0;

  useStorefrontSeo({
    title: `إتمام الطلب — ${store.store_name}`,
    description: "أدخل بيانات التوصيل واختر طريقة الدفع لإتمام الطلب.",
    canonical: `${window.location.origin}${base}/checkout`,
    noindex: true,
  });

  const update = (key: keyof CheckoutForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError("");
  };

  useEffect(() => {
    if (!form.governorate && !form.city) {
      setQuote(null);
      setQuoteError("");
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      setQuoteLoading(true);
      api.storefront
        .shippingQuote(subdomain, {
          governorate: form.governorate,
          city: form.city,
          subtotal: billable,
          payment_method: payment || "COD",
        })
        .then((result) => {
          if (!alive) return;
          setQuote(result.quote);
          setQuoteError("");
        })
        .catch(() => {
          if (!alive) return;
          setQuote(null);
          setQuoteError("تعذر حساب الشحن حالياً. يمكنك إتمام الطلب وسيتواصل معك المتجر لتأكيد التوصيل.");
        })
        .finally(() => {
          if (alive) setQuoteLoading(false);
        });
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [subdomain, form.governorate, form.city, billable, payment]);

  const validate = () => {
    const next: Partial<Record<keyof CheckoutForm, string>> = {};
    if (form.customer_name.trim().length < 2) next.customer_name = "أدخل الاسم الكامل.";
    const digits = form.customer_phone.replace(/\D/g, "");
    if (digits.length < 8) next.customer_phone = "أدخل رقم هاتف صحيحاً للتواصل والتوصيل.";
    if (form.customer_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email.trim())) {
      next.customer_email = "صيغة البريد الإلكتروني غير صحيحة.";
    }
    if (form.address.trim().length < 5) next.address = "أدخل عنواناً واضحاً للتوصيل.";
    if (store.country_code === "EG" && !form.governorate.trim()) next.governorate = "اختر المحافظة.";
    if (store.country_code !== "EG" && !form.governorate.trim() && !form.city.trim()) next.governorate = "أدخل المنطقة أو المدينة.";
    if (!canOrder || !payment) next.notes = "لا توجد طريقة دفع متاحة حالياً.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleTrack = () => {
    if (!form.customer_phone.trim() && !form.customer_name.trim()) return;
    const signature = `${form.customer_phone}|${form.customer_name}`;
    if (signature === trackedPhone) return;
    setTrackedPhone(signature);
    trackCart({ name: form.customer_name, phone: form.customer_phone, email: form.customer_email });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      trackCart({ name: form.customer_name, phone: form.customer_phone, email: form.customer_email, force: true });
      if (!checkoutKey.current) checkoutKey.current = newCheckoutKey();
      const result = await api.orders.checkout(subdomain, {
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_email: form.customer_email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        governorate: form.governorate.trim(),
        payment_method: payment,
        courier: "",
        coupon_code: coupon?.code || "",
        shipping_zone_id: quote?.zoneId || "",
        affiliate_code: "",
        cart_token: cartToken,
        notes: form.notes.trim(),
        items: cart.map((item) =>
          item.variantId ? { variantId: item.variantId, qty: item.qty } : { sku: item.sku, qty: item.qty }
        ),
      }, checkoutKey.current);
      checkoutKey.current = "";
      const phone = encodeURIComponent(form.customer_phone.trim());
      clearCart();
      const tracking = result.tracking_token
        ? `token=${encodeURIComponent(result.tracking_token)}`
        : `phone=${phone}`;
      navigate(`${base}/order/${result.order.orderNumber}?${tracking}&success=1`, { replace: true });
      toast.success("تم استلام طلبك بنجاح.");
    } catch (err: any) {
      setSubmitError(checkoutErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14">
        <StorefrontEmpty
          icon={<ShoppingBag className="h-6 w-6" />}
          title="لا يمكن إتمام طلب فارغ"
          description="أضف منتجات إلى السلة أولاً ثم عد إلى صفحة إتمام الطلب."
          action={
            <Link
              href={`${base}/products`}
              className="rounded-brand px-4 py-2.5 text-xs font-bold text-on-brand"
              style={{ background: theme.primary }}
            >
              تصفح المنتجات
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={cn("font-heading text-2xl font-extrabold", theme.heading)}>إتمام الطلب</h1>
          <p className={cn("mt-1 text-xs", theme.muted)}>بيانات التوصيل والدفع، ثم مراجعة نهائية قبل تأكيد الطلب.</p>
        </div>
        <Link href={`${base}/cart`} className={cn("inline-flex items-center gap-1 text-xs font-semibold", theme.muted)}>
          <ChevronLeft className="h-3.5 w-3.5" /> تعديل السلة
        </Link>
      </div>

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_380px]" noValidate>
        <div className="space-y-4">
          <section className={cn("space-y-4 rounded-brand border p-4 sm:p-5", theme.panel)}>
            <h2 className={cn("flex items-center gap-2 font-heading text-base font-bold", theme.heading)}>
              <MapPin className="h-4 w-4" style={{ color: theme.primary }} /> بيانات التوصيل
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className={cn("text-xs font-semibold", theme.heading)}>الاسم الكامل *</span>
                <input
                  value={form.customer_name}
                  onChange={(event) => update("customer_name", event.target.value)}
                  className={theme.input}
                  autoComplete="name"
                  maxLength={200}
                  placeholder="الاسم كما سيظهر للمندوب"
                />
                {errors.customer_name ? <span className="text-[11px] text-danger">{errors.customer_name}</span> : null}
              </label>
              <label className="space-y-1.5">
                <span className={cn("text-xs font-semibold", theme.heading)}>رقم الهاتف *</span>
                <input
                  value={form.customer_phone}
                  onChange={(event) => update("customer_phone", event.target.value)}
                  onBlur={handleTrack}
                  className={theme.input}
                  autoComplete="tel"
                  dir="ltr"
                  inputMode="tel"
                  maxLength={32}
                  placeholder="01xxxxxxxxx"
                />
                {errors.customer_phone ? <span className="text-[11px] text-danger">{errors.customer_phone}</span> : null}
              </label>
              <label className="space-y-1.5">
                <span className={cn("text-xs font-semibold", theme.heading)}>البريد الإلكتروني (اختياري)</span>
                <input
                  value={form.customer_email}
                  onChange={(event) => update("customer_email", event.target.value)}
                  onBlur={handleTrack}
                  className={theme.input}
                  type="email"
                  autoComplete="email"
                  dir="ltr"
                  maxLength={254}
                  placeholder="you@example.com"
                />
                {errors.customer_email ? <span className="text-[11px] text-danger">{errors.customer_email}</span> : null}
              </label>
              <label className="space-y-1.5">
                <span className={cn("text-xs font-semibold", theme.heading)}>
                  {store.country_code === "EG" ? "المحافظة *" : "المنطقة / المحافظة *"}
                </span>
                {store.country_code === "EG" ? (
                  <select
                    value={form.governorate}
                    onChange={(event) => update("governorate", event.target.value)}
                    className={theme.input}
                  >
                    <option value="">اختر المحافظة</option>
                    {EGYPT_GOVERNORATES.map((governorate) => (
                      <option key={governorate} value={governorate}>{governorate}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.governorate}
                    onChange={(event) => update("governorate", event.target.value)}
                    className={theme.input}
                    maxLength={200}
                    placeholder="المدينة أو المنطقة"
                  />
                )}
                {errors.governorate ? <span className="text-[11px] text-danger">{errors.governorate}</span> : null}
              </label>
              <label className="space-y-1.5">
                <span className={cn("text-xs font-semibold", theme.heading)}>المدينة / الحي</span>
                <input
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                  className={theme.input}
                  autoComplete="address-level2"
                  maxLength={200}
                  placeholder="مثال: مدينة نصر"
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className={cn("text-xs font-semibold", theme.heading)}>العنوان بالتفصيل *</span>
                <input
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                  className={theme.input}
                  autoComplete="street-address"
                  maxLength={300}
                  placeholder="اسم الشارع، رقم المبنى، علامة مميزة"
                />
                {errors.address ? <span className="text-[11px] text-danger">{errors.address}</span> : null}
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className={cn("text-xs font-semibold", theme.heading)}>ملاحظات على الطلب (اختياري)</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  className={cn(theme.input, "min-h-20 resize-y leading-6")}
                  maxLength={2000}
                  placeholder="وقت مناسب للتوصيل أو أي تفاصيل إضافية"
                />
              </label>
            </div>
          </section>

          <section className={cn("space-y-3 rounded-brand border p-4 sm:p-5", theme.panel)}>
            <h2 className={cn("flex items-center gap-2 font-heading text-base font-bold", theme.heading)}>
              <CreditCard className="h-4 w-4" style={{ color: theme.primary }} /> طريقة الدفع
            </h2>
            {canOrder ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {methods.map((method) => {
                  const active = payment === method.value;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPayment(method.value)}
                      className={cn("rounded-brand border p-3 text-start transition", active ? "" : theme.panelHover)}
                      style={active ? { borderColor: theme.primary, background: `color-mix(in srgb, ${theme.primary} 7%, transparent)` } : { borderColor: "var(--color-border)" }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn("text-xs font-bold", theme.heading)}>{method.label}</span>
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full border"
                          style={{ borderColor: active ? theme.primary : "var(--color-muted)", background: active ? theme.primary : "transparent" }}
                        >
                          {active ? <Check className="h-2.5 w-2.5 text-on-brand" /> : null}
                        </span>
                      </span>
                      <span className={cn("mt-1 block text-[11px] leading-5", theme.muted)}>{method.description}</span>
                      {method.value === "COD" && Number(quote?.codFee) > 0 ? (
                        <span className={cn("mt-1 block text-[10px]", theme.muted)}>
                          رسوم التحصيل: {money(Number(quote.codFee), currency)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-brand border border-warning-line bg-warning-soft p-3 text-[11px] leading-6 text-warning">
                لا توجد طريقة دفع مهيأة حالياً لهذا المتجر. تواصل مع المتجر عبر واتساب لإتمام طلبك.
              </div>
            )}
            {errors.notes ? <span className="text-[11px] text-danger">{errors.notes}</span> : null}
          </section>

          <section className={cn("rounded-brand border p-4 sm:p-5", theme.panel)}>
            <div className="flex items-start gap-2 text-[11px] leading-6">
              <Truck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.primary }} />
              <div className={theme.muted}>
                {quoteLoading ? (
                  <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> جارٍ حساب الشحن…</span>
                ) : quoteError ? (
                  <span className="text-warning">{quoteError}</span>
                ) : quote?.zoneId ? (
                  <span>
                    الشحن إلى <strong className={theme.heading}>{quote.zoneName}</strong>
                    {quote.estimatedDaysMin || quote.estimatedDaysMax
                      ? ` · التوصيل المتوقع ${quote.estimatedDaysMin || 1}–${quote.estimatedDaysMax || quote.estimatedDaysMin || 1} يوم`
                      : ""}
                    {Number(quote.fee) === 0 ? " · الشحن مجاني" : ""}
                  </span>
                ) : form.governorate || form.city ? (
                  <span>لا توجد منطقة شحن مطابقة. سيتم التواصل معك لتأكيد تفاصيل التوصيل.</span>
                ) : (
                  <span>أدخل المحافظة لحساب تكلفة الشحن المتوقعة.</span>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-3">
          <div className={cn("space-y-3 rounded-brand border p-4", theme.panel)}>
            <h2 className={cn("font-heading text-base font-bold", theme.heading)}>ملخص الطلب</h2>
            <div className="max-h-64 space-y-2.5 overflow-y-auto pe-1">
              {cart.map((item) => (
                <div key={item.key} className="flex items-center gap-2.5">
                  <div className={cn("h-11 w-11 shrink-0 overflow-hidden rounded-brand-sm border", theme.border)}>
                    <ProductImage src={item.image} alt={item.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("line-clamp-1 text-[11px] font-semibold", theme.heading)}>{item.name}</div>
                    <div className={cn("text-[10px]", theme.muted)}>
                      {item.qty} × {money(item.price, currency)}
                      {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                    </div>
                  </div>
                  <div className={cn("text-[11px] font-bold tabular-nums", theme.heading)}>{money(item.price * item.qty, currency)}</div>
                </div>
              ))}
            </div>

            <CouponBox compact />

            <div className={cn("space-y-2 border-t pt-3 text-xs", theme.border, theme.muted)}>
              <div className="flex items-center justify-between gap-2">
                <span>المجموع الفرعي</span>
                <span className={cn("font-semibold tabular-nums", theme.heading)}>{money(subtotal, currency)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex items-center justify-between gap-2 text-success">
                  <span>الخصم</span>
                  <span className="font-semibold tabular-nums">- {money(discount, currency)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span>الشحن</span>
                <span className="tabular-nums">{coupon?.freeShipping ? "مجاني" : quote ? money(shippingFee + codFee, currency) : "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-2 text-sm" style={{ borderColor: "var(--color-border)" }}>
                <span className={cn("font-bold", theme.heading)}>الإجمالي</span>
                <span className="font-heading text-lg font-extrabold tabular-nums" style={{ color: theme.primary }}>{money(total, currency)}</span>
              </div>
              <p className="text-[10px] leading-5">تُحتسب الأسعار النهائية على الخادم حسب سعر المنتج والمخزون ومنطقة الشحن.</p>
            </div>

            {submitError ? (
              <div className="rounded-brand border border-danger-line bg-danger-soft p-2.5 text-[11px] leading-6 text-danger">
                {submitError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !canOrder}
              className="flex w-full items-center justify-center gap-2 rounded-brand px-4 py-3 text-sm font-bold text-on-brand shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: theme.primary }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "جارٍ تأكيد الطلب…" : "تأكيد الطلب"}
            </button>
            {store.return_policy ? (
              <p className={cn("text-[10px] leading-5", theme.muted)}>
                بإتمام الطلب توافق على سياسة المتجر: {store.return_policy}
              </p>
            ) : null}
          </div>
          <div className={cn("flex items-start gap-2 rounded-brand border p-3 text-[10px] leading-5", theme.panel, theme.muted)}>
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.primary }} />
            <span>لا نحفظ أي بيانات بطاقات بنكية في المتصفح. الدفع عند الاستلام لا يتطلب دفعاً مقدماً.</span>
          </div>
        </aside>
      </form>
    </div>
  );
}

/* --------------------------- order confirmation --------------------------- */

const STAGES = [
  { keys: ["pending", "needs_confirmation"], label: "تم استلام الطلب" },
  { keys: ["confirmed", "preparing", "ready_to_ship"], label: "قيد التجهيز" },
  { keys: ["shipped", "out_for_delivery"], label: "في الطريق إليك" },
  { keys: ["delivered"], label: "تم التوصيل" },
];

function statusTone(status: string) {
  if (status === "cancelled" || status === "returned") return "bg-danger-soft text-danger border-danger-line";
  if (status === "delivered") return "bg-success-soft text-success border-success-line";
  if (status === "shipped" || status === "out_for_delivery") return "bg-info-soft text-info border-info-line";
  return "bg-warning-soft text-warning border-warning-line";
}

function TrackForm({
  initialOrder = "",
  initialPhone = "",
  error,
}: {
  initialOrder?: string;
  initialPhone?: string;
  error?: string;
}) {
  const { base, subdomain, theme } = useStorefront();
  const [order, setOrder] = useState(initialOrder);
  const [phone, setPhone] = useState(initialPhone);
  const [localError, setLocalError] = useState("");

  useEffect(() => setOrder(initialOrder), [initialOrder]);
  useEffect(() => setPhone(initialPhone), [initialPhone]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const number = order.replace(/\D/g, "");
    if (!number) {
      setLocalError("أدخل رقم الطلب.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 8) {
      setLocalError("أدخل رقم الهاتف المستخدم في الطلب.");
      return;
    }
    navigate(`${base}/order/${number}?phone=${encodeURIComponent(phone.trim())}`);
  };

  return (
    <form onSubmit={submit} className={cn("mx-auto w-full max-w-md space-y-3 rounded-brand border p-5", theme.panel)} noValidate>
      <div className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-brand" style={{ background: `color-mix(in srgb, ${theme.primary} 9%, transparent)`, color: theme.primary }}>
          <Search className="h-5 w-5" />
        </div>
        <h1 className={cn("font-heading text-xl font-bold", theme.heading)}>تتبع طلبك</h1>
        <p className={cn("mt-1 text-[11px] leading-6", theme.muted)}>
          أدخل رقم الطلب ورقم الهاتف المستخدم عند الشراء لعرض حالة الطلب وتفاصيله. يظهر رقم الهاتف مخفياً جزئياً بعد التحقق.
        </p>
      </div>
      {error || localError ? (
        <div className="rounded-brand border border-danger-line bg-danger-soft p-2.5 text-[11px] text-danger">{localError || error}</div>
      ) : null}
      <label className="block space-y-1.5">
        <span className={cn("text-xs font-semibold", theme.heading)}>رقم الطلب</span>
        <input
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          className={theme.input}
          dir="ltr"
          inputMode="numeric"
          placeholder="1234"
          maxLength={20}
        />
      </label>
      <label className="block space-y-1.5">
        <span className={cn("text-xs font-semibold", theme.heading)}>رقم الهاتف</span>
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className={theme.input}
          dir="ltr"
          inputMode="tel"
          placeholder="01xxxxxxxxx"
          maxLength={32}
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-brand px-4 py-2.5 text-xs font-bold text-on-brand"
        style={{ background: theme.primary }}
      >
        عرض الطلب
      </button>
      <div className="text-center">
        <Link href={`${base}/products`} className={cn("text-[11px] font-semibold", theme.muted)}>العودة إلى المتجر</Link>
      </div>
    </form>
  );
}

export function StorefrontOrderPage({ orderNumber }: { orderNumber: string }) {
  const { subdomain, base, store, theme, currency } = useStorefront();
  const query = useQuery();
  const phone = query.get("phone") || "";
  const token = query.get("token") || "";
  const success = query.get("success") === "1";
  const hasCredentials = Boolean(token || phone);
  const result = useAsync(
    () =>
      hasCredentials
        ? api.storefront.order(subdomain, orderNumber, token ? { token } : { phone })
        : Promise.resolve(null),
    [subdomain, orderNumber, phone, token, hasCredentials]
  );
  const order = result.data?.order;

  // After a successful phone lookup, swap the phone out of the address bar
  // for the signed token the server just issued, so it stays out of history.
  useEffect(() => {
    const freshToken = result.data?.tracking_token;
    if (!freshToken || !phone || token) return;
    const params = new URLSearchParams();
    params.set("token", freshToken);
    if (success) params.set("success", "1");
    window.history.replaceState(window.history.state, "", `${base}/order/${orderNumber}?${params.toString()}`);
  }, [result.data?.tracking_token, phone, token, success, base, orderNumber]);

  useStorefrontSeo({
    title: `الطلب SND-${orderNumber} — ${store.store_name}`,
    description: "تفاصيل وحالة طلبك في المتجر.",
    canonical: `${window.location.origin}${base}/order/${orderNumber}`,
    noindex: true,
  });

  if (!hasCredentials) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <TrackForm initialOrder={orderNumber} />
      </div>
    );
  }

  if (result.loading) {
    return <div className="mx-auto max-w-4xl px-4 py-12"><LoadingBlock label="جارٍ تحميل الطلب…" /></div>;
  }

  if (result.error || !order) {
    const status = (result.error as any)?.status;
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <TrackForm
          initialOrder={orderNumber}
          initialPhone={phone}
          error={
            status === 404
              ? token
                ? "انتهت صلاحية رابط التتبع أو أنه غير صالح. أدخل رقم الهاتف المستخدم في الطلب لعرضه."
                : "لم نعثر على طلب بهذا الرقم وهذا الهاتف. تحقق من البيانات أو تواصل مع المتجر."
              : "تعذر تحميل الطلب. تحقق من بيانات التتبع وحاول مجدداً."
          }
        />
      </div>
    );
  }

  const stageIndex = STAGES.findIndex((stage) => stage.keys.includes(String(order.status)));
  const cancelled = order.status === "cancelled" || order.status === "returned";
  const whatsapp = store.whatsapp_url
    ? `${store.whatsapp_url}${store.whatsapp_url.includes("?") ? "&" : "?"}text=${encodeURIComponent(
        `مرحباً، بخصوص طلبي SND-${order.orderNumber}.`
      )}`
    : "";
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const statusInfo = ORDER_STATUS[order.status];
  const paymentInfo = PAYMENT_STATUS[order.paymentStatus];

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <div className={cn("overflow-hidden rounded-brand-lg border", theme.panel)}>
        <div
          className="space-y-2 p-5 text-center sm:p-7"
          style={{ background: `linear-gradient(140deg, color-mix(in srgb, ${theme.primary} 9%, transparent), transparent 65%)` }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-on-brand shadow-lg"
            style={{ background: success ? theme.primary : "var(--color-surface)", color: success ? "var(--color-on-primary)" : theme.primary }}
          >
            {success ? <Check className="h-7 w-7" /> : <Package className="h-6 w-6" />}
          </div>
          <h1 className={cn("font-heading text-xl font-extrabold sm:text-2xl", theme.heading)}>
            {success ? "تم استلام طلبك بنجاح" : "تفاصيل طلبك"}
          </h1>
          <p className={cn("mx-auto max-w-lg text-xs leading-6", theme.muted)}>
            {success
              ? "سيتواصل معك المتجر لتأكيد الطلب وتفاصيل التوصيل. احتفظ برقم الطلب للمتابعة."
              : `مرحباً ${order.customerName || ""}، هذه آخر حالة مسجلة لطلبك.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="rounded-full bg-surface px-3 py-1 font-mono text-xs font-bold" dir="ltr">
              SND-{order.orderNumber}
            </span>
            <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold", statusTone(String(order.status)))}>
              {statusInfo?.label || order.status}
            </span>
            <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-semibold">
              {paymentInfo?.label || order.paymentStatus}
            </span>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          {!cancelled ? (
            <div className="grid grid-cols-4 gap-2">
              {STAGES.map((stage, index) => {
                const complete = stageIndex >= index && stageIndex !== -1;
                return (
                  <div key={stage.label} className="space-y-1.5 text-center">
                    <div className="flex items-center">
                      <span
                        className={cn("mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold", complete ? "text-on-brand" : "")}
                        style={complete ? { background: theme.primary, color: "var(--color-on-primary)" } : { background: "var(--color-surface)", color: "var(--color-muted)" }}
                      >
                        {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                    </div>
                    <div className={cn("text-[10px] font-semibold leading-4", complete ? theme.heading : theme.muted)}>{stage.label}</div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className={cn("rounded-brand border p-3", theme.border)}>
              <div className={cn("text-[10px]", theme.muted)}>تاريخ الطلب</div>
              <div className={cn("mt-1 text-xs font-semibold", theme.heading)}>{dateTime(order.createdAt)}</div>
            </div>
            <div className={cn("rounded-brand border p-3", theme.border)}>
              <div className={cn("text-[10px]", theme.muted)}>العميل</div>
              <div className={cn("mt-1 text-xs font-semibold", theme.heading)}>{order.customerName || "—"}</div>
            </div>
            <div className={cn("rounded-brand border p-3", theme.border)}>
              <div className={cn("text-[10px]", theme.muted)}>الإجمالي</div>
              <div className={cn("mt-1 text-xs font-bold", theme.heading)}>{order.amountText || money(Number(order.amountEgp), currency)}</div>
            </div>
          </div>

          <div className={cn("divide-y rounded-brand border", theme.border)}>
            {items.map((item: any, index: number) => (
              <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={cn("h-10 w-10 shrink-0 overflow-hidden rounded-brand-sm border", theme.border)}>
                    <ProductImage src={item.imageUrl} alt={item.name} />
                  </div>
                  <div className="min-w-0">
                    <div className={cn("line-clamp-1 text-xs font-semibold", theme.heading)}>{item.name}</div>
                    <div className={cn("text-[10px]", theme.muted)}>
                      {item.qty} × {money(item.unitPriceEgp, currency)}
                      {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                    </div>
                  </div>
                </div>
                <div className={cn("text-xs font-bold tabular-nums", theme.heading)}>{money(Number(item.unitPriceEgp) * Number(item.qty), currency)}</div>
              </div>
            ))}
          </div>

          <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-brand border p-3 text-[11px]", theme.border, theme.muted)}>
            <span className={cn("inline-flex items-center gap-1.5", theme.muted)}>
              <Phone className="h-3.5 w-3.5" /> {order.customerPhone || "—"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" /> حالة الدفع: {paymentInfo?.label || order.paymentStatus}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-brand px-4 py-2.5 text-xs font-bold text-on-brand"
                style={{ background: theme.primary }}
              >
                <MessageCircle className="h-4 w-4" /> تواصل بخصوص الطلب
              </a>
            ) : null}
            <Link
              href={`${base}/products`}
              className={cn("inline-flex items-center gap-2 rounded-brand border px-4 py-2.5 text-xs font-bold", theme.border)}
            >
              <ShoppingBag className="h-4 w-4" /> متابعة التسوق
            </Link>
            <Link
              href={`${base}/track`}
              className={cn("inline-flex items-center gap-2 rounded-brand border px-4 py-2.5 text-xs font-bold", theme.border)}
            >
              <Search className="h-4 w-4" /> تتبع طلب آخر
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StorefrontTrackPage() {
  const { store, theme, base } = useStorefront();
  useStorefrontSeo({
    title: `تتبع الطلب — ${store.store_name}`,
    description: "تتبع حالة طلبك باستخدام رقم الطلب ورقم الهاتف.",
    canonical: `${window.location.origin}${base}/track`,
    noindex: true,
  });
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <TrackForm />
      <div className="mt-5 flex justify-center">
        <ContinueShoppingLink>العودة إلى المتجر</ContinueShoppingLink>
      </div>
    </div>
  );
}
