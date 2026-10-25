/**
 * Stable customer identity helpers.
 *
 * Phones arrive in many shapes (`+20 100 123 4567`, `0100-123-4567`, `0020…`)
 * and using the raw string lets the same shopper bypass per-customer coupon
 * limits or create duplicate customer rows. We keep digits only (and drop the
 * international `00` prefix) for every new order.
 */
export function normalizePhone(input: string | null | undefined): string {
  return String(input ?? "").replace(/\D/g, "").replace(/^00/, "");
}

export function customerIdentity(input: { phone?: string | null; email?: string | null }): string {
  return normalizePhone(input.phone) || String(input.email ?? "").trim().toLowerCase();
}

/** Stable, non-display key used to deduplicate a customer's saved address. */
export function canonicalAddressKey(input: {
  address: string | null | undefined;
  city: string | null | undefined;
  governorate: string | null | undefined;
  phone: string | null | undefined;
}): string {
  const canonical = [input.address, input.city, input.governorate]
    .map((value) => String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " "))
    .concat(normalizePhone(input.phone))
    .join("|");
  return createHash("md5").update(canonical, "utf8").digest("hex");
}
import { createHash } from "node:crypto";
