import React, { useEffect, useState } from "react";
import { MapPin, Pencil, Plus, RefreshCw, Trash2, Truck } from "lucide-react";
import { api } from "../../lib/api";
import { money, number, safeError } from "../../lib/format";
import { useAsync } from "../../lib/useAsync";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  useToast,
} from "../../components/ui";
import { useDashboard } from "../DashboardShell";
import { ActivePill } from "../common";

interface RateDraft {
  governorate: string;
  city: string;
  fee: string;
  codFee: string;
  estimatedDays: string;
  isActive: boolean;
}

interface ZoneDraft {
  name: string;
  governorates: string;
  cities: string;
  fee: string;
  freeShippingThreshold: string;
  codFee: string;
  estimatedDaysMin: string;
  estimatedDaysMax: string;
  carrier: string;
  isActive: boolean;
  isFallback: boolean;
}

const emptyZone: ZoneDraft = {
  name: "",
  governorates: "",
  cities: "",
  fee: "0",
  freeShippingThreshold: "",
  codFee: "0",
  estimatedDaysMin: "1",
  estimatedDaysMax: "3",
  carrier: "",
  isActive: true,
  isFallback: false,
};

function splitList(value: string): string[] {
  return value
    .split(/[,،\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function ShippingPage() {
  const { subdomain, store } = useDashboard();
  const toast = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data, loading, error, reload } = useAsync(() => api.shipping.list(subdomain), [subdomain]);
  const zones = data?.zones ?? [];

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.shipping.remove(subdomain, deleting.id);
      toast.success("تم حذف منطقة الشحن.");
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="التشغيل"
        title="مناطق الشحن"
        description="حدّد تكلفة الشحن ورسوم الدفع عند الاستلام لكل محافظة. الشحن يدوي: لا يوجد ربط آلي بشركات الشحن، والأسعار تُحسب على الخادم عند كل طلب."
        actions={<Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus className="h-4 w-4" /> منطقة جديدة</Button>}
      />

      <Alert tone="info" title="الشحن يدوي">
        تُدخل شركة الشحن وأسعار المناطق يدوياً. لا يوجد تتبع مباشر أو إرسال آلي لشركات الشحن؛ استخدم رقم الشحنة/الرابط الذي توفره الشركة خارج سند إن لزم.
      </Alert>

      {error ? <Alert tone="error" title="تعذر تحميل مناطق الشحن">{safeError(error)}</Alert> : null}

      {loading && !data ? (
        <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : zones.length === 0 ? (
        <Card>
          <EmptyState
            title="لا توجد مناطق شحن"
            description="أضف منطقة افتراضية واحدة على الأقل، وإلا فلن تُحسب رسوم شحن تلقائياً في الطلبات."
            icon={<Truck className="h-5 w-5" />}
            action={<Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus className="h-4 w-4" /> إضافة منطقة</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {zones.map((zone: any) => (
            <Card key={zone.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-brand" />
                    <span className="font-bold text-ink">{zone.name}</span>
                    {zone.isFallback ? <Badge tone="border-brand-line bg-brand/10 text-brand">افتراضية</Badge> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-subtle">
                    <ActivePill active={zone.isActive} />
                    <span>{num(zone.estimatedDaysMin) === num(zone.estimatedDaysMax) ? `${zone.estimatedDaysMin} يوم` : `${zone.estimatedDaysMin}–${zone.estimatedDaysMax} يوم`}</span>
                    {zone.carrier ? <span>{zone.carrier} (يدوي)</span> : null}
                    <span>إدارة يدوية</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(zone); setEditorOpen(true); }} aria-label="تعديل"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(zone)} aria-label="حذف"><Trash2 className="h-3.5 w-3.5 text-danger" /></Button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-brand border border-line bg-surface p-2.5">
                  <div className="text-[10px] text-subtle">الشحن</div>
                  <div className="mt-0.5 text-xs font-bold text-ink">{money(zone.fee, store.currency)}</div>
                </div>
                <div className="rounded-brand border border-line bg-surface p-2.5">
                  <div className="text-[10px] text-subtle">رسوم COD</div>
                  <div className="mt-0.5 text-xs font-bold text-ink">{money(zone.codFee, store.currency)}</div>
                </div>
                <div className="rounded-brand border border-line bg-surface p-2.5">
                  <div className="text-[10px] text-subtle">شحن مجاني</div>
                  <div className="mt-0.5 text-xs font-bold text-ink">
                    {zone.freeShippingThreshold != null ? money(zone.freeShippingThreshold, store.currency) : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-[11px]">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-subtle"><MapPin className="h-3.5 w-3.5" /></span>
                  <span className="text-ink-soft">
                    {((zone.governorates ?? []) as string[]).length ? (zone.governorates as string[]).join("، ") : "تشمل كل المحافظات (منطقة افتراضية)"}
                  </span>
                </div>
                {((zone.cities ?? []) as string[]).length ? <div className="text-[10px] text-subtle">مدن: {(zone.cities as string[]).join("، ")}</div> : null}
              </div>

              {((zone.rates ?? []) as any[]).length ? (
                <div className="mt-3 rounded-brand border border-line bg-surface p-2">
                  <div className="px-1 text-[10px] font-bold text-subtle">أسعار مخصّصة ({zone.rates.length})</div>
                  <div className="mt-1.5 space-y-1">
                    {zone.rates.slice(0, 4).map((rate: any) => (
                      <div key={rate.id} className="flex items-center justify-between px-1 text-[10px] text-subtle">
                        <span>{[rate.governorate, rate.city, rate.district].filter(Boolean).join(" / ") || "عام"}</span>
                        <span className="font-semibold text-ink">{money(rate.fee, store.currency)}</span>
                      </div>
                    ))}
                    {zone.rates.length > 4 ? <div className="px-1 text-[10px] text-subtle">+ {zone.rates.length - 4} أخرى…</div> : null}
                  </div>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <ZoneEditor open={editorOpen} zone={editing} subdomain={subdomain} currency={store.currency} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); reload(); }} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`حذف منطقة «${deleting?.name || ""}»؟`}
        description="لن تُحسب رسوم هذه المنطقة في الطلبات الجديدة."
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function ZoneEditor({
  open,
  zone,
  subdomain,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  zone: any | null;
  subdomain: string;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ZoneDraft>(emptyZone);
  const [rates, setRates] = useState<RateDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    if (zone) {
      setDraft({
        name: zone.name ?? "",
        governorates: ((zone.governorates ?? []) as string[]).join("، "),
        cities: ((zone.cities ?? []) as string[]).join("، "),
        fee: String(zone.fee ?? 0),
        freeShippingThreshold: zone.freeShippingThreshold != null ? String(zone.freeShippingThreshold) : "",
        codFee: String(zone.codFee ?? 0),
        estimatedDaysMin: String(zone.estimatedDaysMin ?? 1),
        estimatedDaysMax: String(zone.estimatedDaysMax ?? 3),
        carrier: zone.carrier ?? "",
        isActive: zone.isActive !== false,
        isFallback: Boolean(zone.isFallback),
      });
      setRates(
        ((zone.rates ?? []) as any[]).map((rate) => ({
          governorate: rate.governorate ?? "",
          city: rate.city ?? "",
          fee: String(rate.fee ?? 0),
          codFee: String(rate.codFee ?? 0),
          estimatedDays: String(rate.estimatedDays ?? 0),
          isActive: rate.isActive !== false,
        }))
      );
    } else {
      setDraft(emptyZone);
      setRates([]);
    }
  }, [open, zone?.id]);

  const set = (key: keyof ZoneDraft, value: any) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!draft.name.trim()) {
      toast.error("اسم المنطقة مطلوب.");
      return;
    }
    if (num(draft.estimatedDaysMax) < num(draft.estimatedDaysMin)) {
      toast.error("الحد الأقصى للأيام يجب أن يكون ≥ الحد الأدنى.");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: draft.name.trim(),
        governorates: splitList(draft.governorates),
        cities: splitList(draft.cities),
        fee: num(draft.fee),
        freeShippingThreshold: draft.freeShippingThreshold ? num(draft.freeShippingThreshold) : null,
        codFee: num(draft.codFee),
        estimatedDaysMin: Math.max(0, Math.round(num(draft.estimatedDaysMin))),
        estimatedDaysMax: Math.max(0, Math.round(num(draft.estimatedDaysMax))),
        carrier: draft.carrier.trim(),
        // No carrier adapter exists; always store the truthful value.
        trackingSupported: false,
        isActive: draft.isActive,
        isFallback: draft.isFallback,
        rates: rates
          .filter((rate) => rate.governorate || rate.city)
          .map((rate) => ({
            governorate: rate.governorate.trim(),
            city: rate.city.trim(),
            district: "",
            fee: num(rate.fee),
            codFee: num(rate.codFee),
            estimatedDays: Math.max(0, Math.round(num(rate.estimatedDays))),
            isActive: rate.isActive,
          })),
      };
      if (zone) await api.shipping.update(subdomain, zone.id, body);
      else await api.shipping.create(subdomain, body);
      toast.success(zone ? "تم تحديث منطقة الشحن." : "تمت إضافة منطقة الشحن.");
      onSaved();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={zone ? `تعديل: ${zone.name}` : "منطقة شحن جديدة"}
      description={`الرسوم بعملة المتجر (${currency}).`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button loading={busy} onClick={submit}>{zone ? "حفظ" : "إنشاء"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم المنطقة" required><Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="القاهرة الكبرى" /></Field>
        <Field label="شركة الشحن" hint="اسم الشركة للعرض فقط؛ لا يوجد ربط آلي بها."><Input value={draft.carrier} onChange={(e) => set("carrier", e.target.value)} placeholder="أرامكس / بوسطة…" /></Field>
        <Field label="المحافظات" hint="افصل بينها بفاصلة. اتركها فارغة لمنطقة افتراضية تشمل الكل." className="sm:col-span-2">
          <Input value={draft.governorates} onChange={(e) => set("governorates", e.target.value)} placeholder="القاهرة، الجيزة، القليوبية" />
        </Field>
        <Field label="مدن محددة (اختياري)" className="sm:col-span-2"><Input value={draft.cities} onChange={(e) => set("cities", e.target.value)} placeholder="مدينة نصر، المعادي" /></Field>
        <Field label={`سعر الشحن (${currency})`}><Input type="number" min={0} value={draft.fee} onChange={(e) => set("fee", e.target.value)} dir="ltr" /></Field>
        <Field label={`رسوم الدفع عند الاستلام (${currency})`}><Input type="number" min={0} value={draft.codFee} onChange={(e) => set("codFee", e.target.value)} dir="ltr" /></Field>
        <Field label={`شحن مجاني فوق (${currency})`} hint="اتركه فارغاً لتعطيل الشحن المجاني."><Input type="number" min={0} value={draft.freeShippingThreshold} onChange={(e) => set("freeShippingThreshold", e.target.value)} dir="ltr" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="أيام التوصيل من"><Input type="number" min={0} value={draft.estimatedDaysMin} onChange={(e) => set("estimatedDaysMin", e.target.value)} dir="ltr" /></Field>
          <Field label="إلى"><Input type="number" min={0} value={draft.estimatedDaysMax} onChange={(e) => set("estimatedDaysMax", e.target.value)} dir="ltr" /></Field>
        </div>
        <Switch checked={draft.isFallback} onChange={(v) => set("isFallback", v)} label="المنطقة الافتراضية" description="تُستخدم عندما لا تنطبق أي محافظة أخرى." />
        <div className="rounded-brand border border-line bg-surface px-3 py-2.5 text-[10px] leading-5 text-subtle">
          تتبع الشحنات غير متاح داخل سند. لا يوجد تكامل مع شركات الشحن، ولن نعرض حالة تتبع غير حقيقية.
        </div>
        <Switch checked={draft.isActive} onChange={(v) => set("isActive", v)} label="نشطة" />

        <div className="sm:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-ink-soft">أسعار مخصّصة لكل محافظة/مدينة</div>
            <Button size="sm" variant="outline" onClick={() => setRates((current) => [...current, { governorate: "", city: "", fee: draft.fee, codFee: draft.codFee, estimatedDays: draft.estimatedDaysMin, isActive: true }])}>
              <Plus className="h-3.5 w-3.5" /> سعر
            </Button>
          </div>
          {rates.length === 0 ? (
            <div className="mt-2 rounded-brand border border-dashed border-line p-3 text-center text-[11px] text-subtle">لا توجد أسعار مخصّصة — يُستخدم سعر المنطقة الأساسي.</div>
          ) : (
            <div className="mt-2 space-y-2">
              {rates.map((rate, index) => (
                <div key={index} className="grid grid-cols-2 items-end gap-2 rounded-brand border border-line bg-surface p-3 sm:grid-cols-5">
                  <Field label="المحافظة"><Input value={rate.governorate} onChange={(e) => setRates((current) => current.map((r, i) => (i === index ? { ...r, governorate: e.target.value } : r)))} /></Field>
                  <Field label="المدينة"><Input value={rate.city} onChange={(e) => setRates((current) => current.map((r, i) => (i === index ? { ...r, city: e.target.value } : r)))} /></Field>
                  <Field label="السعر"><Input type="number" min={0} value={rate.fee} onChange={(e) => setRates((current) => current.map((r, i) => (i === index ? { ...r, fee: e.target.value } : r)))} dir="ltr" /></Field>
                  <Field label="COD"><Input type="number" min={0} value={rate.codFee} onChange={(e) => setRates((current) => current.map((r, i) => (i === index ? { ...r, codFee: e.target.value } : r)))} dir="ltr" /></Field>
                  <div className="flex items-end gap-2">
                    <Field label="أيام"><Input type="number" min={0} value={rate.estimatedDays} onChange={(e) => setRates((current) => current.map((r, i) => (i === index ? { ...r, estimatedDays: e.target.value } : r)))} dir="ltr" /></Field>
                    <Button size="sm" variant="ghost" onClick={() => setRates((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5 text-danger" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

