import React, { useState } from "react";
import { Gift, Pencil, Plus, RefreshCw, Sparkles, Trash2, Users } from "lucide-react";
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
  SearchInput,
  Select,
  Skeleton,
  StatCard,
  Switch,
  useToast,
} from "../../components/ui";
import { useDashboard } from "../DashboardShell";
import { ActivePill, TableShell, Td, Th } from "../common";

interface RuleDraft {
  name: string;
  type: "earn" | "redeem";
  points: string;
  perAmount: string;
  minOrderValue: string;
  isActive: boolean;
}

const emptyRule: RuleDraft = { name: "", type: "earn", points: "1", perAmount: "100", minOrderValue: "0", isActive: true };

export function LoyaltyPage() {
  const { subdomain, store } = useDashboard();
  const toast = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(emptyRule);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<any | null>(null);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustSearch, setAdjustSearch] = useState("");
  const [adjustSearchCustomerId, setAdjustSearchCustomerId] = useState("");

  const { data, loading, error, reload } = useAsync(() => api.loyalty.get(subdomain), [subdomain]);
  const customersAsync = useAsync(
    () => api.customers.list(subdomain, { pageSize: 50, search: adjustSearch || undefined }),
    [subdomain, adjustSearch]
  );

  const currency = store?.currency ?? "EGP";
  const rules = data?.rules ?? [];
  const accounts = data?.accounts ?? [];
  const transactions = data?.transactions ?? [];

  const openEditor = (rule: any | null) => {
    setEditing(rule);
    setDraft(
      rule
        ? {
            name: rule.name ?? "",
            type: rule.type === "redeem" ? "redeem" : "earn",
            points: String(rule.points ?? 1),
            perAmount: String(rule.perAmount ?? 0),
            minOrderValue: String(rule.minOrderValue ?? 0),
            isActive: Boolean(rule.isActive),
          }
        : emptyRule
    );
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("أدخل اسم القاعدة.");
      return;
    }
    const body: Record<string, unknown> = {
      name: draft.name.trim(),
      type: draft.type,
      points: Math.max(1, Math.round(Number(draft.points) || 1)),
      perAmount: Number(draft.perAmount) || 0,
      minOrderValue: Number(draft.minOrderValue) || 0,
      isActive: draft.isActive,
    };
    setSaving(true);
    try {
      if (editing) await api.loyalty.updateRule(subdomain, editing.id, body);
      else await api.loyalty.createRule(subdomain, body);
      toast.success(editing ? "تم تحديث القاعدة." : "تم إنشاء القاعدة.");
      setEditorOpen(false);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: any) => {
    try {
      await api.loyalty.updateRule(subdomain, rule.id, {
        name: rule.name,
        type: rule.type,
        points: rule.points,
        perAmount: rule.perAmount,
        minOrderValue: rule.minOrderValue,
        isActive: !rule.isActive,
      });
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.loyalty.removeRule(subdomain, deleting.id);
      toast.success("تم حذف القاعدة.");
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const openAdjust = (account: any | null) => {
    setAdjusting(account);
    setAdjustPoints("");
    setAdjustNote("");
    setAdjustSearch("");
    setAdjustOpen(true);
  };

  const submitAdjust = async () => {
    const points = Math.round(Number(adjustPoints));
    if (!points || Number.isNaN(points)) {
      toast.error("أدخل عدد نقاط صحيح (يمكن أن يكون سالباً للخصم).");
      return;
    }
    const customerId = adjusting ? adjusting.customerId : adjustSearchCustomerId;
    if (!customerId) {
      toast.error("اختر عميلاً.");
      return;
    }
    setAdjustBusy(true);
    try {
      await api.loyalty.adjust(subdomain, { customerId, points, note: adjustNote.trim() });
      toast.success("تم تعديل رصيد النقاط.");
      setAdjustOpen(false);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setAdjustBusy(false);
    }
  };

  const customers = customersAsync.data?.customers ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="النمو"
        title="برنامج الولاء"
        description="امنح عملاءك نقاطاً مع كل طلب، وتابع أرصدتهم وقواعد الاكتساب والاستبدال."
        actions={
          <>
            <Button variant="outline" onClick={() => openAdjust(null)}><Sparkles className="h-4 w-4" /> تعديل نقاط عميل</Button>
            <Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> قاعدة جديدة</Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="أعضاء البرنامج" value={number(data?.totals?.members ?? 0)} icon={<Users className="h-5 w-5" />} accent="brand" />
        <StatCard label="النقاط المتاحة حالياً" value={number(data?.totals?.pointsIssued ?? 0)} icon={<Gift className="h-5 w-5" />} accent="info" />
        <StatCard label="قواعد مفعّلة" value={number(rules.filter((rule: any) => rule.isActive).length)} accent="success" />
      </div>

      {error ? <Alert tone="error" title="تعذر تحميل برنامج الولاء">{safeError(error)}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="text-xs font-bold text-ink">قواعد النقاط</div>
            <Button variant="ghost" size="sm" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
          {loading && !data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rules.length === 0 ? (
            <EmptyState
              title="لا توجد قواعد"
              description="مثال: اربح نقطة لكل 100 جنيه في الطلب."
              icon={<Gift className="h-5 w-5" />}
              action={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> إنشاء قاعدة</Button>}
            />
          ) : (
            <TableShell minWidth={560}>
              <thead>
                <tr className="border-b border-line">
                  <Th>القاعدة</Th>
                  <Th>النقاط</Th>
                  <Th>الحالة</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule: any) => (
                  <tr key={rule.id} className="border-b border-line transition hover:bg-surface">
                    <Td>
                      <div className="font-semibold text-ink">{rule.name}</div>
                      <div className="mt-0.5 text-[10px] text-subtle">
                        {rule.type === "earn" ? "اكتساب" : "استبدال"}
                        {rule.type === "earn" ? ` — ${number(rule.points)} نقطة لكل ${money(rule.perAmount, currency)}` : ""}
                        {rule.minOrderValue > 0 ? ` — حد أدنى ${money(rule.minOrderValue, currency)}` : ""}
                      </div>
                    </Td>
                    <Td><Badge tone={rule.type === "earn" ? "bg-success-soft text-success border-success-line" : "bg-warning-soft text-warning border-warning-line"}>{rule.type === "earn" ? "+" : "−"}{number(rule.points)}</Badge></Td>
                    <Td>
                      <button onClick={() => toggleRule(rule)} aria-label="تبديل التفعيل">
                        <ActivePill active={rule.isActive} />
                      </button>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditor(rule)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <button onClick={() => setDeleting(rule)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="حذف">
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

        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-xs font-bold text-ink">أرصدة العملاء (أعلى 100)</div>
          {accounts.length === 0 ? (
            <EmptyState title="لا توجد أرصدة بعد" description="ستظهر أرصدة العملاء هنا بمجرد منحهم نقاطاً." icon={<Users className="h-5 w-5" />} />
          ) : (
            <TableShell minWidth={520}>
              <thead>
                <tr className="border-b border-line">
                  <Th>العميل</Th>
                  <Th>النقاط</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((account: any) => (
                  <tr key={account.id} className="border-b border-line transition hover:bg-surface">
                    <Td>
                      <div className="font-semibold text-ink">{account.customer?.name || "عميل"}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{account.customer?.phone || account.customer?.email || "—"}</div>
                    </Td>
                    <Td>
                      <span className="rounded-brand-sm border border-info-line bg-info-soft px-2.5 py-1 text-[11px] font-bold text-info">{number(account.points)} نقطة</span>
                    </Td>
                    <Td>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openAdjust(account)}>تعديل الرصيد</Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3 text-xs font-bold text-ink">آخر حركات النقاط</div>
        {transactions.length === 0 ? (
          <EmptyState title="لا توجد حركات" description="ستظهر هنا كل إضافة أو خصم للنقاط مع السبب." />
        ) : (
          <TableShell minWidth={640}>
            <thead>
              <tr className="border-b border-line">
                <Th>التاريخ</Th>
                <Th>النوع</Th>
                <Th>النقاط</Th>
                <Th>ملاحظة</Th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction: any) => (
                <tr key={transaction.id} className="border-b border-line">
                  <Td><span className="text-[11px] text-subtle">{dateTime(transaction.createdAt)}</span></Td>
                  <Td><Badge tone="bg-surface text-ink-soft border-line">{transaction.type}</Badge></Td>
                  <Td>
                    <span className={transaction.points >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
                      {transaction.points >= 0 ? "+" : ""}{number(transaction.points)}
                    </span>
                  </Td>
                  <Td><span className="text-[11px] text-subtle">{transaction.note || "—"}</span></Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      {/* rule editor */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? `تعديل القاعدة: ${editing.name}` : "قاعدة نقاط جديدة"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>إلغاء</Button>
            <Button loading={saving} onClick={save}>{editing ? "حفظ التعديلات" : "إنشاء القاعدة"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم القاعدة" required className="sm:col-span-2">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="نقاط مع كل طلب" />
          </Field>
          <Field label="النوع">
            <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as RuleDraft["type"] })}>
              <option value="earn">اكتساب نقاط</option>
              <option value="redeem">استبدال نقاط</option>
            </Select>
          </Field>
          <Field label="عدد النقاط">
            <Input type="number" min={1} value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} />
          </Field>
          {draft.type === "earn" ? (
            <Field label={`لكل مبلغ (${currency})`} hint="مثال: نقطة لكل 100 جنيه">
              <Input type="number" min={0} value={draft.perAmount} onChange={(e) => setDraft({ ...draft, perAmount: e.target.value })} />
            </Field>
          ) : null}
          <Field label={`الحد الأدنى للطلب (${currency})`}>
            <Input type="number" min={0} value={draft.minOrderValue} onChange={(e) => setDraft({ ...draft, minOrderValue: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="تفعيل القاعدة" description="القواعد المتوقفة لا تُطبّق على الطلبات الجديدة." />
          </div>
        </div>
      </Modal>

      {/* points adjustment */}
      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={adjusting ? `تعديل نقاط: ${adjusting.customer?.name || "العميل"}` : "تعديل نقاط عميل"}
        description="استخدم قيمة موجبة للإضافة وسالبة للخصم. تُسجَّل العملية في سجل الحركات."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjustOpen(false)}>إلغاء</Button>
            <Button loading={adjustBusy} onClick={submitAdjust}>تنفيذ التعديل</Button>
          </>
        }
      >
        <div className="space-y-4">
          {!adjusting ? (
            <>
              <SearchInput value={adjustSearch} onChange={(v) => { setAdjustSearch(v); setAdjustSearchCustomerId(""); }} placeholder="ابحث عن عميل بالاسم أو الهاتف…" />
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-brand border border-line p-2">
                {customers.map((customer: any) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setAdjustSearchCustomerId(customer.id)}
                    className={
                      adjustSearchCustomerId === customer.id
                        ? "flex w-full items-center justify-between rounded-brand-sm bg-brand/10 px-3 py-2 text-xs font-semibold text-brand ring-1 ring-inset ring-brand/30"
                        : "flex w-full items-center justify-between rounded-brand-sm px-3 py-2 text-xs text-ink-soft hover:bg-surface"
                    }
                  >
                    <span>{customer.name || "عميل"}</span>
                    <span className="font-mono text-[10px] text-subtle" dir="ltr">{customer.phone || customer.email || ""}</span>
                  </button>
                ))}
                {customers.length === 0 ? <div className="px-3 py-6 text-center text-[11px] text-subtle">لا يوجد عملاء مطابقون.</div> : null}
              </div>
            </>
          ) : (
            <div className="rounded-brand border border-line bg-surface p-3 text-xs text-ink-soft">
              الرصيد الحالي: <span className="font-bold text-ink">{number(adjusting.points)} نقطة</span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="عدد النقاط" required hint="مثال: 50 أو -20">
              <Input type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} />
            </Field>
            <Field label="ملاحظة">
              <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="سبب التعديل" />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف قاعدة النقاط"
        description={deleting ? `سيتم حذف «${deleting.name}» نهائياً.` : undefined}
        loading={deleteBusy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
