/**
 * Typed API client. Authentication uses an httpOnly session cookie set by
 * the server (credentials: "include"), so no token is ever stored in
 * JavaScript-accessible storage.
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
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (res.status === 204) return {} as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw parseError(res.status, data);
  return data as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  storeName: string;
  subdomain: string;
  countryCode?: string;
  storeCurrency?: string;
}

export interface ProductInput {
  sku: string;
  name_ar?: string;
  name_en?: string;
  price_egp?: number;
  price_sar?: number;
  stock?: number;
}

export interface CheckoutInput {
  customer_name: string;
  city?: string;
  payment_method?: string;
  courier?: string;
  items: { sku: string; qty: number }[];
}

export const api = {
  health: () => req<{ ok: boolean }>("/api/health"),

  register: (p: RegisterPayload) =>
    req<{ merchant: any; store: any }>("/api/auth/register", { method: "POST", body: JSON.stringify(p) }),

  login: (email: string, password: string) =>
    req<{ merchant: any; store: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  me: () => req<{ merchant: any; store: any }>("/api/auth/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: boolean }>("/api/auth/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  getStore: (subdomain: string) => req<{ store: any }>(`/api/stores/${subdomain}`),

  myStores: () => req<{ stores: any[] }>("/api/stores"),

  accountStore: () => req<{ store: any }>("/api/account/store"),

  updateAccountStore: (body: Record<string, unknown>) =>
    req<{ store: any }>("/api/account/store", { method: "PATCH", body: JSON.stringify(body) }),

  summary: (subdomain: string) => req<any>(`/api/stores/${subdomain}/summary`),

  orders: {
    list: (subdomain: string, opts?: { page?: number; pageSize?: number; status?: string; from?: string; to?: string }) =>
      req<{ orders: any[]; pagination: any }>(`/api/stores/${subdomain}/orders${qs(opts ?? {})}`),
    get: (subdomain: string, id: string) => req<{ order: any }>(`/api/stores/${subdomain}/orders/${id}`),
    setStatus: (subdomain: string, id: string, status: string) =>
      req<{ order: any }>(`/api/stores/${subdomain}/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    checkout: (subdomain: string, body: CheckoutInput) =>
      req<{ order: any }>(`/api/stores/${subdomain}/checkout`, { method: "POST", body: JSON.stringify(body) }),
  },

  products: {
    list: (subdomain: string, opts?: { page?: number; pageSize?: number; search?: string }) =>
      req<{ products: any[]; pagination: any }>(`/api/stores/${subdomain}/products${qs(opts ?? {})}`),
    get: (subdomain: string, id: string) => req<{ product: any }>(`/api/stores/${subdomain}/products/${id}`),
    create: (subdomain: string, body: ProductInput) =>
      req<{ product: any }>(`/api/stores/${subdomain}/products`, { method: "POST", body: JSON.stringify(body) }),
    update: (subdomain: string, id: string, body: Partial<ProductInput>) =>
      req<{ product: any }>(`/api/stores/${subdomain}/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    remove: (subdomain: string, id: string) =>
      req<{ ok: boolean }>(`/api/stores/${subdomain}/products/${id}`, { method: "DELETE" }),
  },

  myLeads: () => req<{ leads: any[] }>("/api/leads"),

  lead: (type: string, payload: unknown) =>
    req<{ ok: boolean; id: string }>("/api/leads", { method: "POST", body: JSON.stringify({ type, payload }) }),
};
