import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, Send, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { safeError } from "../lib/format";
import { Link, navigate, useQuery } from "../lib/router";
import { useSession } from "../lib/session";
import { Alert, Button, Field, Input } from "../components/ui";
import { AuthShell } from "./AuthShell";

type Status = "idle" | "verifying" | "success" | "error";

export function VerifyEmailPage() {
  const query = useQuery();
  const token = query.get("token") || "";
  const { session } = useSession();
  const [email, setEmail] = useState(query.get("email") || "");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "idle");
  const [error, setError] = useState("");
  const [resendError, setResendError] = useState("");
  const [resent, setResent] = useState(false);
  const [debugToken, setDebugToken] = useState("");
  const [resending, setResending] = useState(false);
  const attempt = useRef<Promise<{ ok: boolean; email_verified: boolean }> | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    if (!attempt.current) attempt.current = api.verifyEmail(token);
    attempt.current
      .then(() => {
        if (!alive) return;
        setStatus("success");
        setError("");
      })
      .catch((err: any) => {
        if (!alive) return;
        setStatus("error");
        setError(
          err?.code === "VERIFICATION_INVALID"
            ? "رابط التحقق غير صالح أو انتهت صلاحيته أو تم استخدامه من قبل. اطلب رابطاً جديداً بالأسفل."
            : safeError(err)
        );
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    setResendError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setResendError("أدخل البريد الإلكتروني المرتبط بحسابك.");
      return;
    }
    setResending(true);
    try {
      const result = await api.resendVerification(email.trim().toLowerCase());
      setResent(true);
      setDebugToken(result.debug_token || "");
    } catch (err: any) {
      setResendError(safeError(err));
    } finally {
      setResending(false);
    }
  };

  const resendForm = (
    <form onSubmit={resend} className="space-y-3">
      {resendError ? <Alert tone="error">{resendError}</Alert> : null}
      {resent ? (
        <Alert tone="success" title="تمت المحاولة">
          إذا كان الحساب يحتاج تحققاً فسيصلك رابط جديد. لا نكشف حالة البريد المسجل.
        </Alert>
      ) : null}
      {debugToken ? (
        <div className="rounded-brand border border-warning-line bg-warning-soft p-3 text-[11px] leading-6 text-warning">
          <div className="font-bold">بيئة تطوير فقط — لم يُرسل بريد فعلي.</div>
          <Link
            href={`/auth/verify-email?token=${encodeURIComponent(debugToken)}`}
            className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] underline"
            dir="ltr"
          >
            فتح رابط التحقق
            <ArrowLeft className="h-3 w-3" />
          </Link>
        </div>
      ) : null}
      <Field label="البريد الإلكتروني" required>
        <div className="relative">
          <Mail className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@store.com"
            className="pe-10 ps-10"
            dir="ltr"
            required
          />
        </div>
      </Field>
      <Button type="submit" className="w-full" loading={resending}>
        {resending ? "جارٍ الإرسال…" : "إعادة إرسال رابط التحقق"}
        {!resending ? <Send className="h-4 w-4" /> : null}
      </Button>
    </form>
  );

  return (
    <AuthShell
      badge="تأكيد البريد"
      title="التحقق من البريد الإلكتروني"
      subtitle="نؤكد أن البريد يخصك قبل منح الحساب صلاحية كاملة. الرابط صالح لفترة قصيرة ولا يعمل إلا مرة واحدة."
      footer={
        <>
          لديك حساب مؤكد؟{" "}
          <Link href="/auth/login" className="font-bold text-brand hover:text-brand">
            سجّل الدخول
          </Link>
        </>
      }
    >
      {status === "verifying" ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-brand" />
          <div className="text-sm font-semibold text-ink">جارٍ التحقق من الرابط…</div>
          <div className="text-[11px] text-subtle">لن يستغرق الأمر سوى لحظة.</div>
        </div>
      ) : status === "success" ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="text-base font-bold text-ink">تم تأكيد بريدك بنجاح</div>
            <p className="text-[11px] leading-6 text-subtle">
              أصبح حسابك مؤكداً. يمكنك الآن تسجيل الدخول واستخدام كل مزايا لوحة التحكم.
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => navigate(session ? (session.store?.onboardingCompleted ? "/dashboard" : "/onboarding") : "/auth/login")}
          >
            {session ? "الانتقال إلى لوحة التحكم" : "تسجيل الدخول"}
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {status === "error" ? (
            <Alert tone="error" title="تعذر التحقق">
              {error || "رابط التحقق غير صالح. اطلب رابطاً جديداً بالأسفل."}
            </Alert>
          ) : (
            <Alert tone="info" title="افتح الرابط من بريدك">
              إذا وصلت إلى هذه الصفحة بدون رابط، اطلب رسالة تحقق جديدة بالأسفل ثم افتح الرابط من بريدك.
            </Alert>
          )}
          {resendForm}
          <p className="flex items-start gap-1.5 text-[10px] leading-5 text-subtle">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            لا نرسل كلمات المرور عبر البريد، ولا نطلب منك مشاركة أي رمز تحقق مع فريق الدعم.
          </p>
        </div>
      )}
    </AuthShell>
  );
}
