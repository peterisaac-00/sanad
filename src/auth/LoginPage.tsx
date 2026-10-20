import React, { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { api } from "../lib/api";
import { safeError } from "../lib/format";
import { Link, navigate, useQuery } from "../lib/router";
import { safeNextPath, useSession } from "../lib/session";
import { Alert, Button, Field, Input } from "../components/ui";
import { AuthShell } from "./AuthShell";

export function LoginPage() {
  const { session, loading, setSession } = useSession();
  const query = useQuery();
  const nextParam = query.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const destination = (store: any) =>
    safeNextPath(nextParam, store?.onboardingCompleted ? "/dashboard" : "/onboarding");

  useEffect(() => {
    if (!loading && session) navigate(destination(session.store), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("أدخل البريد الإلكتروني وكلمة المرور.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.login(email.trim().toLowerCase(), password);
      setSession(result);
      navigate(destination(result.store), { replace: true });
    } catch (err: any) {
      setError(safeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      badge="بوابة التاجر"
      title="تسجيل الدخول"
      subtitle="أدخل بيانات حسابك للوصول إلى لوحة تحكم متجرك ومتابعة الطلبات."
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link href="/auth/register" className="font-bold text-blue-400 hover:text-blue-300">
            أنشئ حساباً جديداً
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field label="البريد الإلكتروني" required>
          <div className="relative">
            <Mail className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@store.com"
              className="pe-10"
              dir="ltr"
              required
            />
          </div>
        </Field>

        <Field label="كلمة المرور" required>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
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
              className="absolute start-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole className="h-3 w-3" />
            جلسة آمنة عبر كوكي httpOnly
          </span>
          <Link href="/auth/register" className="hover:text-slate-300">نسيت كلمة المرور؟</Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? "جارٍ تسجيل الدخول…" : "دخول إلى لوحة التحكم"}
          {!submitting ? <ArrowLeft className="h-4 w-4" /> : null}
        </Button>
      </form>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link href="/auth/register" className="rounded-xl border border-slate-700/80 bg-slate-950/40 px-3 py-3 text-center transition hover:border-blue-500/50 hover:bg-slate-900">
          <div className="text-xs font-bold text-white">حساب جديد</div>
          <div className="mt-0.5 text-[10px] text-slate-500">ابدأ متجرك مجاناً</div>
        </Link>
        <Link href="/" className="rounded-xl border border-slate-700/80 bg-slate-950/40 px-3 py-3 text-center transition hover:border-blue-500/50 hover:bg-slate-900">
          <div className="flex items-center justify-center gap-1 text-xs font-bold text-white">استكشف سند</div>
          <div className="mt-0.5 text-[10px] text-slate-500">تعرف على المنصة</div>
        </Link>
      </div>
    </AuthShell>
  );
}
