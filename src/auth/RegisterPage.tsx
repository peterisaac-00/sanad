import React, { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, Phone, User } from "lucide-react";
import { api } from "../lib/api";
import { safeError } from "../lib/format";
import { Link, navigate } from "../lib/router";
import { useSession } from "../lib/session";
import { Alert, Button, Field, Input } from "../components/ui";
import { AuthShell } from "./AuthShell";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

const initialForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
};

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.firstName.trim()) errors.firstName = "الاسم الأول مطلوب.";
  if (!form.lastName.trim()) errors.lastName = "اسم العائلة مطلوب.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "أدخل بريداً إلكترونياً صحيحاً.";
  if (form.phone.replace(/\D/g, "").length < 8) errors.phone = "أدخل رقم هاتف صحيحاً.";
  if (form.password.length < 8) errors.password = "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
  if (form.confirmPassword !== form.password) errors.confirmPassword = "كلمتا المرور غير متطابقتين.";
  if (!form.acceptTerms) errors.acceptTerms = "يجب الموافقة على الشروط للمتابعة.";
  return errors;
}

export function RegisterPage() {
  const { session, loading, setSession } = useSession();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate(session.store?.onboardingCompleted ? "/dashboard" : "/onboarding", { replace: true });
    }
  }, [loading, session]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const result = await api.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        acceptTerms: true,
      });
      setSession({ merchant: result.merchant, store: result.store });
      navigate("/onboarding", { replace: true });
    } catch (err: any) {
      setError(safeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      badge="ابدأ في دقيقة"
      title="إنشاء حساب جديد"
      subtitle="أنشئ حساب التاجر الآن، ثم أكمل بيانات متجرك خلال خطوات قصيرة قبل النشر."
      footer={
        <>
          لديك حساب بالفعل؟{" "}
          <Link href="/auth/login" className="font-bold text-blue-400 hover:text-blue-300">
            سجّل الدخول
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم الأول" required error={errors.firstName}>
            <div className="relative">
              <User className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="محمد" className="pe-9" autoComplete="given-name" />
            </div>
          </Field>
          <Field label="اسم العائلة" required error={errors.lastName}>
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="أحمد" autoComplete="family-name" />
          </Field>
        </div>

        <Field label="البريد الإلكتروني" required error={errors.email}>
          <div className="relative">
            <Mail className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@store.com" className="pe-9" dir="ltr" autoComplete="email" />
          </div>
        </Field>

        <Field label="رقم الهاتف / واتساب" required error={errors.phone}>
          <div className="relative">
            <Phone className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01012345678" className="pe-9" dir="ltr" autoComplete="tel" />
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="كلمة المرور" required error={errors.password} hint="8 أحرف على الأقل">
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="••••••••"
                className="pe-9 ps-9"
                dir="ltr"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute start-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-800"
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </Field>
          <Field label="تأكيد كلمة المرور" required error={errors.confirmPassword}>
            <Input
              type={showPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              autoComplete="new-password"
            />
          </Field>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-[11px] leading-6 text-slate-400">
            <input
              type="checkbox"
              checked={form.acceptTerms}
              onChange={(e) => set("acceptTerms", e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500"
            />
            <span>
              أوافق على <span className="font-semibold text-slate-200">شروط الاستخدام</span> و<span className="font-semibold text-slate-200">سياسة الخصوصية</span>، وأقر بأن بيانات المتجر التي أقدمها صحيحة.
            </span>
          </label>
          {errors.acceptTerms ? <div className="mt-1 text-[11px] text-rose-400">{errors.acceptTerms}</div> : null}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? "جارٍ إنشاء الحساب…" : "إنشاء الحساب والبدء"}
          {!submitting ? <ArrowLeft className="h-4 w-4" /> : null}
        </Button>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <LockKeyhole className="h-3.5 w-3.5" />
          بعد إنشاء الحساب ستنتقل مباشرة إلى تهيئة المتجر. لا نخزّن كلمات المرور في المتصفح.
        </div>
      </form>
    </AuthShell>
  );
}
