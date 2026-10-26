import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { presentApiError, safeError } from "../src/lib/format.js";

/**
 * Phase 6 UX/accessibility contract.
 *
 * These checks are intentionally source-level where a browser is not available:
 * they lock in the error taxonomy, mutation guards and RTL/responsive layout
 * safeguards that prevent clipping and duplicate submissions. Behavioural
 * concurrency (stock, coupons, refunds) lives in the Phase 1 suites.
 */
const source = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("R7.10 — error taxonomy maps statuses to real user actions", () => {
  const cases: Array<[number, string, boolean]> = [
    [401, "login", false],
    [403, "back", false],
    [404, "back", false],
    [409, "check", true],
    [429, "retry", true],
    [500, "retry", true],
    [503, "retry", true],
  ];

  it.each(cases)("HTTP %i → %s action (retryable=%s)", (status, action, retryable) => {
    const presented = presentApiError({ status, message: "x" });
    expect(presented.action).toBe(action);
    expect(presented.retryable).toBe(retryable);
    expect(presented.title.length).toBeGreaterThan(0);
    expect(presented.message).not.toMatch(/request failed/i);
  });

  it("treats a network failure like a retryable server error", () => {
    expect(presentApiError({ status: 0, code: "NETWORK_ERROR" }).action).toBe("retry");
  });

  it("routes every HTTP status through the taxonomy instead of a generic message", () => {
    for (const status of [401, 403, 404, 409, 429, 500]) {
      expect(safeError({ status, message: "Request failed (x)" })).toBe(presentApiError({ status }).message);
    }
  });

  it("keeps domain-specific guidance ahead of generic status copy", () => {
    expect(safeError({ status: 401, code: "INVALID_CREDENTIALS", message: "Request failed (401)" })).toContain("كلمة المرور");
    expect(safeError({ status: 409, code: "SUBDOMAIN_TAKEN", message: "Request failed (409)" })).toContain("رابط المتجر");
    expect(safeError({ status: 403, code: "TEAM_MEMBER_SUSPENDED", message: "Request failed (403)" })).toContain("موقوف");
  });

  it("clears stale session state only when the server reports an expired session", () => {
    const api = source("src/lib/api.ts");
    expect(api).toContain('"sanad:unauthorized"');
    expect(api).toContain('error.code === "UNAUTHENTICATED"');
    expect(source("src/lib/session.tsx")).toContain('"sanad:unauthorized"');
  });

  it("does not surface raw error messages from interactive error paths", () => {
    const files = [
      "src/components/ImageUploader.tsx",
      "src/storefront/StorefrontProductsPages.tsx",
      "src/storefront/StorefrontUI.tsx",
    ];
    for (const file of files) {
      const text = source(file);
      expect(text, `${file} should use safeError`).toContain("safeError");
      expect(text, `${file} must not render err.message directly`).not.toMatch(/err\?\.message/);
    }
    // Bilingual marketing/auth modals use safeError for Arabic and keep their
    // English fallback; both paths must still be present.
    for (const file of ["src/components/StoreCreationModal.tsx", "src/components/LoginModal.tsx"]) {
      expect(source(file)).toContain("safeError");
    }
  });

  it("exposes a shared error state with an action button", () => {
    const ui = source("src/components/ui.tsx");
    expect(ui).toContain("export function ErrorState");
    expect(ui).toContain("presentApiError");
    expect(source("src/dashboard/DashboardHome.tsx")).toContain("<ErrorState");
    expect(source("src/dashboard/pages/OrdersPages.tsx")).toContain("<ErrorState");
  });
});

describe("R7.5 — mutations cannot fire twice from one click", () => {
  it("checkout guards with a ref before the async request", () => {
    const checkout = source("src/storefront/StorefrontCheckoutPages.tsx");
    expect(checkout).toContain("submitInFlight.current");
    expect(checkout).toContain("if (submitInFlight.current) return;");
    expect(checkout).toContain("disabled={submitting");
  });

  it("product save and coupon save guard with refs and show loading", () => {
    const products = source("src/dashboard/pages/ProductsPages.tsx");
    expect(products).toContain("saveInFlight.current");
    expect(products).toContain("loading={busy}");
    const coupons = source("src/dashboard/pages/CouponsPage.tsx");
    expect(coupons).toContain("saveInFlight.current");
    expect(coupons).toContain("loading={saving}");
    expect(coupons).toContain("toggleBusyId");
  });

  it("settings, order status, notes and refunds are explicitly gated", () => {
    const settings = source("src/dashboard/pages/SettingsPage.tsx");
    expect(settings).toContain("saveInFlight.current");
    expect(settings).toContain("loading={saving}");
    expect(settings).toContain("memberBusyId");
    const orders = source("src/dashboard/pages/OrdersPages.tsx");
    expect(orders).toContain("busyRef.current");
    expect(orders).toContain("noteBusyRef.current");
    expect(orders).toContain("refundBusyRef.current");
    expect(orders).toContain("loading={busy}");
    expect(orders).toContain("loading={noteBusy}");
  });
});

describe("R7.9 — RTL and mixed-text layout safeguards", () => {
  it("renders the document as Arabic RTL", () => {
    const html = source("index.html");
    expect(html).toMatch(/<html[^>]+lang="ar"/);
    expect(html).toMatch(/<html[^>]+dir="rtl"/);
    expect(source("src/dashboard/DashboardShell.tsx")).toContain('dir="rtl"');
  });

  it("keeps wide dashboard tables scrollable instead of clipping at 320px", () => {
    const common = source("src/dashboard/common.tsx");
    expect(common).toContain("overflow-x-auto");
    expect(common).toContain("minWidth");
    expect(common).toContain("break-words");
    expect(common).toContain("[overflow-wrap:anywhere]");
  });

  it("uses readable mobile navigation labels (12px) and truncates account text", () => {
    const shell = source("src/dashboard/DashboardShell.tsx");
    expect(shell).toMatch(/flex items-center gap-2\.5 rounded-brand px-2\.5 py-2 text-xs/);
    expect(shell).toContain("truncate text-[11px] font-semibold text-ink");
    expect(shell).toContain("w-[286px]");
  });

  it("keeps long product/customer identifiers in LTR without overflow", () => {
    const orders = source("src/dashboard/pages/OrdersPages.tsx");
    expect(orders).toMatch(/dir="ltr"/);
    expect(source("src/dashboard/pages/SettingsPage.tsx")).toContain("break-all font-mono");
    expect(source("src/dashboard/common.tsx")).toContain("whitespace-nowrap");
  });
});

describe("R7.6 — external links remain protected", () => {
  it("every dashboard target=_blank link carries rel=noopener noreferrer", () => {
    const files = [
      "src/dashboard/DashboardShell.tsx",
      "src/dashboard/pages/OrdersPages.tsx",
      "src/dashboard/pages/ProductsPages.tsx",
      "src/dashboard/pages/SettingsPage.tsx",
      "src/storefront/StorefrontApp.tsx",
    ];
    for (const file of files) {
      const text = source(file);
      for (const match of text.matchAll(/<a\b[\s\S]*?target="_blank"[\s\S]*?>/g)) {
        expect(match[0], `${file} has an unprotected external link`).toContain('rel="noopener noreferrer"');
      }
    }
  });
});
