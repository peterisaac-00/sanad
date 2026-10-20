import React from "react";
import { ArrowRight, BadgeCheck, ChartNoAxesColumnIncreasing, ShieldCheck, Store } from "lucide-react";
import { BrandLogo } from "../components/Brand";
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
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-[#060a13] font-arabic text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 right-[10%] h-[28rem] w-[28rem] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute bottom-[-10rem] left-[5%] h-[24rem] w-[24rem] rounded-full bg-cyan-500/10 blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="العودة إلى موقع سند">
            <BrandLogo />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">
            العودة للرئيسية
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b1220]/80 shadow-2xl shadow-black/50 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative hidden overflow-hidden border-e border-white/10 bg-gradient-to-br from-blue-950 via-[#0a1426] to-[#07101d] p-9 lg:flex lg:flex-col lg:justify-between">
              <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="relative">
                {badge ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold text-blue-200">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {badge}
                  </span>
                ) : null}
                <h2 className="mt-5 font-heading text-3xl font-bold leading-snug text-white">
                  كل ما تحتاجه لإدارة متجرك
                  <br />
                  <span className="text-blue-400">في مكان واحد.</span>
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-7 text-slate-400">
                  من إنشاء المتجر ورفع المنتجات، إلى تأكيد الطلبات والتحصيل عند الاستلام، وتحليل النمو — بدون عمولة على مبيعاتك.
                </p>
              </div>

              <div className="relative mt-8 space-y-3">
                {[
                  { icon: Store, title: "متجر جاهز للنشر", text: "هوية وتصميم وصفحات ومحتوى عربي بالكامل." },
                  { icon: ShieldCheck, title: "أمان حقيقي", text: "جلسات مشفّرة بكوكيز httpOnly وعزل كامل بين المتاجر." },
                  { icon: ChartNoAxesColumnIncreasing, title: "قرارات مبنية على أرقام", text: "تقارير مبيعات وطلبات وسلات متروكة من بياناتك الفعلية." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5">
                    <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-2 text-blue-300">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{item.title}</div>
                      <div className="mt-0.5 text-[11px] leading-5 text-slate-400">{item.text}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4">
                <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300">
                  <span>0% عمولة على الطلبات</span>
                  <span>100 ج.م / شهرياً</span>
                </div>
                <div className="mt-2 text-[11px] leading-5 text-slate-400">
                  ابدأ بالخطة السنوية أو الشهرية. لا نقتطع شيئاً من قيمة مبيعاتك.
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-9">
              <div className="mb-7 lg:hidden">
                <BrandLogo size="sm" />
              </div>
              <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>
              <div className="mt-7">{children}</div>
              {footer ? <div className="mt-6 border-t border-white/5 pt-5 text-center text-xs text-slate-400">{footer}</div> : null}
            </div>
          </div>
        </div>

        <div className="pb-2 text-center text-[10px] text-slate-600">
          باستخدامك سند فإنك توافق على سياسة الاستخدام وسياسة الخصوصية. جميع البيانات محفوظة داخل حسابك.
        </div>
      </div>
    </div>
  );
}
