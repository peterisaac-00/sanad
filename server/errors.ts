import type { Request, Response, NextFunction } from "express";
import { env } from "./env.js";
import { logger } from "./logger.js";

/** Consistent JSON error shape returned by every API endpoint. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
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

/** Wrap async route handlers so rejections reach the centralized error handler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    res.status(err.status).json(body);
    return;
  }

  // Unexpected failure: log with request context, never leak internals to clients.
  // CORS rejections get a proper 403 JSON shape instead of a 500.
  if (err instanceof Error && /cors/i.test(err.message)) {
    res.status(403).json({
      error: { code: "CORS_ORIGIN_REJECTED", message: "Origin not allowed." },
    } satisfies ApiErrorBody);
    return;
  }
  logger.error({ err, method: req.method, path: req.path }, "unhandled error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: env.isProduction ? "Internal server error." : String((err as Error)?.message || err),
    },
  } satisfies ApiErrorBody);
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
  } satisfies ApiErrorBody);
}
