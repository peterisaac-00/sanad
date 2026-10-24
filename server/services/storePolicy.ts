import { ApiError } from "../errors.js";

/**
 * Store identity and branding are platform-admin controlled. Owners choose
 * them once during onboarding; after publishing, only the admin API may change
 * them. Operational settings (WhatsApp, support email, COD, delivery, etc.)
 * stay with the owner.
 */
export const ADMIN_MANAGED_STORE_FIELDS = [
  "storeName",
  "description",
  "seoTitle",
  "seoDescription",
] as const;

export const OWNER_IDENTITY_LOCKED_MESSAGE =
  "اسم المتجر والوصف والشعار والألوان وإعدادات SEO تُدار من إدارة منصة سند. تواصل مع الإدارة لتعديلها.";

export function adminManagedFieldsIn(body: Record<string, unknown>): string[] {
  return ADMIN_MANAGED_STORE_FIELDS.filter((field) => body[field] !== undefined);
}

export function assertOwnerMayEditStore(body: Record<string, unknown>): void {
  if (adminManagedFieldsIn(body).length > 0) {
    throw new ApiError(409, "STORE_IDENTITY_ADMIN_ONLY", OWNER_IDENTITY_LOCKED_MESSAGE);
  }
}

export function onboardingIdentityTouched(body: Record<string, unknown>): boolean {
  return (
    adminManagedFieldsIn(body).length > 0 ||
    body.templateKey !== undefined ||
    body.branding !== undefined ||
    body.logoUrl !== undefined ||
    body.coverUrl !== undefined
  );
}
