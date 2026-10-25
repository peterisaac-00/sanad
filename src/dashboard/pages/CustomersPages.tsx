import React, { useEffect, useState } from "react";
import { Download, MapPin, Pencil, RefreshCw, Trash2, User, Users } from "lucide-react";
import { api } from "../../lib/api";
import { date, dateTime, money, number, safeError } from "../../lib/format";
import { Link, useQuery } from "../../lib/router";
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
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  Textarea,
  useToast,
} from "../../components/ui";
import { useDashboard } from "../DashboardShell";
import { StatusBadge, TableShell, Td, Th } from "../common";

const enc = encodeURIComponent;

export function CustomersPage() {
  const { subdomain, store } = useDashboard();
  const toast = useToast();
  const query = useQuery();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [hasOrders, setHasOrders] = useState("");
  const [openId, setOpenId] = useState<string | null>(query.get("open"));
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => api.customers.list(subdomain, { page, pageSize: 20, search: search || undefined, hasOrders: hasOrders || undefined }),
    [subdomain, page, search, hasOrders]
  );

  const customers = data?.customers ?? [];
  const pagination = data?.pagination;

  const exportCsv = async () => {
    try {
      await api.downloadCsv(`/api/stores/${enc(subdomain)}/customers/export`, "customers.csv");
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.customers.remove(subdomain, deleting.id);
      toast.success("تم حذف العميل.");
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const totalSpent = customers.reduce((sum: number, customer: any) => sum + Number(customer.totalSpent ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="المتجر"
        title="العملاء"
        description="العملاء يُنشأون تلقائياً مع كل طلب من المتجر، ويمكنك إضافة العناوين والملاحظات يدوياً."
        actions={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> تصدير CSV</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="عملاء الصفحة" value={number(customers.length)} hint={`${number(pagination?.total ?? 0)} عميل إجمالاً`} icon={<Users className="h-4 w-4" />} accent="brand" />
        <StatCard label="إجمالي شراء عملاء الصفحة" value={money(totalSpent, store.currency)} hint="مجموع الطلبات المسجلة" icon={<User className="h-4 w-4" />} accent="success" />
        <StatCard label="لديهم طلبات" value={number(customers.filter((c: any) => (c.ordersCount ?? 0) > 0).length)} hint="في الصفحة الحالية" icon={<RefreshCw className="h-4 w-4" />} accent="info" />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="اسم، هاتف أو بريد…" className="w-64" />
          <Select value={hasOrders} onChange={(e) => { setHasOrders(e.target.value); setPage(1); }} className="w-44">
            <option value="">كل العملاء</option>
            <option value="true">لديهم طلبات</option>
            <option value="false">بدون طلبات</option>
          </Select>
          <Button variant="ghost" size="sm" className="ms-auto" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </Card>

      {error ? <Alert tone="error" title="تعذر تحميل العملاء">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="لا يوجد عملاء بعد"
            description="أول طلب من متجرك يُنشئ ملف العميل تلقائياً مع بياناته وعناوينه."
            icon={<Users className="h-5 w-5" />}
            action={<Link href={`/store/${subdomain}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-brand">فتح المتجر ←</Link>}
          />
        ) : (
          <>
            <TableShell minWidth={860}>
              <thead>
                <tr className="border-b border-line">
                  <Th>العميل</Th>
                  <Th>الهاتف</Th>
                  <Th>الطلبات</Th>
                  <Th>إجمالي الشراء</Th>
                  <Th>آخر طلب</Th>
                  <Th>العناوين</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {customers.map((customer: any) => (
                  <tr key={customer.id} className="border-b border-line transition hover:bg-surface">
                    <Td>
                      <button onClick={() => setOpenId(customer.id)} className="text-start">
                        <div className="font-semibold text-ink hover:text-brand">{customer.name || "بدون اسم"}</div>
                        {customer.email ? <div className="mt-0.5 text-[10px] text-subtle" dir="ltr">{customer.email}</div> : null}
                      </button>
                    </Td>
                    <Td className="font-mono text-[11px] text-subtle" dir="ltr">{customer.phone || "—"}</Td>
                    <Td>{number(customer.ordersCount ?? 0)}</Td>
                    <Td className="font-bold text-ink">{money(customer.totalSpent, store.currency)}</Td>
                    <Td className="text-[10px] text-subtle">{customer.lastOrderAt ? date(customer.lastOrderAt) : "—"}</Td>
                    <Td className="text-[11px] text-subtle">{number(customer.addressesCount ?? 0)}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setOpenId(customer.id)} aria-label="فتح الملف"><User className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(customer)} aria-label="تعديل"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(customer)} aria-label="حذف"><Trash2 className="h-3.5 w-3.5 text-danger" /></Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <div className="border-t border-line px-3">
              <Pagination page={page} totalPages={pagination?.totalPages ?? 1} total={pagination?.total} onChange={setPage} />
            </div>
          </>
        )}
      </Card>

      <CustomerEditModal
        customer={editing}
        subdomain={subdomain}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
      />

      {openId ? (
        <CustomerProfileModal id={openId} subdomain={subdomain} currency={store.currency} onClose={() => setOpenId(null)} onChanged={reload} />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`حذف العميل «${deleting?.name || deleting?.phone || ""}»؟`}
        description="سيتم حذف ملف العميل وعناوينه. الطلبات السابقة تبقى في السجل."
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function CustomerEditModal({ customer, subdomain, onClose, onSaved }: { customer: any | null; subdomain: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  useEffect(() => {
    if (!customer) return;
    setForm({ name: customer.name ?? "", phone: customer.phone ?? "", email: customer.email ?? "", notes: customer.notes ?? "" });
  }, [customer?.id]);

  const save = async () => {
    if (!customer) return;
    setBusy(true);
    try {
      await api.customers.update(subdomain, customer.id, form);
      toast.success("تم تحديث بيانات العميل.");
      onSaved();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(customer)}
      onClose={onClose}
      title={`تعديل: ${customer?.name || customer?.phone || "عميل"}`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button loading={busy} onClick={save}>حفظ</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="الهاتف"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></Field>
        <Field label="البريد الإلكتروني" className="sm:col-span-2"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" /></Field>
        <Field label="ملاحظات داخلية" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-24" placeholder="مثال: عميل منتظم — يفضل الشحن السريع." />
        </Field>
      </div>
    </Modal>
  );
}

function CustomerProfileModal({
  id,
  subdomain,
  currency,
  onClose,
  onChanged,
}: {
  id: string;
  subdomain: string;
  currency: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.customers.get(subdomain, id), [id]);
  const [addressOpen, setAddressOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any | null>(null);
  const [addressForm, setAddressForm] = useState({ label: "", address: "", city: "", governorate: "", phone: "", isDefault: false });
  const [busy, setBusy] = useState(false);

  const customer = data?.customer;

  const saveAddress = async () => {
    if (!customer) return;
    setBusy(true);
    try {
      if (editingAddress) await api.customers.updateAddress(subdomain, customer.id, editingAddress.id, addressForm);
      else await api.customers.addAddress(subdomain, customer.id, addressForm);
      toast.success(editingAddress ? "تم تحديث العنوان." : "تمت إضافة العنوان.");
      setAddressOpen(false);
      reload();
      onChanged();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  const removeAddress = async (addressId: string) => {
    if (!customer) return;
    try {
      await api.customers.removeAddress(subdomain, customer.id, addressId);
      toast.success("تم حذف العنوان.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  return (
    <Modal open onClose={onClose} title={customer?.name || "ملف العميل"} description={customer?.phone ? `هاتف: ${customer.phone}` : undefined} size="lg">
      {loading && !data ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-40" /></div>
      ) : error || !customer ? (
        <Alert tone="error" title="تعذر تحميل الملف">{safeError(error)}</Alert>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-brand border border-line bg-surface p-3 text-center">
              <div className="text-[10px] text-subtle">إجمالي الشراء</div>
              <div className="mt-1 text-lg font-bold text-ink">{money(customer.totalSpent, currency)}</div>
            </div>
            <div className="rounded-brand border border-line bg-surface p-3 text-center">
              <div className="text-[10px] text-subtle">الطلبات</div>
              <div className="mt-1 text-lg font-bold text-ink">{number(customer.orders?.length ?? 0)}</div>
            </div>
            <div className="rounded-brand border border-line bg-surface p-3 text-center">
              <div className="text-[10px] text-subtle">نقاط الولاء</div>
              <div className="mt-1 text-lg font-bold text-ink">{number(customer.loyalty?.points ?? 0)}</div>
            </div>
          </div>

          <div className="grid gap-2 text-[11px] sm:grid-cols-2">
            <div className="rounded-brand border border-line bg-surface p-3"><span className="text-subtle">البريد: </span><span className="text-ink" dir="ltr">{customer.email || "—"}</span></div>
            <div className="rounded-brand border border-line bg-surface p-3"><span className="text-subtle">الهاتف: </span><span className="font-mono text-ink" dir="ltr">{customer.phone || "—"}</span></div>
            {customer.notes ? <div className="rounded-brand border border-line bg-surface p-3 sm:col-span-2"><span className="text-subtle">ملاحظات: </span><span className="text-ink-soft">{customer.notes}</span></div> : null}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-ink">العناوين</div>
              <Button size="sm" variant="outline" onClick={() => { setEditingAddress(null); setAddressForm({ label: "", address: "", city: "", governorate: "", phone: customer.phone ?? "", isDefault: false }); setAddressOpen(true); }}>
                <MapPin className="h-3.5 w-3.5" /> عنوان جديد
              </Button>
            </div>
            {(customer.addresses ?? []).length === 0 ? (
              <div className="mt-2 rounded-brand border border-dashed border-line p-4 text-center text-[11px] text-subtle">لا توجد عناوين محفوظة.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {(customer.addresses ?? []).map((address: any) => (
                  <div key={address.id} className="flex flex-wrap items-start justify-between gap-2 rounded-brand border border-line bg-surface p-3">
                    <div className="text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{address.label || "عنوان"}</span>
                        {address.isDefault ? <Badge tone="border-brand-line bg-brand/10 text-brand">افتراضي</Badge> : null}
                      </div>
                      <div className="mt-1 leading-6 text-subtle">
                        {address.address}
                        {address.city ? `، ${address.city}` : ""}
                        {address.governorate ? `، ${address.governorate}` : ""}
                      </div>
                      {address.phone ? <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{address.phone}</div> : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingAddress(address); setAddressForm({ label: address.label ?? "", address: address.address ?? "", city: address.city ?? "", governorate: address.governorate ?? "", phone: address.phone ?? "", isDefault: Boolean(address.isDefault) }); setAddressOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeAddress(address.id)}><Trash2 className="h-3.5 w-3.5 text-danger" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-bold text-ink">سجل الطلبات</div>
            {(customer.orders ?? []).length === 0 ? (
              <div className="mt-2 rounded-brand border border-dashed border-line p-4 text-center text-[11px] text-subtle">لا توجد طلبات لهذا العميل بعد.</div>
            ) : (
              <div className="mt-2 overflow-hidden rounded-brand border border-line">
                <TableShell minWidth={560}>
                  <thead>
                    <tr className="border-b border-line bg-surface">
                      <Th>الطلب</Th>
                      <Th>الحالة</Th>
                      <Th>المبلغ</Th>
                      <Th>التاريخ</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(customer.orders ?? []).map((order: any) => (
                      <tr key={order.id} className="border-b border-line">
                        <Td>
                          <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-[11px] font-bold text-brand">SND-{order.orderNumber}</Link>
                        </Td>
                        <Td><StatusBadge status={order.status} /></Td>
                        <Td className="font-bold text-ink">{money(order.amountEgp, currency)}</Td>
                        <Td className="text-[10px] text-subtle">{dateTime(order.createdAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        title={editingAddress ? "تعديل العنوان" : "عنوان جديد"}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddressOpen(false)}>إلغاء</Button>
            <Button loading={busy} onClick={saveAddress}>حفظ العنوان</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم العنوان"><Input value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} placeholder="المنزل / العمل" /></Field>
          <Field label="الهاتف"><Input value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} dir="ltr" /></Field>
          <Field label="العنوان" className="sm:col-span-2"><Input value={addressForm.address} onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })} /></Field>
          <Field label="المدينة"><Input value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} /></Field>
          <Field label="المحافظة"><Input value={addressForm.governorate} onChange={(e) => setAddressForm({ ...addressForm, governorate: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-[11px] text-subtle sm:col-span-2">
            <input type="checkbox" checked={addressForm.isDefault} onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })} />
            تعيين كعنوان افتراضي
          </label>
        </div>
      </Modal>
    </Modal>
  );
}
