import nodemailer, { type Transporter } from "nodemailer";
import type { Options as SMTPOptions } from "nodemailer/lib/smtp-transport";
import { env } from "../env.js";
import { ApiError } from "../errors.js";
import { logger } from "../logger.js";

/**
 * Transactional email via SMTP (nodemailer). Email is optional: when it is
 * not configured the app reports that honestly instead of pretending a
 * message was sent and discarding the verification/reset link.
 */

let transport: Transporter | null = null;

export function emailConfigured(): boolean {
  return env.email.configured;
}

function getTransport(): Transporter {
  if (!emailConfigured()) {
    throw new ApiError(503, "EMAIL_NOT_CONFIGURED", "Email delivery is not configured on this server.");
  }
  const options: SMTPOptions = {
    // Bound connection attempts so a broken SMTP host cannot hang a request.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  };
  transport ??= nodemailer.createTransport(env.email.smtpUrl, options);
  return transport;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const transporter = getTransport();
  await transporter.sendMail({
    from: env.email.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

/**
 * Try to deliver; never expose SMTP errors to the caller. The account action
 * still succeeds, and the user can request another link.
 */
export async function trySendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    await sendEmail(input);
    return true;
  } catch (err) {
    logger.error({ err }, "email delivery failed");
    return false;
  }
}

export async function sendVerificationEmail(input: { to: string; link: string; ttlMinutes: number }): Promise<boolean> {
  const hours = Math.max(1, Math.round(input.ttlMinutes / 60));
  const text =
    `مرحباً،\n\n` +
    `لتأكيد بريدك الإلكتروني على سند افتح الرابط التالي:\n${input.link}\n\n` +
    `تنتهي صلاحية الرابط بعد ${hours} ساعة. إذا لم تطلب هذا، تجاهل الرسالة.\n\n` +
    `فريق سند`;
  return trySendEmail({
    to: input.to,
    subject: "تأكيد بريدك الإلكتروني — سند",
    text,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#0f172a">
      <p>مرحباً،</p>
      <p>لتأكيد بريدك الإلكتروني على سند اضغط الرابط التالي:</p>
      <p><a href="${escapeHtml(input.link)}">تأكيد البريد الإلكتروني</a></p>
      <p style="color:#64748b;font-size:12px">تنتهي صلاحية الرابط بعد ${hours} ساعة. إذا لم تطلب هذا، تجاهل الرسالة.</p>
      <p>فريق سند</p>
    </div>`,
  });
}

export async function sendPasswordResetEmail(input: { to: string; link: string; ttlMinutes: number }): Promise<boolean> {
  const text =
    `مرحباً،\n\n` +
    `طلبنا إعادة تعيين كلمة المرور لحسابك على سند. افتح الرابط التالي:\n${input.link}\n\n` +
    `تنتهي صلاحية الرابط بعد ${input.ttlMinutes} دقيقة. إذا لم تطلب هذا، تجاهل الرسالة ولن تتغير كلمة المرور.\n\n` +
    `فريق سند`;
  return trySendEmail({
    to: input.to,
    subject: "إعادة تعيين كلمة المرور — سند",
    text,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#0f172a">
      <p>مرحباً،</p>
      <p>طلبنا إعادة تعيين كلمة المرور لحسابك على سند. اضغط الرابط التالي:</p>
      <p><a href="${escapeHtml(input.link)}">إعادة تعيين كلمة المرور</a></p>
      <p style="color:#64748b;font-size:12px">تنتهي صلاحية الرابط بعد ${input.ttlMinutes} دقيقة. إذا لم تطلب هذا، تجاهل الرسالة ولن تتغير كلمة المرور.</p>
      <p>فريق سند</p>
    </div>`,
  });
}
