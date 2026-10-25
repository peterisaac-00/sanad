import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { readableOnPrimary } from "../lib/color";
import { useToast } from "../components/ui";

/**
 * Storefront state lives outside the dashboard: the cart is browser-local and
 * contains display snapshots only. Every price, stock level, coupon and
 * shipping fee is revalidated by the server at checkout.
 */

export interface CartItem {
  key: string;
  productId: string;
  slug: string;
  name: string;
  sku: string;
  variantId?: string;
  variantLabel?: string;
  price: number;
  image: string;
  qty: number;
  maxStock: number;
}

export type NewCartItem = Omit<CartItem, "key" | "qty">;

export interface CouponState {
  couponId: string;
  code: string;
  discount: number;
  freeShipping: boolean;
}

export interface StorefrontTheme {
  dark: boolean;
  primary: string;
  font: string;
  page: string;
  panel: string;
  panelHover: string;
  heading: string;
  muted: string;
  border: string;
  input: string;
  soft: string;
  navLink: string;
}

interface StorefrontContextValue {
  subdomain: string;
  base: string;
  store: any;
  branding: any;
  categories: any[];
  featured: any[];
  pages: any[];
  zones: any[];
  payments: { cod_enabled: boolean; online_enabled: boolean };
  published: boolean;
  data: any;
  reload: () => void;
  currency: string;
  theme: StorefrontTheme;

  cart: CartItem[];
  cartCount: number;
  subtotal: number;
  addToCart: (item: NewCartItem, qty?: number) => boolean;
  setQty: (key: string, qty: number) => void;
  updateCartItem: (key: string, patch: Partial<CartItem>) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  cartToken: string;

  coupon: CouponState | null;
  couponLoading: boolean;
  applyCoupon: (code: string) => Promise<CouponState>;
  clearCoupon: () => void;

  trackCart: (input: { name?: string; phone?: string; email?: string; force?: boolean }) => void;
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

function cartStorageKey(subdomain: string) {
  return `sanad_storefront_cart_${subdomain}`;
}

function couponStorageKey(subdomain: string) {
  return `sanad_storefront_coupon_${subdomain}`;
}

function tokenStorageKey(subdomain: string) {
  return `sanad_storefront_token_${subdomain}`;
}

function readCart(subdomain: string): CartItem[] {
  try {
    const raw = localStorage.getItem(cartStorageKey(subdomain));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        key: String(item.key ?? ""),
        productId: String(item.productId ?? ""),
        slug: String(item.slug ?? ""),
        name: String(item.name ?? ""),
        sku: String(item.sku ?? ""),
        variantId: item.variantId ? String(item.variantId) : undefined,
        variantLabel: item.variantLabel ? String(item.variantLabel) : undefined,
        price: Math.max(0, Number(item.price) || 0),
        image: String(item.image ?? ""),
        qty: Math.max(1, Math.min(99, Math.round(Number(item.qty) || 1))),
        maxStock: Math.max(0, Math.round(Number(item.maxStock) || 0)),
      }))
      .filter((item) => item.key && item.sku && item.qty > 0);
  } catch {
    return [];
  }
}

function readSavedCoupon(subdomain: string): string {
  try {
    return localStorage.getItem(couponStorageKey(subdomain)) || "";
  } catch {
    return "";
  }
}

function makeCartToken(subdomain: string): string {
  try {
    const existing = localStorage.getItem(tokenStorageKey(subdomain));
    if (existing && existing.length >= 8) return existing;
    const created = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `cart-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(tokenStorageKey(subdomain), created);
    return created;
  } catch {
    return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function readStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or a full quota: the cart still works for this visit.
  }
}

function dropStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function useSystemDark(): boolean {
  const [systemDark, setSystemDark] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return systemDark;
}

export function StorefrontProvider({
  subdomain,
  data,
  reload,
  base: baseProp,
  children,
}: {
  subdomain: string;
  data: any;
  reload: () => void;
  base?: string;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const base = baseProp ?? `/store/${subdomain}`;
  const store = data.store ?? {};
  const branding = data.branding ?? {};
  const currency = store.currency || "EGP";
  const systemDark = useSystemDark();
  const mode = branding.themeMode || "light";
  const dark = mode === "dark" ? true : mode === "system" ? systemDark : false;
  const customPrimary = typeof branding.primaryColor === "string" ? branding.primaryColor.trim() : "";
  const primary = "var(--sf-primary)";
  const font = branding.arabicFont || "IBM Plex Sans Arabic";

  const [cart, setCart] = useState<CartItem[]>(() => readCart(subdomain));
  const [coupon, setCoupon] = useState<CouponState | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const savedCouponCode = useRef(readSavedCoupon(subdomain));
  const cartToken = useRef(makeCartToken(subdomain));
  const lastTracked = useRef("");
  const subtotal = useMemo(
    () => Math.round(cart.reduce((sum, item) => sum + item.price * item.qty, 0) * 100) / 100,
    [cart]
  );
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);

  useEffect(() => {
    readStorage(cartStorageKey(subdomain), JSON.stringify(cart));
  }, [cart, subdomain]);

  useEffect(() => {
    if (coupon) readStorage(couponStorageKey(subdomain), coupon.code);
    else dropStorage(couponStorageKey(subdomain));
  }, [coupon, subdomain]);

  // Revalidate a remembered code once against the restored cart. A stale code
  // is removed instead of being displayed as a discount that no longer exists.
  useEffect(() => {
    const code = savedCouponCode.current;
    if (!code || subtotal <= 0) return;
    let alive = true;
    api.storefront
      .coupon(subdomain, { code, subtotal })
      .then((result) => {
        if (!alive) return;
        if (result.coupon) setCoupon(result.coupon as CouponState);
        else {
          setCoupon(null);
          dropStorage(couponStorageKey(subdomain));
        }
      })
      .catch(() => {
        if (!alive) return;
        setCoupon(null);
        dropStorage(couponStorageKey(subdomain));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subdomain]);

  const addToCart = useCallback(
    (item: NewCartItem, qty = 1) => {
      if (item.maxStock <= 0) {
        toast.error("هذا المنتج غير متوفر حالياً.");
        return false;
      }
      const key = item.variantId ? `v:${item.variantId}` : `p:${item.sku}`;
      const existing = cart.find((entry) => entry.key === key);
      const currentQty = existing?.qty ?? 0;
      const nextQty = Math.min(item.maxStock, currentQty + Math.max(1, Math.round(qty)));
      if (existing && nextQty === currentQty) {
        toast.push("وصلت إلى أقصى كمية متاحة من هذا المنتج.");
        return false;
      }
      setCart((current) => {
        const found = current.find((entry) => entry.key === key);
        if (found) {
          return current.map((entry) => (entry.key === key ? { ...entry, qty: nextQty } : entry));
        }
        return [...current, { ...item, key, qty: nextQty }];
      });
      toast.success(existing ? "تم تحديث الكمية في السلة." : "تمت إضافة المنتج إلى السلة.");
      return true;
    },
    [cart, toast]
  );

  const setQty = useCallback((key: string, qty: number) => {
    setCart((current) =>
      current
        .map((item) => (item.key === key ? { ...item, qty: Math.max(1, Math.min(item.maxStock || 99, Math.round(qty))) } : item))
        .filter((item) => item.qty > 0)
    );
  }, []);

  const updateCartItem = useCallback((key: string, patch: Partial<CartItem>) => {
    setCart((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  }, []);

  const removeItem = useCallback((key: string) => {
    setCart((current) => current.filter((item) => item.key !== key));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCoupon(null);
    dropStorage(couponStorageKey(subdomain));
  }, [subdomain]);

  const applyCoupon = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) throw new Error("أدخل كود الخصم أولاً.");
      if (subtotal <= 0) throw new Error("أضف منتجات إلى السلة قبل استخدام كود الخصم.");
      setCouponLoading(true);
      try {
        const result = await api.storefront.coupon(subdomain, { code, subtotal });
        if (!result.coupon) throw new Error("كود الخصم غير صالح.");
        setCoupon(result.coupon as CouponState);
        return result.coupon as CouponState;
      } finally {
        setCouponLoading(false);
      }
    },
    [subdomain, subtotal]
  );

  const clearCoupon = useCallback(() => setCoupon(null), []);

  const trackCart = useCallback(
    (input: { name?: string; phone?: string; email?: string; force?: boolean }) => {
      if (!cart.length) return;
      const name = (input.name ?? "").trim();
      const phone = (input.phone ?? "").trim();
      const email = (input.email ?? "").trim();
      if (!input.force && !phone && !name) return;
      const signature = `${name}|${phone}|${email}|${cart.map((item) => `${item.key}:${item.qty}`).join(",")}`;
      if (!input.force && signature === lastTracked.current) return;
      lastTracked.current = signature;
      void api.storefront
        .trackCart(subdomain, {
          cartToken: cartToken.current,
          customerName: name,
          phone,
          email,
          items: cart.map((item) =>
            item.variantId ? { variantId: item.variantId, qty: item.qty } : { sku: item.sku, qty: item.qty }
          ),
        })
        .catch(() => {
          // Recovery tracking is best-effort and must never block checkout.
        });
    },
    [cart, subdomain]
  );

  const theme = useMemo<StorefrontTheme>(
    () => ({
      dark,
      primary,
      font,
      page: "bg-canvas text-ink",
      panel: "border-line bg-card shadow-brand-card",
      panelHover: "hover:border-brand-line",
      heading: "text-ink",
      muted: "text-subtle",
      border: "border-line",
      input: "input-control",
      soft: "bg-surface",
      navLink: "text-subtle hover:text-ink",
    }),
    [dark, primary, font]
  );

  const value = useMemo<StorefrontContextValue>(
    () => ({
      subdomain,
      base,
      store,
      branding,
      categories: data.categories ?? [],
      featured: data.featured_products ?? [],
      pages: data.pages ?? [],
      zones: data.shipping_zones ?? [],
      payments: data.payments ?? { cod_enabled: Boolean(store.cod_enabled), online_enabled: Boolean(store.online_payment_enabled) },
      published: Boolean(data.published),
      data,
      reload,
      currency,
      theme,
      cart,
      cartCount,
      subtotal,
      addToCart,
      setQty,
      updateCartItem,
      removeItem,
      clearCart,
      cartToken: cartToken.current,
      coupon,
      couponLoading,
      applyCoupon,
      clearCoupon,
      trackCart,
    }),
    [
      subdomain,
      base,
      store,
      branding,
      data,
      reload,
      currency,
      theme,
      cart,
      cartCount,
      subtotal,
      addToCart,
      setQty,
      updateCartItem,
      removeItem,
      clearCart,
      coupon,
      couponLoading,
      applyCoupon,
      clearCoupon,
      trackCart,
    ]
  );

  return (
    <StorefrontContext.Provider value={value}>
      <div
        dir="rtl"
        data-theme={dark ? "dark" : "light"}
        className={`min-h-screen font-arabic ${theme.page}`}
        style={{
          fontFamily: `'${font}', var(--font-arabic)`,
          ["--sf-primary" as any]: customPrimary || "var(--color-primary)",
          ...(customPrimary
            ? {
                ["--color-primary" as any]: customPrimary,
                ["--color-on-primary" as any]: readableOnPrimary(customPrimary),
                ["--color-primary-hover" as any]: `color-mix(in srgb, ${customPrimary} 86%, var(--color-text))`,
                ["--color-primary-soft" as any]: `color-mix(in srgb, ${customPrimary} 13%, var(--color-card))`,
                ["--color-primary-line" as any]: `color-mix(in srgb, ${customPrimary} 32%, var(--color-card))`,
              }
            : {}),
        }}
      >
        {children}
      </div>
    </StorefrontContext.Provider>
  );
}

export function useStorefront(): StorefrontContextValue {
  const ctx = useContext(StorefrontContext);
  if (!ctx) throw new Error("useStorefront must be used inside StorefrontProvider");
  return ctx;
}

export function effectiveSubtotal(subtotal: number, coupon: CouponState | null): number {
  return Math.max(0, Math.round((subtotal - Math.min(coupon?.discount ?? 0, subtotal)) * 100) / 100);
}
