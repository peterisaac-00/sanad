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
