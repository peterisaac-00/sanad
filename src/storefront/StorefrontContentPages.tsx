import React from "react";
import { ArrowLeft, BookOpen, CalendarDays, ChevronLeft, FileText, UserRound } from "lucide-react";
import { api } from "../lib/api";
import { date } from "../lib/format";
import { Link } from "../lib/router";
import { useAsync } from "../lib/useAsync";
import { cn } from "../components/ui";
import { useStorefront } from "./StorefrontContext";
import {
  ErrorBlock,
  LoadingBlock,
  ProductImage,
  SectionHeading,
  StorefrontEmpty,
  useStorefrontSeo,
} from "./StorefrontUI";

export function StorefrontPageView({ slug }: { slug: string }) {
  const { base, subdomain, store, theme } = useStorefront();
  const result = useAsync(() => api.storefront.page(subdomain, slug), [subdomain, slug]);
  const page = result.data?.page;

  useStorefrontSeo({
    title: page ? `${page.seoTitle || page.title} — ${store.store_name}` : `صفحة — ${store.store_name}`,
    description: page?.seoDescription || undefined,
    canonical: `${window.location.origin}${base}/pages/${encodeURIComponent(slug)}`,
  });

  if (result.loading) return <div className="mx-auto max-w-4xl px-4 py-12"><LoadingBlock /></div>;
  if (result.error || !page) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14">
        <ErrorBlock
          message="هذه الصفحة غير موجودة أو غير منشورة."
          onRetry={(result.error as any)?.status === 404 ? undefined : result.reload}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <nav className={cn("flex flex-wrap items-center gap-1.5 text-[11px]", theme.muted)}>
        <Link href={base} className="hover:opacity-80">الرئيسية</Link>
        <ChevronLeft className="h-3 w-3" />
        <span className={theme.heading}>{page.title}</span>
      </nav>

      <article className={cn("rounded-brand-lg border p-5 sm:p-8", theme.panel)}>
        <div className="mb-3 flex items-center gap-2 text-[11px]" style={{ color: theme.primary }}>
          <FileText className="h-3.5 w-3.5" />
          {page.type === "about" ? "عن المتجر" : page.type === "contact" ? "تواصل معنا" : page.type === "policy" ? "السياسات" : "صفحة"}
        </div>
        <h1 className={cn("font-heading text-2xl font-extrabold sm:text-3xl", theme.heading)}>{page.title}</h1>
        <div className={cn("mt-5 whitespace-pre-line text-sm leading-8", theme.muted)}>
          {page.content || "لم يُضف محتوى لهذه الصفحة بعد."}
        </div>
      </article>
    </div>
  );
}

export function StorefrontBlogPage() {
  const { base, subdomain, store, theme } = useStorefront();
  const result = useAsync(() => api.storefront.blog(subdomain), [subdomain]);
  const posts: any[] = result.data?.posts ?? [];

  useStorefrontSeo({
    title: `المدونة — ${store.store_name}`,
    description: `مقالات ونصائح من ${store.store_name}.`,
    canonical: `${window.location.origin}${base}/blog`,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <SectionHeading
        eyebrow="المدونة"
        title="مقالات المتجر"
        description="محتوى منشور من فريق المتجر: نصائح، أدلة شراء وتحديثات."
      />

      {result.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={cn("overflow-hidden rounded-brand border", theme.panel)}>
              <div className={cn("aspect-[16/9] animate-pulse", theme.soft)} />
              <div className="space-y-2 p-4">
                <div className={cn("h-3 w-2/3 animate-pulse rounded", theme.soft)} />
                <div className={cn("h-3 w-full animate-pulse rounded", theme.soft)} />
              </div>
            </div>
          ))}
        </div>
      ) : result.error ? (
        <ErrorBlock message="تعذر تحميل المقالات." onRetry={result.reload} />
      ) : posts.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`${base}/blog/${encodeURIComponent(post.slug)}`}
              className={cn("group overflow-hidden rounded-brand border transition", theme.panel, theme.panelHover)}
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                {post.featuredImage ? (
                  <ProductImage
                    src={post.featuredImage}
                    alt={post.title}
                    className="transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center" style={{ background: `color-mix(in srgb, ${theme.primary} 8%, transparent)` }}>
                    <BookOpen className="h-8 w-8" style={{ color: theme.primary }} />
                  </div>
                )}
              </div>
              <div className="space-y-1.5 p-4">
                <div className={cn("flex flex-wrap items-center gap-2 text-[10px]", theme.muted)}>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {date(post.publishedAt || post.createdAt)}</span>
                  {post.author ? <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" /> {post.author}</span> : null}
                </div>
                <h2 className={cn("line-clamp-2 font-heading text-base font-bold leading-6", theme.heading)}>{post.title}</h2>
                {post.excerpt ? <p className={cn("line-clamp-3 text-xs leading-6", theme.muted)}>{post.excerpt}</p> : null}
                <span className="inline-flex items-center gap-1 pt-1 text-[11px] font-bold" style={{ color: theme.primary }}>
                  اقرأ المقال <ArrowLeft className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <StorefrontEmpty
          icon={<BookOpen className="h-6 w-6" />}
          title="لا توجد مقالات منشورة"
          description="لم ينشر المتجر مقالات بعد. عد قريباً."
        />
      )}
    </div>
  );
}

export function StorefrontBlogPostPage({ slug }: { slug: string }) {
  const { base, subdomain, store, theme } = useStorefront();
  const result = useAsync(() => api.storefront.post(subdomain, slug), [subdomain, slug]);
  const post = result.data?.post;
  const categories: string[] = Array.isArray(post?.categories) ? post.categories : [];
  const tags: string[] = Array.isArray(post?.tags) ? post.tags : [];

  useStorefrontSeo({
    title: post ? `${post.seoTitle || post.title} — ${store.store_name}` : `المدونة — ${store.store_name}`,
    description: post?.seoDescription || post?.excerpt || undefined,
    image: post?.featuredImage || undefined,
    canonical: `${window.location.origin}${base}/blog/${encodeURIComponent(slug)}`,
  });

  if (result.loading) return <div className="mx-auto max-w-4xl px-4 py-12"><LoadingBlock /></div>;
  if (result.error || !post) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14">
        <ErrorBlock
          message="هذا المقال غير موجود أو غير منشور."
          onRetry={(result.error as any)?.status === 404 ? undefined : result.reload}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <nav className={cn("flex flex-wrap items-center gap-1.5 text-[11px]", theme.muted)}>
        <Link href={base} className="hover:opacity-80">الرئيسية</Link>
        <ChevronLeft className="h-3 w-3" />
        <Link href={`${base}/blog`} className="hover:opacity-80">المدونة</Link>
        <ChevronLeft className="h-3 w-3" />
        <span className={cn("line-clamp-1", theme.heading)}>{post.title}</span>
      </nav>

      <article className={cn("overflow-hidden rounded-brand-lg border", theme.panel)}>
        {post.featuredImage ? (
          <div className="aspect-[16/8] overflow-hidden">
            <ProductImage src={post.featuredImage} alt={post.title} />
          </div>
        ) : null}
        <div className="space-y-4 p-5 sm:p-8">
          <div className={cn("flex flex-wrap items-center gap-3 text-[11px]", theme.muted)}>
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {date(post.publishedAt || post.createdAt)}</span>
            {post.author ? <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> {post.author}</span> : null}
          </div>
          <h1 className={cn("font-heading text-2xl font-extrabold leading-snug sm:text-3xl", theme.heading)}>{post.title}</h1>
          {post.excerpt ? <p className={cn("text-sm leading-7", theme.muted)}>{post.excerpt}</p> : null}
          <div className={cn("whitespace-pre-line border-t pt-4 text-sm leading-8", theme.border, theme.muted)}>
            {post.content || "لم يُضف محتوى لهذا المقال بعد."}
          </div>
          {categories.length || tags.length ? (
            <div className={cn("flex flex-wrap gap-1.5 border-t pt-4", theme.border)}>
              {[...categories, ...tags].map((item, index) => (
                <span key={`${item}-${index}`} className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", theme.soft)}>
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </article>

      <div className="flex justify-center">
        <Link href={`${base}/blog`} className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", theme.muted)}>
          <ArrowLeft className="h-3.5 w-3.5" /> كل المقالات
        </Link>
      </div>
    </div>
  );
}

export function StorefrontNotFoundPage() {
  const { base, theme, store } = useStorefront();
  useStorefrontSeo({
    title: `الصفحة غير موجودة — ${store.store_name}`,
    description: "لم نعثر على الصفحة المطلوبة.",
    noindex: true,
  });
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <StorefrontEmpty
        icon={<FileText className="h-6 w-6" />}
        title="الصفحة غير موجودة"
        description="ربما تغيّر الرابط أو أُزيلت الصفحة. يمكنك العودة إلى المتجر أو تصفح المنتجات."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href={base} className="rounded-brand px-4 py-2.5 text-xs font-bold text-on-brand" style={{ background: theme.primary }}>
              الصفحة الرئيسية
            </Link>
            <Link href={`${base}/products`} className={cn("rounded-brand border px-4 py-2.5 text-xs font-bold", theme.border)}>
              تصفح المنتجات
            </Link>
          </div>
        }
      />
    </div>
  );
}
