import React from "react";
import { ArrowRight, BadgeCheck, ChartNoAxesColumnIncreasing, ShieldCheck, Store } from "lucide-react";
import { BrandLogo } from "../components/Brand";
import { ThemeToggle } from "../lib/theme";
import { Link } from "../lib/router";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  badge,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  badge?: string;
}) {
  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-canvas font-arabic text-ink">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 right-[8%] h-[26rem] w-[26rem] rounded-full bg-brand-soft opacity-80 blur-[110px]" />
        <div className="absolute bottom-[-12rem] left-[3%] h-[24rem] w-[24rem] rounded-full bg-surface blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" aria-label="العودة إلى موقع سند">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-brand px-3 py-2 text-xs font-semibold text-subtle transition hover:bg-surface hover:text-ink">
              <span className="hidden sm:inline">العودة للرئيسية</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="surface-card grid w-full max-w-5xl overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative hidden overflow-hidden border-e border-line bg-secondary p-9 lg:flex lg:flex-col lg:justify-between">
              <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand-on-dark/15 blur-3xl" />
              <div className="relative">
                {badge ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-brand-on-dark">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {badge}
                  </span>
                ) : null}
                <h2 className="mt-5 font-heading text-3xl font-bold leading-snug text-white">
                  كل ما تحتاجه لإدارة متجرك
                  <br />
                  <span className="text-brand-on-dark">في مكان واحد.</span>
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-7 text-white/65">
                  من إنشاء المتجر ورفع المنتجات، إلى تأكيد الطلبات والتحصيل عند الاستلام، وتحليل النمو — بدون عمولة على مبيعاتك.
                </p>
              </div>

              <div className="relative mt-8 space-y-3">
                {[
                  { icon: Store, title: "متجر جاهز للنشر", text: "هوية وتصميم وصفحات ومحتوى عربي بالكامل." },
                  { icon: ShieldCheck, title: "أمان حقيقي", text: "جلسات مشفّرة بكوكيز httpOnly وعزل كامل بين المتاجر." },
                  { icon: ChartNoAxesColumnIncreasing, title: "قرارات مبنية على أرقام", text: "تقارير مبيعات وطلبات وسلات متروكة من بياناتك الفعلية." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-brand border border-white/10 bg-white/[0.055] p-3.5">
                    <div className="rounded-brand-sm border border-white/10 bg-white/10 p-2 text-brand-on-dark">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{item.title}</div>
                      <div className="mt-0.5 text-[11px] leading-5 text-white/60">{item.text}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative mt-8 rounded-brand border border-white/10 bg-white/[0.055] p-4">
                <div className="flex items-center justify-between text-[11px] font-semibold text-brand-on-dark">
                  <span>0% عمولة على الطلبات</span>
                  <span>100 ج.م / شهرياً</span>
                </div>
                <div className="mt-2 text-[11px] leading-5 text-white/60">
                  ابدأ بالخطة السنوية أو الشهرية. لا نقتطع شيئاً من قيمة مبيعاتك.
                </div>
              </div>
            </div>

            <div className="bg-card p-6 sm:p-9">
              <div className="mb-7 flex items-center justify-between lg:hidden">
                <BrandLogo size="sm" showTagline={false} />
                {badge ? <span className="rounded-full border border-brand-line bg-brand-soft px-2.5 py-1 text-[10px] font-semibold text-brand">{badge}</span> : null}
              </div>
              <h1 className="font-heading text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-subtle">{subtitle}</p>
              <div className="mt-7">{children}</div>
              {footer ? <div className="mt-6 border-t border-line pt-5 text-center text-xs text-subtle">{footer}</div> : null}
            </div>
          </div>
        </div>

        <div className="pb-2 text-center text-[10px] text-subtle">
          باستخدامك سند فإنك توافق على سياسة الاستخدام وسياسة الخصوصية. جميع البيانات محفوظة داخل حسابك.
        </div>
      </div>
    </div>
  );
}
