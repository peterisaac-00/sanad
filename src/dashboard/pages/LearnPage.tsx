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
import { LEARN_CHECKLIST, LEARN_GUIDES } from "../learnContent";

const STORAGE_KEY = "sanad.learn.checklist.v1";

const GUIDE_ICONS = {
  play: PlayCircle,
  book: BookOpen,
  growth: Lightbulb,
  catalog: GraduationCap,
};

export function LearnPage() {
  const { storefrontUrl } = useDashboard();
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

  const totalItems = useMemo(() => LEARN_CHECKLIST.reduce((sum, group) => sum + group.items.length, 0), []);
  const doneItems = useMemo(() => LEARN_CHECKLIST.reduce((sum, group) => sum + group.items.filter((item) => done[item.id]).length, 0), [done]);
  const progress = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="الدليل السريع"
        title="الدليل السريع"
        description="خطوات قصيرة وقوائم تشغيل لتشغيل متجرك. هذه مساعدة ثابتة وليست مركز تعلم كامل؛ تقدّمك محفوظ على هذا الجهاز."
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-ink">قائمة تشغيل المتجر</div>
            <div className="mt-0.5 text-[11px] text-subtle">{doneItems} من {totalItems} مهام مكتملة</div>
          </div>
          <div className="flex min-w-[200px] flex-1 items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-bold text-brand">{progress}%</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LEARN_GUIDES.map((guide) => {
          const Icon = GUIDE_ICONS[guide.icon];
          return (
            <Link key={guide.title} href={guide.href} className="group">
              <Card className={cn("relative h-full overflow-hidden p-4 transition group-hover:border-brand-line")}>
                <div className={cn("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", guide.tone)} />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="rounded-brand border border-line bg-surface p-2 text-brand"><Icon className="h-4 w-4" /></span>
                    <Badge tone="bg-surface text-subtle border-line"><Clock className="h-3 w-3" /> {guide.minutes} دقيقة</Badge>
                  </div>
                  <div className="mt-3 text-sm font-bold text-ink">{guide.title}</div>
                  <p className="mt-1 text-[11px] leading-5 text-subtle">{guide.description}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {LEARN_CHECKLIST.map((group) => (
          <Card key={group.title} className="p-4">
            <div className="mb-3 text-xs font-bold text-ink">{group.title}</div>
            <div className="space-y-2">
              {group.items.map((item) => {
                const checked = Boolean(done[item.id]);
                return (
                  <div key={item.id} className="flex items-start gap-2.5 rounded-brand border border-line bg-surface p-2.5">
                    <button onClick={() => toggle(item.id)} className="mt-0.5 shrink-0" aria-label={checked ? "إلغاء الإكمال" : "إكمال"}>
                      {checked ? <CheckCircle2 className="h-4.5 w-4.5 text-success" /> : <Circle className="h-4.5 w-4.5 text-subtle" />}
                    </button>
                    <div className="min-w-0">
                      <div className={cn("text-[11px] font-semibold", checked ? "text-subtle line-through" : "text-ink")}>{item.label}</div>
                      <div className="mt-0.5 text-[10px] leading-4 text-subtle">
                        {item.href ? <Link href={item.href} className="text-brand hover:text-brand">{item.hint} ←</Link> : item.hint}
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
        <div className="border-b border-line px-4 py-3 text-xs font-bold text-ink">مقالات معرفية مختارة</div>
        <div className="divide-y divide-line">
          {KNOWLEDGE_ARTICLES.slice(0, 6).map((article) => {
            const open = openArticle === article.slug;
            return (
              <div key={article.slug}>
                <button
                  onClick={() => { setOpenArticle(open ? null : article.slug); setOpenSection(null); }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition hover:bg-surface"
                >
                  <span className="rounded-brand-sm border border-line bg-surface p-1.5 text-brand"><BookOpen className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-ink">{article.title_ar}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-subtle">
                      <span>{article.category_ar}</span>
                      <span>·</span>
                      <span>{article.reading_time_min} دقائق قراءة</span>
                    </div>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-subtle transition", open && "rotate-180")} />
                </button>
                {open ? (
                  <div className="space-y-2 px-4 pb-4">
                    <p className="text-[11px] leading-6 text-subtle">{article.summary_ar}</p>
                    {article.sections_ar.map((section) => {
                      const key = `${article.slug}:${section.heading}`;
                      const sectionOpen = openSection === key;
                      return (
                        <div key={key} className="overflow-hidden rounded-brand border border-line bg-surface">
                          <button
                            onClick={() => setOpenSection(sectionOpen ? null : key)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start text-[11px] font-semibold text-ink transition hover:bg-surface"
                          >
                            {section.heading}
                            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-subtle transition", sectionOpen && "rotate-180")} />
                          </button>
                          {sectionOpen ? <div className="border-t border-line px-3 py-2.5 text-[11px] leading-6 text-subtle">{section.content}</div> : null}
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
          <div className="text-xs font-bold text-ink">تحتاج مساعدة من الفريق؟</div>
          <div className="mt-0.5 text-[11px] text-subtle">راسلنا عبر واتساب وسيساعدك فريق سند في تشغيل متجرك.</div>
        </div>
        <Link
          href={storefrontUrl}
          target="_blank" rel="noopener noreferrer"
          className="rounded-brand border border-line px-4 py-2 text-xs font-semibold text-ink transition hover:border-brand-line"
        >
          افتح متجرك للمراجعة
        </Link>
      </Card>
    </div>
  );
}
