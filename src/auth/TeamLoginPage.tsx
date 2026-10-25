import React, { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Users } from "lucide-react";
import { api } from "../lib/api";
import { safeError } from "../lib/format";
import { Link, navigate, useQuery } from "../lib/router";
import { useSession } from "../lib/session";
import { Alert, Button, Field, Input } from "../components/ui";
import { AuthShell } from "./AuthShell";

export function TeamLoginPage() {
  const { session, loading, setSession } = useSession();
  const query = useQuery();
  const accepted = query.get("accepted") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session?.principal_type === "team") navigate("/dashboard", { replace: true });
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
      await api.team.login(email.trim().toLowerCase(), password);
      const me = await api.me();
      setSession(me);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(safeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      badge="دخول فريق المتجر"
      title="تسجيل دخول الفريق"
      subtitle="للأعضاء المدعوين من مالك المتجر. استخدم البريد الإلكتروني الذي وصلتك عليه الدعوة."
      footer={
        <>
          ليس لديك دعوة؟{" "}
          <Link href="/auth/login" className="font-bold text-brand hover:text-brand">
            دخول التاجر
          </Link>
          <span className="mx-1.5 text-line">·</span>
          <Link href="/" className="font-semibold text-subtle hover:text-ink">
            الرئيسية
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {accepted ? (
          <Alert tone="success" title="تم قبول الدعوة">
            تم إنشاء حسابك في فريق المتجر. سجّل الدخول الآن بالبريد وكلمة المرور اللذين اخترتهما.
          </Alert>
        ) : null}

        {session?.principal_type === "team" ? null : session?.merchant ? (
          <Alert tone="info" title="أنت مسجل بالفعل كتاجر">
            المتابعة كعضو فريق ستستبدل جلسة التاجر على هذا المتصفح.
          </Alert>
        ) : null}

        {error ? <Alert tone="error">{error}</Alert> : null}

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

        <div className="flex items-center justify-between gap-2 text-[11px] text-subtle">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            جلسة آمنة عبر كوكي httpOnly
          </span>
          <span>نسيت كلمة المرور؟ اطلب من مالك المتجر دعوة جديدة.</span>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? "جارٍ تسجيل الدخول…" : "دخول إلى لوحة الفريق"}
          {!submitting ? <ArrowLeft className="h-4 w-4" /> : null}
        </Button>
      </form>

      <div className="mt-5 rounded-brand border border-line bg-surface p-3 text-[11px] leading-6 text-subtle">
        <div className="flex items-start gap-2">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          <span>
            صلاحياتك يحددها مالك المتجر. إذا تغيّر دورك أو أُوقف حسابك، فستحتاج إلى تحديث الدخول.
          </span>
        </div>
      </div>
    </AuthShell>
  );
}
