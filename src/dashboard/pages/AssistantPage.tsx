import React, { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { api } from "../../lib/api";
import { safeError } from "../../lib/format";
import { useAsync } from "../../lib/useAsync";
import {
  Alert,
  Button,
  Card,
  CopyButton,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  useToast,
  cn,
} from "../../components/ui";
import { useDashboard } from "../DashboardShell";
import { getBusinessExamples } from "../businessExamples";

const TASK_ICONS: Record<string, string> = {
  product_description: "📝",
  seo: "🔍",
  ad_copy: "📣",
  coupon_suggestions: "🎟️",
  whatsapp_message: "💬",
  blog_topics: "📰",
};

interface TaskFieldConfig {
  label: string;
  placeholder: string;
  key: string;
  required?: boolean;
}

const TASK_FIELDS: Record<string, TaskFieldConfig[]> = {
  product_description: [
    { key: "productName", label: "اسم المنتج", placeholder: "حقيبة جلد طبيعي", required: true },
    { key: "features", label: "أهم الميزات", placeholder: "جلد طبيعي، حجم متوسط، لون أسود" },
    { key: "audience", label: "الجمهور المستهدف", placeholder: "نساء 25-40 سنة" },
  ],
  seo: [
    { key: "productName", label: "اسم المنتج أو الصفحة", placeholder: "حقيبة جلد طبيعي", required: true },
    { key: "keywords", label: "كلمات مفتاحية", placeholder: "حقيبة جلد، شنطة نسائية" },
  ],
  ad_copy: [
    { key: "offer", label: "العرض", placeholder: "خصم 20% لمدة 3 أيام", required: true },
    { key: "audience", label: "الجمهور", placeholder: "عملاء القاهرة والجيزة" },
    { key: "platform", label: "المنصة", placeholder: "فيسبوك / إنستغرام / تيك توك" },
  ],
  coupon_suggestions: [
    { key: "goal", label: "الهدف من الكوبون", placeholder: "استرجاع السلات المتروكة", required: true },
    { key: "averageOrderValue", label: "متوسط قيمة الطلب", placeholder: "500" },
  ],
  whatsapp_message: [
    { key: "purpose", label: "الغرض من الرسالة", placeholder: "تذكير بسلة متروكة", required: true },
    { key: "customerName", label: "اسم العميل", placeholder: "أحمد" },
  ],
  blog_topics: [
    { key: "industry", label: "مجال متجرك", placeholder: "أزياء نسائية", required: true },
    { key: "audience", label: "الجمهور", placeholder: "عملاء مهتمون بالموضة" },
  ],
};

export function AssistantPage() {
  const { subdomain, store } = useDashboard();
  const examples = getBusinessExamples(store?.businessType);
  const toast = useToast();
  const [task, setTask] = useState("product_description");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; provider: string; model: string } | null>(null);

  const { data, loading, error } = useAsync(() => api.assistant.get(subdomain), [subdomain]);

  const configured = Boolean(data?.configured);
  const capabilities: Record<string, string> = data?.capabilities ?? {};
  const fields = (TASK_FIELDS[task] ?? []).map((field) => ({
    ...field,
    placeholder:
      field.key === "productName" ? examples.productAr :
      field.key === "features" ? examples.featuresAr :
      field.key === "audience" ? examples.audienceAr :
      field.key === "industry" ? examples.categoryAr :
      field.key === "keywords" ? `${examples.categoryAr}، ${examples.productAr}` :
      field.placeholder,
  }));

  const generate = async () => {
    for (const field of fields) {
      if (field.required && !inputs[field.key]?.trim()) {
        toast.error(`املأ حقل «${field.label}».`);
        return;
      }
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        const value = inputs[field.key]?.trim();
        if (value) payload[field.key] = value;
      }
      const response = await api.assistant.generate(subdomain, task, payload);
      setResult(response.result);
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="النمو"
        title="مساعد التسويق"
        description="ولّد نصوصاً جاهزة لمنتجاتك وإعلاناتك ورسائل واتساب. راجع النص دائماً قبل النشر."
      />

      {error ? <Alert tone="error" title="تعذر تحميل المساعد">{safeError(error)}</Alert> : null}
      {loading && !data ? (
        <div className="space-y-2"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
      ) : (
        <>
          <Alert tone={configured ? "success" : "warning"} title={configured ? "المساعد متصل" : "المساعد غير متصل بعد"}>
            {data?.note ?? ""}
          </Alert>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-ink"><Wand2 className="h-3.5 w-3.5 text-brand" /> اختر نوع المحتوى</div>
              <div className="grid gap-2">
                {Object.entries(capabilities).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setTask(key); setInputs({}); setResult(null); }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-brand border px-3 py-2.5 text-start text-xs font-semibold transition",
                      task === key ? "border-brand-line bg-brand/10 text-brand" : "border-line bg-surface text-ink-soft hover:border-line"
                    )}
                  >
                    <span>{TASK_ICONS[key] ?? "✨"}</span>
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-3 border-t border-line pt-4">
                {fields.map((field) => (
                  <Field key={field.key} label={field.label} required={field.required}>
                    <Input
                      value={inputs[field.key] ?? ""}
                      onChange={(e) => setInputs((current) => ({ ...current, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                    />
                  </Field>
                ))}
                <Button className="w-full" loading={busy} disabled={!configured} onClick={generate}>
                  <Sparkles className="h-4 w-4" /> توليد المحتوى
                </Button>
                {!configured ? <div className="text-center text-[10px] text-subtle">يتاح التوليد بعد تهيئة مزود الذكاء الاصطناعي في بيئة الخادم.</div> : null}
              </div>
            </Card>

            <Card className="flex min-h-[320px] flex-col p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-bold text-ink">النتيجة</div>
                {result ? <CopyButton value={result.text} label="نسخ النص" /> : null}
              </div>
              {result ? (
                <>
                  <Textarea
                    rows={14}
                    value={result.text}
                    onChange={(e) => setResult({ ...result, text: e.target.value })}
                    className="flex-1"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-subtle">
                    <span>يمكنك تعديل النص قبل نسخه — التوليد نقطة بداية وليس نصاً نهائياً.</span>
                    <span className="font-mono" dir="ltr">{result.provider} · {result.model}</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-brand-lg border border-line bg-surface text-brand">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-semibold text-ink">النص سيظهر هنا</div>
                  <p className="max-w-sm text-xs leading-6 text-subtle">
                    اختر نوع المحتوى، املأ التفاصيل، ثم اضغط «توليد المحتوى». يمكنك أيضاً نسخ النص أو تعديله مباشرة.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
