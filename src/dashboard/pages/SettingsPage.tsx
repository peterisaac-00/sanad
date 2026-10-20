import React, { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  CheckCircle2,
  Globe,
  KeyRound,
  RefreshCw,
  ScrollText,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "../../lib/api";
import { COUNTRIES_DATA } from "../../data/countries";
import { CURRENCIES, dateTime, number, safeError } from "../../lib/format";
import { useAsync } from "../../lib/useAsync";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  Textarea,
  useToast,
  cn,
} from "../../components/ui";
import { ImageUploader } from "../../components/ImageUploader";
import { useDashboard } from "../DashboardShell";
import { useSession } from "../../lib/session";
import { TableShell, Td, Th } from "../common";

const TABS = [
  { key: "general", label: "بيانات المتجر", icon: Building2 },
  { key: "notifications", label: "الإشعارات", icon: Bell },
  { key: "domains", label: "النطاقات", icon: Globe },
  { key: "team", label: "الفريق", icon: Users },
  { key: "security", label: "الأمان والحساب", icon: Shield },
  { key: "audit", label: "سجل النشاط", icon: ScrollText },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TIME_ZONES = [
  "Africa/Cairo", "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Qatar",
  "Asia/Amman", "Asia/Beirut", "Asia/Baghdad", "Africa/Casablanca", "Africa/Tunis", "UTC",
];

const ROLES: Record<string, string> = { admin: "مدير عام", manager: "مدير", staff: "موظف", viewer: "مشاهدة فقط" };
const TEAM_STATUS: Record<string, string> = { invited: "مدعو", active: "نشط", suspended: "موقوف" };

export function SettingsPage() {
  const { subdomain, store } = useDashboard();
  const { refresh } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>("general");

  const { data, loading, error, reload } = useAsync(() => api.settings.get(subdomain), [subdomain]);

  /* ---- general form ---- */
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.store || form) return;
    const s = data.store;
    setForm({
      storeName: s.storeName ?? "",
      phone: s.phone ?? "",
      countryCode: s.countryCode ?? "EG",
      storeCurrency: s.currency ?? "EGP",
      description: s.description ?? "",
      logoUrl: s.logoUrl ?? "",
      coverUrl: s.coverUrl ?? "",
      supportEmail: s.supportEmail ?? "",
      seoTitle: s.seoTitle ?? "",
      seoDescription: s.seoDescription ?? "",
      whatsapp: s.whatsapp ?? "",
      codEnabled: Boolean(s.codEnabled),
      onlinePaymentEnabled: Boolean(s.onlinePaymentEnabled),
      primaryLanguage: s.primaryLanguage === "en" ? "en" : "ar",
      timeZone: s.timeZone ?? "Africa/Cairo",
    });
  }, [data, form]);

  const saveGeneral = async () => {
    if (!form) return;
    if (form.storeName.trim().length < 2) {
      toast.error("اسم المتجر قصير جداً.");
      return;
    }
    setSaving(true);
    try {
      await api.settings.update(subdomain, {
        storeName: form.storeName.trim(),
        phone: form.phone.trim(),
        countryCode: form.countryCode,
        storeCurrency: form.storeCurrency,
        description: form.description,
        logoUrl: form.logoUrl,
        coverUrl: form.coverUrl,
        supportEmail: form.supportEmail.trim(),
        seoTitle: form.seoTitle.trim(),
        seoDescription: form.seoDescription.trim(),
        whatsapp: form.whatsapp.trim(),
        codEnabled: form.codEnabled,
        onlinePaymentEnabled: form.onlinePaymentEnabled,
        primaryLanguage: form.primaryLanguage,
        timeZone: form.timeZone,
      });
      toast.success("تم حفظ بيانات المتجر.");
      await refresh();
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSaving(false);
    }
  };

  /* ---- notification prefs ---- */
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [prefsBusy, setPrefsBusy] = useState(false);

  useEffect(() => {
    if (!data?.store || prefs) return;
    const stored = (data.store.notificationPrefs ?? {}) as Record<string, unknown>;
    setPrefs({
      newOrders: stored.newOrders !== false,
      lowStock: stored.lowStock !== false,
      abandonedCarts: stored.abandonedCarts !== false,
      reviews: stored.reviews !== false,
      marketing: stored.marketing === true,
    });
  }, [data, prefs]);

  const savePrefs = async (next: Record<string, boolean>) => {
    setPrefs(next);
    setPrefsBusy(true);
    try {
      await api.settings.notificationPrefs(subdomain, next);
      toast.success("تم تحديث تفضيلات الإشعارات.");
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setPrefsBusy(false);
    }
  };

  /* ---- domains ---- */
  const [domainInput, setDomainInput] = useState("");
  const [domainBusy, setDomainBusy] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<any | null>(null);

  const addDomain = async () => {
    if (!domainInput.trim()) return;
    setDomainBusy(true);
    try {
      await api.settings.addDomain(subdomain, domainInput.trim().toLowerCase());
      toast.success("تمت إضافة النطاق. أضف سجل TXT للتحقق.");
      setDomainInput("");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDomainBusy(false);
    }
  };

  const verifyDomain = async (domain: any) => {
    setVerifyingId(domain.id);
    try {
      const result = await api.settings.verifyDomain(subdomain, domain.id);
      if (result.verified) toast.success("تم التحقق من النطاق بنجاح.");
      else toast.error("لم يتم العثور على سجل التحقق بعد. تأكد من إضافته ثم أعد المحاولة.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setVerifyingId(null);
    }
  };

  /* ---- team ---- */
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamDraft, setTeamDraft] = useState({ name: "", email: "", role: "staff" });
  const [teamBusy, setTeamBusy] = useState(false);
  const [deletingMember, setDeletingMember] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const inviteMember = async () => {
    if (!teamDraft.email.trim()) {
      toast.error("أدخل البريد الإلكتروني.");
      return;
    }
    setTeamBusy(true);
    try {
      const result = await api.settings.invite(subdomain, {
        name: teamDraft.name.trim(),
        email: teamDraft.email.trim(),
        role: teamDraft.role,
      });
      toast.success(result.note ?? "تم إنشاء الدعوة.");
      setTeamOpen(false);
      setTeamDraft({ name: "", email: "", role: "staff" });
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setTeamBusy(false);
    }
  };

  const updateMember = async (member: any, body: Record<string, unknown>) => {
    try {
      await api.settings.updateMember(subdomain, member.id, body);
      toast.success("تم تحديث عضو الفريق.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  /* ---- security ---- */
  const [passwordDraft, setPasswordDraft] = useState({ current: "", next: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);

  const changePassword = async () => {
    if (passwordDraft.next.length < 8) {
      toast.error("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (passwordDraft.next !== passwordDraft.confirm) {
      toast.error("كلمتا المرور غير متطابقتين.");
      return;
    }
    setPasswordBusy(true);
    try {
      await api.changePassword(passwordDraft.current, passwordDraft.next);
      toast.success("تم تغيير كلمة المرور.");
      setPasswordDraft({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDraft, setDeleteDraft] = useState({ password: "", confirmation: "" });
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);

  const deleteAccount = async () => {
    if (deleteDraft.confirmation !== "DELETE") {
      toast.error("اكتب DELETE بالضبط للتأكيد.");
      return;
    }
    setDeleteAccountBusy(true);
    try {
      await api.deleteAccount(deleteDraft.password);
      toast.success("تم حذف الحساب.");
      window.location.href = "/";
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDeleteAccountBusy(false);
    }
  };

  const integrations = data?.integrations ?? {};

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="التشغيل"
        title="الإعدادات"
        description="بيانات المتجر، الإشعارات، النطاقات، الفريق، والأمان في مكان واحد."
        actions={<Button variant="ghost" size="sm" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>}
      />

      <div className="flex flex-wrap gap-1 rounded-brand border border-line bg-card p-1 text-xs font-semibold">
        {TABS.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.key}
              onClick={() => setTab(entry.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-brand-sm px-3 py-2 transition",
                tab === entry.key ? "bg-brand text-on-brand" : "text-subtle hover:text-ink"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {entry.label}
            </button>
          );
        })}
      </div>

      {error ? <Alert tone="error" title="تعذر تحميل الإعدادات">{safeError(error)}</Alert> : null}

      {loading && !data ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : tab === "general" && form ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-3 text-xs font-bold text-ink">الهوية</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اسم المتجر" required>
                  <Input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
                </Field>
                <Field label="رابط المتجر" hint="النطاق الفرعي لا يتغير من هنا للحفاظ على الروابط المنشورة.">
                  <Input value={`/store/${subdomain}`} disabled dir="ltr" className="font-mono" />
                </Field>
                <Field label="وصف المتجر" className="sm:col-span-2">
                  <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
                <ImageUploader value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} label="شعار المتجر" />
                <ImageUploader value={form.coverUrl} onChange={(url) => setForm({ ...form, coverUrl: url })} label="صورة الغلاف" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 text-xs font-bold text-ink">البيع والتواصل</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="واتساب الدعم" hint="يظهر في متجرك وفي روابط تأكيد الطلب">
                  <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} dir="ltr" placeholder="+2010…" />
                </Field>
                <Field label="هاتف المتجر">
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
                </Field>
                <Field label="بريد الدعم">
                  <Input type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} dir="ltr" />
                </Field>
                <Field label="عملة المتجر" hint="تغيير العملة يؤثر على عرض الأسعار الجديدة.">
                  <Select value={form.storeCurrency} onChange={(e) => setForm({ ...form, storeCurrency: e.target.value })}>
                    {Object.entries(CURRENCIES).map(([code, meta]) => (
                      <option key={code} value={code}>{meta.label} ({code})</option>
                    ))}
                  </Select>
                </Field>
                <Field label="الدولة">
                  <Select value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })}>
                    {COUNTRIES_DATA.map((country) => (
                      <option key={country.code} value={country.code}>{country.flag} {country.name_ar}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="المنطقة الزمنية">
                  <Select value={form.timeZone} onChange={(e) => setForm({ ...form, timeZone: e.target.value })}>
                    {TIME_ZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                  </Select>
                </Field>
                <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                  <Switch checked={form.codEnabled} onChange={(v) => setForm({ ...form, codEnabled: v })} label="الدفع عند الاستلام" description="الطريقة الأساسية للتجارة الإلكترونية في المنطقة." />
                  <Switch
                    checked={form.onlinePaymentEnabled}
                    onChange={(v) => setForm({ ...form, onlinePaymentEnabled: v })}
                    label="الدفع الإلكتروني"
                    description={integrations.payments?.configured ? "البوابة مهيأة على الخادم." : "يتطلب تهيئة بوابة دفع على الخادم أولاً."}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 text-xs font-bold text-ink">تحسين محركات البحث (SEO)</div>
              <div className="grid gap-4">
                <Field label="عنوان الصفحة">
                  <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
                </Field>
                <Field label="وصف الصفحة">
                  <Textarea rows={2} value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
                </Field>
                <Field label="اللغة الأساسية">
                  <Select value={form.primaryLanguage} onChange={(e) => setForm({ ...form, primaryLanguage: e.target.value })}>
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </Select>
                </Field>
              </div>
            </Card>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => { setForm(null); reload(); }}>استعادة القيم</Button>
              <Button loading={saving} onClick={saveGeneral}>حفظ الإعدادات</Button>
            </div>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-3 text-xs font-bold text-ink">استخدام المتجر</div>
              <div className="space-y-2 text-[11px] text-subtle">
                <div className="flex justify-between"><span>المنتجات</span><span className="font-semibold text-ink">{number(data?.usage?.products ?? 0)}</span></div>
                <div className="flex justify-between"><span>الطلبات</span><span className="font-semibold text-ink">{number(data?.usage?.orders ?? 0)}</span></div>
                <div className="flex justify-between"><span>العملاء</span><span className="font-semibold text-ink">{number(data?.usage?.customers ?? 0)}</span></div>
                <div className="flex justify-between"><span>أعضاء الفريق</span><span className="font-semibold text-ink">{number((data?.team ?? []).length)}</span></div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 text-xs font-bold text-ink">حالة التكاملات</div>
              <div className="space-y-2 text-[11px]">
                {Object.entries(integrations).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-subtle">{key}</span>
                    {value?.configured ? (
                      <Badge tone="bg-success-soft text-success border-success-line"><CheckCircle2 className="h-3 w-3" /> مهيأ</Badge>
                    ) : (
                      <Badge tone="bg-surface text-subtle border-line">غير مهيأ</Badge>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] leading-5 text-subtle">
                التكاملات غير المهيأة تعمل بوضع يدوي بشفافية، ولن ندّعي إرسالاً أو ربطاً لم يحدث فعلاً.
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-2 text-xs font-bold text-ink">حساب التاجر</div>
              <div className="text-[11px] text-subtle">{data?.merchant?.email}</div>
              <div className="mt-1 text-[10px] text-subtle">
                {[data?.merchant?.firstName, data?.merchant?.lastName].filter(Boolean).join(" ") || data?.merchant?.name || ""}
              </div>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => setTab("security")}>إدارة الأمان</Button>
              </div>
            </Card>
          </div>
        </div>
      ) : tab === "notifications" && prefs ? (
        <Card className="max-w-2xl p-4">
          <div className="mb-3 text-xs font-bold text-ink">تفضيلات الإشعارات</div>
          <div className="grid gap-3">
            <Switch checked={prefs.newOrders} disabled={prefsBusy} onChange={(v) => savePrefs({ ...prefs, newOrders: v })} label="الطلبات الجديدة" description="إشعار فوري عند وصول أي طلب جديد." />
            <Switch checked={prefs.lowStock} disabled={prefsBusy} onChange={(v) => savePrefs({ ...prefs, lowStock: v })} label="تنبيه المخزون المنخفض" description="عند اقتراب أي منتج من النفاد." />
            <Switch checked={prefs.abandonedCarts} disabled={prefsBusy} onChange={(v) => savePrefs({ ...prefs, abandonedCarts: v })} label="السلات المتروكة" description="عند ترك عميل لمنتج في السلة." />
            <Switch checked={prefs.reviews} disabled={prefsBusy} onChange={(v) => savePrefs({ ...prefs, reviews: v })} label="التقييمات الجديدة" description="عند إرسال عميل تقييماً يحتاج مراجعة." />
            <Switch checked={prefs.marketing} disabled={prefsBusy} onChange={(v) => savePrefs({ ...prefs, marketing: v })} label="رسائل سند التسويقية" description="نصائح وعروض من فريق سند." />
          </div>
        </Card>
      ) : tab === "domains" ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3 text-xs font-bold text-ink">النطاقات المتصلة</div>
            {(data?.domains ?? []).length === 0 ? (
              <EmptyState
                title="لا توجد نطاقات مخصصة"
                description="متجرك متاح الآن على رابط سند. أضف نطاقاً خاصاً بك لتعزيز الثقة."
                icon={<Globe className="h-5 w-5" />}
              />
            ) : (
              <div className="divide-y divide-line">
                {(data?.domains ?? []).map((domain: any) => (
                  <div key={domain.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-ink" dir="ltr">{domain.domain}</span>
                        {domain.status === "verified" ? (
                          <Badge tone="bg-success-soft text-success border-success-line"><CheckCircle2 className="h-3 w-3" /> موثّق</Badge>
                        ) : (
                          <Badge tone="bg-warning-soft text-warning border-warning-line">بانتظار التحقق</Badge>
                        )}
                      </div>
                      {domain.status !== "verified" ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-subtle">
                          <span>سجل TXT على <span className="font-mono" dir="ltr">_sanad-verification.{domain.domain}</span> بالقيمة:</span>
                          <span className="font-mono text-subtle" dir="ltr">{domain.verificationToken}</span>
                          <CopyButton value={domain.verificationToken} label="" />
                        </div>
                      ) : (
                        <div className="mt-1 text-[10px] text-subtle">تم التوثيق {dateTime(domain.verifiedAt)}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {domain.status !== "verified" ? (
                        <Button variant="outline" size="sm" loading={verifyingId === domain.id} onClick={() => verifyDomain(domain)}>تحقق الآن</Button>
                      ) : null}
                      <button onClick={() => setDeletingDomain(domain)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="حذف">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-3 text-xs font-bold text-ink">إضافة نطاق</div>
            <div className="space-y-3">
              <Field label="النطاق" hint="مثال: shop.example.com">
                <Input value={domainInput} onChange={(e) => setDomainInput(e.target.value)} dir="ltr" className="font-mono" placeholder="shop.example.com" />
              </Field>
              <Button className="w-full" loading={domainBusy} onClick={addDomain}>إضافة النطاق</Button>
              <div className="text-[10px] leading-5 text-subtle">
                بعد الإضافة سنعرض لك سجل TXT المطلوب. نتحقق منه فعلياً عبر DNS، ولن يظهر النطاق كموثّق قبل ذلك.
              </div>
            </div>
          </Card>
        </div>
      ) : tab === "team" ? (
        <div className="space-y-3">
          <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <div className="text-xs font-bold text-ink">فريق المتجر</div>
              <div className="mt-0.5 text-[11px] text-subtle">
                {data?.invitation_email_configured ? "دعوات البريد مفعّلة." : "إرسال دعوات البريد غير مهيأ بعد — تُنشأ الدعوة داخل النظام فقط."}
              </div>
            </div>
            <Button onClick={() => setTeamOpen(true)}><UserPlus className="h-4 w-4" /> دعوة عضو</Button>
          </Card>
          <Card className="overflow-hidden">
            {(data?.team ?? []).length === 0 ? (
              <EmptyState
                title="لا يوجد أعضاء بعد"
                description="ادعُ موظفاً ليساعدك في إدارة الطلبات والمنتجات."
                icon={<Users className="h-5 w-5" />}
                action={<Button onClick={() => setTeamOpen(true)}><UserPlus className="h-4 w-4" /> دعوة أول عضو</Button>}
              />
            ) : (
              <TableShell minWidth={780}>
                <thead>
                  <tr className="border-b border-line">
                    <Th>العضو</Th>
                    <Th>البريد</Th>
                    <Th>الدور</Th>
                    <Th>الحالة</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {(data?.team ?? []).map((member: any) => (
                    <tr key={member.id} className="border-b border-line">
                      <Td><span className="font-semibold text-ink">{member.name || "—"}</span></Td>
                      <Td><span className="font-mono text-[10px] text-subtle" dir="ltr">{member.email}</span></Td>
                      <Td>
                        <Select
                          value={member.role}
                          onChange={(e) => updateMember(member, { role: e.target.value })}
                          className="h-8 w-32 text-[11px]"
                          aria-label="الدور"
                        >
                          {Object.entries(ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </Select>
                      </Td>
                      <Td>
                        <Select
                          value={member.status}
                          onChange={(e) => updateMember(member, { status: e.target.value })}
                          className="h-8 w-28 text-[11px]"
                          aria-label="الحالة"
                        >
                          {Object.entries(TEAM_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </Select>
                      </Td>
                      <Td>
                        <div className="flex justify-end">
                          <button onClick={() => setDeletingMember(member)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="إزالة">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Card>
        </div>
      ) : tab === "security" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-ink"><KeyRound className="h-3.5 w-3.5 text-brand" /> تغيير كلمة المرور</div>
            <div className="space-y-3">
              <Field label="كلمة المرور الحالية" required>
                <Input type="password" value={passwordDraft.current} onChange={(e) => setPasswordDraft({ ...passwordDraft, current: e.target.value })} dir="ltr" />
              </Field>
              <Field label="كلمة المرور الجديدة" required hint="8 أحرف على الأقل">
                <Input type="password" value={passwordDraft.next} onChange={(e) => setPasswordDraft({ ...passwordDraft, next: e.target.value })} dir="ltr" />
              </Field>
              <Field label="تأكيد كلمة المرور" required>
                <Input type="password" value={passwordDraft.confirm} onChange={(e) => setPasswordDraft({ ...passwordDraft, confirm: e.target.value })} dir="ltr" />
              </Field>
              <Button loading={passwordBusy} onClick={changePassword}>تحديث كلمة المرور</Button>
            </div>
          </Card>

          <Card className="border-danger-line p-4">
            <div className="mb-3 text-xs font-bold text-danger">حذف الحساب نهائياً</div>
            <p className="text-[11px] leading-6 text-subtle">
              سيتم حذف حسابك وبيانات تسجيل الدخول. إذا كنت التاجر الوحيد على المتجر فسيُحذف المتجر معه هو وكل بياناته.
              لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="mt-3">
              <Button variant="danger" onClick={() => { setDeleteDraft({ password: "", confirmation: "" }); setDeleteOpen(true); }}>
                <Trash2 className="h-4 w-4" /> حذف الحساب
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-xs font-bold text-ink">آخر أنشطة المتجر (سجل تدقيق)</div>
          <AuditLogs subdomain={subdomain} />
        </Card>
      )}

      {/* invite modal */}
      <Modal
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
        title="دعوة عضو جديد"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTeamOpen(false)}>إلغاء</Button>
            <Button loading={teamBusy} onClick={inviteMember}>إرسال الدعوة</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="الاسم">
            <Input value={teamDraft.name} onChange={(e) => setTeamDraft({ ...teamDraft, name: e.target.value })} />
          </Field>
          <Field label="البريد الإلكتروني" required>
            <Input type="email" value={teamDraft.email} onChange={(e) => setTeamDraft({ ...teamDraft, email: e.target.value })} dir="ltr" />
          </Field>
          <Field label="الدور">
            <Select value={teamDraft.role} onChange={(e) => setTeamDraft({ ...teamDraft, role: e.target.value })}>
              {Object.entries(ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          </Field>
          <Alert tone="warning" title="ملاحظة صادقة">
            إرسال البريد غير مهيأ حالياً، لذا ستُنشأ الدعوة داخل النظام فقط ولن نؤكد إرسال بريد لم يحدث.
          </Alert>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="تأكيد حذف الحساب"
        description="إجراء نهائي لا يمكن التراجع عنه."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>إلغاء</Button>
            <Button variant="danger" loading={deleteAccountBusy} onClick={deleteAccount}>حذف نهائي</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="كلمة المرور" required>
            <Input type="password" value={deleteDraft.password} onChange={(e) => setDeleteDraft({ ...deleteDraft, password: e.target.value })} dir="ltr" />
          </Field>
          <Field label="اكتب DELETE للتأكيد" required>
            <Input value={deleteDraft.confirmation} onChange={(e) => setDeleteDraft({ ...deleteDraft, confirmation: e.target.value })} dir="ltr" className="font-mono" placeholder="DELETE" />
          </Field>
          <Alert tone="error" title="تحذير">
            سيتم حذف الحساب وجلساتك، وقد يُحذف المتجر وبياناته إن لم يتبقَّ تجار آخرون عليه.
          </Alert>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingDomain)}
        title="حذف النطاق"
        description={deletingDomain ? `سيتم فصل النطاق ${deletingDomain.domain}.` : undefined}
        confirmLabel="فصل النطاق"
        loading={false}
        onConfirm={async () => {
          if (!deletingDomain) return;
          try {
            await api.settings.removeDomain(subdomain, deletingDomain.id);
            toast.success("تم فصل النطاق.");
          } catch (err: any) {
            toast.error(safeError(err));
          } finally {
            setDeletingDomain(null);
            reload();
          }
        }}
        onClose={() => setDeletingDomain(null)}
      />

      <ConfirmDialog
        open={Boolean(deletingMember)}
        title="إزالة عضو الفريق"
        description={deletingMember ? `سيتم إلغاء وصول ${deletingMember.email}.` : undefined}
        confirmLabel="إزالة العضو"
        loading={deleteBusy}
        onConfirm={async () => {
          if (!deletingMember) return;
          setDeleteBusy(true);
          try {
            await api.settings.removeMember(subdomain, deletingMember.id);
            toast.success("تمت إزالة العضو.");
          } catch (err: any) {
            toast.error(safeError(err));
          } finally {
            setDeleteBusy(false);
            setDeletingMember(null);
            reload();
          }
        }}
        onClose={() => setDeletingMember(null)}
      />
    </div>
  );
}

function AuditLogs({ subdomain }: { subdomain: string }) {
  const { data, loading } = useAsync(() => api.settings.auditLogs(subdomain, 60), [subdomain]);
  const logs = data?.logs ?? [];

  if (loading && !data) {
    return <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>;
  }
  if (logs.length === 0) {
    return <EmptyState title="لا يوجد نشاط مسجّل" description="ستظهر هنا كل العمليات المهمة على المتجر مثل تعديل المنتجات والطلبات والإعدادات." icon={<ScrollText className="h-5 w-5" />} />;
  }
  return (
    <TableShell minWidth={720}>
      <thead>
        <tr className="border-b border-line">
          <Th>التاريخ</Th>
          <Th>العملية</Th>
          <Th>الكيان</Th>
          <Th>بواسطة</Th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log: any) => (
          <tr key={log.id} className="border-b border-line">
            <Td><span className="text-[11px] text-subtle">{dateTime(log.createdAt)}</span></Td>
            <Td><Badge tone="bg-surface text-ink-soft border-line">{log.action}</Badge></Td>
            <Td><span className="font-mono text-[10px] text-subtle" dir="ltr">{log.entity || "—"}</span></Td>
            <Td><span className="text-[11px] text-subtle">{log.merchant?.email || "—"}</span></Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
