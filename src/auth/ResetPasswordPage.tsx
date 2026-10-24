import React, { useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { api } from "../lib/api";
import { safeError } from "../lib/format";
import { Link, useQuery } from "../lib/router";
import { Alert, Button, Field, Input } from "../components/ui";
import { AuthShell } from "./AuthShell";

export function ResetPasswordPage() {
  const query = useQuery();
  const token = query.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(safeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      badge="استعادة الحساب"
      title="تعيين كلمة مرور جديدة"
      subtitle="اختر كلمة مرور قوية لم تستخدمها من قبل. سيتم إنهاء جميع الجلسات الأخرى بعد الحفظ."
      footer={
        <>
          العودة إلى{" "}
          <Link href="/auth/login" className="font-bold text-brand hover:text-brand">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      {!token ? (
        <div className="space-y-4">
          <Alert tone="error" title="رابط غير مكتمل">
            رابط إعادة التعيين لا يحتوي على رمز صالح. اطلب رابطاً جديداً من صفحة نسيت كلمة المرور.
          </Alert>
          <Link
            href="/auth/forgot-password"
            className="flex w-full items-center justify-center gap-2 rounded-brand border border-line bg-surface px-4 py-2.5 text-xs font-bold text-ink"
          >
            طلب رابط جديد
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      ) : done ? (
        <div className="space-y-4">
          <Alert tone="success" title="تم تعيين كلمة المرور">
            يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة. جميع الجلسات السابقة تم إنهاؤها لحماية حسابك.
          </Alert>
          <Link
            href="/auth/login"
            className="flex w-full items-center justify-center gap-2 rounded-brand bg-brand px-4 py-3 text-sm font-bold text-on-brand"
          >
            <CheckCircle2 className="h-4 w-4" />
            الدخول إلى حسابك
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="كلمة المرور الجديدة" required hint="8 أحرف على الأقل">
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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
          <Field label="تأكيد كلمة المرور" required>
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              required
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            {submitting ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}
          </Button>
          <p className="text-center text-[10px] leading-5 text-subtle">
            لا يمكن استخدام رابط الاستعادة أكثر من مرة واحدة. إذا انتهت صلاحيته فاطلب رابطاً جديداً.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
