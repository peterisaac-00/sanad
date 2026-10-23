/**
 * Typed API client. Authentication uses an httpOnly session cookie set by
 * the server (credentials: "include"), so no token is ever stored in
 * JavaScript-accessible storage. Cart contents live in localStorage, but
 * every price, stock level and coupon is revalidated on the server.
 */

const BASE = (import.meta as any).env?.VITE_API_URL || "";

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function parseError(status: number, data: unknown): ApiRequestError {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error: unknown }).error;
    if (e && typeof e === "object" && "message" in e) {
      const { code, message, details } = e as ApiErrorShape;
      return new ApiRequestError(status, String(code || "REQUEST_FAILED"), String(message || `Request failed (${status})`), details);
    }
    if (typeof e === "string") return new ApiRequestError(status, "REQUEST_FAILED", e);
  }
  return new ApiRequestError(status, "REQUEST_FAILED", `Request failed (${status})`);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (res.status === 204) return {} as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw parseError(res.status, data);
  return data as T;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

const enc = encodeURIComponent;

export interface SessionPayload {
  merchant: any;
  store: any;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  storeName?: string;
  subdomain?: string;
  countryCode?: string;
  storeCurrency?: string;
  acceptTerms?: boolean;
}

export interface ProductInput {
  sku: string;
  name_ar?: string;
  name_en?: string;
  price_egp?: number;
  price_sar?: number;
  [key: string]: any;
}

export interface CheckoutInput {
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  address?: string;
  city?: string;
  governorate?: string;
  payment_method?: string;
  courier?: string;
  coupon_code?: string;
  shipping_zone_id?: string;
  affiliate_code?: string;
  cart_token?: string;
  notes?: string;
  items: { sku?: string; variantId?: string; qty: number }[];
}

export const api = {
  health: () => req<{ ok: boolean }>("/api/health"),

  register: (p: RegisterPayload) =>
    req<{ merchant: any; store: any; next?: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(p),
    }),

  login: (email: string, password: string) =>
    req<SessionPayload>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  me: () => req<SessionPayload>("/api/auth/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: boolean }>("/api/auth/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  deleteAccount: (password: string) =>
    req<{ ok: boolean }>("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ password, confirmation: "DELETE" }),
    }),

  getStore: (subdomain: string) => req<{ store: any }>(`/api/stores/${enc(subdomain)}`),

  myStores: () => req<{ stores: any[] }>("/api/stores"),

  accountStore: () => req<{ store: any }>("/api/account/store"),

  updateAccountStore: (body: Record<string, unknown>) =>
    req<{ store: any }>("/api/account/store", { method: "PATCH", body: JSON.stringify(body) }),

  onboarding: {
    get: () => req<any>("/api/onboarding"),
    save: (body: Record<string, unknown>) =>
      req<any>("/api/onboarding", { method: "PATCH", body: JSON.stringify(body) }),
    complete: () =>
      req<{ store: any; branding: any; public_url: string; dashboard_url: string }>("/api/onboarding/complete", {
        method: "POST",
      }),
  },

  media: {
    upload: (input: { fileName: string; mimeType: string; dataBase64: string }) =>
      req<{ media: { id: string; url: string; fileName: string; mimeType: string; size: number } }>("/api/media/", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    list: () => req<{ media: any[] }>("/api/media/"),
  },

  dashboard: {
    summary: (subdomain: string) => req<any>(`/api/stores/${enc(subdomain)}/summary`),
    notifications: (subdomain: string) => req<{ notifications: any[]; unread: number }>(`/api/stores/${enc(subdomain)}/notifications`),
    readNotifications: (subdomain: string, id?: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/notifications/read`, {
        method: "PATCH",
        body: JSON.stringify(id ? { id } : {}),
      }),
  },

  orders: {
    list: (
      subdomain: string,
      opts?: {
        page?: number;
        pageSize?: number;
        status?: string;
        paymentStatus?: string;
        paymentMethod?: string;
        governorate?: string;
        from?: string;
        to?: string;
        search?: string;
      }
    ) => req<{ orders: any[]; pagination: any; status_counts: Record<string, number> }>(`/api/stores/${enc(subdomain)}/orders${qs(opts ?? {})}`),
    get: (subdomain: string, id: string) => req<{ order: any }>(`/api/stores/${enc(subdomain)}/orders/${enc(id)}`),
    create: (subdomain: string, body: Record<string, unknown>) =>
      req<{ order: any }>(`/api/stores/${enc(subdomain)}/orders`, { method: "POST", body: JSON.stringify(body) }),
    setStatus: (subdomain: string, id: string, status: string) =>
      req<{ order: any }>(`/api/stores/${enc(subdomain)}/orders/${enc(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    setPaymentStatus: (subdomain: string, id: string, paymentStatus: string) =>
      req<{ order: any }>(`/api/stores/${enc(subdomain)}/orders/${enc(id)}/payment-status`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus }),
      }),
    bulkStatus: (subdomain: string, ids: string[], status: string) =>
      req<{ results: any[] }>(`/api/stores/${enc(subdomain)}/orders/bulk-status`, {
        method: "PATCH",
        body: JSON.stringify({ ids, status }),
      }),
    addNote: (subdomain: string, id: string, note: string, internal = true) =>
      req<{ event: any }>(`/api/stores/${enc(subdomain)}/orders/${enc(id)}/notes`, {
        method: "POST",
        body: JSON.stringify({ note, internal }),
      }),
    refunds: (subdomain: string, id: string) => req<{ refunds: any[] }>(`/api/stores/${enc(subdomain)}/orders/${enc(id)}/refunds`),
    requestRefund: (subdomain: string, id: string, amount: number, reason: string) =>
      req<{ refund: any }>(`/api/stores/${enc(subdomain)}/orders/${enc(id)}/refunds`, {
        method: "POST",
        body: JSON.stringify({ amount, reason }),
      }),
    processRefund: (subdomain: string, id: string, refundId: string, status: "processed" | "cancelled") =>
      req<{ refund: any }>(`/api/stores/${enc(subdomain)}/orders/${enc(id)}/refunds/${enc(refundId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    checkout: (subdomain: string, body: CheckoutInput, idempotencyKey?: string) =>
      req<{ order: any; shipping: any; whatsapp_url: string | null }>(`/api/stores/${enc(subdomain)}/checkout`, {
        method: "POST",
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
        body: JSON.stringify(body),
      }),
    exportUrl: (subdomain: string, opts?: Record<string, string | undefined>) =>
      `${BASE}/api/stores/${enc(subdomain)}/orders/export${qs(opts ?? {})}`,
  },

  products: {
    list: (
      subdomain: string,
      opts?: {
        page?: number;
        pageSize?: number;
        search?: string;
        categoryId?: string;
        status?: string;
        stock?: string;
        sort?: string;
      }
    ) => req<{ products: any[]; pagination: any }>(`/api/stores/${enc(subdomain)}/products${qs(opts ?? {})}`),
    get: (subdomain: string, id: string) => req<{ product: any }>(`/api/stores/${enc(subdomain)}/products/${enc(id)}`),
    create: (subdomain: string, body: ProductInput) =>
      req<{ product: any }>(`/api/stores/${enc(subdomain)}/products`, { method: "POST", body: JSON.stringify(body) }),
    update: (subdomain: string, id: string, body: Partial<ProductInput>) =>
      req<{ product: any }>(`/api/stores/${enc(subdomain)}/products/${enc(id)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/products/${enc(id)}`, { method: "DELETE" }),
  },

  categories: {
    list: (subdomain: string, opts?: { page?: number; pageSize?: number; search?: string }) =>
      req<{ categories: any[]; pagination: any }>(`/api/stores/${enc(subdomain)}/categories${qs(opts ?? {})}`),
    create: (subdomain: string, body: Record<string, unknown>) =>
      req<{ category: any }>(`/api/stores/${enc(subdomain)}/categories`, { method: "POST", body: JSON.stringify(body) }),
    update: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ category: any }>(`/api/stores/${enc(subdomain)}/categories/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/categories/${enc(id)}`, { method: "DELETE" }),
    reorder: (subdomain: string, ids: string[]) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/categories/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ ids }),
      }),
  },

  customers: {
    list: (subdomain: string, opts?: { page?: number; pageSize?: number; search?: string; hasOrders?: string }) =>
      req<{ customers: any[]; pagination: any }>(`/api/stores/${enc(subdomain)}/customers${qs(opts ?? {})}`),
    get: (subdomain: string, id: string) => req<{ customer: any }>(`/api/stores/${enc(subdomain)}/customers/${enc(id)}`),
    update: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ customer: any }>(`/api/stores/${enc(subdomain)}/customers/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/customers/${enc(id)}`, { method: "DELETE" }),
    addAddress: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ address: any }>(`/api/stores/${enc(subdomain)}/customers/${enc(id)}/addresses`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateAddress: (subdomain: string, id: string, addressId: string, body: Record<string, unknown>) =>
      req<{ address: any }>(`/api/stores/${enc(subdomain)}/customers/${enc(id)}/addresses/${enc(addressId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    removeAddress: (subdomain: string, id: string, addressId: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/customers/${enc(id)}/addresses/${enc(addressId)}`, {
        method: "DELETE",
      }),
    exportUrl: (subdomain: string) => `${BASE}/api/stores/${enc(subdomain)}/customers/export`,
  },

  wallet: {
    get: (subdomain: string) => req<any>(`/api/stores/${enc(subdomain)}/wallet`),
    deposit: (subdomain: string, body: { amount: number; reference?: string; note?: string }) =>
      req<any>(`/api/stores/${enc(subdomain)}/wallet/deposits`, { method: "POST", body: JSON.stringify(body) }),
  },

  shipping: {
    list: (subdomain: string) => req<{ zones: any[] }>(`/api/stores/${enc(subdomain)}/shipping-zones`),
    create: (subdomain: string, body: Record<string, unknown>) =>
      req<{ zone: any }>(`/api/stores/${enc(subdomain)}/shipping-zones`, { method: "POST", body: JSON.stringify(body) }),
    update: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ zone: any }>(`/api/stores/${enc(subdomain)}/shipping-zones/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/shipping-zones/${enc(id)}`, { method: "DELETE" }),
  },

  coupons: {
    list: (subdomain: string) => req<{ coupons: any[] }>(`/api/stores/${enc(subdomain)}/coupons`),
    create: (subdomain: string, body: Record<string, unknown>) =>
      req<{ coupon: any }>(`/api/stores/${enc(subdomain)}/coupons`, { method: "POST", body: JSON.stringify(body) }),
    update: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ coupon: any }>(`/api/stores/${enc(subdomain)}/coupons/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/coupons/${enc(id)}`, { method: "DELETE" }),
  },

  upsells: {
    list: (subdomain: string) => req<{ upsells: any[] }>(`/api/stores/${enc(subdomain)}/upsells`),
    create: (subdomain: string, body: Record<string, unknown>) =>
      req<{ upsell: any }>(`/api/stores/${enc(subdomain)}/upsells`, { method: "POST", body: JSON.stringify(body) }),
    update: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ upsell: any }>(`/api/stores/${enc(subdomain)}/upsells/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/upsells/${enc(id)}`, { method: "DELETE" }),
  },

  related: {
    list: (subdomain: string, productId?: string) =>
      req<{ relations: any[] }>(`/api/stores/${enc(subdomain)}/related-products${qs({ productId })}`),
    create: (subdomain: string, body: Record<string, unknown>) =>
      req<{ relations: any[] }>(`/api/stores/${enc(subdomain)}/related-products`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ relation: any }>(`/api/stores/${enc(subdomain)}/related-products/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/related-products/${enc(id)}`, { method: "DELETE" }),
  },

  abandoned: {
    list: (subdomain: string, opts?: { page?: number; pageSize?: number; status?: string; search?: string }) =>
      req<{ carts: any[]; summary: any; pagination: any }>(`/api/stores/${enc(subdomain)}/abandoned-carts${qs(opts ?? {})}`),
    update: (subdomain: string, id: string, recoveryStatus: string) =>
      req<{ cart: any }>(`/api/stores/${enc(subdomain)}/abandoned-carts/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ recoveryStatus }),
      }),
    remind: (subdomain: string, id: string) =>
      req<any>(`/api/stores/${enc(subdomain)}/abandoned-carts/${enc(id)}/remind`, { method: "POST" }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/abandoned-carts/${enc(id)}`, { method: "DELETE" }),
  },

  pages: {
    list: (subdomain: string) => req<{ pages: any[] }>(`/api/stores/${enc(subdomain)}/pages`),
    create: (subdomain: string, body: Record<string, unknown>) =>
      req<{ page: any }>(`/api/stores/${enc(subdomain)}/pages`, { method: "POST", body: JSON.stringify(body) }),
    update: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ page: any }>(`/api/stores/${enc(subdomain)}/pages/${enc(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/pages/${enc(id)}`, { method: "DELETE" }),
  },

  blog: {
    list: (subdomain: string) => req<{ posts: any[] }>(`/api/stores/${enc(subdomain)}/blog`),
    create: (subdomain: string, body: Record<string, unknown>) =>
      req<{ post: any }>(`/api/stores/${enc(subdomain)}/blog`, { method: "POST", body: JSON.stringify(body) }),
    update: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ post: any }>(`/api/stores/${enc(subdomain)}/blog/${enc(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/blog/${enc(id)}`, { method: "DELETE" }),
  },

  affiliates: {
    list: (subdomain: string) => req<{ affiliates: any[] }>(`/api/stores/${enc(subdomain)}/affiliates`),
    create: (subdomain: string, body: Record<string, unknown>) =>
      req<{ affiliate: any }>(`/api/stores/${enc(subdomain)}/affiliates`, { method: "POST", body: JSON.stringify(body) }),
    update: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ affiliate: any }>(`/api/stores/${enc(subdomain)}/affiliates/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/affiliates/${enc(id)}`, { method: "DELETE" }),
  },

  reviews: {
    list: (subdomain: string, opts?: { page?: number; pageSize?: number; status?: string; rating?: number; reported?: string; search?: string }) =>
      req<{ reviews: any[]; summary: any; pagination: any }>(`/api/stores/${enc(subdomain)}/reviews${qs(opts ?? {})}`),
    update: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ review: any }>(`/api/stores/${enc(subdomain)}/reviews/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/reviews/${enc(id)}`, { method: "DELETE" }),
  },

  loyalty: {
    get: (subdomain: string) => req<any>(`/api/stores/${enc(subdomain)}/loyalty`),
    createRule: (subdomain: string, body: Record<string, unknown>) =>
      req<{ rule: any }>(`/api/stores/${enc(subdomain)}/loyalty/rules`, { method: "POST", body: JSON.stringify(body) }),
    updateRule: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ rule: any }>(`/api/stores/${enc(subdomain)}/loyalty/rules/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    removeRule: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/loyalty/rules/${enc(id)}`, { method: "DELETE" }),
    adjust: (subdomain: string, body: { customerId: string; points: number; note?: string }) =>
      req<{ account: any }>(`/api/stores/${enc(subdomain)}/loyalty/adjust`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  dropshipping: {
    get: (subdomain: string) => req<any>(`/api/stores/${enc(subdomain)}/dropshipping`),
    createSupplier: (subdomain: string, body: Record<string, unknown>) =>
      req<{ supplier: any }>(`/api/stores/${enc(subdomain)}/suppliers`, { method: "POST", body: JSON.stringify(body) }),
    updateSupplier: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ supplier: any }>(`/api/stores/${enc(subdomain)}/suppliers/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    removeSupplier: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/suppliers/${enc(id)}`, { method: "DELETE" }),
    createProduct: (subdomain: string, body: Record<string, unknown>) =>
      req<{ dropship: any }>(`/api/stores/${enc(subdomain)}/dropship-products`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateProduct: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ dropship: any }>(`/api/stores/${enc(subdomain)}/dropship-products/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    removeProduct: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/dropship-products/${enc(id)}`, { method: "DELETE" }),
  },

  assistant: {
    get: (subdomain: string) => req<any>(`/api/stores/${enc(subdomain)}/assistant`),
    generate: (subdomain: string, task: string, input: Record<string, unknown>) =>
      req<{ result: { text: string; provider: string; model: string } }>(`/api/stores/${enc(subdomain)}/assistant/generate`, {
        method: "POST",
        body: JSON.stringify({ task, input }),
      }),
  },

  reports: {
    get: (subdomain: string, opts?: { from?: string; to?: string; groupBy?: string }) =>
      req<any>(`/api/stores/${enc(subdomain)}/reports${qs(opts ?? {})}`)  },

  settings: {
    get: (subdomain: string) => req<any>(`/api/stores/${enc(subdomain)}/settings`),
    update: (subdomain: string, body: Record<string, unknown>) =>
      req<{ store: any }>(`/api/stores/${enc(subdomain)}/settings`, { method: "PATCH", body: JSON.stringify(body) }),
    notificationPrefs: (subdomain: string, body: Record<string, unknown>) =>
      req<{ notificationPrefs: any }>(`/api/stores/${enc(subdomain)}/notification-preferences`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    auditLogs: (subdomain: string, limit?: number) =>
      req<{ logs: any[] }>(`/api/stores/${enc(subdomain)}/audit-logs${qs({ limit })}`),
    domains: (subdomain: string) => req<{ domains: any[] }>(`/api/stores/${enc(subdomain)}/domains`),
    addDomain: (subdomain: string, domain: string) =>
      req<{ domain: any }>(`/api/stores/${enc(subdomain)}/domains`, { method: "POST", body: JSON.stringify({ domain }) }),
    verifyDomain: (subdomain: string, id: string) =>
      req<any>(`/api/stores/${enc(subdomain)}/domains/${enc(id)}/verify`, { method: "POST" }),
    removeDomain: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/domains/${enc(id)}`, { method: "DELETE" }),
    team: (subdomain: string) => req<{ team: any[]; invitation_email_configured: boolean }>(`/api/stores/${enc(subdomain)}/team`),
    invite: (subdomain: string, body: Record<string, unknown>) =>
      req<any>(`/api/stores/${enc(subdomain)}/team`, { method: "POST", body: JSON.stringify(body) }),
    updateMember: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ member: any }>(`/api/stores/${enc(subdomain)}/team/${enc(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    removeMember: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/team/${enc(id)}`, { method: "DELETE" }),
  },

  storefront: {
    get: (subdomain: string) => req<any>(`/api/storefront/${enc(subdomain)}`),
    products: (
      subdomain: string,
      opts?: {
        page?: number;
        pageSize?: number;
        search?: string;
        category?: string;
        sort?: string;
        featured?: string;
        minPrice?: number;
        maxPrice?: number;
      }
    ) => req<{ products: any[]; pagination: any; currency: string }>(`/api/storefront/${enc(subdomain)}/products${qs(opts ?? {})}`),
    product: (subdomain: string, slug: string) =>
      req<{ product: any; store: any; branding: any }>(`/api/storefront/${enc(subdomain)}/products/${enc(slug)}`),
    categories: (subdomain: string) => req<{ categories: any[] }>(`/api/storefront/${enc(subdomain)}/categories`),
    page: (subdomain: string, slug: string) =>
      req<{ page: any; store: any }>(`/api/storefront/${enc(subdomain)}/pages/${enc(slug)}`),
    blog: (subdomain: string) => req<{ posts: any[] }>(`/api/storefront/${enc(subdomain)}/blog`),
    post: (subdomain: string, slug: string) =>
      req<{ post: any; store: any }>(`/api/storefront/${enc(subdomain)}/blog/${enc(slug)}`),
    reviews: (subdomain: string, productId: string) =>
      req<{ reviews: any[] }>(`/api/storefront/${enc(subdomain)}/reviews/${enc(productId)}`),
    submitReview: (subdomain: string, body: Record<string, unknown>) =>
      req<any>(`/api/storefront/${enc(subdomain)}/reviews`, { method: "POST", body: JSON.stringify(body) }),
    coupon: (subdomain: string, body: { code: string; subtotal: number; customer_phone?: string }) =>
      req<{ valid: boolean; coupon: any }>(`/api/storefront/${enc(subdomain)}/coupon`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    shippingQuote: (
      subdomain: string,
      body: { governorate?: string; city?: string; subtotal: number; zoneId?: string; payment_method?: string }
    ) => req<{ quote: any; currency: string }>(`/api/storefront/${enc(subdomain)}/shipping-quote`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    trackCart: (
      subdomain: string,
      body: {
        cartToken: string;
        customerName?: string;
        phone?: string;
        email?: string;
        items: { sku?: string; variantId?: string; qty: number }[];
      }
    ) => req<{ cart: any }>(`/api/storefront/${enc(subdomain)}/cart`, { method: "POST", body: JSON.stringify(body) }),
    order: (subdomain: string, orderNumber: string, phone: string) =>
      req<{ order: any; store: any }>(`/api/storefront/${enc(subdomain)}/orders/${enc(orderNumber)}${qs({ phone })}`),
  },

  myLeads: () => req<{ leads: any[] }>("/api/leads"),

  lead: (type: string, payload: unknown) =>
    req<{ ok: boolean; id: string }>("/api/leads", { method: "POST", body: JSON.stringify({ type, payload }) }),

  /** Download an authenticated CSV (session cookie is sent, unlike <a download>). */
  downloadCsv: async (path: string, fallbackName: string) => {
    const res = await fetch(`${BASE}${path}`, { credentials: "include" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw parseError(res.status, data);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/i);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = match?.[1] || fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export function mediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  return `${BASE}${url}`;
}
