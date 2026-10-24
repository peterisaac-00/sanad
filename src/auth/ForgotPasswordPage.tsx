import React, { useState } from "react";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { api } from "../lib/api";
import { safeError } from "../lib/format";
import { Link } from "../lib/router";
import { Alert, Button, Field, Input } from "../components/ui";
import { AuthShell } from "./AuthShell";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [debugToken, setDebugToken] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("أدخل بريداً إلكترونياً صحيحاً.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.forgotPassword(email.trim().toLowerCase());
      setSent(true);
      setDebugToken(result.debug_token || "");
    } catch (err: any) {
      setError(safeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      badge="استعادة الحساب"
      title="نسيت كلمة المرور؟"
      subtitle="أدخل بريد حسابك وسنرسل رابطاً لإعادة تعيين كلمة المرور. الرابط صالح لفترة قصيرة ولا يعمل إلا مرة واحدة."
      footer={
        <>
          تذكرت كلمة المرور؟{" "}
          <Link href="/auth/login" className="font-bold text-brand hover:text-brand">
            سجّل الدخول
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <Alert tone="success" title="تحقق من بريدك">
            إذا كان هناك حساب مرتبط بهذا البريد فسيصلك رابط إعادة التعيين خلال دقائق. لا نكشف ما إذا كان البريد مسجلاً أم لا.
          </Alert>
          {debugToken ? (
            <div className="rounded-brand border border-warning-line bg-warning-soft p-3 text-[11px] leading-6 text-warning">
              <div className="font-bold">بيئة تطوير فقط — لم يُرسل بريد فعلي.</div>
              <Link
                href={`/auth/reset-password?token=${encodeURIComponent(debugToken)}`}
                className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] underline"
                dir="ltr"
              >
                فتح رابط إعادة التعيين
                <ArrowLeft className="h-3 w-3" />
              </Link>
            </div>
          ) : null}
          <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
            استخدام بريد آخر
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
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
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            {submitting ? "جارٍ الإرسال…" : "إرسال رابط الاستعادة"}
            {!submitting ? <Send className="h-4 w-4" /> : null}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
