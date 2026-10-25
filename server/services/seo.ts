import type { Request } from "express";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { isPublished } from "./publishing.js";
import { isPlatformHost, normalizeHost, resolveCustomDomainHost } from "./domains.js";

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function absoluteStoreUrl(store: { subdomain: string; customDomain: string | null }, path = "") {
  const origin = store.customDomain ? `https://${store.customDomain}` : `${env.appUrl}/store/${encodeURIComponent(store.subdomain)}`;
  return `${origin}${path && path !== "/" ? (path.startsWith("/") ? path : `/${path}`) : ""}`;
}

export async function resolveStoreForRequest(req: Request) {
  const host = normalizeHost(req.headers.host);
  if (!isPlatformHost(host)) {
    const resolved = await resolveCustomDomainHost(host);
    return resolved ? prisma.store.findUnique({ where: { id: resolved.storeId } }) : null;
  }
  const match = req.path.match(/^\/store\/([^/]+)/);
  if (!match) return null;
  let subdomain = match[1];
  try { subdomain = decodeURIComponent(subdomain); } catch { /* keep raw */ }
  return prisma.store.findUnique({ where: { subdomain } });
}

export async function storefrontSeo(req: Request, store: any) {
  const path = req.path;
  const published = isPublished(store);
  const baseTitle = store.seoTitle || store.storeName;
  const baseDescription = store.seoDescription || store.description || `تسوّق من متجر ${store.storeName}.`;
  let title = baseTitle;
  let description = baseDescription;
  let image = store.coverUrl || store.logoUrl || "";
  let status = 200;
  let noindex = !published;

  if (published) {
    const productMatch = path.match(/^\/store\/[^/]+\/products\/([^/]+)/);
    const blogMatch = path.match(/^\/store\/[^/]+\/blog\/([^/]+)/);
    const pageMatch = path.match(/^\/store\/[^/]+\/pages\/([^/]+)/);
    if (productMatch) {
      const slug = decodeURIComponent(productMatch[1]);
      const product = await prisma.product.findFirst({ where: { storeId: store.id, slug, status: "active" }, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } });
      if (!product) { status = 404; title = "المنتج غير موجود"; noindex = true; }
      else {
        title = product.seoTitle || product.nameAr || product.nameEn || baseTitle;
        description = product.seoDescription || product.shortDescriptionAr || product.shortDescriptionEn || baseDescription;
        image = product.images[0]?.url || image;
      }
    } else if (blogMatch) {
      const post = await prisma.blogPost.findFirst({ where: { storeId: store.id, slug: decodeURIComponent(blogMatch[1]), status: "published" } });
      if (!post) { status = 404; title = "المقال غير موجود"; noindex = true; }
      else { title = post.seoTitle || post.title; description = post.seoDescription || post.excerpt || baseDescription; image = post.featuredImage || image; }
    } else if (pageMatch) {
      const page = await prisma.page.findFirst({ where: { storeId: store.id, slug: decodeURIComponent(pageMatch[1]), status: "published" } });
      if (!page) { status = 404; title = "الصفحة غير موجودة"; noindex = true; }
      else { title = page.seoTitle || page.title; description = page.seoDescription || baseDescription; }
    }
    const query = new URL(req.originalUrl, "http://metadata.invalid").searchParams;
    if (query.has("search") || query.has("minPrice") || query.has("maxPrice") || query.has("featured")) noindex = true;
  }

  const canonicalPath = path.replace(/^\/store\/[^/]+/, "").replace(/\/$/, "") || "/";
  const canonical = absoluteStoreUrl(store, canonicalPath === "/" ? "" : canonicalPath);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": path.includes("/products/") ? "Product" : "OnlineStore",
    name: title,
    description,
    url: canonical,
    ...(image ? { image: image.startsWith("http") ? image : new URL(image, env.appUrl).toString() } : {}),
    ...(path.includes("/products/") ? { offers: { "@type": "Offer", priceCurrency: store.currency, availability: "https://schema.org/InStock" } } : {}),
  };
  return { title, description, image, canonical, noindex, status, jsonLd };
}

export async function storeSitemap(store: any) {
  if (!store || !isPublished(store)) return null;
  const [products, categories, pages, posts] = await Promise.all([
    prisma.product.findMany({ where: { storeId: store.id, status: "active" }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { storeId: store.id, isActive: true }, select: { slug: true, updatedAt: true } }),
    prisma.page.findMany({ where: { storeId: store.id, status: "published" }, select: { slug: true, updatedAt: true } }),
    prisma.blogPost.findMany({ where: { storeId: store.id, status: "published" }, select: { slug: true, updatedAt: true } }),
  ]);
  const urls = [
    { loc: absoluteStoreUrl(store), lastmod: store.updatedAt },
    { loc: absoluteStoreUrl(store, "/products"), lastmod: store.updatedAt },
    { loc: absoluteStoreUrl(store, "/categories"), lastmod: store.updatedAt },
    { loc: absoluteStoreUrl(store, "/blog"), lastmod: store.updatedAt },
    ...categories.map((x) => ({ loc: absoluteStoreUrl(store, `/categories/${encodeURIComponent(x.slug)}`), lastmod: x.updatedAt })),
    ...products.map((x) => ({ loc: absoluteStoreUrl(store, `/products/${encodeURIComponent(x.slug)}`), lastmod: x.updatedAt })),
    ...pages.map((x) => ({ loc: absoluteStoreUrl(store, `/pages/${encodeURIComponent(x.slug)}`), lastmod: x.updatedAt })),
    ...posts.map((x) => ({ loc: absoluteStoreUrl(store, `/blog/${encodeURIComponent(x.slug)}`), lastmod: x.updatedAt })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${xml(u.loc)}</loc><lastmod>${u.lastmod.toISOString()}</lastmod></url>`).join("")}</urlset>`;
}

export function marketingSitemap() {
  const urls = ["/", "/auth/login", "/auth/register"].map((path) => `${env.appUrl}${path}`);
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((loc) => `<url><loc>${xml(loc)}</loc></url>`).join("")}</urlset>`;
}
