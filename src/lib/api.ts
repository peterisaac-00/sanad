const BASE = (import.meta as any).env?.VITE_API_URL || "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data as T;
}

export interface StorePayload {
  storeName: string;
  subdomain: string;
  phone: string;
  countryCode: string;
  storeCurrency: string;
  selectedPlan: "monthly" | "annual";
}

export const api = {
  health: () => req<{ ok: boolean }>("/api/health"),
  createStore: (p: StorePayload) =>
    req<{ store: any }>("/api/stores", { method: "POST", body: JSON.stringify(p) }),
  getStore: (subdomain: string) => req<{ store: any }>(`/api/stores/${subdomain}`),
  login: (email: string, password: string, storeHandle: string) =>
    req<{ token: string; merchant: any; store: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, storeHandle }),
    }),
  register: (email: string, password: string, storeHandle: string, name = "", phone = "") =>
    req<{ token: string; merchant: any; store: any }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, storeHandle, name, phone }),
    }),
  summary: (subdomain: string) => req<any>(`/api/stores/${subdomain}/summary`),
  orders: (subdomain: string) => req<{ orders: any[] }>(`/api/stores/${subdomain}/orders`),
  products: (subdomain: string) => req<{ products: any[] }>(`/api/stores/${subdomain}/products`),
  lead: (type: string, payload: unknown) =>
    req<{ ok: boolean; id: string }>("/api/leads", { method: "POST", body: JSON.stringify({ type, payload }) }),
};

export function saveSession(token: string) {
  try {
    localStorage.setItem("sanad_token", token);
  } catch { /* ignore */ }
}

export function getSession(): string | null {
  try {
    return localStorage.getItem("sanad_token");
  } catch {
    return null;
  }
}
