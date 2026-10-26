import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Flag,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Store as StoreIcon,
  UserCog,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { date, dateTime, money, number, safeError } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  Switch,
  Textarea,
  cn,
  useToast,
} from "../components/ui";
import { ORDER_STATUS } from "../lib/format";
import { TableShell, Td, Th } from "../dashboard/common";
import {
  ADMIN_ROLE_LABELS,
  DOMAIN_STATUS,
  TLS_STATUS,
  PermissionNote,
  type AdminPanelProps,
  type AdminIdentityPanelProps,
  type AdminPermission,
} from "./shared";

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

function firstOfMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsPanel({ can }: AdminPanelProps) {
  const toast = useToast();
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState({ from: firstOfMonth(), to: today() });
  const { data, loading, error, reload } = useAsync(
    () => (can("reports.read") ? api.admin.reports(applied) : Promise.resolve(null)),
    [can, applied.from, applied.to]
  );

  const summary = data?.summary ?? {};
  const ordersByStatus = data?.ordersByStatus ?? [];
  const topStores = data?.topStores ?? [];

  const apply = () => {
    if (!from || !to) {
      toast.error("حدد تاريخ البداية والنهاية.");
      return;
    }
    if (from > to) {
      toast.error("تاريخ البداية يجب أن يسبق تاريخ النهاية.");
      return;
    }
    setApplied({ from, to });
  };

  if (!can("reports.read")) {
    return <PermissionNote>دورك الحالي لا يمنح صلاحية قراءة تقارير المنصة.</PermissionNote>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="تحليلات المنصة"
        title="تقارير المنصة"
        description="أرقام الطلبات والإيرادات والتجار الجدد تُحسب من قاعدة البيانات لنطاق زمني محدد. الإيراد بالجنيه المصري وفق سعر الصرف المسجل في الطلب."
        actions={<Button variant="outline" onClick={reload} loading={loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="من تاريخ">
            <Input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} dir="ltr" className="w-44" />
          </Field>
          <Field label="إلى تاريخ">
            <Input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} dir="ltr" className="w-44" />
          </Field>
          <Button onClick={apply} loading={loading}>تطبيق النطاق</Button>
          {data?.range ? (
            <div className="ms-auto text-[10px] leading-5 text-subtle">
              النطاق المحسوب: {date(data.range.from)} — {date(data.range.to)}
            </div>
          ) : null}
        </div>
      </Card>

      {error ? <Alert tone="error" title="تعذر تحميل التقرير">{safeError(error)}</Alert> : null}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="إجمالي الطلبات" value={number(summary.orders ?? 0)} hint="داخل النطاق الزمني" icon={<BarChart3 className="h-5 w-5" />} accent="brand" />
            <StatCard label="إجمالي الإيراد" value={money(summary.revenue ?? 0, "EGP")} hint="مجموع قيمة الطلبات بالجنيه" icon={<Wallet className="h-5 w-5" />} accent="success" />
            <StatCard label="متوسط قيمة الطلب" value={money(summary.averageOrderValue ?? 0, "EGP")} hint="الإيراد ÷ عدد الطلبات" icon={<ArrowUpRight className="h-5 w-5" />} accent="info" />
            <StatCard label="نمو المنصة" value={`${number(summary.newMerchants ?? 0)} / ${number(summary.newStores ?? 0)}`} hint="تجار جدد / متاجر جديدة" icon={<Users className="h-5 w-5" />} accent="warning" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <div className="text-sm font-bold text-ink">الطلبات حسب الحالة</div>
                <div className="mt-0.5 text-[10px] text-subtle">كل الطلبات المنشأة داخل النطاق، بغض النظر عن الحالة الحالية.</div>
              </div>
              {ordersByStatus.length === 0 ? (
                <EmptyState title="لا توجد طلبات في هذا النطاق" description="جرّب توسيع النطاق الزمني." icon={<BarChart3 className="h-5 w-5" />} />
              ) : (
                <div className="divide-y divide-line">
                  {ordersByStatus.map((row: any) => {
                    const meta = ORDER_STATUS[row.status] ?? { label: row.status, tone: "bg-surface text-ink-soft border-line" };
                    return (
                      <div key={row.status} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="text-sm font-bold text-ink">{number(row.count)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <div className="text-sm font-bold text-ink">أعلى المتاجر إيراداً</div>
                <div className="mt-0.5 text-[10px] text-subtle">أعلى 10 متاجر حسب قيمة الطلبات داخل النطاق.</div>
              </div>
              {topStores.length === 0 ? (
                <EmptyState title="لا توجد بيانات متاجر" description="ستظهر المتاجر بعد تسجيل طلبات داخل النطاق." icon={<StoreIcon className="h-5 w-5" />} />
              ) : (
                <TableShell minWidth={640}>
                  <thead>
                    <tr className="border-b border-line bg-surface/60">
                      <Th>#</Th>
                      <Th>المتجر</Th>
                      <Th>الطلبات</Th>
                      <Th>الإيراد</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {topStores.map((row: any, index: number) => (
                      <tr key={row.storeId} className="border-b border-line hover:bg-surface/50">
                        <Td><span className="text-[11px] font-semibold text-subtle">{number(index + 1)}</span></Td>
                        <Td>
                          <div className="max-w-[220px] truncate text-xs font-semibold text-ink">{row.storeName || "—"}</div>
                          <a href={`/store/${row.subdomain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-subtle hover:text-brand" dir="ltr">
                            /store/{row.subdomain} <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </Td>
                        <Td><span className="font-semibold text-ink">{number(row.orders ?? 0)}</span></Td>
                        <Td><span className="font-semibold text-ink">{money(row.revenue ?? 0, "EGP")}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Custom domains and TLS                                              */
/* ------------------------------------------------------------------ */

type TlsDraft = { domain: any; status: "pending" | "active" | "failed"; error: string };

export function DomainsPanel({ can }: AdminPanelProps) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(
    () => (can("domains.read") ? api.admin.domains() : Promise.resolve(null)),
    [can]
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tlsDraft, setTlsDraft] = useState<TlsDraft | null>(null);
  const [tlsBusy, setTlsBusy] = useState(false);
  const [query, setQuery] = useState("");
  const domains = data?.domains ?? [];

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return domains;
    return domains.filter((row: any) =>
      [row.domain, row.store?.storeName, row.store?.subdomain].filter(Boolean).join(" ").toLowerCase().includes(term)
    );
  }, [domains, query]);

  const verify = async (row: any, verified: boolean) => {
    setBusyId(row.id);
    try {
      await api.admin.verifyDomain(row.id, verified);
      toast.success(verified ? "تم توثيق النطاق وربطه بالمتجر." : "تم إلغاء توثيق النطاق وفصله عن المتجر.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const saveTls = async () => {
    if (!tlsDraft) return;
    setTlsBusy(true);
    try {
      await api.admin.setDomainTls(tlsDraft.domain.id, tlsDraft.status, tlsDraft.error.trim());
      toast.success("تم تحديث حالة TLS للنطاق.");
      setTlsDraft(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setTlsBusy(false);
    }
  };

  if (!can("domains.read")) {
    return <PermissionNote>دورك الحالي لا يمنح صلاحية قراءة النطاقات المخصصة.</PermissionNote>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="النطاقات والتوجيه"
        title="النطاقات المخصصة و TLS"
        description="التحقق من ملكية النطاق يربطه بالمتجر فوراً. TLS يُنهى عند وكيل المنصة، لذلك نسجل حالته صراحةً بدلاً من افتراض أن HTTPS يعمل تلقائياً."
        actions={<Button variant="outline" onClick={reload} loading={loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />

      <Alert tone="info" title="كيف يتم التحقق؟">
        يتطلب النطاق سجل TXT على <span className="font-mono" dir="ltr">_sanad-verification.&lt;domain&gt;</span> بالقيمة
        الظاهرة لكل صف. بعد التأكد من السجل في DNS وثق النطاق هنا، ثم سجّل حالة شهادة TLS بعد تهيئتها على الوكيل الخارجي.
      </Alert>

      {error ? <Alert tone="error" title="تعذر تحميل النطاقات">{safeError(error)}</Alert> : null}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث بالنطاق أو اسم المتجر…" className="w-full sm:w-80" />
          <div className="ms-auto text-[11px] text-subtle">{number(filtered.length)} من {number(domains.length)} نطاق</div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="لا توجد نطاقات مخصصة"
            description="يسجّل التجار نطاقاتهم من إعدادات المتجر، ثم تظهر هنا للتحقق وتهيئة TLS."
            icon={<Globe className="h-5 w-5" />}
          />
        ) : (
          <TableShell minWidth={1240}>
            <thead>
              <tr className="border-b border-line bg-surface/60">
                <Th>النطاق</Th>
                <Th>المتجر</Th>
                <Th>التحقق</Th>
                <Th>TLS</Th>
                <Th>آخر فحص</Th>
                <Th>الإجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row: any) => {
                const domainMeta = DOMAIN_STATUS[row.status] ?? { label: row.status, tone: "bg-surface text-ink-soft border-line", dot: "bg-subtle" };
                const tlsMeta = TLS_STATUS[row.tls_status] ?? { label: row.tls_status ?? "—", tone: "bg-surface text-ink-soft border-line" };
                const canWrite = can("domains.write");
                return (
                  <tr key={row.id} className="border-b border-line align-top hover:bg-surface/50">
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-ink" dir="ltr">{row.domain}</span>
                        {row.store?.customDomain === row.domain ? (
                          <Badge tone="bg-brand-soft text-brand border-brand-line">النطاق الحالي</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-subtle">
                        <span>TXT:</span>
                        <code className="rounded bg-surface px-1 py-0.5 font-mono" dir="ltr">_sanad-verification.{row.domain}</code>
                        <CopyButton value={row.verificationToken} label="" />
                      </div>
                      <div className="mt-0.5 max-w-[330px] truncate font-mono text-[10px] text-subtle" dir="ltr">{row.verificationToken}</div>
                    </Td>
                    <Td>
                      <div className="max-w-[190px] truncate text-[11px] font-semibold text-ink">{row.store?.storeName || "—"}</div>
                      <a href={`/store/${row.store?.subdomain ?? ""}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-subtle hover:text-brand" dir="ltr">
                        /store/{row.store?.subdomain} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                      <div className="mt-1 text-[10px] text-subtle">اعتماد: {row.store?.status ?? "—"} · نشر: {row.store?.publishStatus ?? "—"}</div>
                    </Td>
                    <Td>
                      <Badge tone={domainMeta.tone} dot={domainMeta.dot}>{domainMeta.label}</Badge>
                      <div className="mt-1 text-[10px] text-subtle">
                        {row.verifiedAt ? `وُثّق ${dateTime(row.verifiedAt)}` : "لم يُوثّق بعد"}
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={tlsMeta.tone}>{tlsMeta.label}</Badge>
                      <div className="mt-1 text-[10px] text-subtle">وضع: {row.tlsMode || "external_proxy"}</div>
                      {row.tlsProvisionedAt ? <div className="text-[10px] text-subtle">جُهّز {dateTime(row.tlsProvisionedAt)}</div> : null}
                      {row.tlsError ? <div className="mt-1 max-w-[200px] text-[10px] leading-4 text-danger">{row.tlsError}</div> : null}
                    </Td>
                    <Td><span className="text-[11px] text-subtle">{row.lastCheckedAt ? dateTime(row.lastCheckedAt) : "—"}</span></Td>
                    <Td>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {row.status === "verified" ? (
                          <Button size="sm" variant="ghost" disabled={!canWrite || busyId === row.id} loading={busyId === row.id} onClick={() => verify(row, false)}>
                            <XCircle className="h-3.5 w-3.5" /> إلغاء التوثيق
                          </Button>
                        ) : (
                          <Button size="sm" variant="success" disabled={!canWrite || busyId === row.id} loading={busyId === row.id} onClick={() => verify(row, true)}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> توثيق
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canWrite}
                          onClick={() => setTlsDraft({ domain: row, status: row.tls_status === "active" ? "active" : "pending", error: row.tlsError ?? "" })}
                        >
                          <Lock className="h-3.5 w-3.5" /> TLS
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal
        open={Boolean(tlsDraft)}
        onClose={() => (tlsBusy ? undefined : setTlsDraft(null))}
        title="تحديث حالة TLS"
        description={tlsDraft?.domain?.domain}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTlsDraft(null)} disabled={tlsBusy}>إلغاء</Button>
            <Button loading={tlsBusy} onClick={saveTls}>حفظ الحالة</Button>
          </>
        }
      >
        {tlsDraft ? (
          <div className="space-y-4">
            <Field label="حالة الشهادة">
              <Select value={tlsDraft.status} onChange={(event) => setTlsDraft({ ...tlsDraft, status: event.target.value as TlsDraft["status"] })}>
                <option value="pending">بانتظار التهيئة</option>
                <option value="active">نشطة</option>
                <option value="failed">فشلت</option>
              </Select>
            </Field>
            <Field label="سبب الفشل / ملاحظة" hint="يظهر للتاجر عند فشل التهيئة.">
              <Textarea rows={3} value={tlsDraft.error} onChange={(event) => setTlsDraft({ ...tlsDraft, error: event.target.value })} disabled={tlsDraft.status !== "failed"} />
            </Field>
            <Alert tone="warning">
              لا تسجل الحالة «نشطة» قبل التحقق فعلياً من الشهادة عند الوكيل. تُسجَّل هذه الحالة في سجل التدقيق.
            </Alert>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

const ACTOR_LABELS: Record<string, string> = {
  platform_admin: "إدارة المنصة",
  merchant: "تاجر",
  team_member: "عضو فريق",
  system: "النظام",
};

export function AuditPanel({ can }: AdminPanelProps) {
  const [draft, setDraft] = useState({ action: "", actorType: "", storeId: "" });
  const [filters, setFilters] = useState({ action: "", actorType: "", storeId: "" });
  const { data, loading, error, reload } = useAsync(
    () => (can("audit.read") ? api.admin.audit(filters) : Promise.resolve(null)),
    [can, filters.action, filters.actorType, filters.storeId]
  );
  const logs = data?.logs ?? [];
  const securityEvents = data?.security_events ?? [];

  const apply = () => setFilters({ ...draft });

  if (!can("audit.read")) {
    return <PermissionNote>دورك الحالي لا يمنح صلاحية قراءة سجل التدقيق.</PermissionNote>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="الحوكمة"
        title="سجل التدقيق وأحداث الأمان"
        description="كل عملية إدارية تُسجَّل مع هوية المنفذ ونوعه. محاولات الدخول لإدارة المنصة تظهر منفصلة في بطاقة أحداث الأمان."
        actions={<Button variant="outline" onClick={reload} loading={loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="بحث في الإجراء">
            <Input value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })} placeholder="wallet. أو admin." dir="ltr" className="w-56" />
          </Field>
          <Field label="نوع المنفذ">
            <Select value={draft.actorType} onChange={(event) => setDraft({ ...draft, actorType: event.target.value })} className="w-44">
              <option value="">الكل</option>
              <option value="platform_admin">إدارة المنصة</option>
              <option value="merchant">تاجر</option>
              <option value="team_member">عضو فريق</option>
              <option value="system">النظام</option>
            </Select>
          </Field>
          <Button onClick={apply} loading={loading}><Search className="h-4 w-4" /> تطبيق</Button>
          <Button
            variant="ghost"
            onClick={() => {
              const empty = { action: "", actorType: "", storeId: "" };
              setDraft(empty);
              setFilters(empty);
            }}
          >
            مسح
          </Button>
        </div>
      </Card>

      {error ? <Alert tone="error" title="تعذر تحميل سجل التدقيق">{safeError(error)}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="text-sm font-bold text-ink">آخر العمليات</div>
            <div className="mt-0.5 text-[10px] text-subtle">{number(logs.length)} سجل — بحد أقصى 300 سجل حديث.</div>
          </div>
          {loading && !data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
          ) : logs.length === 0 ? (
            <EmptyState title="لا توجد سجلات مطابقة" description="جرّب تغيير عامل التصفية أو امسحه." icon={<Shield className="h-5 w-5" />} />
          ) : (
            <TableShell minWidth={900}>
              <thead>
                <tr className="border-b border-line bg-surface/60">
                  <Th>الوقت</Th>
                  <Th>الإجراء</Th>
                  <Th>المنفذ</Th>
                  <Th>الكيان</Th>
                  <Th>المتجر</Th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-line align-top hover:bg-surface/50">
                    <Td><span className="text-[10px] text-subtle">{dateTime(log.createdAt)}</span></Td>
                    <Td>
                      <Badge tone="bg-surface text-ink-soft border-line">{log.action}</Badge>
                      {log.metadata && Object.keys(log.metadata).length ? (
                        <div className="mt-1 max-w-[260px] truncate font-mono text-[9px] text-subtle" dir="ltr">
                          {JSON.stringify(log.metadata)}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      <div className="text-[11px] font-semibold text-ink">{ACTOR_LABELS[log.actorType] ?? log.actorType ?? "—"}</div>
                      <div className="mt-0.5 text-[9px] text-subtle" dir="ltr">{log.ip || "—"}</div>
                    </Td>
                    <Td><span className="font-mono text-[10px] text-subtle" dir="ltr">{log.entity || "—"}</span></Td>
                    <Td>
                      {log.store ? (
                        <a href={`/store/${log.store.subdomain}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand hover:underline">
                          {log.store.storeName}
                        </a>
                      ) : (
                        <span className="text-[10px] text-subtle">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm font-bold text-ink"><ShieldAlert className="h-4 w-4 text-brand" /> أحداث أمان الإدارة</div>
            <div className="mt-0.5 text-[10px] text-subtle">آخر 50 محاولة دخول ناجحة أو فاشلة.</div>
          </div>
          {securityEvents.length === 0 ? (
            <EmptyState title="لا توجد أحداث" description="ستظهر هنا محاولات تسجيل دخول إدارة المنصة." icon={<ShieldCheck className="h-5 w-5" />} />
          ) : (
            <div className="max-h-[560px] divide-y divide-line overflow-y-auto">
              {securityEvents.map((event: any) => {
                const success = event.action === "admin.signed_in";
                return (
                  <div key={event.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={success ? "bg-success-soft text-success border-success-line" : "bg-danger-soft text-danger border-danger-line"}>
                        {success ? "دخول ناجح" : "دخول فاشل"}
                      </Badge>
                      <span className="text-[9px] text-subtle">{dateTime(event.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-subtle" dir="ltr">{event.ip || "—"}</div>
                    {event.metadata?.reason ? <div className="mt-0.5 text-[10px] text-subtle">السبب: {event.metadata.reason}</div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feature flags                                                       */
/* ------------------------------------------------------------------ */

const FLAG_CATALOG: Record<string, { label: string; description: string; defaultEnabled: boolean }> = {
  wallet_deposits: {
    label: "طلبات إيداع المحفظة",
    description: "يسمح للتجار بإرسال طلبات إيداع تخضع لمراجعة الإدارة قبل إضافة الرصيد. عند الإيقاف يبقى الرصيد والسجل ظاهرين للقراءة.",
    defaultEnabled: true,
  },
  support_center: {
    label: "مركز الدعم",
    description: "يسمح للتجار بفتح تذاكر دعم من لوحة التحكم.",
    defaultEnabled: true,
  },
};

export function FlagsPanel({ can }: AdminPanelProps) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(
    () => (can("flags.read") ? api.admin.featureFlags() : Promise.resolve(null)),
    [can]
  );
  const [busy, setBusy] = useState<string | null>(null);

  const flags = useMemo(() => {
    const rows = data?.flags ?? [];
    const known = new Map(rows.map((row: any) => [row.key, row]));
    const merged = rows.map((row: any) => ({
      ...row,
      catalog: FLAG_CATALOG[row.key] ?? null,
      default_enabled: FLAG_CATALOG[row.key]?.defaultEnabled ?? false,
    }));
    for (const [key, meta] of Object.entries(FLAG_CATALOG)) {
      if (!known.has(key)) {
        merged.push({
          key,
          label: meta.label,
          description: meta.description,
          enabled: meta.defaultEnabled,
          catalog: meta,
          default_enabled: meta.defaultEnabled,
          persisted: false,
        });
      }
    }
    return merged.sort((a: any, b: any) => a.key.localeCompare(b.key));
  }, [data]);

  const toggle = async (key: string, enabled: boolean) => {
    setBusy(key);
    try {
      await api.admin.updateFeatureFlag(key, enabled);
      toast.success(`تم ${enabled ? "تفعيل" : "إيقاف"} ${FLAG_CATALOG[key]?.label ?? key}.`);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(null);
    }
  };

  if (!can("flags.read")) {
    return <PermissionNote>دورك الحالي لا يمنح صلاحية قراءة مفاتيح الميزات.</PermissionNote>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="التشغيل"
        title="مفاتيح الميزات"
        description="تحكم مركزي في الميزات التي تعتمد على قرار تشغيلي. القيمة الافتراضية تُطبق عندما لا يوجد صف في قاعدة البيانات."
        actions={<Button variant="outline" onClick={reload} loading={loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>}
      />

      <Alert tone="info" title="التغييرات تُطبَّق فوراً">
        كل تبديل يُحدِّث قاعدة البيانات ويُسجَّل في سجل التدقيق باسمك. المفتاح غير الموجود بعد يظهر بقيمته الافتراضية حتى تُحفظ أول مرة.
      </Alert>

      {error ? <Alert tone="error" title="تعذر تحميل المفاتيح">{safeError(error)}</Alert> : null}

      {loading && !data ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20" />)}</div>
      ) : (
        <div className="space-y-2">
          {flags.map((flag: any) => {
            const label = flag.catalog?.label || flag.label || flag.key;
            const description = flag.catalog?.description || flag.description || "";
            const disabled = !can("flags.write") || busy === flag.key;
            return (
              <Card key={flag.key} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Flag className="h-4 w-4 text-brand" />
                      <span className="text-xs font-bold text-ink">{label}</span>
                      <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-subtle" dir="ltr">{flag.key}</code>
                      {flag.persisted === false ? <Badge tone="bg-surface text-ink-soft border-line">قيمة افتراضية</Badge> : null}
                    </div>
                    {description ? <p className="mt-1 text-[11px] leading-5 text-subtle">{description}</p> : null}
                    <div className="mt-1 text-[10px] text-subtle">
                      {flag.updatedAt ? `آخر تحديث ${dateTime(flag.updatedAt)}` : "لم يُحفظ صف صريح بعد."}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {busy === flag.key ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> : null}
                    <Badge tone={flag.enabled ? "bg-success-soft text-success border-success-line" : "bg-surface text-ink-soft border-line"}>
                      {flag.enabled ? "مفعّل" : "متوقف"}
                    </Badge>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(flag.key, !flag.enabled)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition",
                        flag.enabled ? "border-brand-line bg-brand" : "border-line bg-line",
                        disabled && "cursor-not-allowed opacity-60"
                      )}
                      aria-label={`${flag.enabled ? "إيقاف" : "تفعيل"} ${label}`}
                      aria-pressed={flag.enabled}
                    >
                      <span className={cn("absolute h-4 w-4 rounded-full bg-card shadow transition", flag.enabled ? "start-[24px]" : "start-0.5")} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
          {flags.length === 0 ? (
            <EmptyState title="لا توجد مفاتيح" description="لم تُسجَّل أي مفاتيح ميزات بعد." icon={<Flag className="h-5 w-5" />} />
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Platform administrators                                             */
/* ------------------------------------------------------------------ */

const ADMIN_ROLES = ["super_admin", "operations", "finance", "support", "readonly"] as const;

export function AdminsPanel({ can, admin }: AdminIdentityPanelProps) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(
    () => (can("admins.manage") ? api.admin.admins() : Promise.resolve(null)),
    [can]
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", password: "", role: "readonly" });
  const [createBusy, setCreateBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const admins = data?.admins ?? [];

  const create = async () => {
    if (!draft.email.trim() || draft.password.length < 12) {
      toast.error("أدخل بريداً صحيحاً وكلمة مرور من 12 حرفاً على الأقل.");
      return;
    }
    setCreateBusy(true);
    try {
      await api.admin.createAdmin({
        email: draft.email.trim(),
        password: draft.password,
        name: draft.name.trim(),
        role: draft.role,
      });
      toast.success("تم إنشاء حساب إدارة المنصة.");
      setCreateOpen(false);
      setDraft({ name: "", email: "", password: "", role: "readonly" });
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setCreateBusy(false);
    }
  };

  const update = async (row: any, body: { role?: string; status?: string }) => {
    setBusyId(row.id);
    try {
      await api.admin.updateAdmin(row.id, body);
      toast.success("تم تحديث حساب الإدارة.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusyId(null);
    }
  };

  if (!can("admins.manage")) {
    return <PermissionNote>إدارة حسابات المنصة متاحة لدور «مدير أعلى» فقط.</PermissionNote>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="الحوكمة"
        title="حسابات إدارة المنصة"
        description="حسابات منفصلة تماماً عن حسابات التجار، بجلسة دخول وكوكيز مستقلة. الدور يحدد الصلاحيات التي يفرضها الخادم."
        actions={
          <>
            <Button variant="outline" onClick={reload} loading={loading}><RefreshCw className="h-4 w-4" /> تحديث</Button>
            <Button onClick={() => setCreateOpen(true)}><UserCog className="h-4 w-4" /> إضافة مدير</Button>
          </>
        }
      />

      <Alert tone="warning" title="حدود الحماية">
        لا يمكنك تغيير دورك أو تعطيل حسابك الحالي من هذه الصفحة. تعطيل أي حساب يُنهي كل جلساته النشطة فوراً.
      </Alert>

      {error ? <Alert tone="error" title="تعذر تحميل الحسابات">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
        ) : admins.length === 0 ? (
          <EmptyState title="لا توجد حسابات إدارة" description="أضف أول حساب إدارة للمنصة." icon={<UserCog className="h-5 w-5" />} />
        ) : (
          <TableShell minWidth={1060}>
            <thead>
              <tr className="border-b border-line bg-surface/60">
                <Th>الحساب</Th>
                <Th>الدور</Th>
                <Th>الحالة</Th>
                <Th>2FA</Th>
                <Th>آخر دخول</Th>
                <Th>أُنشئ</Th>
              </tr>
            </thead>
            <tbody>
              {admins.map((row: any) => {
                const self = row.id === admin.id;
                const busy = busyId === row.id;
                return (
                  <tr key={row.id} className={cn("border-b border-line align-top hover:bg-surface/50", self && "bg-brand-soft/40")}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">{row.name || "—"}</span>
                        {self ? <Badge tone="bg-brand-soft text-brand border-brand-line">أنت</Badge> : null}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{row.email}</div>
                    </Td>
                    <Td>
                      <Select
                        value={row.role}
                        disabled={self || busy}
                        onChange={(event) => update(row, { role: event.target.value })}
                        className="h-8 w-36 text-[11px]"
                        aria-label={`دور ${row.email}`}
                      >
                        {ADMIN_ROLES.map((role) => <option key={role} value={role}>{ADMIN_ROLE_LABELS[role] ?? role}</option>)}
                      </Select>
                    </Td>
                    <Td>
                      <Select
                        value={row.status ?? "active"}
                        disabled={self || busy}
                        onChange={(event) => update(row, { status: event.target.value })}
                        className="h-8 w-28 text-[11px]"
                        aria-label={`حالة ${row.email}`}
                      >
                        <option value="active">نشط</option>
                        <option value="disabled">معطّل</option>
                      </Select>
                      {row.status !== "active" ? <div className="mt-1 text-[10px] text-danger">الجلسات مقطوعة</div> : null}
                    </Td>
                    <Td>
                      <Badge tone={row.two_factor_enabled ? "bg-success-soft text-success border-success-line" : "bg-surface text-ink-soft border-line"}>
                        {row.two_factor_enabled ? "مفعّلة" : "غير مفعّلة"}
                      </Badge>
                    </Td>
                    <Td><span className="text-[10px] text-subtle">{row.last_login_at ? dateTime(row.last_login_at) : "—"}</span></Td>
                    <Td><span className="text-[10px] text-subtle">{row.created_at ? date(row.created_at) : "—"}</span></Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => (createBusy ? undefined : setCreateOpen(false))}
        title="إضافة حساب إدارة"
        description="سيُطلب من الحساب تفعيل المصادقة الثنائية من صفحة الأمان."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={createBusy}>إلغاء</Button>
            <Button loading={createBusy} onClick={create}>إنشاء الحساب</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="الاسم">
            <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>
          <Field label="البريد الإلكتروني" required>
            <Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} dir="ltr" autoComplete="off" />
          </Field>
          <Field label="كلمة المرور" required hint="12 حرفاً على الأقل.">
            <Input type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} dir="ltr" autoComplete="new-password" />
          </Field>
          <Field label="الدور" hint="يمكن تعديله لاحقاً من الجدول.">
            <Select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
              {ADMIN_ROLES.map((role) => <option key={role} value={role}>{ADMIN_ROLE_LABELS[role] ?? role}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Security (current admin account)                                    */
/* ------------------------------------------------------------------ */

export function SecurityPanel({ admin, onAdminUpdated }: AdminIdentityPanelProps & { onAdminUpdated: () => void }) {
  const toast = useToast();
  const [passwordDraft, setPasswordDraft] = useState({ current: "", next: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [twoFactorStart, setTwoFactorStart] = useState(false);
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableDraft, setDisableDraft] = useState({ password: "", code: "" });
  const [disableBusy, setDisableBusy] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const twoFactorEnabled = Boolean(admin.two_factor_enabled);

  const changePassword = async () => {
    if (passwordDraft.next.length < 12) {
      toast.error("كلمة المرور الجديدة يجب أن تكون 12 حرفاً على الأقل.");
      return;
    }
    if (passwordDraft.next !== passwordDraft.confirm) {
      toast.error("كلمتا المرور غير متطابقتين.");
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await api.admin.auth.changePassword(passwordDraft.current, passwordDraft.next);
      toast.success(
        result.revoked_sessions > 0
          ? `تم تغيير كلمة المرور وإنهاء ${result.revoked_sessions} جلسة أخرى.`
          : "تم تغيير كلمة المرور."
      );
      setPasswordDraft({ current: "", next: "", confirm: "" });
      onAdminUpdated();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  const startTwoFactor = async () => {
    if (!twoFactorPassword) {
      toast.error("أدخل كلمة المرور الحالية.");
      return;
    }
    setTwoFactorBusy(true);
    try {
      const result = await api.admin.auth.twoFactor.setup(twoFactorPassword);
      setTwoFactorSetup({ secret: result.secret, otpauth_url: result.otpauth_url });
      setTwoFactorPassword("");
      setTwoFactorCode("");
      toast.success("أضف الحساب إلى تطبيق المصادقة ثم أدخل الرمز.");
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const enableTwoFactor = async () => {
    const code = twoFactorCode.replace(/\D/g, "");
    if (code.length !== 6) {
      toast.error("أدخل رمزاً من 6 أرقام.");
      return;
    }
    setTwoFactorBusy(true);
    try {
      const result = await api.admin.auth.twoFactor.enable(code);
      setRecoveryCodes(result.recovery_codes || []);
      setTwoFactorSetup(null);
      setTwoFactorCode("");
      toast.success("تم تفعيل المصادقة الثنائية. احفظ رموز الاسترداد الآن.");
      onAdminUpdated();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!disableDraft.password || !disableDraft.code.trim()) {
      toast.error("أدخل كلمة المرور ورمز المصادقة أو أحد رموز الاسترداد.");
      return;
    }
    setDisableBusy(true);
    try {
      await api.admin.auth.twoFactor.disable(disableDraft.password, disableDraft.code.trim());
      toast.success("تم تعطيل المصادقة الثنائية.");
      setDisableOpen(false);
      setDisableDraft({ password: "", code: "" });
      setRecoveryCodes([]);
      onAdminUpdated();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDisableBusy(false);
    }
  };

  const revokeOthers = async () => {
    setRevokeBusy(true);
    try {
      const result = await api.admin.auth.revokeOtherSessions();
      toast.success(result.revoked > 0 ? `تم إنهاء ${result.revoked} جلسة.` : "لا توجد جلسات أخرى نشطة.");
      setRevokeOpen(false);
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setRevokeBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="الحوكمة"
        title="أمان حساب الإدارة"
        description="كلمة المرور والمصادقة الثنائية والجلسات لحساب إدارة المنصة الحالي فقط. هذه الإعدادات منفصلة عن أي حساب تاجر."
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-ink">{admin.name || admin.email}</div>
            <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{admin.email}</div>
            <div className="mt-1 text-[10px] text-subtle">
              {ADMIN_ROLE_LABELS[admin.role] ?? admin.role} · {admin.permissions.length} صلاحية
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="bg-brand-soft text-brand border-brand-line"><ShieldCheck className="h-3 w-3" /> جلسة إدارة مستقلة</Badge>
            <Badge tone={twoFactorEnabled ? "bg-success-soft text-success border-success-line" : "bg-warning-soft text-warning border-warning-line"}>
              2FA {twoFactorEnabled ? "مفعّلة" : "غير مفعّلة"}
            </Badge>
          </div>
        </div>
        <div className="mt-3 text-[10px] leading-5 text-subtle">
          آخر دخول: {admin.last_login_at ? dateTime(admin.last_login_at) : "غير مسجل"}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-ink"><KeyRound className="h-3.5 w-3.5 text-brand" /> تغيير كلمة المرور</div>
          <div className="space-y-3">
            <Field label="كلمة المرور الحالية" required>
              <Input type="password" value={passwordDraft.current} onChange={(event) => setPasswordDraft({ ...passwordDraft, current: event.target.value })} dir="ltr" autoComplete="current-password" />
            </Field>
            <Field label="كلمة المرور الجديدة" required hint="12 حرفاً على الأقل.">
              <Input type="password" value={passwordDraft.next} onChange={(event) => setPasswordDraft({ ...passwordDraft, next: event.target.value })} dir="ltr" autoComplete="new-password" />
            </Field>
            <Field label="تأكيد كلمة المرور" required>
              <Input type="password" value={passwordDraft.confirm} onChange={(event) => setPasswordDraft({ ...passwordDraft, confirm: event.target.value })} dir="ltr" autoComplete="new-password" />
            </Field>
            <Button loading={passwordBusy} onClick={changePassword}>تحديث كلمة المرور</Button>
            <p className="text-[10px] leading-5 text-subtle">تُنهى كل الجلسات الأخرى تلقائياً وتبقى جلستك الحالية نشطة.</p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink"><Smartphone className="h-3.5 w-3.5 text-brand" /> المصادقة الثنائية</div>
            <Badge tone={twoFactorEnabled ? "bg-success-soft text-success border-success-line" : "bg-surface text-subtle border-line"}>
              {twoFactorEnabled ? "مفعّلة" : "غير مفعّلة"}
            </Badge>
          </div>

          {recoveryCodes.length > 0 ? (
            <div className="space-y-3">
              <Alert tone="warning" title="احفظ رموز الاسترداد الآن">تُعرض مرة واحدة فقط. كل رمز يعمل مرة واحدة.</Alert>
              <div className="grid grid-cols-2 gap-2 rounded-brand border border-line bg-surface p-3">
                {recoveryCodes.map((code) => <code key={code} className="font-mono text-[11px] text-ink" dir="ltr">{code}</code>)}
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={recoveryCodes.join("\n")} label="نسخ الرموز" />
                <Button variant="outline" size="sm" onClick={() => setRecoveryCodes([])}>حفظتها — إخفاء</Button>
              </div>
            </div>
          ) : twoFactorEnabled ? (
            <div className="space-y-3">
              <p className="text-[11px] leading-6 text-subtle">تسجيل الدخول يتطلب رمزاً من تطبيق المصادقة أو أحد رموز الاسترداد.</p>
              <Button variant="outline" onClick={() => { setDisableDraft({ password: "", code: "" }); setDisableOpen(true); }}>تعطيل المصادقة</Button>
            </div>
          ) : twoFactorSetup ? (
            <div className="space-y-3">
              <p className="text-[11px] leading-6 text-subtle">أضف الحساب إلى تطبيق مصادقة ثم أدخل الرمز الظاهر.</p>
              <div className="flex flex-wrap items-center gap-2 rounded-brand border border-line bg-surface p-3">
                <span className="text-[10px] text-subtle">المفتاح اليدوي:</span>
                <code className="break-all font-mono text-[11px] text-ink" dir="ltr">{twoFactorSetup.secret}</code>
                <CopyButton value={twoFactorSetup.secret} label="" />
              </div>
              <a href={twoFactorSetup.otpauth_url} className="inline-flex text-[10px] font-semibold text-brand underline" dir="ltr">فتح في تطبيق المصادقة</a>
              <Field label="رمز التحقق" required hint="6 أرقام">
                <Input value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))} dir="ltr" inputMode="numeric" maxLength={6} className="font-mono tracking-[0.35em]" placeholder="123456" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button loading={twoFactorBusy} onClick={enableTwoFactor}>تفعيل</Button>
                <Button variant="ghost" onClick={() => { setTwoFactorSetup(null); setTwoFactorCode(""); }}>إلغاء</Button>
              </div>
            </div>
          ) : twoFactorStart ? (
            <div className="space-y-3">
              <p className="text-[11px] leading-6 text-subtle">أدخل كلمة المرور الحالية لعرض مفتاح التفعيل.</p>
              <Field label="كلمة المرور الحالية" required>
                <Input type="password" value={twoFactorPassword} onChange={(event) => setTwoFactorPassword(event.target.value)} dir="ltr" autoComplete="current-password" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button loading={twoFactorBusy} onClick={startTwoFactor}>بدء التفعيل</Button>
                <Button variant="ghost" onClick={() => { setTwoFactorStart(false); setTwoFactorPassword(""); }}>إلغاء</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] leading-6 text-subtle">أضف طبقة حماية ثانية لحساب إدارة المنصة.</p>
              <Button onClick={() => setTwoFactorStart(true)}>تفعيل المصادقة الثنائية</Button>
            </div>
          )}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-ink"><Shield className="h-3.5 w-3.5 text-brand" /> الجلسات النشطة</div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-[11px] leading-6 text-subtle">
              إنهاء الجلسات الأخرى يقطع الوصول من الأجهزة الأخرى دون التأثير على جلستك الحالية. تُسجَّل العملية في سجل التدقيق.
            </p>
            <Button variant="outline" onClick={() => setRevokeOpen(true)}>إنهاء الجلسات الأخرى</Button>
          </div>
        </Card>
      </div>

      <Modal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title="تعطيل المصادقة الثنائية"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisableOpen(false)}>إلغاء</Button>
            <Button variant="danger" loading={disableBusy} onClick={disableTwoFactor}>تعطيل</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="كلمة المرور الحالية" required>
            <Input type="password" value={disableDraft.password} onChange={(event) => setDisableDraft({ ...disableDraft, password: event.target.value })} dir="ltr" autoComplete="current-password" />
          </Field>
          <Field label="رمز المصادقة أو الاسترداد" required>
            <Input value={disableDraft.code} onChange={(event) => setDisableDraft({ ...disableDraft, code: event.target.value })} dir="ltr" className="font-mono" placeholder="123456" />
          </Field>
          <Alert tone="warning">بعد التعطيل لن يُطلب رمز إضافي عند الدخول. تُنهى الجلسات الأخرى تلقائياً.</Alert>
        </div>
      </Modal>

      <Modal
        open={revokeOpen}
        onClose={() => (revokeBusy ? undefined : setRevokeOpen(false))}
        title="إنهاء الجلسات الأخرى"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevokeOpen(false)} disabled={revokeBusy}>إلغاء</Button>
            <Button loading={revokeBusy} onClick={revokeOthers}>إنهاء الجلسات</Button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-brand border border-warning-line bg-warning-soft p-3 text-xs leading-6 text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ستبقى جلستك الحالية نشطة، وستُفصل كل الجلسات الأخرى فوراً.
        </div>
      </Modal>
    </div>
  );
}

export type { AdminPermission };
