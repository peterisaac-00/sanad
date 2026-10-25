import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Store, User, Users } from "lucide-react";
import { api } from "../lib/api";
import { date, safeError } from "../lib/format";
import { Link, navigate, useQuery } from "../lib/router";
import { useSession } from "../lib/session";
import { Alert, Badge, Button, Field, Input, Spinner } from "../components/ui";
import { AuthShell } from "./AuthShell";

const TEAM_ROLE_LABELS: Record<string, string> = {
  admin: "مدير عام",
  manager: "مدير",
  staff: "موظف",
  viewer: "مشاهدة فقط",
};

interface InvitationPreview {
  email: string;
  name: string;
  role: string;
  permissions?: string[];
  store_name: string;
  subdomain: string;
  expires_at: string;
}

type Status = "loading" | "ready" | "error";

function tokenFromLocation(query: URLSearchParams): string {
  const fromQuery = query.get("token");
  if (fromQuery) return fromQuery.trim();
  const match = window.location.pathname.match(/^\/team\/invite\/([^/]+)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

export function TeamInvitePage() {
  const query = useQuery();
  const token = useMemo(() => tokenFromLocation(query), [query]);
  const { session, setSession } = useSession();
  const [status, setStatus] = useState<Status>(token ? "loading" : "error");
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [errorCode, setErrorCode] = useState("");
  const [error, setError] = useState(
    token ? "" : "رابط الدعوة غير مكتمل. افتح الرابط الكامل من رسالة الدعوة أو اطلب من مالك المتجر رابطاً جديداً."
  );
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setStatus("loading");
    setError("");
    setErrorCode("");
    api.team
      .invitation(token)
      .then((result) => {
        if (!alive) return;
        const invitation = result.invitation as InvitationPreview;
        setPreview(invitation);
        setName(invitation.name || "");
        setStatus("ready");
      })
      .catch((err: any) => {
        if (!alive) return;
        setErrorCode(err?.code || "");
        setError(safeError(err));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preview) return;
    setError("");

    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "أدخل اسمك لعرضه في لوحة الفريق.";
    if (password.length < 8) nextErrors.password = "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
    if (confirmPassword !== password) nextErrors.confirmPassword = "كلمتا المرور غير متطابقتين.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await api.team.accept({ token, password, name: name.trim() });
      try {
        const me = await api.me();
        setSession(me);
        navigate("/dashboard", { replace: true });
      } catch {
        // The invitation is already accepted at this point; send the member to
        // sign in rather than showing a misleading "failed" state.
        navigate("/team/login?accepted=1", { replace: true });
      }
    } catch (err: any) {
      setErrorCode(err?.code || "");
      setError(safeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const title = preview ? `الانضمام إلى ${preview.store_name}` : "قبول دعوة الفريق";
  const subtitle = preview
    ? "أنشئ كلمة المرور الخاصة بك لتصبح عضواً في فريق المتجر. البريد الإلكتروني مرتبط بالدعوة ولا يمكن تغييره."
    : "دعوة للانضمام إلى فريق متجر على سند. افتح الرابط الكامل من رسالة الدعوة ثم أكمل بياناتك.";

  return (
    <AuthShell
      badge="دعوة فريق"
      title={title}
      subtitle={subtitle}
      footer={
        <>
          لديك حساب فريق بالفعل؟{" "}
          <Link href="/team/login" className="font-bold text-brand hover:text-brand">
            سجّل الدخول
          </Link>
          <span className="mx-1.5 text-line">·</span>
          <Link href="/auth/login" className="font-semibold text-subtle hover:text-ink">
            دخول التاجر
          </Link>
        </>
      }
    >
      {status === "loading" ? (
        <Spinner label="جارٍ التحقق من الدعوة…" />
      ) : status === "error" ? (
        <div className="space-y-4">
          <Alert tone="error" title="تعذر استخدام الدعوة">
            {error}
          </Alert>
          {errorCode === "INVITE_ALREADY_ACCEPTED" ? (
            <Button className="w-full" onClick={() => navigate("/team/login", { replace: true })}>
              تسجيل دخول الفريق
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <div className="rounded-brand border border-line bg-surface p-3 text-[11px] leading-6 text-subtle">
              اطلب من مالك المتجر إرسال دعوة جديدة من صفحة «الإعدادات ← الفريق». الدعوات صالحة لمدة 7 أيام وتُستخدم مرة واحدة.
            </div>
          )}
          <Link
            href="/"
            className="flex h-10 items-center justify-center rounded-brand border border-line bg-card text-xs font-semibold text-ink transition hover:border-brand-line hover:bg-surface"
          >
            العودة إلى الرئيسية
          </Link>
        </div>
      ) : preview ? (
        <div className="space-y-4">
          <div className="rounded-brand border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-sm bg-brand-soft text-brand">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink">{preview.store_name}</div>
                <div className="mt-0.5 truncate font-mono text-[10px] text-subtle" dir="ltr">
                  /store/{preview.subdomain}
                </div>
              </div>
              <Badge tone="border-brand-line bg-brand-soft text-brand">
                {TEAM_ROLE_LABELS[preview.role] ?? preview.role}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[11px] text-subtle">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-semibold text-ink" dir="ltr">{preview.email}</span>
              </span>
              <span>صالحة حتى {date(preview.expires_at)}</span>
            </div>
          </div>

          {session ? (
            <Alert tone="info" title="سيتم تبديل الجلسة الحالية">
              قبول الدعوة سيجعل هذا المتصفح مسجلاً كعضو في فريق هذا المتجر بدلاً من الجلسة الحالية.
            </Alert>
          ) : null}

          {error ? <Alert tone="error">{error}</Alert> : null}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="الاسم الكامل" required error={fieldErrors.name}>
              <div className="relative">
                <User className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors((current) => ({ ...current, name: "" }));
                  }}
                  placeholder="اسمك كما سيظهر للفريق"
                  className="pe-10"
                  autoComplete="name"
                />
              </div>
            </Field>

            <Field label="كلمة المرور" required error={fieldErrors.password} hint="8 أحرف على الأقل">
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((current) => ({ ...current, password: "" }));
                  }}
                  placeholder="••••••••"
                  className="pe-10 ps-10"
                  dir="ltr"
                  autoComplete="new-password"
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

            <Field label="تأكيد كلمة المرور" required error={fieldErrors.confirmPassword}>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setFieldErrors((current) => ({ ...current, confirmPassword: "" }));
                }}
                placeholder="••••••••"
                dir="ltr"
                autoComplete="new-password"
              />
            </Field>

            <div className="flex items-start gap-1.5 text-[10px] leading-5 text-subtle">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                لا تشارك كلمة المرور مع أي شخص. صلاحيات هذا الحساب:{" "}
                <span className="font-semibold text-ink">{TEAM_ROLE_LABELS[preview.role] ?? preview.role}</span>.
              </span>
            </div>

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              {submitting ? "جارٍ قبول الدعوة…" : "قبول الدعوة والدخول"}
              {!submitting ? <ArrowLeft className="h-4 w-4" /> : null}
            </Button>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-subtle">
            <Users className="h-3 w-3" />
            يمكن لمالك المتجر تعديل دورك أو إيقاف حسابك في أي وقت.
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}
