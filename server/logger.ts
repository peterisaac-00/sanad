import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "./env.js";
import { maskEmail, maskPhone, sanitizeUrlForLogs } from "./privacy.js";

/**
 * Structured logs. Secrets are redacted and customer PII (email/phone,
 * tracking tokens in query strings) is masked before anything is written.
 * Request bodies are never logged at all.
 */

const redactPaths = [
  "req.headers.cookie",
  "req.headers.authorization",
  "res.headers['set-cookie']",
  "req.body.password",
  "req.body.currentPassword",
  "req.body.newPassword",
  "req.body.token",
  "req.body.email",
  "req.body.phone",
  "req.body.customer_phone",
  "req.body.customer_email",
  "body.password",
  "body.currentPassword",
  "body.newPassword",
  "body.token",
  "body.email",
  "body.phone",
  "body.customer_phone",
  "body.customer_email",
  "*.password",
  "*.token",
  "*.secret",
];

export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  formatters: {
    log(object) {
      // DB errors can carry SQL parameters containing phone/email values.
      if (object.phone) object.phone = maskPhone(String(object.phone));
      if (object.email) object.email = maskEmail(String(object.email));
      return object;
    },
  },
});

export const httpLogger = pinoHttp({
  logger,
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        // Never persist ?phone= or ?token= values in access logs.
        url: sanitizeUrlForLogs(req.url),
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
    err: pino.stdSerializers.err,
  },
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
