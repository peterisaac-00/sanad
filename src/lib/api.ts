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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw parseError(res.status, data);
  return data as T;
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
  selectedPlan?: "monthly" | "annual";
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

  summary: (subdomain: string) => req<any>(`/api/stores/${subdomain}/summary`),

  orders: (subdomain: string) => req<{ orders: any[] }>(`/api/stores/${subdomain}/orders`),

  products: (subdomain: string) => req<{ products: any[] }>(`/api/stores/${subdomain}/products`),

  lead: (type: string, payload: unknown) =>
    req<{ ok: boolean; id: string }>("/api/leads", { method: "POST", body: JSON.stringify({ type, payload }) }),
};
