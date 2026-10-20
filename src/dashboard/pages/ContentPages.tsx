import React, { useState } from "react";
import {
  ExternalLink,
  Eye,
  FileText,
  Megaphone,
  Newspaper,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { api, mediaUrl } from "../../lib/api";
import { date, dateTime, money, number, percent, safeError, TEMPLATES } from "../../lib/format";
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
import { StorePreview } from "../../components/StorePreview";
import { Link } from "../../lib/router";
import { useDashboard } from "../DashboardShell";
import { ActivePill, dateInputToIso, isoToDateInput, TableShell, Td, Th } from "../common";

/* -------------------------------- pages -------------------------------- */

const PAGE_TYPES: Record<string, string> = {
  custom: "صفحة مخصصة",
  about: "من نحن",
  contact: "اتصل بنا",
  faq: "الأسئلة الشائعة",
  policy: "الخصوصية",
  shipping: "الشحن",
  returns: "الاسترجاع",
};

interface PageDraft {
  title: string;
  slug: string;
  type: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
}

const emptyPage: PageDraft = { title: "", slug: "", type: "custom", content: "", seoTitle: "", seoDescription: "", published: false };

export function PagesPage() {
  const { subdomain } = useDashboard();
  const toast = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<PageDraft>(emptyPage);

  const { data, loading, error, reload } = useAsync(() => api.pages.list(subdomain), [subdomain]);
  const pages = data?.pages ?? [];

  const openEditor = (page: any | null) => {
    setEditing(page);
    setDraft(
      page
        ? {
            title: page.title ?? "",
            slug: page.slug ?? "",
            type: page.type ?? "custom",
            content: page.content ?? "",
            seoTitle: page.seoTitle ?? "",
            seoDescription: page.seoDescription ?? "",
            published: page.status === "published",
          }
        : emptyPage
    );
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error("أدخل عنوان الصفحة.");
      return;
    }
    const body: Record<string, unknown> = {
      title: draft.title.trim(),
      type: draft.type,
      content: draft.content,
      seoTitle: draft.seoTitle.trim(),
      seoDescription: draft.seoDescription.trim(),
      status: draft.published ? "published" : "draft",
      ...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
    };
    setSaving(true);
    try {
      if (editing) await api.pages.update(subdomain, editing.id, body);
      else await api.pages.create(subdomain, body);
      toast.success(editing ? "تم تحديث الصفحة." : "تم إنشاء الصفحة.");
      setEditorOpen(false);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (page: any) => {
    try {
      await api.pages.update(subdomain, page.id, { status: page.status === "published" ? "draft" : "published" });
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.pages.remove(subdomain, deleting.id);
      toast.success("تم حذف الصفحة.");
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
        eyebrow="المحتوى"
        title="الصفحات"
        description="صفحات ثابتة مثل «من نحن» و«سياسة الاسترجاع» تظهر في متجرك وتقوّي ثقة العملاء."
        actions={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> صفحة جديدة</Button>}
      />

      {error ? <Alert tone="error" title="تعذر تحميل الصفحات">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : pages.length === 0 ? (
          <EmptyState
            title="لا توجد صفحات"
            description="ابدأ بصفحة «سياسة الاسترجاع» — من أكثر الصفحات التي يبحث عنها العملاء قبل الشراء."
            icon={<FileText className="h-5 w-5" />}
            action={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> إنشاء أول صفحة</Button>}
          />
        ) : (
          <TableShell minWidth={820}>
            <thead>
              <tr className="border-b border-line">
                <Th>الصفحة</Th>
                <Th>النوع</Th>
                <Th>آخر تحديث</Th>
                <Th>الحالة</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {pages.map((page: any) => (
                <tr key={page.id} className="border-b border-line transition hover:bg-surface">
                  <Td>
                    <div className="font-semibold text-ink">{page.title}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">/store/{subdomain}/page/{page.slug}</div>
                  </Td>
                  <Td><Badge tone="bg-surface text-ink-soft border-line">{PAGE_TYPES[page.type] ?? page.type}</Badge></Td>
                  <Td><span className="text-[11px] text-subtle">{dateTime(page.updatedAt)}</span></Td>
                  <Td>
                    <button onClick={() => togglePublish(page)} aria-label="تبديل النشر">
                      <ActivePill active={page.status === "published"} />
                    </button>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {page.status === "published" ? (
                        <Link href={`/store/${subdomain}/page/${page.slug}`} target="_blank" className="rounded-brand-sm p-2 text-subtle hover:bg-surface hover:text-brand" title="عرض">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => openEditor(page)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <button onClick={() => setDeleting(page)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="حذف">
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

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? `تعديل: ${editing.title}` : "صفحة جديدة"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>إلغاء</Button>
            <Button loading={saving} onClick={save}>{draft.published ? "حفظ ونشر" : "حفظ كمسودة"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان الصفحة" required>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="سياسة الاسترجاع" />
          </Field>
          <Field label="الرابط" hint="حروف إنجليزية وأرقام وشرطات. يُولَّد تلقائياً إن تُرك فارغاً.">
            <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} dir="ltr" className="font-mono" placeholder="returns-policy" />
          </Field>
          <Field label="النوع">
            <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              {Object.entries(PAGE_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="عنوان SEO">
            <Input value={draft.seoTitle} onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })} />
          </Field>
          <Field label="وصف SEO" className="sm:col-span-2">
            <Input value={draft.seoDescription} onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })} />
          </Field>
          <Field label="محتوى الصفحة" className="sm:col-span-2" hint="يدعم النص العربي مباشرة. اكتب بلغة واضحة ومباشرة.">
            <Textarea rows={10} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="اكتب محتوى الصفحة هنا…" />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={draft.published} onChange={(v) => setDraft({ ...draft, published: v })} label="نشر الصفحة" description="الصفحات المنشورة فقط تظهر في متجرك." />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف الصفحة"
        description={deleting ? `سيتم حذف «${deleting.title}» نهائياً.` : undefined}
        loading={deleteBusy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/* --------------------------------- blog --------------------------------- */

const POST_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "مسودة", tone: "bg-surface text-ink-soft border-line" },
  published: { label: "منشور", tone: "bg-success-soft text-success border-success-line" },
  scheduled: { label: "مجدول", tone: "bg-brand/10 text-brand border-brand-line" },
};

interface PostDraft {
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  featuredImage: string;
  content: string;
  categories: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  status: "draft" | "published" | "scheduled";
  scheduledAt: string;
}

const emptyPost: PostDraft = {
  title: "",
  slug: "",
  excerpt: "",
  author: "",
  featuredImage: "",
  content: "",
  categories: "",
  tags: "",
  seoTitle: "",
  seoDescription: "",
  status: "draft",
  scheduledAt: "",
};

function splitCsv(value: string): string[] {
  return value.split(/[,،]/).map((part) => part.trim()).filter(Boolean);
}

export function BlogPage() {
  const { subdomain } = useDashboard();
  const toast = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<PostDraft>(emptyPost);

  const { data, loading, error, reload } = useAsync(() => api.blog.list(subdomain), [subdomain]);
  const posts = data?.posts ?? [];

  const openEditor = (post: any | null) => {
    setEditing(post);
    setDraft(
      post
        ? {
            title: post.title ?? "",
            slug: post.slug ?? "",
            excerpt: post.excerpt ?? "",
            author: post.author ?? "",
            featuredImage: post.featuredImage ?? "",
            content: post.content ?? "",
            categories: Array.isArray(post.categories) ? post.categories.join("، ") : "",
            tags: Array.isArray(post.tags) ? post.tags.join("، ") : "",
            seoTitle: post.seoTitle ?? "",
            seoDescription: post.seoDescription ?? "",
            status: post.status ?? "draft",
            scheduledAt: post.scheduledAt ? isoToDateInput(post.scheduledAt) : "",
          }
        : emptyPost
    );
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error("أدخل عنوان المقال.");
      return;
    }
    if (draft.status === "scheduled" && !draft.scheduledAt) {
      toast.error("حدّد تاريخ ووقت النشر للمقال المجدول.");
      return;
    }
    const body: Record<string, unknown> = {
      title: draft.title.trim(),
      excerpt: draft.excerpt.trim(),
      author: draft.author.trim(),
      featuredImage: draft.featuredImage.trim(),
      content: draft.content,
      categories: splitCsv(draft.categories),
      tags: splitCsv(draft.tags),
      seoTitle: draft.seoTitle.trim(),
      seoDescription: draft.seoDescription.trim(),
      status: draft.status,
      ...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
      scheduledAt: draft.status === "scheduled" ? dateInputToIso(draft.scheduledAt) ?? null : null,
    };
    setSaving(true);
    try {
      if (editing) await api.blog.update(subdomain, editing.id, body);
      else await api.blog.create(subdomain, body);
      toast.success(editing ? "تم تحديث المقال." : "تم إنشاء المقال.");
      setEditorOpen(false);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.blog.remove(subdomain, deleting.id);
      toast.success("تم حذف المقال.");
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
        eyebrow="المحتوى"
        title="المدونة"
        description="مقالاتك تظهر في متجرك وتحسن ظهورك في محركات البحث، وتبني ثقة العملاء قبل الشراء."
        actions={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> مقال جديد</Button>}
      />

      {error ? <Alert tone="error" title="تعذر تحميل المقالات">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : posts.length === 0 ? (
          <EmptyState
            title="لا توجد مقالات بعد"
            description="اكتب عن طريقة استخدام منتجاتك أو نصائح مرتبطة بمجال متجرك. حتى مقالان يحدثان فرقاً في الزيارات."
            icon={<Newspaper className="h-5 w-5" />}
            action={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> كتابة أول مقال</Button>}
          />
        ) : (
          <TableShell minWidth={880}>
            <thead>
              <tr className="border-b border-line">
                <Th>المقال</Th>
                <Th>الكاتب</Th>
                <Th>النشر</Th>
                <Th>الحالة</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {posts.map((post: any) => {
                const meta = POST_STATUS[post.status] ?? POST_STATUS.draft;
                return (
                  <tr key={post.id} className="border-b border-line transition hover:bg-surface">
                    <Td>
                      <div className="flex items-center gap-3">
                        {post.featuredImage ? (
                          <img src={mediaUrl(post.featuredImage)} alt="" className="h-10 w-14 shrink-0 rounded-brand-sm border border-line object-cover" />
                        ) : (
                          <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-brand-sm border border-line bg-canvas text-subtle"><Newspaper className="h-4 w-4" /></div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-ink">{post.title}</div>
                          <div className="mt-0.5 max-w-[320px] truncate text-[10px] text-subtle">{post.excerpt || "بدون مقتطف"}</div>
                        </div>
                      </div>
                    </Td>
                    <Td><span className="text-[11px] text-subtle">{post.author || "—"}</span></Td>
                    <Td>
                      <div className="text-[11px] text-subtle">{date(post.publishedAt)}</div>
                      {post.status === "scheduled" ? <div className="text-[10px] text-brand">مجدول: {dateTime(post.scheduledAt)}</div> : null}
                    </Td>
                    <Td><Badge tone={meta.tone}>{meta.label}</Badge></Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        {post.status === "published" ? (
                          <Link href={`/store/${subdomain}/blog/${post.slug}`} target="_blank" className="rounded-brand-sm p-2 text-subtle hover:bg-surface hover:text-brand" title="عرض">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => openEditor(post)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <button onClick={() => setDeleting(post)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="حذف">
                          <Trash2 className="h-3.5 w-3.5" />
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

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? `تعديل: ${editing.title}` : "مقال جديد"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>إلغاء</Button>
            <Button loading={saving} onClick={save}>{editing ? "حفظ التعديلات" : "إنشاء المقال"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان المقال" required className="sm:col-span-2">
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="5 نصائح لاختيار المنتج المناسب" />
          </Field>
          <Field label="المقتطف" className="sm:col-span-2" hint="سطران يظهران في قائمة المقالات">
            <Textarea rows={2} value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} />
          </Field>
          <Field label="الكاتب">
            <Input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
          </Field>
          <Field label="الرابط" hint="يُولَّد تلقائياً إن تُرك فارغاً">
            <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} dir="ltr" className="font-mono" />
          </Field>
          <div className="sm:col-span-2">
            <ImageUploader value={draft.featuredImage} onChange={(url) => setDraft({ ...draft, featuredImage: url })} label="الصورة الرئيسية" aspect="aspect-video" />
          </div>
          <Field label="التصنيفات" hint="افصل بينها بفاصلة">
            <Input value={draft.categories} onChange={(e) => setDraft({ ...draft, categories: e.target.value })} placeholder="نصائح، تسوق" />
          </Field>
          <Field label="الوسوم" hint="افصل بينها بفاصلة">
            <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="أزياء، صيف" />
          </Field>
          <Field label="محتوى المقال" className="sm:col-span-2">
            <Textarea rows={10} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
          </Field>
          <Field label="عنوان SEO">
            <Input value={draft.seoTitle} onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })} />
          </Field>
          <Field label="وصف SEO">
            <Input value={draft.seoDescription} onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })} />
          </Field>
          <Field label="حالة النشر">
            <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as PostDraft["status"] })}>
              <option value="draft">مسودة</option>
              <option value="published">منشور الآن</option>
              <option value="scheduled">مجدول</option>
            </Select>
          </Field>
          {draft.status === "scheduled" ? (
            <Field label="تاريخ ووقت النشر" required>
              <Input type="datetime-local" value={draft.scheduledAt} onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })} />
            </Field>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف المقال"
        description={deleting ? `سيتم حذف «${deleting.title}» نهائياً.` : undefined}
        loading={deleteBusy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/* ------------------------------ affiliates ------------------------------ */

interface AffiliateDraft {
  name: string;
  phone: string;
  email: string;
  referralCode: string;
  commissionRate: string;
  isActive: boolean;
}

const emptyAffiliate: AffiliateDraft = { name: "", phone: "", email: "", referralCode: "", commissionRate: "5", isActive: true };

export function AffiliatesPage() {
  const { subdomain, store } = useDashboard();
  const toast = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AffiliateDraft>(emptyAffiliate);

  const { data, loading, error, reload } = useAsync(() => api.affiliates.list(subdomain), [subdomain]);
  const affiliates = data?.affiliates ?? [];
  const currency = store?.currency ?? "EGP";

  const openEditor = (affiliate: any | null) => {
    setEditing(affiliate);
    setDraft(
      affiliate
        ? {
            name: affiliate.name ?? "",
            phone: affiliate.phone ?? "",
            email: affiliate.email ?? "",
            referralCode: affiliate.referralCode ?? "",
            commissionRate: String(affiliate.commissionRate ?? 5),
            isActive: Boolean(affiliate.isActive),
          }
        : emptyAffiliate
    );
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("أدخل اسم المسوّق.");
      return;
    }
    const body: Record<string, unknown> = {
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      commissionRate: Number(draft.commissionRate) || 0,
      isActive: draft.isActive,
    };
    if (draft.referralCode.trim()) body.referralCode = draft.referralCode.trim().toUpperCase();
    setSaving(true);
    try {
      if (editing) await api.affiliates.update(subdomain, editing.id, body);
      else await api.affiliates.create(subdomain, body);
      toast.success(editing ? "تم تحديث المسوّق." : "تم إنشاء المسوّق.");
      setEditorOpen(false);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (affiliate: any) => {
    try {
      await api.affiliates.update(subdomain, affiliate.id, { isActive: !affiliate.isActive });
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.affiliates.remove(subdomain, deleting.id);
      toast.success("تم حذف المسوّق.");
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const referralLink = (code: string) => `${window.location.origin}/store/${subdomain}?ref=${code}`;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="النمو"
        title="التسويق بالعمولة"
        description="امنح مسوّقين كود إحالة خاصاً بهم، وتابع الطلبات والعمولات المستحقة لكل واحد تلقائياً."
        actions={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> مسوّق جديد</Button>}
      />

      <Alert tone="info" title="كيف تُحسب العمولة؟">
        عند استخدام رابط إحالة أو كود مسوّق في طلب، تُسجَّل العمولة تلقائياً بحالة «معلّقة» حتى تأكيد الطلب. تظهر هنا الإجماليات لكل مسوّق.
      </Alert>

      {error ? <Alert tone="error" title="تعذر تحميل المسوّقين">{safeError(error)}</Alert> : null}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : affiliates.length === 0 ? (
          <EmptyState
            title="لا يوجد مسوّقون"
            description="أضف مؤثراً أو صديقاً كمسوّق، وشارك معه كود الإحالة الخاص به."
            icon={<Megaphone className="h-5 w-5" />}
            action={<Button onClick={() => openEditor(null)}><Plus className="h-4 w-4" /> إضافة أول مسوّق</Button>}
          />
        ) : (
          <TableShell minWidth={980}>
            <thead>
              <tr className="border-b border-line">
                <Th>المسوّق</Th>
                <Th>كود الإحالة</Th>
                <Th>نسبة العمولة</Th>
                <Th>الطلبات</Th>
                <Th>العمولات</Th>
                <Th>الحالة</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {affiliates.map((affiliate: any) => (
                <tr key={affiliate.id} className="border-b border-line transition hover:bg-surface">
                  <Td>
                    <div className="font-semibold text-ink">{affiliate.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-subtle" dir="ltr">{affiliate.phone || affiliate.email || "—"}</div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-brand-sm border border-info-line bg-info-soft px-2 py-1 font-mono text-[11px] font-bold text-info" dir="ltr">{affiliate.referralCode}</span>
                      <CopyButton value={referralLink(affiliate.referralCode)} label="نسخ الرابط" />
                    </div>
                  </Td>
                  <Td><span className="font-semibold text-ink">{percent(affiliate.commissionRate)}</span></Td>
                  <Td><span className="text-[11px] text-ink-soft">{number(affiliate.ordersCount ?? 0)}</span></Td>
                  <Td>
                    <div className="text-[11px] text-ink-soft">إجمالي {money(affiliate.commissionTotal ?? 0, currency)}</div>
                    <div className="text-[10px] text-warning">معلّق {money(affiliate.commissionPending ?? 0, currency)}</div>
                  </Td>
                  <Td>
                    <button onClick={() => toggleActive(affiliate)} aria-label="تبديل التفعيل">
                      <ActivePill active={affiliate.isActive} />
                    </button>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditor(affiliate)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <button onClick={() => setDeleting(affiliate)} className="rounded-brand-sm p-2 text-subtle hover:bg-danger-soft hover:text-danger" title="حذف">
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

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? `تعديل: ${editing.name}` : "مسوّق جديد"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>إلغاء</Button>
            <Button loading={saving} onClick={save}>{editing ? "حفظ التعديلات" : "إنشاء المسوّق"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم" required className="sm:col-span-2">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="اسم المسوّق أو المؤثر" />
          </Field>
          <Field label="الهاتف">
            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} dir="ltr" placeholder="+2010…" />
          </Field>
          <Field label="البريد الإلكتروني">
            <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} dir="ltr" />
          </Field>
          <Field label="كود الإحالة" hint="يُولَّد تلقائياً إن تُرك فارغاً">
            <Input value={draft.referralCode} onChange={(e) => setDraft({ ...draft, referralCode: e.target.value.toUpperCase() })} dir="ltr" className="font-mono" placeholder="AHMED10" />
          </Field>
          <Field label="نسبة العمولة (%)">
            <Input type="number" min={0} max={100} value={draft.commissionRate} onChange={(e) => setDraft({ ...draft, commissionRate: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="تفعيل المسوّق" description="المسوّقون المتوقفون لا تُحتسب لهم عمولات جديدة." />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف المسوّق"
        description={deleting ? `سيتم حذف ${deleting.name} وسجل عمولاته.` : undefined}
        loading={deleteBusy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/* -------------------------------- design -------------------------------- */

const FONTS = ["Cairo", "IBM Plex Sans Arabic", "Tajawal", "Almarai"];

interface DesignDraft {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  themeMode: "light" | "dark" | "system";
  arabicFont: string;
  templateKey: string;
  logoUrl: string;
  coverUrl: string;
}

export function DesignPage() {
  const { subdomain } = useDashboard();
  const toast = useToast();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DesignDraft | null>(null);

  const { data, loading, error, reload } = useAsync(() => api.settings.design(subdomain), [subdomain]);

  React.useEffect(() => {
    if (!data?.store || draft) return;
    const branding = data.branding ?? {};
    setDraft({
      primaryColor: branding.primaryColor || "#047857",
      secondaryColor: branding.secondaryColor || "#0F2A24",
      textColor: branding.textColor || "#0F172A",
      themeMode: branding.themeMode === "dark" ? "dark" : branding.themeMode === "system" ? "system" : "light",
      arabicFont: branding.arabicFont || "IBM Plex Sans Arabic",
      templateKey: branding.templateKey || data.store.templateKey || "general",
      logoUrl: data.store.logoUrl || "",
      coverUrl: data.store.coverUrl || "",
    });
  }, [data, draft]);

  const save = async (saveAsDraft: boolean) => {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await api.settings.updateDesign(subdomain, {
        primaryColor: draft.primaryColor,
        secondaryColor: draft.secondaryColor,
        textColor: draft.textColor,
        themeMode: draft.themeMode,
        arabicFont: draft.arabicFont,
        templateKey: draft.templateKey,
        logoUrl: draft.logoUrl,
        coverUrl: draft.coverUrl,
        saveAsDraft,
      });
      toast.success(result.draft ? "تم حفظ التغييرات كمسودة." : "تم نشر التصميم على المتجر.");
      reload();
    } catch (err: any) {
      toast.error(safeError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>;
  }

  const store = data?.store;
  const branding = data?.branding;
  const templates: string[] = data?.templates ?? Object.keys(TEMPLATES);

  const previewStore = {
    ...store,
    ...(draft ? { logoUrl: draft.logoUrl, coverUrl: draft.coverUrl, templateKey: draft.templateKey, description: store?.description } : {}),
  };
  const previewBranding = draft ? { ...branding, ...draft } : branding;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="المحتوى والتصميم"
        title="التصميم"
        description="خصص هوية متجرك: القالب، الألوان، الخط العربي والشعار، مع معاينة فورية قبل النشر."
        actions={
          <>
            <Button variant="outline" loading={saving} onClick={() => save(true)}>حفظ كمسودة</Button>
            <Button loading={saving} onClick={() => save(false)}>نشر التصميم</Button>
          </>
        }
      />

      {error ? <Alert tone="error" title="تعذر تحميل التصميم">{safeError(error)}</Alert> : null}

      {draft ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-ink"><Palette className="h-3.5 w-3.5 text-brand" /> القالب</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {templates.map((key) => {
                  const template = TEMPLATES[key] ?? { label: key, description: "", emoji: "🛍️", accent: "#047857" };
                  const active = draft.templateKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDraft({ ...draft, templateKey: key, primaryColor: key === "general" ? draft.primaryColor : template.accent })}
                      className={cn(
                        "rounded-brand border p-3 text-start transition",
                        active ? "border-brand-line bg-brand/10" : "border-line bg-surface hover:border-line"
                      )}
                    >
                      <div className="text-lg">{template.emoji}</div>
                      <div className="mt-1 text-xs font-bold text-ink">{template.label}</div>
                      <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-subtle">{template.description}</div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 text-xs font-bold text-ink">الألوان والوضع</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اللون الأساسي">
                  <div className="flex items-center gap-2">
                    <input type="color" value={draft.primaryColor} onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })} className="h-10 w-14 cursor-pointer rounded-brand-sm border border-line bg-canvas" />
                    <Input value={draft.primaryColor} onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })} dir="ltr" className="font-mono" />
                  </div>
                </Field>
                <Field label="اللون الثانوي">
                  <div className="flex items-center gap-2">
                    <input type="color" value={draft.secondaryColor} onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })} className="h-10 w-14 cursor-pointer rounded-brand-sm border border-line bg-canvas" />
                    <Input value={draft.secondaryColor} onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })} dir="ltr" className="font-mono" />
                  </div>
                </Field>
                <Field label="وضع المتجر">
                  <Select value={draft.themeMode} onChange={(e) => setDraft({ ...draft, themeMode: e.target.value as DesignDraft["themeMode"] })}>
                    <option value="dark">داكن</option>
                    <option value="light">فاتح</option>
                    <option value="system">حسب جهاز العميل</option>
                  </Select>
                </Field>
                <Field label="الخط العربي">
                  <Select value={draft.arabicFont} onChange={(e) => setDraft({ ...draft, arabicFont: e.target.value })}>
                    {FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
                  </Select>
                </Field>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 text-xs font-bold text-ink">الشعار والغلاف</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ImageUploader value={draft.logoUrl} onChange={(url) => setDraft({ ...draft, logoUrl: url })} label="شعار المتجر" />
                <ImageUploader value={draft.coverUrl} onChange={(url) => setDraft({ ...draft, coverUrl: url })} label="صورة الغلاف" aspect="aspect-square" />
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink"><Eye className="h-3.5 w-3.5 text-brand" /> معاينة مباشرة</div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-brand-sm border border-line p-0.5">
                    <button onClick={() => setDevice("desktop")} className={cn("rounded-brand-sm px-3 py-1.5 text-[11px] font-semibold transition", device === "desktop" ? "bg-brand text-on-brand" : "text-subtle hover:text-ink")}>سطح المكتب</button>
                    <button onClick={() => setDevice("mobile")} className={cn("rounded-brand-sm px-3 py-1.5 text-[11px] font-semibold transition", device === "mobile" ? "bg-brand text-on-brand" : "text-subtle hover:text-ink")}>الجوال</button>
                  </div>
                  <Link href={`/store/${subdomain}`} target="_blank" className="rounded-brand-sm border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft hover:border-brand-line">
                    فتح المتجر
                  </Link>
                </div>
              </div>
              <StorePreview store={previewStore} branding={previewBranding} device={device} />
              <div className="mt-3 text-[10px] leading-5 text-subtle">
                المعاينة تعرض الهوية والقالب. المنتجات الفعلية تظهر من بيانات متجرك عند فتح الرابط.
              </div>
            </Card>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-brand border border-line bg-card px-4 py-3 text-[11px] text-subtle">
              <span>«حفظ كمسودة» يحفظ التغييرات دون نشرها للعملاء.</span>
              <span className="font-mono text-subtle" dir="ltr">{data?.preview_url ?? `/store/${subdomain}`}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
