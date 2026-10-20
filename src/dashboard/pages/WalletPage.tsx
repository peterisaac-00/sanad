import React, { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Clock, RefreshCw, Wallet as WalletIcon } from "lucide-react";
import { api } from "../../lib/api";
import { dateTime, money, number, safeError } from "../../lib/format";
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
  Skeleton,
  StatCard,
  Textarea,
  useToast,
} from "../../components/ui";
import { useDashboard } from "../DashboardShell";
import { TableShell, Td, Th } from "../common";

const TX_TYPE: Record<string, { label: string; tone: string }> = {
  deposit: { label: "إيداع", tone: "bg-success-soft text-success border-success-line" },
  withdrawal: { label: "سحب", tone: "bg-danger-soft text-danger border-danger-line" },
  fee: { label: "رسوم", tone: "bg-warning-soft text-warning border-warning-line" },
  refund: { label: "استرداد", tone: "bg-info-soft text-info border-info-line" },
  payment: { label: "دفعة", tone: "bg-brand/10 text-brand border-brand-line" },
};

const TX_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "معلّقة", tone: "bg-warning-soft text-warning border-warning-line" },
  completed: { label: "مكتملة", tone: "bg-success-soft text-success border-success-line" },
  failed: { label: "فاشلة", tone: "bg-danger-soft text-danger border-danger-line" },
  cancelled: { label: "ملغاة", tone: "bg-surface text-ink-soft border-line" },
};

export function WalletPage() {
  const { subdomain } = useDashboard();
  const toast = useToast();
  const [depositOpen, setDepositOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(() => api.wallet.get(subdomain), [subdomain]);
  const currency = data?.summary?.currency ?? "EGP";
  const transactions = data?.transactions ?? [];

  const submitDeposit = async () => {
    const value = Number(amount);
    if (!value || value < 1) {
      toast.error("أدخل مبلغاً صحيحاً.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.wallet.deposit(subdomain, { amount: value, reference: reference.trim(), note: note.trim() });
      toast.success(result.note ?? "تم تسجيل طلب الإيداع.");
      setDepositOpen(false);
      setAmount("");
      setReference("");
      setNote("");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="التشغيل"
        title="المحفظة"
        description="رصيدك وسجل الحركات المالية لمتجرك. تُسجَّل الإيداعات كمعلّقة حتى يتم التحقق من التحويل."
        actions={<Button onClick={() => setDepositOpen(true)}><ArrowDownToLine className="h-4 w-4" /> طلب إيداع</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="الرصيد الحالي"
          value={money(data?.summary?.balance ?? 0, currency)}
          icon={<WalletIcon className="h-5 w-5" />}
          accent="brand"
          hint={data?.account?.updatedAt ? `آخر تحديث ${dateTime(data.account.updatedAt)}` : undefined}
        />
        <StatCard label="إيداعات معلّقة" value={money(data?.summary?.pendingDeposits ?? 0, currency)} icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label="إيداعات مؤكدة" value={money(data?.summary?.completedDeposits ?? 0, currency)} icon={<ArrowDownToLine className="h-5 w-5" />} accent="success" />
      </div>

      {data?.note ? <Alert tone="info" title="كيف تعمل المحفظة؟">{data.note}</Alert> : null}
      {error ? <Alert tone="error" title="تعذر تحميل المحفظة">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="text-xs font-bold text-ink">سجل الحركات</div>
          <Button variant="ghost" size="sm" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : transactions.length === 0 ? (
          <EmptyState
            title="لا توجد حركات مالية"
            description="عند تسجيل أول إيداع أو تحصيل، ستظهر الحركات هنا مع الرصيد قبل وبعد كل عملية."
            icon={<WalletIcon className="h-5 w-5" />}
            action={<Button onClick={() => setDepositOpen(true)}><ArrowDownToLine className="h-4 w-4" /> تسجيل إيداع</Button>}
          />
        ) : (
          <TableShell minWidth={940}>
            <thead>
              <tr className="border-b border-line">
                <Th>التاريخ</Th>
                <Th>النوع</Th>
                <Th>المبلغ</Th>
                <Th>الرصيد قبل</Th>
                <Th>الرصيد بعد</Th>
                <Th>المرجع / الملاحظة</Th>
                <Th>الحالة</Th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction: any) => {
                const type = TX_TYPE[transaction.type] ?? { label: transaction.type, tone: "bg-surface text-ink-soft border-line" };
                const status = TX_STATUS[transaction.status] ?? { label: transaction.status, tone: "bg-surface text-ink-soft border-line" };
                const incoming = transaction.type === "deposit" || transaction.type === "refund" || transaction.type === "payment";
                return (
                  <tr key={transaction.id} className="border-b border-line transition hover:bg-surface">
                    <Td><span className="text-[11px] text-subtle">{dateTime(transaction.createdAt)}</span></Td>
                    <Td>
                      <Badge tone={type.tone}>
                        {incoming ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
                        {type.label}
                      </Badge>
                    </Td>
                    <Td>
                      <span className={incoming ? "font-semibold text-success" : "font-semibold text-danger"}>
                        {incoming ? "+" : "−"}{money(transaction.amount, currency)}
                      </span>
                    </Td>
                    <Td><span className="text-[11px] text-subtle">{money(transaction.balanceBefore, currency)}</span></Td>
                    <Td><span className="text-[11px] text-subtle">{money(transaction.balanceAfter, currency)}</span></Td>
                    <Td>
                      <div className="max-w-[240px] truncate text-[11px] text-ink-soft">{transaction.reference || transaction.note || "—"}</div>
                    </Td>
                    <Td><Badge tone={status.tone}>{status.label}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        title="طلب إيداع في المحفظة"
        description="سجّل بيانات التحويل وسيتحقق فريق سند منه قبل إضافة المبلغ إلى الرصيد."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDepositOpen(false)}>إلغاء</Button>
            <Button loading={busy} onClick={submitDeposit}>تسجيل الطلب</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={`المبلغ (${currency})`} required>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" />
          </Field>
          <Field label="مرجع التحويل" hint="رقم العملية أو آخر 4 أرقام من الحساب المحوّل منه">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" />
          </Field>
          <Field label="ملاحظات">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Alert tone="warning" title="لن يتغير الرصيد فوراً">
            يُسجَّل الطلب بحالة «معلّقة» ويظهر في السجل. لا تُضاف الأموال إلى الرصيد إلا بعد تأكيد التحويل.
          </Alert>
        </div>
      </Modal>
    </div>
  );
}

/* ----------------------------- dropshipping ----------------------------- */

const FULFILLMENT: Record<string, { label: string; tone: string }> = {
  manual: { label: "إدارة يدوية", tone: "bg-surface text-ink-soft border-line" },
  imported: { label: "مستورد", tone: "bg-brand/10 text-brand border-brand-line" },
  fulfilled: { label: "تم التوريد", tone: "bg-success-soft text-success border-success-line" },
  cancelled: { label: "ملغي", tone: "bg-danger-soft text-danger border-danger-line" },
};

export function DropshippingPage() {
  const { subdomain, store } = useDashboard();
  const toast = useToast();
  const [tab, setTab] = useState<"suppliers" | "links">("suppliers");

  const [supplierOpen, setSupplierOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [supplierDraft, setSupplierDraft] = useState({ name: "", contactName: "", email: "", phone: "", status: "active", notes: "" });
  const [supplierBusy, setSupplierBusy] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState<any | null>(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<any | null>(null);
  const [linkDraft, setLinkDraft] = useState({ productId: "", supplierId: "", costPrice: "0", suggestedPrice: "0", fulfillmentStatus: "manual" });
  const [linkBusy, setLinkBusy] = useState(false);
  const [deletingLink, setDeletingLink] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(() => api.dropshipping.get(subdomain), [subdomain]);
  const productsAsync = useAsync(() => api.products.list(subdomain, { pageSize: 100 }), [subdomain]);

  const currency = store?.currency ?? "EGP";
  const suppliers = data?.suppliers ?? [];
  const links = data?.products ?? [];
  const products = productsAsync.data?.products ?? [];

  const productName = (product: any) => product?.nameAr || product?.nameEn || product?.sku || "—";

  const openSupplier = (supplier: any | null) => {
    setEditingSupplier(supplier);
    setSupplierDraft(
      supplier
        ? {
            name: supplier.name ?? "",
            contactName: supplier.contactName ?? "",
            email: supplier.email ?? "",
            phone: supplier.phone ?? "",
            status: supplier.status ?? "active",
            notes: supplier.notes ?? "",
          }
        : { name: "", contactName: "", email: "", phone: "", status: "active", notes: "" }
    );
    setSupplierOpen(true);
  };

  const saveSupplier = async () => {
    if (!supplierDraft.name.trim()) {
      toast.error("أدخل اسم المورد.");
      return;
    }
    const body = {
      name: supplierDraft.name.trim(),
      contactName: supplierDraft.contactName.trim(),
      email: supplierDraft.email.trim(),
      phone: supplierDraft.phone.trim(),
      status: supplierDraft.status,
      notes: supplierDraft.notes.trim(),
    };
    setSupplierBusy(true);
    try {
      if (editingSupplier) await api.dropshipping.updateSupplier(subdomain, editingSupplier.id, body);
      else await api.dropshipping.createSupplier(subdomain, body);
      toast.success(editingSupplier ? "تم تحديث المورد." : "تم إنشاء المورد.");
      setSupplierOpen(false);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSupplierBusy(false);
    }
  };

  const openLink = (link: any | null) => {
    setEditingLink(link);
    setLinkDraft(
      link
        ? {
            productId: link.productId ?? "",
            supplierId: link.supplierId ?? "",
            costPrice: String(link.costPrice ?? 0),
            suggestedPrice: String(link.suggestedPrice ?? 0),
            fulfillmentStatus: link.fulfillmentStatus ?? "manual",
          }
        : { productId: "", supplierId: suppliers[0]?.id ?? "", costPrice: "0", suggestedPrice: "0", fulfillmentStatus: "manual" }
    );
    setLinkOpen(true);
  };

  const saveLink = async () => {
    if (!editingLink && (!linkDraft.productId || !linkDraft.supplierId)) {
      toast.error("اختر المنتج والمورد.");
      return;
    }
    setLinkBusy(true);
    try {
      const base = {
        costPrice: Number(linkDraft.costPrice) || 0,
        suggestedPrice: Number(linkDraft.suggestedPrice) || 0,
        fulfillmentStatus: linkDraft.fulfillmentStatus,
      };
      if (editingLink) {
        await api.dropshipping.updateProduct(subdomain, editingLink.id, { ...base, supplierId: linkDraft.supplierId });
      } else {
        await api.dropshipping.createProduct(subdomain, { ...base, productId: linkDraft.productId, supplierId: linkDraft.supplierId });
      }
      toast.success(editingLink ? "تم تحديث الربط." : "تم ربط المنتج بالمورد.");
      setLinkOpen(false);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setLinkBusy(false);
    }
  };

  const removeEntity = async () => {
    setDeleteBusy(true);
    try {
      if (deletingSupplier) {
        await api.dropshipping.removeSupplier(subdomain, deletingSupplier.id);
        toast.success("تم حذف المورد.");
        setDeletingSupplier(null);
      }
      if (deletingLink) {
        await api.dropshipping.removeProduct(subdomain, deletingLink.id);
        toast.success("تم حذف الربط.");
        setDeletingLink(null);
      }
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const margin = (link: any) => {
    const cost = Number(link.costPrice ?? 0);
    const price = Number(link.suggestedPrice ?? 0) || Number(link.product?.basePrice ?? 0);
    if (!price) return null;
    return Math.round(((price - cost) / price) * 1000) / 10;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="التشغيل"
        title="الدروبشيبينغ"
        description="أدر مورديك واربط المنتجات بهم مع تكلفة التوريد وسعر البيع المقترح، وتابع هامش الربح المتوقع."
        actions={
          tab === "suppliers" ? (
            <Button onClick={() => openSupplier(null)}>+ مورد جديد</Button>
          ) : (
            <Button onClick={() => openLink(null)} disabled={suppliers.length === 0 || products.length === 0}>+ ربط منتج</Button>
          )
        }
      />

      {data?.note ? <Alert tone="info" title="وضع التكامل">{data.note}</Alert> : null}
      {error ? <Alert tone="error" title="تعذر تحميل الدروبشيبينغ">{safeError(error)}</Alert> : null}
      <div className="flex items-center gap-1 rounded-brand border border-line bg-card p-1 text-xs font-semibold">
        <button
          onClick={() => setTab("suppliers")}
          className={tab === "suppliers" ? "rounded-brand-sm bg-brand px-4 py-2 text-on-brand" : "rounded-brand-sm px-4 py-2 text-subtle hover:text-ink"}
        >
          الموردون ({number(suppliers.length)})
        </button>
        <button
          onClick={() => setTab("links")}
          className={tab === "links" ? "rounded-brand-sm bg-brand px-4 py-2 text-on-brand" : "rounded-brand-sm px-4 py-2 text-subtle hover:text-ink"}
        >
          روابط المنتجات ({number(links.length)})
        </button>
        <Button variant="ghost" size="sm" className="ms-auto" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      {loading && !data ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : tab === "suppliers" ? (
        <Card className="overflow-hidden">
          {suppliers.length === 0 ? (
            <EmptyState
              title="لا يوجد موردون"
              description="أضف بيانات المورد (الاسم، وسائل التواصل، ملاحظات) لتوثيق مصدر منتجاتك."
              action={<Button onClick={() => openSupplier(null)}>إنشاء أول مورد</Button>}
            />
          ) : (
            <TableShell minWidth={860}>
              <thead>
                <tr className="border-b border-line">
                  <Th>المورد</Th>
                  <Th>جهة الاتصال</Th>
                  <Th>التواصل</Th>
                  <Th>الحالة</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier: any) => (
                  <tr key={supplier.id} className="border-b border-line transition hover:bg-surface">
                    <Td>
                      <div className="font-semibold text-ink">{supplier.name}</div>
                      {supplier.notes ? <div className="mt-0.5 max-w-[280px] truncate text-[10px] text-subtle">{supplier.notes}</div> : null}
                    </Td>
                    <Td><span className="text-[11px] text-subtle">{supplier.contactName || "—"}</span></Td>
                    <Td>
                      <div className="font-mono text-[10px] text-subtle" dir="ltr">{supplier.phone || "—"}</div>
                      <div className="font-mono text-[10px] text-subtle" dir="ltr">{supplier.email || ""}</div>
                    </Td>
                    <Td><Badge tone={supplier.status === "active" ? "bg-success-soft text-success border-success-line" : "bg-surface text-ink-soft border-line"}>{supplier.status === "active" ? "نشط" : "غير نشط"}</Badge></Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openSupplier(supplier)}>تعديل</Button>
                        <button onClick={() => setDeletingSupplier(supplier)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="حذف">
                          ×
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {links.length === 0 ? (
            <EmptyState
              title="لا توجد روابط منتجات"
              description={suppliers.length === 0 ? "أضف مورداً أولاً ثم اربط المنتجات به." : "اربط منتجاتك بالموردين لتتبع التكلفة والهامش."}
              action={<Button onClick={() => openLink(null)} disabled={suppliers.length === 0}>ربط منتج</Button>}
            />
          ) : (
            <TableShell minWidth={940}>
              <thead>
                <tr className="border-b border-line">
                  <Th>المنتج</Th>
                  <Th>المورد</Th>
                  <Th>تكلفة التوريد</Th>
                  <Th>سعر البيع المقترح</Th>
                  <Th>الهامش المتوقع</Th>
                  <Th>حالة التوريد</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {links.map((link: any) => {
                  const m = margin(link);
                  const fulfillment = FULFILLMENT[link.fulfillmentStatus] ?? { label: link.fulfillmentStatus, tone: "bg-surface text-ink-soft border-line" };
                  return (
                    <tr key={link.id} className="border-b border-line transition hover:bg-surface">
                      <Td>
                        <div className="font-semibold text-ink">{productName(link.product)}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{link.product?.sku}</div>
                      </Td>
                      <Td><span className="text-[11px] text-ink-soft">{link.supplier?.name ?? "—"}</span></Td>
                      <Td><span className="text-[11px] text-ink-soft">{money(link.costPrice, currency)}</span></Td>
                      <Td><span className="text-[11px] text-ink-soft">{money(link.suggestedPrice, currency)}</span></Td>
                      <Td>
                        {m === null ? (
                          <span className="text-[11px] text-subtle">أضف سعر بيع</span>
                        ) : (
                          <span className={m >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>{m}%</span>
                        )}
                      </Td>
                      <Td><Badge tone={fulfillment.tone}>{fulfillment.label}</Badge></Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openLink(link)}>تعديل</Button>
                          <button onClick={() => setDeletingLink(link)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="حذف">
                            ×
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          )}
        </Card>
      )}

      <Modal
        open={supplierOpen}
        onClose={() => setSupplierOpen(false)}
        title={editingSupplier ? `تعديل المورد: ${editingSupplier.name}` : "مورد جديد"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSupplierOpen(false)}>إلغاء</Button>
            <Button loading={supplierBusy} onClick={saveSupplier}>{editingSupplier ? "حفظ التعديلات" : "إنشاء المورد"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم المورد" required className="sm:col-span-2">
            <Input value={supplierDraft.name} onChange={(e) => setSupplierDraft({ ...supplierDraft, name: e.target.value })} />
          </Field>
          <Field label="جهة الاتصال">
            <Input value={supplierDraft.contactName} onChange={(e) => setSupplierDraft({ ...supplierDraft, contactName: e.target.value })} />
          </Field>
          <Field label="الهاتف">
            <Input value={supplierDraft.phone} onChange={(e) => setSupplierDraft({ ...supplierDraft, phone: e.target.value })} dir="ltr" />
          </Field>
          <Field label="البريد الإلكتروني">
            <Input type="email" value={supplierDraft.email} onChange={(e) => setSupplierDraft({ ...supplierDraft, email: e.target.value })} dir="ltr" />
          </Field>
          <Field label="الحالة">
            <select
              value={supplierDraft.status}
              onChange={(e) => setSupplierDraft({ ...supplierDraft, status: e.target.value })}
              className="h-10 w-full rounded-brand border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
          </Field>
          <Field label="ملاحظات" className="sm:col-span-2">
            <Textarea rows={3} value={supplierDraft.notes} onChange={(e) => setSupplierDraft({ ...supplierDraft, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title={editingLink ? `تعديل الربط: ${productName(editingLink.product)}` : "ربط منتج بمورد"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>إلغاء</Button>
            <Button loading={linkBusy} onClick={saveLink}>{editingLink ? "حفظ التعديلات" : "ربط المنتج"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {!editingLink ? (
            <Field label="المنتج" required className="sm:col-span-2">
              <select
                value={linkDraft.productId}
                onChange={(e) => setLinkDraft({ ...linkDraft, productId: e.target.value })}
                className="h-10 w-full rounded-brand border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-brand"
              >
                <option value="">اختر منتجاً…</option>
                {products.map((product: any) => (
                  <option key={product.id} value={product.id}>{productName(product)}</option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="المورد" required className="sm:col-span-2">
            <select
              value={linkDraft.supplierId}
              onChange={(e) => setLinkDraft({ ...linkDraft, supplierId: e.target.value })}
              className="h-10 w-full rounded-brand border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-brand"
            >
              <option value="">اختر مورداً…</option>
              {suppliers.map((supplier: any) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </Field>
          <Field label={`تكلفة التوريد (${currency})`}>
            <Input type="number" min={0} value={linkDraft.costPrice} onChange={(e) => setLinkDraft({ ...linkDraft, costPrice: e.target.value })} />
          </Field>
          <Field label={`سعر البيع المقترح (${currency})`}>
            <Input type="number" min={0} value={linkDraft.suggestedPrice} onChange={(e) => setLinkDraft({ ...linkDraft, suggestedPrice: e.target.value })} />
          </Field>
          <Field label="حالة التوريد" className="sm:col-span-2">
            <select
              value={linkDraft.fulfillmentStatus}
              onChange={(e) => setLinkDraft({ ...linkDraft, fulfillmentStatus: e.target.value })}
              className="h-10 w-full rounded-brand border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-brand"
            >
              {Object.entries(FULFILLMENT).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingSupplier || deletingLink)}
        title={deletingSupplier ? "حذف المورد" : "حذف الربط"}
        description={
          deletingSupplier
            ? "سيتم حذف المورد. روابط المنتجات المرتبطة به قد تتأثر."
            : "سيتم فك ارتباط المنتج بالمورد."
        }
        confirmLabel="حذف"
        loading={deleteBusy}
        onConfirm={removeEntity}
        onClose={() => { setDeletingSupplier(null); setDeletingLink(null); }}
      />
    </div>
  );
}
