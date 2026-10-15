import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { ApiError } from "./errors.js";

/**
 * Request validation (body, params, query) with zod.
 * Unknown fields are rejected (.strictObject): clients get a clear 400
 * instead of silently ignored input.
 */

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "valid email is required" });

const subdomainField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,40}$/, { message: "subdomain must be 3-40 chars: a-z, 0-9, hyphen" });

const passwordField = z.string().min(8, { message: "password must be at least 8 characters" }).max(128);

export const registerSchema = z.strictObject({
  email: emailField,
  password: passwordField,
  name: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(32).default(""),
  storeName: z.string().trim().min(2, { message: "storeName is required (min 2 chars)" }).max(120),
  subdomain: subdomainField,
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, { message: "countryCode must be a 2-letter code" }).default("EG"),
  storeCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, { message: "storeCurrency must be a 3-letter code" }).default("EGP"),
  selectedPlan: z.enum(["monthly", "annual"]).default("annual"),
});

export const loginSchema = z.strictObject({
  email: emailField,
  password: z.string().min(1, { message: "password is required" }).max(128),
});

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1, { message: "currentPassword is required" }).max(128),
    newPassword: passwordField,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "newPassword must be different from currentPassword",
    path: ["newPassword"],
  });

export const subdomainParamSchema = z.strictObject({
  subdomain: subdomainField,
});

export const productBodySchema = z.strictObject({
  sku: z.string().trim().min(1, { message: "sku is required" }).max(64),
  name_ar: z.string().trim().max(200).default(""),
  name_en: z.string().trim().max(200).default(""),
  price_egp: z.number().min(0).max(1e12).default(0),
  price_sar: z.number().min(0).max(1e12).default(0),
  stock: z.number().int().min(0).max(1e9).default(0),
});

export const merchantOrderBodySchema = z.strictObject({
  customer_name: z.string().trim().min(1, { message: "customer_name is required" }).max(200),
  city: z.string().trim().max(200).default(""),
  items_summary: z.string().trim().max(1000).default(""),
  amount_text: z.string().trim().max(120).default(""),
  amount_egp: z.number().min(0).max(1e12).default(0),
  payment_method: z.string().trim().max(80).default("COD"),
  status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]).default("pending"),
  courier: z.string().trim().max(200).default(""),
});

export const leadBodySchema = z.strictObject({
  type: z.string().trim().min(1, { message: "type is required" }).max(64),
  payload: z.unknown().default({}),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ---- Phase 3: pagination, product/order detail, checkout, store settings ----

export const paginationQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export const orderListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]).optional(),
  from: z.string().datetime({ message: "from must be an ISO datetime" }).optional(),
  to: z.string().datetime({ message: "to must be an ISO datetime" }).optional(),
});

export const productIdParamSchema = subdomainParamSchema.extend({
  id: z.string().trim().min(1).max(64),
});

export const productUpdateSchema = z
  .strictObject({
    sku: z.string().trim().min(1, { message: "sku is required" }).max(64).optional(),
    name_ar: z.string().trim().max(200).optional(),
    name_en: z.string().trim().max(200).optional(),
    price_egp: z.number().min(0).max(1e12).optional(),
    price_sar: z.number().min(0).max(1e12).optional(),
    stock: z.number().int().min(0).max(1e9).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field must be provided",
  });

export const orderIdParamSchema = subdomainParamSchema.extend({
  id: z.string().trim().min(1).max(64),
});

export const orderStatusSchema = z.strictObject({
  status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
});

/** Valid order status transitions (server-enforced). */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const checkoutItemSchema = z.strictObject({
  sku: z.string().trim().min(1).max(64),
  qty: z.number().int().min(1).max(99),
});

export const checkoutBodySchema = z.strictObject({
  customer_name: z.string().trim().min(1, { message: "customer_name is required" }).max(200),
  city: z.string().trim().max(200).default(""),
  payment_method: z.string().trim().max(80).default("COD"),
  courier: z.string().trim().max(200).default(""),
  items: z.array(checkoutItemSchema).min(1, { message: "at least one item is required" }).max(50),
});

export const storeUpdateSchema = z
  .strictObject({
    storeName: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(32).optional(),
    countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, { message: "countryCode must be a 2-letter code" }).optional(),
    storeCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, { message: "storeCurrency must be a 3-letter code" }).optional(),
    selectedPlan: z.enum(["monthly", "annual"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field must be provided" });

function toDetails(issues: z.core.$ZodIssue[]) {
  return issues.map((i) => ({
    path: (i.path ?? []).join("."),
    message: i.message,
    code: i.code,
  }));
}

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = (schema as unknown as z.ZodType).safeParse(req.body ?? {});
    if (!result.success) {
      next(new ApiError(400, "VALIDATION_ERROR", "Invalid request body.", toDetails(result.error.issues)));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = (schema as unknown as z.ZodType).safeParse(req.params ?? {});
    if (!result.success) {
      next(new ApiError(400, "VALIDATION_ERROR", "Invalid request params.", toDetails(result.error.issues)));
      return;
    }
    req.params = result.data as Request["params"];
    next();
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = (schema as unknown as z.ZodType).safeParse(req.query ?? {});
    if (!result.success) {
      next(new ApiError(400, "VALIDATION_ERROR", "Invalid query params.", toDetails(result.error.issues)));
      return;
    }
    req.query = result.data as Request["query"];
    next();
  };
}
