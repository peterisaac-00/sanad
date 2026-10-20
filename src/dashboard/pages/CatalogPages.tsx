import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, MessageSquare, Pencil, Plus, RefreshCw, Star, Tags, Trash2 } from "lucide-react";
import { api, mediaUrl } from "../../lib/api";
import { dateTime, number, safeError } from "../../lib/format";
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
  Switch,
  Textarea,
  useToast,
} from "../../components/ui";
import { useDashboard } from "../DashboardShell";
import { Stars, TableShell, Td, Th } from "../common";

/* ------------------------------ categories ------------------------------ */

export function CategoriesPage() {
  const { subdomain } = useDashboard();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => api.categories.list(subdomain, { pageSize: 100, search: search || undefined }),
    [subdomain, search]
  );

  const categories = data?.categories ?? [];

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...categories];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await api.categories.reorder(subdomain, next.map((category: any) => category.id));
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.categories.remove(subdomain, deleting.id);
      toast.success("تم حذف الفئة.");
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="الكتالوج"
        title="الفئات"
        description="نظّم منتجاتك في فئات تظهر في متجرك. الترتيب هنا يحدد ترتيب الفئات في صفحة المتجر."
        actions={<Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus className="h-4 w-4" /> فئة جديدة</Button>}
      />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث في الفئات…" className="w-64" />
          <Button variant="ghost" size="sm" className="ms-auto" onClick={reload} aria-label="تحديث"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </Card>

      {error ? <Alert tone="error" title="تعذر تحميل الفئات">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : categories.length === 0 ? (
          <EmptyState
            title="لا توجد فئات بعد"
            description="الفئات تساعد عملاءك على التنقل بين منتجاتك بسرعة."
            icon={<Tags className="h-5 w-5" />}
            action={<Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus className="h-4 w-4" /> إضافة أول فئة</Button>}
          />
        ) : (
          <TableShell minWidth={720}>
            <thead>
              <tr className="border-b border-slate-800/70">
                <Th>الفئة</Th>
                <Th>الرابط</Th>
                <Th>المنتجات</Th>
                <Th>الحالة</Th>
                <Th>الترتيب</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {categories.map((category: any, index: number) => (
                <tr key={category.id} className="border-b border-slate-800/40 transition hover:bg-slate-800/20">
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                        {category.imageUrl ? <img src={mediaUrl(category.imageUrl)} alt="" className="h-full w-full object-cover" /> : <Tags className="h-4 w-4 text-slate-600" />}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200">{category.nameAr || category.name}</div>
                        {category.nameEn ? <div className="text-[10px] text-slate-500" dir="ltr">{category.nameEn}</div> : null}
                      </div>
                    </div>
                  </Td>
                  <Td className="font-mono text-[10px] text-slate-500" dir="ltr">{category.slug}</Td>
                  <Td>{number(category._count?.products ?? 0)}</Td>
                  <Td>
                    <Badge tone={category.isActive ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "bg-slate-800 text-slate-400 border-slate-700"}>
                      {category.isActive ? "ظاهرة" : "مخفية"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} aria-label="أعلى"><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" disabled={index === categories.length - 1} onClick={() => move(index, 1)} aria-label="أسفل"><ArrowDown className="h-3.5 w-3.5" /></Button>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(category); setEditorOpen(true); }} aria-label="تعديل"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(category)} aria-label="حذف"><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <CategoryEditor open={editorOpen} category={editing} subdomain={subdomain} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); reload(); }} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`حذف فئة «${deleting?.nameAr || deleting?.name || ""}»؟`}
        description="المنتجات المرتبطة ستبقى لكنها ستظهر بدون فئة."
        loading={deleteBusy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function CategoryEditor({ open, category, subdomain, onClose, onSaved }: { open: boolean; category: any | null; subdomain: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ nameAr: "", nameEn: "", description: "", imageUrl: "", isActive: true });

  useEffect(() => {
    if (!open) return;
    setForm({
      nameAr: category?.nameAr ?? category?.name ?? "",
      nameEn: category?.nameEn ?? "",
      description: category?.description ?? "",
      imageUrl: category?.imageUrl ?? "",
      isActive: category?.isActive !== false,
    });
  }, [open, category?.id]);

  const submit = async () => {
    if (!form.nameAr.trim() && !form.nameEn.trim()) {
      toast.error("أدخل اسم الفئة.");
      return;
    }
    setBusy(true);
    try {
      const body = { name: form.nameAr.trim() || form.nameEn.trim(), nameAr: form.nameAr.trim(), nameEn: form.nameEn.trim(), description: form.description, imageUrl: form.imageUrl, isActive: form.isActive };
      if (category) await api.categories.update(subdomain, category.id, body);
      else await api.categories.create(subdomain, body);
      toast.success(category ? "تم تحديث الفئة." : "تم إنشاء الفئة.");
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
      title={category ? `تعديل: ${category.nameAr || category.name}` : "فئة جديدة"}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button loading={busy} onClick={submit}>{category ? "حفظ" : "إنشاء"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم بالعربية" required>
          <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} placeholder="ملابس رجالية" />
        </Field>
        <Field label="الاسم بالإنجليزية">
          <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" />
        </Field>
        <Field label="رابط صورة الفئة" className="sm:col-span-2" hint="اتركه فارغاً لعرض الفئة بدون صورة.">
          <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} dir="ltr" placeholder="/uploads/…" />
        </Field>
        <Field label="وصف الفئة" className="sm:col-span-2">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-20" />
        </Field>
        <div className="sm:col-span-2">
          <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="ظاهرة في المتجر" description="الفئات المخفية لا تظهر للعملاء ولا في التنقل." />
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------- reviews -------------------------------- */

const REVIEW_TONE: Record<string, string> = {
  pending: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  rejected: "bg-slate-800 text-slate-400 border-slate-700",
};

export function ReviewsPage() {
  const { subdomain } = useDashboard();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [search, setSearch] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => api.reviews.list(subdomain, { page, pageSize: 20, status: status || undefined, rating: rating ? Number(rating) : undefined, search: search || undefined }),
    [subdomain, page, status, rating, search]
  );

  const reviews = data?.reviews ?? [];
  const summary = data?.summary;

  const setReviewStatus = async (review: any, next: string) => {
    try {
      await api.reviews.update(subdomain, review.id, { status: next });
      toast.success(next === "approved" ? "تم نشر التقييم في المتجر." : next === "rejected" ? "تم رفض التقييم." : "تم إرجاع التقييم للمراجعة.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const saveReply = async () => {
    if (!replyTo) return;
    setBusy(true);
    try {
      await api.reviews.update(subdomain, replyTo.id, { merchantReply: replyText.trim() });
      toast.success("تم حفظ رد المتجر.");
      setReplyTo(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.reviews.remove(subdomain, deleting.id);
      toast.success("تم حذف التقييم.");
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="المتجر"
        title="التقييمات"
        description="كل تقييم يصل من المتجر يظل معلّقاً حتى تراجعه. لا يُنشر أي تقييم تلقائياً."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="متوسط التقييمات المنشورة" value={number(summary?.averageRating ?? 0)} hint="من 5 نجوم" icon={<Star className="h-4 w-4" />} accent="amber" />
        <StatCard label="تقييمات منشورة" value={number(summary?.approvedCount ?? 0)} hint="ظهرت للعملاء" icon={<MessageSquare className="h-4 w-4" />} accent="emerald" />
        <StatCard label="بانتظار المراجعة" value={number(reviews.filter((r: any) => r.status === "pending").length)} hint="في الصفحة الحالية" icon={<RefreshCw className="h-4 w-4" />} accent="blue" />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="اسم العميل أو نص التقييم…" className="w-64" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40">
            <option value="">كل الحالات</option>
            <option value="pending">معلّّق</option>
            <option value="approved">منشور</option>
            <option value="rejected">مرفوض</option>
          </Select>
          <Select value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }} className="w-32">
            <option value="">كل النجوم</option>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} نجوم</option>)}
          </Select>
        </div>
      </Card>

      {error ? <Alert tone="error" title="تعذر تحميل التقييمات">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : reviews.length === 0 ? (
          <EmptyState title="لا توجد تقييمات" description="عندما يقيّم عملاؤك منتجاتك ستظهر تقييماتهم هنا لمراجعتها قبل النشر." icon={<Star className="h-5 w-5" />} />
        ) : (
          <>
            <div className="divide-y divide-slate-800/50">
              {reviews.map((review: any) => (
                <div key={review.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                        {(review.customerName || "?").charAt(0)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-100">{review.customerName}</span>
                          <Stars rating={review.rating} />
                          <Badge tone={REVIEW_TONE[review.status]}>{review.status === "pending" ? "معلّق" : review.status === "approved" ? "منشور" : "مرفوض"}</Badge>
                          {review.reported ? <Badge tone="border-rose-500/25 bg-rose-500/10 text-rose-300">مُبلّغ عنه</Badge> : null}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">
                          {review.product ? `على: ${review.product.nameAr || review.product.nameEn || "منتج"} · ` : ""}
                          {dateTime(review.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {review.status !== "approved" ? <Button size="sm" variant="success" onClick={() => setReviewStatus(review, "approved")}>نشر</Button> : null}
                      {review.status !== "rejected" ? <Button size="sm" variant="outline" onClick={() => setReviewStatus(review, "rejected")}>رفض</Button> : null}
                      <Button size="sm" variant="ghost" onClick={() => { setReplyTo(review); setReplyText(review.merchantReply ?? ""); }}>
                        <MessageSquare className="h-3.5 w-3.5" /> رد
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(review)}><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-xs leading-6 text-slate-300">{review.content}</p>
                  {review.merchantReply ? (
                    <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-3 text-[11px] leading-6 text-blue-100">
                      <span className="font-bold">رد المتجر: </span>
                      {review.merchantReply}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="border-t border-slate-800/60 px-3">
              <Pagination page={page} totalPages={data?.pagination?.totalPages ?? 1} total={data?.pagination?.total} onChange={setPage} />
            </div>
          </>
        )}
      </Card>

      <Modal
        open={Boolean(replyTo)}
        onClose={() => setReplyTo(null)}
        title="رد المتجر"
        description="يظهر الرد أسفل التقييم في صفحة المنتج."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReplyTo(null)}>إلغاء</Button>
            <Button loading={busy} onClick={saveReply}>حفظ الرد</Button>
          </>
        }
      >
        <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className="min-h-28" placeholder="شكراً لتقييمك! يسعدنا أن المنتج أعجبك…" />
      </Modal>

      <ConfirmDialog open={Boolean(deleting)} title="حذف التقييم؟" description="سيختفي التقييم نهائياً من المتجر ومن سجلاتك." onConfirm={remove} onClose={() => setDeleting(null)} />
    </div>
  );
}
