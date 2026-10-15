import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "./env.js";

export const logger = pino({
  level: env.logLevel,
  // Never log credentials: cookies, authorization headers, and password fields are redacted.
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "req.body.password",
      "req.body.currentPassword",
      "req.body.newPassword",
      "body.password",
      "body.currentPassword",
      "body.newPassword",
    ],
    censor: "[REDACTED]",
  },
});

export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
