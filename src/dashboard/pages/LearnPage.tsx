import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  GraduationCap,
  Lightbulb,
  PlayCircle,
} from "lucide-react";
import { KNOWLEDGE_ARTICLES } from "../../data/knowledge";
import { Link } from "../../lib/router";
import { Badge, Card, PageHeader, cn } from "../../components/ui";
import { useDashboard } from "../DashboardShell";

const STORAGE_KEY = "sanad.learn.checklist.v1";

interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
  href?: string;
}

const CHECKLIST: { title: string; items: ChecklistItem[] }[] = [
  {
    title: "جهّز متجرك للبيع",
    items: [
      { id: "product", label: "أضف أول منتج مع صورة وسعر", hint: "المنتجات ← منتج جديد", href: "/dashboard/products" },
      { id: "categories", label: "أنشئ فئات لتنظيم الكتالوج", hint: "منتجات بفئات واضحة تُشترى أكثر", href: "/dashboard/categories" },
      { id: "shipping", label: "أضف منطقة شحن بأسعار التحصيل", hint: "بدون منطقة شحن لن يُحسب الشحن في الطلبات", href: "/dashboard/shipping" },
      { id: "whatsapp", label: "أضف رقم واتساب للدعم", hint: "يظهر في متجرك وصفحة نجاح الطلب", href: "/dashboard/settings" },
      { id: "publish", label: "انشر صفحة البيع من التهيئة", hint: "التهيئة ← الخطوة الأخيرة" },
    ],
  },
  {
    title: "ابدأ استقبال أول طلب",
    items: [
      { id: "share", label: "شارك رابط متجرك أو استخدم كود الإحالة", hint: "انسخ الرابط من بطاقة المتجر في الشريط الجانبي" },
      { id: "confirm", label: "أكد الطلبات الجديدة خلال 30 دقيقة", hint: "الطلبات ← تغيير الحالة إلى «بانتظار التأكيد» ثم «مؤكد»", href: "/dashboard/orders" },
      { id: "track", label: "تابع حالة الطلب حتى التوصيل", hint: "قيد التجهيز ← جاهز للشحن ← خرج للتوصيل ← تم التوصيل" },
    ],
  },
  {
    title: "انمُ بعد أول طلب",
    items: [
      { id: "coupon", label: "أنشئ كوبون ترحيبي للعملاء الجدد", hint: "مثال: WELCOME10", href: "/dashboard/coupons" },
      { id: "abandoned", label: "فعّل متابعة السلات المتروكة", hint: "ذكر العملاء عبر واتساب", href: "/dashboard/abandoned-carts" },
      { id: "reviews", label: "راجع التقييمات ووافق على الجيد منها", hint: "التقييمات المنشورة تبني الثقة", href: "/dashboard/reviews" },
      { id: "reports", label: "راقب أفضل المنتجات أسبوعياً", hint: "التقارير ← أفضل المنتجات", href: "/dashboard/reports" },
    ],
  },
];

const GUIDES = [
  { title: "دليل البداية السريعة", description: "من تسجيل الحساب حتى أول طلب مؤكد، خطوة بخطوة.", minutes: 5, href: "/onboarding", icon: PlayCircle, tone: "from-blue-500/20" },
  { title: "إدارة الطلبات والشحن", description: "حالات الطلب، التحصيل، الشحن اليدوي ومناطق الشحن.", minutes: 7, href: "/dashboard/orders", icon: BookOpen, tone: "from-violet-500/20" },
  { title: "التسويق والنمو", description: "الكوبونات، السلات المتروكة، الولاء والتسويق بالعمولة.", minutes: 8, href: "/dashboard/coupons", icon: Lightbulb, tone: "from-emerald-500/20" },
  { title: "المنتجات والكتالوج", description: "أفضل ممارسات الصور والأوصاف والأسعار والمتغيرات.", minutes: 6, href: "/dashboard/products", icon: GraduationCap, tone: "from-amber-500/20" },
];

export function LearnPage() {
  const { subdomain } = useDashboard();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [openArticle, setOpenArticle] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setDone(JSON.parse(stored));
    } catch {
      // A corrupted local checklist should not break the page; start fresh.
    }
  }, []);

  const toggle = (id: string) => {
    setDone((current) => {
      const next = { ...current, [id]: !current[id] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Persisting is best-effort only.
      }
      return next;
    });
  };

  const totalItems = useMemo(() => CHECKLIST.reduce((sum, group) => sum + group.items.length, 0), []);
  const doneItems = useMemo(() => CHECKLIST.reduce((sum, group) => sum + group.items.filter((item) => done[item.id]).length, 0), [done]);
  const progress = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="مركز التعلم"
        title="مركز التعلم"
        description="أدلة عملية وتذكيرات تضمن ألا يفوتك أي شيء في تشغيل متجرك. تقدّمك محفوظ على هذا الجهاز."
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-white">قائمة تشغيل المتجر</div>
            <div className="mt-0.5 text-[11px] text-slate-500">{doneItems} من {totalItems} مهام مكتملة</div>
          </div>
          <div className="flex min-w-[200px] flex-1 items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-bold text-blue-300">{progress}%</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {GUIDES.map((guide) => {
          const Icon = guide.icon;
          return (
            <Link key={guide.title} href={guide.href} className="group">
              <Card className={cn("relative h-full overflow-hidden p-4 transition group-hover:border-blue-500/40")}>
                <div className={cn("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", guide.tone)} />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl border border-slate-700 bg-slate-800/70 p-2 text-blue-300"><Icon className="h-4 w-4" /></span>
                    <Badge tone="bg-slate-800 text-slate-400 border-slate-700"><Clock className="h-3 w-3" /> {guide.minutes} دقيقة</Badge>
                  </div>
                  <div className="mt-3 text-sm font-bold text-white">{guide.title}</div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">{guide.description}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {CHECKLIST.map((group) => (
          <Card key={group.title} className="p-4">
            <div className="mb-3 text-xs font-bold text-white">{group.title}</div>
            <div className="space-y-2">
              {group.items.map((item) => {
                const checked = Boolean(done[item.id]);
                return (
                  <div key={item.id} className="flex items-start gap-2.5 rounded-xl border border-slate-800/70 bg-slate-950/40 p-2.5">
                    <button onClick={() => toggle(item.id)} className="mt-0.5 shrink-0" aria-label={checked ? "إلغاء الإكمال" : "إكمال"}>
                      {checked ? <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" /> : <Circle className="h-4.5 w-4.5 text-slate-600" />}
                    </button>
                    <div className="min-w-0">
                      <div className={cn("text-[11px] font-semibold", checked ? "text-slate-500 line-through" : "text-slate-200")}>{item.label}</div>
                      <div className="mt-0.5 text-[10px] leading-4 text-slate-500">
                        {item.href ? <Link href={item.href} className="text-blue-400 hover:text-blue-300">{item.hint} ←</Link> : item.hint}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-800/70 px-4 py-3 text-xs font-bold text-white">مقالات معرفية مختارة</div>
        <div className="divide-y divide-slate-800/60">
          {KNOWLEDGE_ARTICLES.slice(0, 6).map((article) => {
            const open = openArticle === article.slug;
            return (
              <div key={article.slug}>
                <button
                  onClick={() => { setOpenArticle(open ? null : article.slug); setOpenSection(null); }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition hover:bg-slate-800/30"
                >
                  <span className="rounded-lg border border-slate-700 bg-slate-800/70 p-1.5 text-blue-300"><BookOpen className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-slate-100">{article.title_ar}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{article.category_ar}</span>
                      <span>·</span>
                      <span>{article.reading_time_min} دقائق قراءة</span>
                    </div>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition", open && "rotate-180")} />
                </button>
                {open ? (
                  <div className="space-y-2 px-4 pb-4">
                    <p className="text-[11px] leading-6 text-slate-400">{article.summary_ar}</p>
                    {article.sections_ar.map((section) => {
                      const key = `${article.slug}:${section.heading}`;
                      const sectionOpen = openSection === key;
                      return (
                        <div key={key} className="overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/40">
                          <button
                            onClick={() => setOpenSection(sectionOpen ? null : key)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start text-[11px] font-semibold text-slate-200 transition hover:bg-slate-800/30"
                          >
                            {section.heading}
                            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-slate-500 transition", sectionOpen && "rotate-180")} />
                          </button>
                          {sectionOpen ? <div className="border-t border-slate-800/60 px-3 py-2.5 text-[11px] leading-6 text-slate-400">{section.content}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-xs font-bold text-white">تحتاج مساعدة من الفريق؟</div>
          <div className="mt-0.5 text-[11px] text-slate-500">راسلنا عبر واتساب وسيساعدك فريق سند في تشغيل متجرك.</div>
        </div>
        <Link
          href={`/store/${subdomain}`}
          target="_blank"
          className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-blue-500/40"
        >
          افتح متجرك للمراجعة
        </Link>
      </Card>
    </div>
  );
}
