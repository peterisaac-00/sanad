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

export type StorePermission =
  | "store.read"
  | "operations.write"
  | "settings.write"
  | "team.manage"
  | "domain.manage"
  | "billing.manage"
  | "export.read"
  | "audit.read";

export interface TeamMemberPayload {
  id: string;
  storeId: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff" | "viewer";
  status: "invited" | "active" | "suspended";
  permissions?: StorePermission[];
  accepted_at: string | null;
  last_login_at: string | null;
  invite_expires_at?: string | null;
  created_at: string;
}

export interface SessionPayload {
  merchant: any | null;
  store: any;
  team_member?: TeamMemberPayload | null;
  principal_type?: "merchant" | "team";
  permissions?: StorePermission[];
  publishing?: any;
}

export interface SitePayload {
  host: string;
  mode: "platform" | "custom_domain";
  custom_domain: boolean;
  canonical_url: string;
  store: {
    id: string;
    store_name: string;
    subdomain: string;
    status: string;
    publish_status: string;
    canonical_url: string;
    tls_status?: string;
  } | null;
}

export interface AdminPayload {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "operations" | "finance" | "support" | "readonly";
  permissions: string[];
  two_factor_enabled?: boolean;
  last_login_at?: string | null;
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

export interface EmailVerificationState {
  required: boolean;
  email_configured: boolean;
  sent: boolean;
  /** Development/testing only: never present when NODE_ENV=production. */
  debug_token?: string;
}

export interface SecondFactorInput {
  totp?: string;
  recovery_code?: string;
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

  site: () => req<SitePayload>("/api/site"),

  register: (p: RegisterPayload) =>
    req<{ merchant: any; store: any; next?: string; email_verification?: EmailVerificationState }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(p),
    }),

  login: (email: string, password: string, secondFactor?: SecondFactorInput) =>
    req<SessionPayload>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(secondFactor ?? {}) }),
    }),

  logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  me: () => req<SessionPayload>("/api/auth/me"),

  verifyEmail: (token: string) =>
    req<{ ok: boolean; email_verified: boolean }>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: (email: string) =>
    req<{ ok: boolean; already_verified: boolean; email_configured: boolean; sent: boolean; debug_token?: string }>(
      "/api/auth/verify-email/resend",
      { method: "POST", body: JSON.stringify({ email }) }
    ),

  forgotPassword: (email: string) =>
    req<{ ok: boolean; debug_token?: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    req<{ ok: boolean }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: boolean }>("/api/auth/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  revokeOtherSessions: () =>
    req<{ ok: boolean; revoked: number }>("/api/auth/sessions/revoke-others", { method: "POST" }),

  twoFactor: {
    setup: (password: string) =>
      req<{ secret: string; otpauth_url: string; issuer: string; account: string }>("/api/auth/2fa/setup", {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
    enable: (code: string) =>
      req<{ ok: boolean; recovery_codes: string[] }>("/api/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    disable: (password: string, code: string) =>
      req<{ ok: boolean }>("/api/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password, code }),
      }),
  },

  deleteAccount: (password: string) =>
    req<{ ok: boolean }>("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ password, confirmation: "DELETE" }),
    }),

  team: {
    invitation: (token: string) =>
      req<{ invitation: any }>(`/api/team/invitations/${enc(token)}`),
    accept: (body: { token: string; name?: string; password: string }) =>
      req<{ team_member: TeamMemberPayload; store: any; scope: "team" }>("/api/team/invitations/accept", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    login: (email: string, password: string) =>
      req<{ team_member: TeamMemberPayload; store: any; scope: "team" }>("/api/team/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => req<{ team_member: TeamMemberPayload; store: any; scope: "team" }>("/api/team/me"),
    logout: () => req<{ ok: boolean }>("/api/team/logout", { method: "POST" }),
  },

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
      req<{
        order: any;
        shipping: any;
        whatsapp_url: string | null;
        tracking_token: string;
        tracking_url: string;
      }>(`/api/stores/${enc(subdomain)}/checkout`, {
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
    deposit: (subdomain: string, body: { amount: number; method?: "bank_transfer" | "instapay" | "vodafone_cash" | "wallet" | "other"; reference?: string; note?: string }) =>
      req<any>(`/api/stores/${enc(subdomain)}/wallet/deposits`, { method: "POST", body: JSON.stringify(body) }),
    submitSubscription: (
      subdomain: string,
      body: {
        plan: "monthly" | "annual";
        method: "bank_transfer" | "instapay" | "vodafone_cash" | "wallet" | "other";
        reference: string;
        payerName?: string;
        note?: string;
      }
    ) =>
      req<{ payment: any; amount: number; currency: string; note: string }>(
        `/api/stores/${enc(subdomain)}/subscription-payments`,
        { method: "POST", body: JSON.stringify(body) }
      ),
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
      req<{ carts: any[]; summary: any; pagination: any; whatsapp: any }>(`/api/stores/${enc(subdomain)}/abandoned-carts${qs(opts ?? {})}`),
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
    settle: (subdomain: string, id: string) =>
      req<{ settled: { count: number; amount: number; settledAt: string }; note: string }>(
        `/api/stores/${enc(subdomain)}/affiliates/${enc(id)}/settle`,
        { method: "POST" }
      ),
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
      req<{ domain: any; challenge: { type: "TXT"; name: string; value: string } }>(`/api/stores/${enc(subdomain)}/domains`, {
        method: "POST",
        body: JSON.stringify({ domain }),
      }),
    verifyDomain: (subdomain: string, id: string) =>
      req<{ domain: any; verified: boolean; status: string; instructions: string }>(
        `/api/stores/${enc(subdomain)}/domains/${enc(id)}/verify`,
        { method: "POST" }
      ),
    rotateDomainChallenge: (subdomain: string, id: string) =>
      req<{ domain: any; challenge: { type: "TXT"; name: string; value: string } }>(
        `/api/stores/${enc(subdomain)}/domains/${enc(id)}/challenge`,
        { method: "POST" }
      ),
    removeDomain: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/domains/${enc(id)}`, { method: "DELETE" }),
    team: (subdomain: string) => req<{ team: any[]; invitation_email_configured: boolean }>(`/api/stores/${enc(subdomain)}/team`),
    invite: (subdomain: string, body: Record<string, unknown>) =>
      req<{
        member: any;
        email_sent: boolean;
        invite_token: string;
        invite_url: string;
        expires_at: string;
        note: string;
      }>(`/api/stores/${enc(subdomain)}/team`, { method: "POST", body: JSON.stringify(body) }),
    updateMember: (subdomain: string, id: string, body: Record<string, unknown>) =>
      req<{ member: any; invite_token?: string; invite_url?: string; expires_at?: string }>(
        `/api/stores/${enc(subdomain)}/team/${enc(id)}`,
        { method: "PATCH", body: JSON.stringify(body) }
      ),
    removeMember: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${enc(subdomain)}/team/${enc(id)}`, { method: "DELETE" }),
    publish: (subdomain: string) =>
      req<{ store: any; publishing: any }>(`/api/stores/${enc(subdomain)}/publishing`, {
        method: "POST",
        body: JSON.stringify({ action: "publish" }),
      }),
    unpublish: (subdomain: string, reason?: string) =>
      req<{ store: any; publishing: any }>(`/api/stores/${enc(subdomain)}/publishing`, {
        method: "POST",
        body: JSON.stringify({ action: "unpublish", reason }),
      }),
  },

  support: {
    list: (subdomain: string) =>
      req<{ tickets: any[]; enabled: boolean }>(`/api/stores/${enc(subdomain)}/support-tickets`),
    create: (subdomain: string, body: { subject: string; message: string; category?: string; priority?: string }) =>
      req<{ ticket: any }>(`/api/stores/${enc(subdomain)}/support-tickets`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  storefront: {
    get: (subdomain: string) => req<any>(`/api/storefront/${enc(subdomain)}`),
    visit: (subdomain: string, path: string) =>
      req<Record<string, never>>(`/api/storefront/${enc(subdomain)}/visit`, {
        method: "POST",
        body: JSON.stringify({ path }),
      }),
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
    order: (subdomain: string, orderNumber: string, opts: { phone?: string; token?: string }) =>
      req<{
        order: any;
        store: any;
        tracking_token: string;
        tracking_url: string;
      }>(`/api/storefront/${enc(subdomain)}/orders/${enc(orderNumber)}${qs({ phone: opts.phone, token: opts.token })}`),
  },

  admin: {
    auth: {
      login: (email: string, password: string, secondFactor?: { totp?: string; recovery_code?: string }) =>
        req<{ admin: AdminPayload; scope: "platform" }>("/api/admin/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password, ...(secondFactor ?? {}) }),
        }),
      me: () => req<{ admin: AdminPayload; scope: "platform" }>("/api/admin/auth/me"),
      logout: () => req<{ ok: boolean }>("/api/admin/auth/logout", { method: "POST" }),
      changePassword: (currentPassword: string, newPassword: string) =>
        req<{ ok: boolean; revoked_sessions: number }>("/api/admin/auth/password", {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword }),
        }),
      revokeOtherSessions: () =>
        req<{ ok: boolean; revoked: number }>("/api/admin/auth/sessions/revoke-others", { method: "POST" }),
      twoFactor: {
        setup: (password: string) =>
          req<{ secret: string; otpauth_url: string; issuer: string; account: string }>("/api/admin/auth/2fa/setup", {
            method: "POST",
            body: JSON.stringify({ password }),
          }),
        enable: (code: string) =>
          req<{ ok: boolean; recovery_codes: string[] }>("/api/admin/auth/2fa/enable", {
            method: "POST",
            body: JSON.stringify({ code }),
          }),
        disable: (password: string, code: string) =>
          req<{ ok: boolean }>("/api/admin/auth/2fa/disable", {
            method: "POST",
            body: JSON.stringify({ password, code }),
          }),
      },
    },
    overview: () => req<any>("/api/admin/overview"),
    stores: (opts?: { status?: string; publish?: string }) =>
      req<{ stores: any[] }>(`/api/admin/stores${qs(opts ?? {})}`),
    approveStore: (id: string, note = "") =>
      req<{ store: any; publishing: any }>(`/api/admin/stores/${enc(id)}/approve`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    rejectStore: (id: string, note = "") =>
      req<{ store: any; publishing: any }>(`/api/admin/stores/${enc(id)}/reject`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    suspendStore: (id: string, note = "") =>
      req<{ store: any; publishing: any }>(`/api/admin/stores/${enc(id)}/suspend`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    setStorePublishing: (id: string, action: "publish" | "unpublish", note = "") =>
      req<{ store: any; publishing: any }>(`/api/admin/stores/${enc(id)}/publishing`, {
        method: "POST",
        body: JSON.stringify({ action, note }),
      }),
    storeSettings: (id: string) => req<any>(`/api/admin/stores/${enc(id)}/settings`),
    updateStoreSettings: (id: string, body: Record<string, unknown>) =>
      req<{ store: any; branding: any }>(`/api/admin/stores/${enc(id)}/settings`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    uploadStoreMedia: (id: string, input: { fileName: string; mimeType: string; dataBase64: string }) =>
      req<{ media: { id: string; url: string; fileName: string; mimeType: string; size: number; width: number; height: number } }>(
        `/api/admin/stores/${enc(id)}/media`,
        { method: "POST", body: JSON.stringify(input) }
      ),
    merchants: () => req<{ merchants: any[] }>("/api/admin/merchants"),
    subscriptionPayments: (opts?: { status?: string }) =>
      req<any>(`/api/admin/subscription-payments${qs(opts ?? {})}`),
    reviewSubscriptionPayment: (id: string, body: { decision: "approve" | "reject"; note?: string }) =>
      req<{ payment: any; store: any }>(`/api/admin/subscription-payments/${enc(id)}/review`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    walletTransactions: (opts?: { status?: string }) =>
      req<any>(`/api/admin/wallet/transactions${qs(opts ?? {})}`),
    reviewWalletTransaction: (id: string, body: { decision: "approve" | "reject"; note?: string }) =>
      req<{ transaction: any; decision: string }>(`/api/admin/wallet/transactions/${enc(id)}/review`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    supportTickets: (opts?: { status?: string }) =>
      req<{ tickets: any[] }>(`/api/admin/support-tickets${qs(opts ?? {})}`),
    updateSupportTicket: (id: string, body: Record<string, unknown>) =>
      req<{ ticket: any }>(`/api/admin/support-tickets/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    reports: (opts?: { from?: string; to?: string }) =>
      req<any>(`/api/admin/reports${qs(opts ?? {})}`),
    domains: () => req<{ domains: any[] }>("/api/admin/domains"),
    verifyDomain: (id: string, verified: boolean, note = "") =>
      req<{ domain: any }>(`/api/admin/domains/${enc(id)}/verify`, {
        method: "POST",
        body: JSON.stringify({ verified, note }),
      }),
    setDomainTls: (id: string, status: "pending" | "active" | "failed", error = "") =>
      req<{ domain: any }>(`/api/admin/domains/${enc(id)}/tls`, {
        method: "POST",
        body: JSON.stringify({ status, error }),
      }),
    audit: (opts?: { actorType?: string; action?: string; storeId?: string }) =>
      req<{ logs: any[]; security_events: any[] }>(`/api/admin/audit${qs(opts ?? {})}`),
    featureFlags: () => req<{ flags: any[] }>("/api/admin/feature-flags"),
    updateFeatureFlag: (key: string, enabled: boolean) =>
      req<{ flag: any }>(`/api/admin/feature-flags/${enc(key)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    admins: () => req<{ admins: any[] }>("/api/admin/admins"),
    createAdmin: (body: { email: string; password: string; name?: string; role: string }) =>
      req<{ admin: any }>("/api/admin/admins", { method: "POST", body: JSON.stringify(body) }),
    updateAdmin: (id: string, body: { role?: string; status?: string }) =>
      req<{ admin: any }>(`/api/admin/admins/${enc(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    leads: () => req<{ leads: any[] }>("/api/admin/leads"),
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
