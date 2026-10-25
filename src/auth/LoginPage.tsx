import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { safeError } from "../lib/format";
import { Link, navigate, useQuery } from "../lib/router";
import { safeNextPath, useSession } from "../lib/session";
import { Alert, Button, Field, Input } from "../components/ui";
import { AuthShell } from "./AuthShell";

type Phase = "credentials" | "second-factor";

export function LoginPage() {
  const { session, loading, refresh } = useSession();
  const query = useQuery();
  const nextParam = query.get("next");
  const [phase, setPhase] = useState<Phase>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // A draft store has no console yet, regardless of the ?next= hint: finish
  // onboarding (design + publish) before any dashboard destination is allowed.
  // Platform administrators use their own identity and session at /admin; a
  // merchant login can never be redirected into that trust boundary.
  const destination = (payload: { merchant?: any; store?: any } | null) => {
    return payload?.store?.onboardingCompleted ? safeNextPath(nextParam, "/dashboard") : "/onboarding";
  };

  useEffect(() => {
    if (!loading && session) navigate(destination(session), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  useEffect(() => {
    if (phase === "second-factor") codeRef.current?.focus();
  }, [phase, recoveryMode]);

  const finishLogin = async (result: { merchant: any; store: any }) => {
    const canonical = await refresh();
    navigate(destination(canonical ?? result), { replace: true });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNeedsVerification(false);

    if (phase === "credentials") {
      if (!email.trim() || !password) {
        setError("أدخل البريد الإلكتروني وكلمة المرور.");
        return;
      }
      setSubmitting(true);
      try {
        const result = await api.login(email.trim().toLowerCase(), password);
        await finishLogin(result);
      } catch (err: any) {
        if (err?.code === "TWO_FACTOR_REQUIRED") {
          setPhase("second-factor");
          setCode("");
        } else {
          if (err?.code === "EMAIL_NOT_VERIFIED") setNeedsVerification(true);
          setError(safeError(err));
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const normalized = recoveryMode ? code.trim() : code.replace(/\D/g, "");
    if (recoveryMode ? normalized.length < 8 : normalized.length !== 6) {
      setError(recoveryMode ? "أدخل رمز استرداد صالحاً." : "أدخل الرمز المكوّن من 6 أرقام.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.login(
        email.trim().toLowerCase(),
        password,
        recoveryMode ? { recovery_code: normalized } : { totp: normalized }
      );
      await finishLogin(result);
    } catch (err: any) {
      setError(safeError(err));
      if (err?.code === "INVALID_TWO_FACTOR_CODE") setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  const backToCredentials = () => {
    setPhase("credentials");
    setCode("");
    setRecoveryMode(false);
    setError("");
  };

  return (
    <AuthShell
      badge="بوابة التاجر"
      title={phase === "credentials" ? "تسجيل الدخول" : "التحقق بخطوة ثانية"}
      subtitle={
        phase === "credentials"
          ? "أدخل بيانات حسابك للوصول إلى لوحة تحكم متجرك ومتابعة الطلبات."
          : "أدخل الرمز من تطبيق المصادقة لإكمال تسجيل الدخول. هذه الخطوة تحمي حسابك حتى لو عُرفت كلمة المرور."
      }
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link href="/auth/register" className="font-bold text-brand hover:text-brand">
            أنشئ حساباً جديداً
          </Link>
          <div className="mt-3 border-t border-line pt-3 text-[10px] text-subtle">
            عضو فريق مدعو؟{" "}
            <Link href="/team/login" className="font-semibold text-brand hover:underline">دخول الفريق</Link>
            <span className="mx-1.5">·</span>
            مدير منصة؟{" "}
            <Link href="/admin" className="font-semibold text-brand hover:underline">دخول الإدارة</Link>
          </div>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? (
          <Alert tone="error">
            <div className="space-y-2">
              <div>{error}</div>
              {needsVerification ? (
                <Link
                  href={`/auth/verify-email${email.trim() ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : ""}`}
                  className="inline-flex items-center gap-1 text-[11px] font-bold underline"
                >
                  إعادة إرسال رابط التحقق
                  <ArrowLeft className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          </Alert>
        ) : null}

        {phase === "credentials" ? (
          <>
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

            <Field label="كلمة المرور" required>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pe-10 ps-10"
                  dir="ltr"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute start-2 top-1/2 -translate-y-1/2 rounded-brand-sm p-1.5 text-subtle hover:bg-surface hover:text-ink"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          </>
        ) : (
          <>
            <div className="rounded-brand border border-line bg-surface px-3 py-2.5 text-[11px] text-subtle">
              تسجيل الدخول باسم <span className="font-semibold text-ink" dir="ltr">{email.trim().toLowerCase()}</span>
            </div>

            <Field
              label={recoveryMode ? "رمز الاسترداد" : "رمز تطبيق المصادقة"}
              required
              hint={recoveryMode ? "أدخل أحد رموز الاسترداد التي حفظتها عند تفعيل المصادقة." : "6 أرقام تتغير كل 30 ثانية."}
            >
              <div className="relative">
                <KeyRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <Input
                  ref={codeRef}
                  value={code}
                  onChange={(e) => setCode(recoveryMode ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={recoveryMode ? "XXXX-XXXX" : "123456"}
                  className="pe-10 ps-10 font-mono tracking-[0.35em]"
                  dir="ltr"
                  inputMode={recoveryMode ? "text" : "numeric"}
                  autoComplete={recoveryMode ? "off" : "one-time-code"}
                  maxLength={recoveryMode ? 32 : 6}
                  required
                />
              </div>
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-subtle">
              <button
                type="button"
                onClick={backToCredentials}
                className="inline-flex items-center gap-1 font-semibold hover:text-ink"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                العودة إلى كلمة المرور
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecoveryMode((v) => !v);
                  setCode("");
                  setError("");
                }}
                className="font-semibold hover:text-ink"
              >
                {recoveryMode ? "استخدام رمز التطبيق" : "استخدام رمز استرداد"}
              </button>
            </div>
          </>
        )}

        {phase === "credentials" ? (
          <div className="flex items-center justify-between text-[11px] text-subtle">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              جلسة آمنة عبر كوكي httpOnly
            </span>
            <Link href="/auth/forgot-password" className="hover:text-ink">نسيت كلمة المرور؟</Link>
          </div>
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting
            ? phase === "credentials"
              ? "جارٍ تسجيل الدخول…"
              : "جارٍ التحقق…"
            : phase === "credentials"
              ? "دخول إلى لوحة التحكم"
              : "تأكيد الرمز والدخول"}
          {!submitting ? <ArrowLeft className="h-4 w-4" /> : null}
        </Button>
      </form>

      {phase === "credentials" ? (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link href="/auth/register" className="rounded-brand border border-line bg-surface px-3 py-3 text-center transition hover:border-brand-line hover:bg-brand-soft">
            <div className="text-xs font-bold text-ink">حساب جديد</div>
            <div className="mt-0.5 text-[10px] text-subtle">ابدأ متجرك مجاناً</div>
          </Link>
          <Link href="/" className="rounded-brand border border-line bg-surface px-3 py-3 text-center transition hover:border-brand-line hover:bg-brand-soft">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-ink">استكشف سند</div>
            <div className="mt-0.5 text-[10px] text-subtle">تعرف على المنصة</div>
          </Link>
        </div>
      ) : (
        <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-subtle">
          <Loader2 className="hidden h-3 w-3" />
          لا تشارك رمز المصادقة مع أي شخص، ولا يطلبه منك فريق سند أبداً.
        </div>
      )}
    </AuthShell>
  );
}
