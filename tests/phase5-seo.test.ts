import { describe, expect, it } from "vitest";
import { marketingSitemap, absoluteStoreUrl } from "../server/services/seo.js";
import { SUPPORTED_STORE_CURRENCIES, registerSchema, storeUpdateSchema } from "../server/validate.js";

describe("Phase 5 public discovery and currency contracts", () => {
  it("builds canonical store URLs without hash routes", () => {
    const store = { subdomain: "demo-shop", customDomain: null };
    expect(absoluteStoreUrl(store)).toContain("/store/demo-shop");
    expect(absoluteStoreUrl(store, "/products/tee")).toContain("/store/demo-shop/products/tee");
    expect(absoluteStoreUrl({ ...store, customDomain: "shop.example.com" }, "/products/tee")).toBe("https://shop.example.com/products/tee");
  });

  it("emits a crawlable marketing sitemap", () => {
    const sitemap = marketingSitemap();
    expect(sitemap).toContain("<urlset");
    expect(sitemap).toContain("/auth/register");
    expect(sitemap).not.toContain("#/" );
  });

  it("accepts only currencies backed by product pricing and checkout", () => {
    expect(SUPPORTED_STORE_CURRENCIES).toEqual(["EGP", "SAR"]);
    expect(registerSchema.parse({ email: "merchant@example.com", password: "password123", storeCurrency: "SAR" }).storeCurrency).toBe("SAR");
    expect(() => registerSchema.parse({ email: "merchant@example.com", password: "password123", storeCurrency: "AED" })).toThrow();
    expect(() => storeUpdateSchema.parse({ storeCurrency: "AED" })).toThrow();
  });
});
