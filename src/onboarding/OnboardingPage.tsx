import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  Globe2,
  Loader2,
  Monitor,
  Palette,
  Rocket,
  Save,
  Smartphone,
  Sparkles,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import { api, mediaUrl } from "../lib/api";
import { BUSINESS_TYPES, EGYPT_GOVERNORATES, TEMPLATES, safeError } from "../lib/format";
import { navigate } from "../lib/router";
import { useSession } from "../lib/session";
import { ThemeToggle } from "../lib/theme";
import { Alert, Button, Field, Input, Select, Spinner, Switch, Textarea, useToast } from "../components/ui";
import { BrandLogo } from "../components/Brand";
import { ImageUploader } from "../components/ImageUploader";
import { StorePreview } from "../components/StorePreview";

const STEPS = [
  { title: "هوية المتجر", subtitle: "الاسم والنشاط والسوق", icon: Store },
  { title: "الشعار والهوية", subtitle: "الصور والألوان والخط", icon: Palette },
  { title: "القالب", subtitle: "اختر شكل واجهة متجرك", icon: Sparkles },
  { title: "البيع والدفع", subtitle: "الدفع عند الاستلام والشحن", icon: Wallet },
  { title: "المعاينة والنشر", subtitle: "راجع متجرك ثم انشره", icon: Rocket },
];

interface FormState {
  storeName: string;
  subdomain: string;
  businessType: string;
  description: string;
  countryCode: string;
  governorate: string;
  currency: string;
  primaryLanguage: string;
  logoUrl: string;
  coverUrl: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  themeMode: string;
  arabicFont: string;
  templateKey: string;
  whatsapp: string;
  returnPolicy: string;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  shippingFee: number;
  shippingThreshold: string;
  shippingGovernorates: string;
}

function fromData(data: any): FormState {
  const store = data.store ?? {};
  const branding = data.branding ?? {};
  const fallbackZone = (data.shipping_zones ?? []).find((zone: any) => zone.isFallback) ?? data.shipping_zones?.[0];
  return {
    storeName: store.storeName ?? "",
    subdomain: store.subdomain ?? "",
    businessType: store.businessType ?? "other",
    description: store.description ?? "",
    countryCode: store.countryCode ?? "EG",
    governorate: store.governorate ?? "",
    currency: store.currency ?? "EGP",
    primaryLanguage: store.primaryLanguage ?? "ar",
    logoUrl: store.logoUrl ?? "",
    coverUrl: store.coverUrl ?? "",
    primaryColor: branding.primaryColor ?? "#047857",
    secondaryColor: branding.secondaryColor ?? "#0F2A24",
    textColor: branding.textColor ?? "#0F172A",
    themeMode: branding.themeMode ?? "light",
    arabicFont: branding.arabicFont ?? "IBM Plex Sans Arabic",
    templateKey: store.templateKey ?? branding.templateKey ?? "general",
    whatsapp: store.whatsapp ?? "",
    returnPolicy: store.returnPolicy ?? "",
    codEnabled: Boolean(store.codEnabled),
    onlinePaymentEnabled: Boolean(store.onlinePaymentEnabled),
    shippingFee: Number(data.store?.shippingFee ?? 0),
    shippingThreshold: "",
    shippingGovernorates: Array.isArray(fallbackZone?.governorates) ? fallbackZone.governorates.join(", ") : "",
  };
}

function payloadOf(form: FormState, step: number) {
  return {
    step,
    ...(form.storeName.trim().length >= 2 ? { storeName: form.storeName.trim() } : {}),
    ...(form.subdomain.trim() ? { subdomain: form.subdomain.trim().toLowerCase() } : {}),
    businessType: form.businessType,
    description: form.description,
    countryCode: form.countryCode,
    governorate: form.governorate,
    currency: form.currency,
    primaryLanguage: form.primaryLanguage,
    whatsapp: form.whatsapp,
    returnPolicy: form.returnPolicy,
    codEnabled: form.codEnabled,
    onlinePaymentEnabled: form.onlinePaymentEnabled,
    templateKey: form.templateKey,
    branding: {
      logoUrl: form.logoUrl,
      coverUrl: form.coverUrl,
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      textColor: form.textColor,
      themeMode: form.themeMode,
      arabicFont: form.arabicFont,
      templateKey: form.templateKey,
    },
    selling: {
      whatsapp: form.whatsapp,
      returnPolicy: form.returnPolicy,
      codEnabled: form.codEnabled,
      onlinePaymentEnabled: form.onlinePaymentEnabled,
      shipping: {
        governorates: form.shippingGovernorates
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        fee: Number(form.shippingFee) || 0,
        freeShippingThreshold: form.shippingThreshold === "" ? null : Number(form.shippingThreshold) || 0,
      },
    },
  };
}

export function OnboardingPage() {
  const { session, loading, refresh } = useSession();
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [step, setStep] = useState(1);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<any>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const readyRef = useRef(false);
  const dirtyRef = useRef(false);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (!loading && !session) navigate("/auth/login?next=/onboarding", { replace: true });
    if (!loading && session && session.store?.onboardingCompleted && !published && !publishing) {
      // Identity is admin-managed after submission; a completed store goes
      // straight to the console (or waits there for platform approval).
      navigate("/dashboard", { replace: true });
    }
  }, [loading, session, published, publishing]);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    api.onboarding
      .get()
      .then((result) => {
        if (!alive) return;
        setData(result);
        setForm(fromData(result));
        setStep(Math.min(5, Math.max(1, result.store?.onboardingStep ?? 1)));
        readyRef.current = true;
      })
      .catch((err) => {
        if (alive) setLoadError(safeError(err));
      });
    return () => {
      alive = false;
    };
  }, [session]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    dirtyRef.current = true;
    setFormError("");
  };

  const performSave = async (silent = true): Promise<boolean> => {
    if (!form) return false;
    if (!form.storeName.trim() || form.storeName.trim().length < 2) {
      if (!silent) setFormError("اسم المتجر مطلوب (حرفان على الأقل).");
      return false;
    }
    setSaving(true);
    try {
      const result = await api.onboarding.save(payloadOf(form, step));
      setData((current: any) => ({ ...current, ...result }));
      setSavedAt(new Date());
      dirtyRef.current = false;
      return true;
    } catch (err: any) {
      if (!silent) setFormError(safeError(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = (silent = true): Promise<boolean> => {
    if (saveInFlightRef.current) return saveInFlightRef.current;
    const operation = performSave(silent);
    saveInFlightRef.current = operation;
    void operation.finally(() => {
      if (saveInFlightRef.current === operation) saveInFlightRef.current = null;
    });
    return operation;
  };

  // Debounced autosave: a merchant can close the tab at any moment.
  useEffect(() => {
    if (!form || !readyRef.current || !dirtyRef.current) return;
    const timer = window.setTimeout(() => void save(true), 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, step]);

  const validateStep = (): string => {
    if (!form) return "تعذر تحميل بيانات المتجر.";
    if (step === 1) {
      if (form.storeName.trim().length < 2) return "اكتب اسم متجرك (حرفان على الأقل).";
      if (!/^[a-z0-9-]{3,40}$/.test(form.subdomain.trim())) return "رابط المتجر يجب أن يكون 3-40 حرفاً إنجليزياً أو رقماً أو شرطة.";
      if (form.description.trim().length < 10) return "أضف وصفاً قصيراً للمتجر (10 أحرف على الأقل) ليظهر للعملاء.";
    }
    if (step === 3 && !TEMPLATES[form.templateKey]) return "اختر قالباً لمتجرك.";
    if (step === 4 && !form.codEnabled && !form.onlinePaymentEnabled) return "فعّل طريقة دفع واحدة على الأقل. الدفع عند الاستلام متاح فوراً.";
    return "";
  };

  const next = async () => {
    const error = validateStep();
    if (error) {
      setFormError(error);
      return;
    }
    const saved = await save(false);
    if (!saved) return;
    setStep((current) => Math.min(5, current + 1));
    dirtyRef.current = true;
  };

  const back = () => {
    setFormError("");
    setStep((current) => Math.max(1, current - 1));
    dirtyRef.current = true;
  };

  const saveDraft = async () => {
    const saved = await save(false);
    if (!saved) return;
    // A draft save may have changed the store address; keep the in-memory
    // session in sync so later steps target the right store.
    await refresh();
    toast.success("تم حفظ مسودة متجرك. يمكنك إغلاق الصفحة والمتابعة لاحقاً.");
  };

  const publish = async () => {
    setFormError("");
    const saved = await save(false);
    if (!saved) return;
    setPublishing(true);
    try {
      const result = await api.onboarding.complete();
      // Pull the canonical store into the session before showing the success
      // modal, so its dashboard links never target a still-draft snapshot.
      await refresh();
      setPublished(result);
      toast.success("تم نشر متجرك بنجاح.");
    } catch (err: any) {
      setFormError(safeError(err));
    } finally {
      setPublishing(false);
    }
  };

  const progress = useMemo(() => (form ? Math.round((step / 5) * 100) : 0), [step, form]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner label="جارٍ تحميل الجلسة…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-md rounded-brand-lg border border-danger-line bg-card p-6">
          <Alert tone="error" title="تعذر تحميل بيانات المتجر">{loadError}</Alert>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => window.location.reload()}>إعادة المحاولة</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner />
      </div>
    );
  }

  const previewStore = {
    storeName: form.storeName,
    description: form.description,
    logoUrl: form.logoUrl,
    coverUrl: form.coverUrl,
    templateKey: form.templateKey,
  };
  const previewBranding = {
    primaryColor: form.primaryColor,
    secondaryColor: form.secondaryColor,
    themeMode: form.themeMode,
    arabicFont: form.arabicFont,
  };

  return (
    <div dir="rtl" className="min-h-screen bg-canvas font-arabic text-ink">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <BrandLogo />
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-[11px] text-subtle sm:flex">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
              {saving ? "جارٍ حفظ المسودة…" : savedAt ? "تم حفظ المسودة تلقائياً" : "الحفظ التلقائي مفعّل"}
            </span>
            <ThemeToggle compact />
            <Button variant="outline" size="sm" onClick={saveDraft} loading={saving}>
              <Save className="h-3.5 w-3.5" />
              حفظ المسودة
            </Button>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-3">
            <div className="rounded-brand-lg border border-line bg-card p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">تهيئة المتجر</span>
                <span className="font-bold text-brand">{progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-gradient-to-l from-brand to-brand-on-dark transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-4 space-y-1.5">
                {STEPS.map((item, index) => {
                  const number = index + 1;
                  const active = number === step;
                  const done = number < step;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => {
                        if (number < step) {
                          setStep(number);
                          dirtyRef.current = true;
                        }
                      }}
                      className={`flex w-full items-start gap-3 rounded-brand p-2.5 text-start transition ${active ? "bg-brand/10 ring-1 ring-brand/30" : done ? "hover:bg-surface" : "opacity-60"}`}
                    >
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${done ? "bg-success text-on-success" : active ? "bg-brand text-on-brand" : "bg-surface text-subtle"}`}>
                        {done ? <Check className="h-3 w-3" /> : number}
                      </span>
                      <span>
                        <span className={`block text-xs font-bold ${active ? "text-ink" : "text-ink-soft"}`}>{item.title}</span>
                        <span className="mt-0.5 block text-[10px] leading-4 text-subtle">{item.subtitle}</span>
                      </span>
                      <Icon className={`ms-auto mt-1 h-3.5 w-3.5 ${active ? "text-brand" : "text-subtle"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-brand-lg border border-line bg-card p-4 text-[11px] leading-6 text-subtle">
              <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-ink-soft"><Globe2 className="h-3.5 w-3.5 text-brand" /> رابط متجرك</div>
              <div className="break-all rounded-brand-sm bg-surface px-2 py-1.5 font-mono text-[10px] text-brand" dir="ltr">/store/{form.subdomain || "your-store"}</div>
              <p className="mt-2">لن يظهر المتجر لعملائك بشكل كامل قبل الضغط على «نشر المتجر».</p>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-4 flex items-center gap-2 text-[11px] text-subtle">
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> 5 خطوات قصيرة</span>
              <span>·</span>
              <span>يمكنك الرجوع والتعديل قبل النشر</span>
            </div>

            {formError ? <Alert tone="error" className="mb-4">{formError}</Alert> : null}

            <div className="rounded-brand-lg border border-line bg-card p-5 sm:p-7">
              {step === 1 ? (
                <div className="space-y-5">
                  <StepTitle icon={Store} title="خلّينا نتعرف على متجرك" subtitle="هذه البيانات تظهر في واجهة المتجر وصفحات التواصل." />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="اسم المتجر" required>
                      <Input value={form.storeName} onChange={(e) => update("storeName", e.target.value)} placeholder="مثال: متجر نور" maxLength={120} />
                    </Field>
                    <Field label="رابط المتجر" required hint="أحرف إنجليزية صغيرة وأرقام وشرطات فقط">
                      <div className="flex overflow-hidden rounded-brand border border-line bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
                        <span className="flex items-center border-e border-line px-2.5 text-[10px] text-subtle" dir="ltr">/store/</span>
                        <input
                          value={form.subdomain}
                          onChange={(e) => update("subdomain", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                          className="h-10 w-full bg-transparent px-2 text-sm text-ink outline-none placeholder:text-subtle"
                          placeholder="nour-store"
                          dir="ltr"
                          maxLength={40}
                        />
                      </div>
                    </Field>
                  </div>

                  <Field label="نوع النشاط" required>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {Object.entries(BUSINESS_TYPES).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => update("businessType", key)}
                          className={`rounded-brand border px-2 py-2.5 text-center text-[11px] font-semibold transition ${form.businessType === key ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-subtle hover:border-line"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="وصف المتجر" hint="سطر أو سطران يوضحان ما تبيعه ولمن.">
                    <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} placeholder="نقدم منتجات مختارة بعناية…" maxLength={3000} />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="الدولة">
                      <Input value="🇪🇬 جمهورية مصر العربية" readOnly aria-label="الدولة: جمهورية مصر العربية" className="cursor-default bg-surface" />
                    </Field>
                    <Field label="المحافظة / المدينة">
                      <Select value={form.governorate} onChange={(e) => update("governorate", e.target.value)}>
                        <option value="">اختر المحافظة</option>
                        {EGYPT_GOVERNORATES.map((governorate) => (
                          <option key={governorate} value={governorate}>{governorate}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="عملة المتجر">
                      <Input value="EGP — الجنيه المصري (ج.م)" readOnly aria-label="عملة المتجر: الجنيه المصري" className="cursor-default bg-surface" />
                    </Field>
                  </div>

                  <Field label="لغة المتجر الأساسية">
                    <div className="flex gap-2">
                      {[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => update("primaryLanguage", option.value)}
                          className={`rounded-brand border px-4 py-2 text-xs font-semibold ${form.primaryLanguage === option.value ? "border-brand bg-brand/10 text-brand" : "border-line text-subtle"}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-5">
                  <StepTitle icon={Palette} title="الشعار والهوية البصرية" subtitle="ارفع صوراً حقيقية من جهازك أو الصق روابط الصور. الصور تُخزن في مساحة المتجر." />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <ImageUploader value={form.logoUrl} onChange={(url) => update("logoUrl", url)} label="شعار المتجر (Logo)" aspect="aspect-square" />
                    <ImageUploader value={form.coverUrl} onChange={(url) => update("coverUrl", url)} label="صورة الغلاف (Cover)" aspect="aspect-video" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="اللون الأساسي">
                      <div className="flex items-center gap-2 rounded-brand border border-line bg-surface p-1.5">
                        <input type="color" value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" />
                        <input value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} dir="ltr" className="w-full bg-transparent font-mono text-xs text-ink outline-none" maxLength={7} />
                      </div>
                    </Field>
                    <Field label="لون التمييز">
                      <div className="flex items-center gap-2 rounded-brand border border-line bg-surface p-1.5">
                        <input type="color" value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" />
                        <input value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} dir="ltr" className="w-full bg-transparent font-mono text-xs text-ink outline-none" maxLength={7} />
                      </div>
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="الخط العربي">
                      <Select value={form.arabicFont} onChange={(e) => update("arabicFont", e.target.value)}>
                        {["Cairo", "IBM Plex Sans Arabic", "Tajawal", "Almarai"].map((font) => <option key={font} value={font}>{font}</option>)}
                      </Select>
                    </Field>
                    <Field label="وضع الواجهة">
                      <div className="flex gap-2">
                        {[{ value: "dark", label: "داكن" }, { value: "light", label: "فاتح" }, { value: "system", label: "حسب النظام" }].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => update("themeMode", option.value)}
                            className={`flex-1 rounded-brand border px-2 py-2 text-[11px] font-semibold ${form.themeMode === option.value ? "border-brand bg-brand/10 text-brand" : "border-line text-subtle"}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>

                  <div className="rounded-brand border border-line bg-surface p-4">
                    <div className="mb-2 text-[11px] font-semibold text-ink-soft">معاينة سريعة للهوية</div>
                    <StorePreview store={previewStore} branding={previewBranding} device="desktop" />
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-5">
                  <StepTitle icon={Sparkles} title="اختر قالب متجرك" subtitle="كل القوالب متجاوبة بالكامل وتدعم العربية RTL. الهوية والقالب يُثبَّتان بعد النشر." />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(TEMPLATES).map(([key, template]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => update("templateKey", key)}
                        className={`group overflow-hidden rounded-brand-lg border text-start transition ${form.templateKey === key ? "border-brand ring-2 ring-brand/30" : "border-line hover:border-line"}`}
                      >
                        <div
                          className="relative flex h-28 items-end p-3"
                          style={{ background: `radial-gradient(circle at 20% 10%, ${template.accent}55, transparent 55%), linear-gradient(135deg, ${template.accent}22, var(--color-secondary))` }}
                        >
                          <span className="text-2xl">{template.emoji}</span>
                          {form.templateKey === key ? (
                            <span className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-on-brand"><Check className="h-3.5 w-3.5" /></span>
                          ) : null}
                        </div>
                        <div className="bg-card p-3">
                          <div className="text-xs font-bold text-ink">{template.label}</div>
                          <div className="mt-0.5 text-[10px] leading-5 text-subtle">{template.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-5">
                  <StepTitle icon={Wallet} title="إعدادات البيع والدفع" subtitle="ابدأ بالدفع عند الاستلام. الدفع الإلكتروني لا يُفعّل إلا عند إعداد بوابة دفع حقيقية." />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="رقم واتساب المتجر" hint="يثبّت زر «تواصل عبر واتساب» على واجهة المتجر">
                      <Input value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="201012345678" dir="ltr" />
                    </Field>
                    <Field label="سياسة الإرجاع" hint="تظهر للعميل وتساعده على اتخاذ قرار الشراء">
                      <Input value={form.returnPolicy} onChange={(e) => update("returnPolicy", e.target.value)} placeholder="يمكن الإرجاع خلال 14 يوماً…" maxLength={3000} />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Switch
                      checked={form.codEnabled}
                      onChange={(value) => update("codEnabled", value)}
                      label="الدفع عند الاستلام (COD)"
                      description="الطريقة الأساسية في مصر والخليج. لا تحتاج بوابة دفع."
                    />
                    <Switch
                      checked={form.onlinePaymentEnabled}
                      onChange={(value) => update("onlinePaymentEnabled", value)}
                      disabled={!data?.payments?.providerConfigured}
                      label="الدفع الإلكتروني"
                      description={data?.payments?.providerConfigured ? "بوابة الدفع مهيأة على الخادم." : "غير متاح: لا يوجد محوّل دفع مثبت في هذه النسخة."}
                    />
                  </div>

                  {!data?.payments?.providerConfigured ? (
                    <Alert tone="info" title="الدفع الإلكتروني غير متاح">
                      لا يوجد محوّل دفع فعلي في هذه النسخة، وإضافة متغيرات PAYMENT_PROVIDER أو PAYMENT_SECRET_KEY وحدها لن تفعّله. يبقى الدفع عند الاستلام هو الخيار المتاح، ولن نعرض خيار دفع غير قابل للتنفيذ.
                    </Alert>
                  ) : null}

                  <div className="rounded-brand border border-line bg-surface p-4">
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold text-ink"><Truck className="h-4 w-4 text-brand" /> منطقة الشحن الافتراضية</div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="المحافظات المشمولة" hint="اختر المحافظات التي سيظهرها العميل عند إتمام الطلب. اتركها بدون اختيار لتغطية كل المحافظات." className="sm:col-span-3">
                        {(() => {
                          const selected = form.shippingGovernorates.split(",").map((value) => value.trim()).filter(Boolean);
                          const addGovernorate = (value: string) => {
                            if (!value || selected.includes(value)) return;
                            update("shippingGovernorates", [...selected, value].join(", "));
                          };
                          const removeGovernorate = (value: string) => update("shippingGovernorates", selected.filter((item) => item !== value).join(", "));
                          return (
                            <div className="space-y-2">
                              <Select value="" onChange={(e) => addGovernorate(e.target.value)} aria-label="إضافة محافظة للشحن">
                                <option value="">إضافة محافظة…</option>
                                {EGYPT_GOVERNORATES.filter((governorate) => !selected.includes(governorate)).map((governorate) => (
                                  <option key={governorate} value={governorate}>{governorate}</option>
                                ))}
                              </Select>
                              {selected.length ? (
                                <div className="flex flex-wrap gap-2 rounded-brand border border-line bg-surface p-3">
                                  {selected.map((governorate) => (
                                    <button key={governorate} type="button" onClick={() => removeGovernorate(governorate)} className="inline-flex items-center gap-1 rounded-full border border-brand-line bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand" aria-label={`إزالة ${governorate}`}>
                                      {governorate}<span aria-hidden="true">×</span>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-brand border border-dashed border-line bg-surface px-3 py-2 text-[11px] text-subtle">لم يتم تحديد محافظات — سيتم قبول جميع المحافظات المصرية.</div>
                              )}
                            </div>
                          );
                        })()}
                      </Field>
                      <Field label="رسوم الشحن">
                        <Input type="number" min={0} step="0.01" value={form.shippingFee} onChange={(e) => update("shippingFee", Number(e.target.value))} />
                      </Field>
                      <Field label="شحن مجاني بعد" hint="اتركه فارغاً لتعطيل شحن مجاني">
                        <Input type="number" min={0} step="0.01" value={form.shippingThreshold} onChange={(e) => update("shippingThreshold", e.target.value)} placeholder="مثال: 500" />
                      </Field>
                    </div>
                    <div className="mt-3 text-[10px] leading-5 text-subtle">لا يوجد ربط آلي بشركات الشحن أو تتبع شحنات. يمكنك إدارة الشحن يدوياً من لوحة التحكم، ولن تُنشأ حالات شحن وهمية.</div>
                  </div>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <StepTitle icon={Rocket} title="راجع متجرك قبل النشر" subtitle="هذه معاينة مباشرة لبياناتك الحقيقية. تأكد من الاسم والوصف والصور ثم انشر." />
                    <div className="flex rounded-brand border border-line bg-surface p-1">
                      <button type="button" onClick={() => setDevice("desktop")} className={`flex items-center gap-1.5 rounded-brand-sm px-3 py-1.5 text-[11px] font-semibold ${device === "desktop" ? "bg-surface text-ink" : "text-subtle"}`}><Monitor className="h-3.5 w-3.5" /> سطح المكتب</button>
                      <button type="button" onClick={() => setDevice("mobile")} className={`flex items-center gap-1.5 rounded-brand-sm px-3 py-1.5 text-[11px] font-semibold ${device === "mobile" ? "bg-surface text-ink" : "text-subtle"}`}><Smartphone className="h-3.5 w-3.5" /> الجوال</button>
                    </div>
                  </div>

                  <div className="rounded-brand-lg border border-line bg-surface p-4">
                    <StorePreview store={previewStore} branding={previewBranding} device={device} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <ReviewItem icon={Store} label="اسم المتجر" value={form.storeName} />
                    <ReviewItem icon={Globe2} label="الرابط" value={`/store/${form.subdomain}`} ltr />
                    <ReviewItem icon={BadgeCheck} label="القالب" value={TEMPLATES[form.templateKey]?.label ?? form.templateKey} />
                    <ReviewItem icon={CreditCard} label="طرق الدفع" value={[form.codEnabled && "الدفع عند الاستلام", form.onlinePaymentEnabled && "دفع إلكتروني"].filter(Boolean).join(" · ") || "لا توجد"} />
                    <ReviewItem icon={Truck} label="الشحن" value={form.shippingFee > 0 ? `${form.shippingFee} ${form.currency}` : "يُحدد حسب المنطقة"} />
                    <ReviewItem icon={CheckCircle2} label="الحالة" value="مسودة جاهزة للنشر" />
                  </div>

                  <div className="rounded-brand border border-success-line bg-success-soft p-4 text-[11px] leading-6 text-success">
                    عند النشر سيتم تفعيل رابط المتجر، وستستطيع إضافة المنتجات واستقبال الطلبات. تُثبَّت هوية المتجر (الشعار والألوان والقالب) والرابط بعد النشر.
                  </div>
                </div>
              ) : null}

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <Button variant="ghost" onClick={back} disabled={step === 1}>
                  <ChevronLeft className="h-4 w-4" />
                  السابق
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hidden text-[11px] text-subtle sm:inline">{saving ? "جارٍ الحفظ…" : savedAt ? "تم الحفظ" : ""}</span>
                  {step < 5 ? (
                    <Button onClick={next} loading={saving}>
                      التالي
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="success" size="lg" onClick={publish} loading={publishing}>
                      <Rocket className="h-4 w-4" />
                      نشر المتجر الآن
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 px-1 text-[10px] text-subtle">
              بياناتك محفوظة داخل حسابك ولا تظهر لأي متجر آخر. تُفتح لوحة التحكم بعد إكمال التهيئة ونشر المتجر.
            </div>
          </main>
        </div>
      </div>

      {published ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur">
          <div className="w-full max-w-md rounded-brand-lg border border-success-line bg-card p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-brand-lg bg-success-soft text-success">
              <Rocket className="h-7 w-7" />
            </div>
            <h2 className="mt-4 font-heading text-2xl font-bold text-ink">
              {published.approval_required === false ? "متجرك أصبح جاهزاً 🎉" : "تم إرسال متجرك للمراجعة 🎉"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-subtle">
              {published.approval_required === false
                ? "تم اعتماد متجرك ويمكنك الآن مشاركة الرابط مع عملائك. ابدأ بإضافة منتجاتك لإكمال تجربة التسوق."
                : "استلمنا بيانات متجرك وهويته. سيراجعها فريق سند ويفعّل المتجر قبل ظهوره للعملاء. يمكنك الآن تجهيز منتجاتك من لوحة التحكم."}
            </p>
            <div className="mt-4 rounded-brand border border-line bg-surface p-3 text-[11px] leading-5 text-subtle">
              {published.approval_required === false ? "رابط متجرك:" : "رابط متجرك بعد الموافقة:"}
              <div className="mt-1 break-all font-mono text-brand" dir="ltr">
                {window.location.origin}/store/{published.store?.subdomain}
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              <Button onClick={() => navigate("/dashboard/products")}>
                <ArrowLeft className="h-4 w-4" />
                ابدأ بإضافة منتجاتك
              </Button>
              {published.approval_required === false ? (
                <Button variant="outline" onClick={() => window.open(`/store/${published.store?.subdomain}`, "_blank", "noopener,noreferrer")}>
                  زيارة المتجر
                </Button>
              ) : (
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  العودة إلى لوحة التحكم
                </Button>
              )}
              <div className="text-[11px] leading-5 text-subtle">
                {published.approval_required === false
                  ? "يمكنك متابعة الطلبات والمنتجات من لوحة التحكم."
                  : "لن يظهر المتجر للعملاء حتى تصلك موافقة الإدارة. تابع حالة الطلب من لوحة التحكم."}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StepTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-brand border border-brand-line bg-brand/10 p-2.5 text-brand">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-heading text-lg font-bold text-ink">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-subtle">{subtitle}</p>
      </div>
    </div>
  );
}

function ReviewItem({ icon: Icon, label, value, ltr }: { icon: React.ElementType; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-brand border border-line bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-subtle"><Icon className="h-3 w-3" /> {label}</div>
      <div className={`mt-1 truncate text-xs font-semibold text-ink ${ltr ? "font-mono" : ""}`} dir={ltr ? "ltr" : undefined}>{value || "—"}</div>
    </div>
  );
}
