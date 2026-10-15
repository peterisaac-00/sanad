import React, { useState } from 'react';
import { Language } from '../data/translations';
import {
  X,
  Store,
  TrendingUp,
  Package,
  ShoppingBag,
  Truck,
  MessageCircle,
  Share2,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Printer,
  ChevronRight,
  Filter
} from 'lucide-react';

interface GrowthCenterPreviewProps {
  currentLang: Language;
  isOpen: boolean;
  onClose: () => void;
  onOpenStoreModal: () => void;
}

export const GrowthCenterPreview: React.FC<GrowthCenterPreviewProps> = ({
  currentLang,
  isOpen,
  onClose,
  onOpenStoreModal
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'products' | 'shipping' | 'marketing'>('overview');

  if (!isOpen) return null;

  const sampleOrders = [
    {
      id: 'SND-4821',
      customer: 'أحمد محمود إبراهيم',
      city: 'القاهرة (التجمع الخامس)',
      items: 'قميص كتان طبيعي (كحلي - L)',
      amount: '750 ج.م',
      payment: 'الدفع عند الاستلام COD',
      status: 'تم التسليم والتحصيل',
      statusColor: 'bg-emerald-100 text-emerald-800',
      courier: 'بوسطة Bosta'
    },
    {
      id: 'SND-4822',
      customer: 'سارة خالد المنصوري',
      city: 'الرياض (حي الملقا - السعودية)',
      items: 'عباية حرير مطرزة (مقاس 56)',
      amount: '420 ر.س (5,540 ج.م)',
      payment: 'Apple Pay (بطاقة دفع إلكتروني)',
      status: 'مشحون جوياً - بالجمارك',
      statusColor: 'bg-blue-100 text-blue-800',
      courier: 'أرامكس إكسبريس'
    },
    {
      id: 'SND-4823',
      customer: 'كريم عبد العظيم',
      city: 'الإسكندرية (سموحة)',
      items: 'حذاء كاجوال جلد طبيعي (مقاس 43)',
      amount: '1,120 ج.م',
      payment: 'الدفع عند الاستلام COD',
      status: 'مؤكد عبر واتساب - قيد التجهيز',
      statusColor: 'bg-amber-100 text-amber-800',
      courier: 'بوسطة Bosta'
    },
    {
      id: 'SND-4824',
      customer: 'منى الشريف',
      city: 'المنصورة (الدلتا)',
      items: 'فستان صيفي مطبوع + وشاح',
      amount: '890 ج.م',
      payment: 'الدفع عند الاستلام COD',
      status: 'وارد جديد - بانتظار التأكيد',
      statusColor: 'bg-slate-100 text-slate-700',
      courier: 'بانتظار البوليصة'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Cockpit Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold">
              سـ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base sm:text-lg text-white">
                  {currentLang === 'ar' ? 'مركز نمو التاجر (Merchant Cockpit)' : 'Merchant Growth Center (Live Cockpit)'}
                </h3>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded">
                  0% عمولة مفعلة
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {currentLang === 'ar' ? 'متجر سرايا للأزياء · saraya.sanad.app · العملة الأساسية: EGP' : 'Saraya Boutique · saraya.sanad.app · Base: EGP'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenStoreModal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-colors"
            >
              {currentLang === 'ar' ? 'أنشئ متجرك المماثل الآن' : 'Launch Your Own Store'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 flex gap-2 overflow-x-auto text-xs font-medium py-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'overview' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>{currentLang === 'ar' ? 'المؤشرات الحيوية' : 'Live KPIs'}</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'orders' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span>{currentLang === 'ar' ? 'إدارة الطلبات والـ COD' : 'Orders & COD'}</span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'products' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 text-emerald-600" />
            <span>{currentLang === 'ar' ? 'المنتجات والمتغيرات' : 'Products & SKUs'}</span>
          </button>
          <button
            onClick={() => setActiveTab('shipping')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'shipping' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>{currentLang === 'ar' ? 'مناطق الشحن' : 'Shipping Zones'}</span>
          </button>
          <button
            onClick={() => setActiveTab('marketing')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'marketing' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>{currentLang === 'ar' ? 'Meta CAPI و Google' : 'Meta & Google'}</span>
          </button>
        </div>

        {/* Dashboard Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 5 Real Deterministic KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="text-[11px] font-medium text-slate-500">
                    {currentLang === 'ar' ? 'صافي المبيعات (هذا الشهر)' : 'Net Sales (Month)'}
                  </div>
                  <div className="text-xl font-bold font-heading text-slate-900">
                    148,500 <span className="text-xs font-normal text-slate-500">{currentLang === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold">
                    {currentLang === 'ar' ? '+18.4% نمو حقيقي' : '+18.4% growth'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="text-[11px] font-medium text-slate-500">
                    {currentLang === 'ar' ? 'عدد الطلبات المكتملة' : 'Completed Orders'}
                  </div>
                  <div className="text-xl font-bold font-heading text-slate-900">
                    312 <span className="text-xs font-normal text-slate-500">{currentLang === 'ar' ? 'طلب' : 'orders'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {currentLang === 'ar' ? '0 عمولة مقتطعة' : '0 commission taken'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="text-[11px] font-medium text-slate-500">
                    {currentLang === 'ar' ? 'متوسط قيمة الطلب (AOV)' : 'Average Order Value'}
                  </div>
                  <div className="text-xl font-bold font-heading text-slate-900">
                    476 <span className="text-xs font-normal text-slate-500">{currentLang === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-medium">
                    {currentLang === 'ar' ? 'مدعوم بالعروض المجمعة' : 'Driven by bundles'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="text-[11px] font-medium text-slate-500">
                    {currentLang === 'ar' ? 'نسبة تسليم الـ COD' : 'COD Delivery Success'}
                  </div>
                  <div className="text-xl font-bold font-heading text-emerald-700">
                    86.4%
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {currentLang === 'ar' ? 'بفضل تأكيد الواتساب' : 'Via WhatsApp checks'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="text-[11px] font-medium text-slate-500">
                    {currentLang === 'ar' ? 'كاش معلق لدى الشحن' : 'Pending Remittances'}
                  </div>
                  <div className="text-xl font-bold font-heading text-slate-900">
                    14,250 <span className="text-xs font-normal text-slate-500">{currentLang === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </div>
                  <div className="text-[10px] text-blue-600 font-medium">
                    {currentLang === 'ar' ? 'جاهز للتوريد البنكي' : 'Pending courier batch'}
                  </div>
                </div>
              </div>

              {/* Recent Orders Preview */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold font-heading text-slate-900">
                    {currentLang === 'ar' ? 'أحدث الطلبات ودورة حالات الـ COD' : 'Recent Orders & COD Workflow'}
                  </h4>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer flex items-center gap-1"
                  >
                    <span>{currentLang === 'ar' ? 'عرض كافة الطلبات (312)' : 'View all orders (312)'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {sampleOrders.map((order) => (
                    <div key={order.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{order.id}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-medium text-slate-700">{order.customer}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {order.city} · {order.items}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-end">
                          <div className="font-bold text-slate-900">{order.amount}</div>
                          <div className="text-[10px] text-slate-500">{order.payment}</div>
                        </div>

                        <span className={`px-2 py-1 rounded text-[11px] font-semibold ${order.statusColor}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800">
                    {currentLang === 'ar' ? 'تصفية الطلبات:' : 'Filter Orders:'}
                  </span>
                  <span className="text-xs text-slate-600">الكل (312) · وارد (4) · مؤكد (18) · تم التسليم (268)</span>
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5" />
                    <span>{currentLang === 'ar' ? 'طباعة بوالص الشحن' : 'Print Airway Bills'}</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {sampleOrders.map((order) => (
                  <div key={order.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{order.id} - {order.customer}</div>
                      <div className="text-[11px] text-slate-500">{order.city} · {order.items}</div>
                      <div className="text-[11px] text-emerald-700 font-medium mt-0.5">الناقل: {order.courier}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded text-[11px] font-semibold ${order.statusColor}`}>
                        {order.status}
                      </span>
                      <button className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer" title="تأكيد عبر واتساب">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="text-xs font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>{currentLang === 'ar' ? 'سجل المنتجات والمتغيرات SKUs' : 'Products & Multi-Variant SKUs'}</span>
                <span className="text-slate-500">42 منتج نشط</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">قميص كتان طبيعي مصري (Linen Shirt)</div>
                    <div className="text-[11px] text-slate-500">SKU: LNN-EGY-01 · 4 مقاسات (S, M, L, XL) · 3 ألوان</div>
                  </div>
                  <div className="text-end">
                    <div className="font-bold text-slate-900">750 ج.م / 57 ر.س</div>
                    <div className="text-[11px] text-emerald-600 font-semibold">متبقي بالمخزون: 48 قطعة</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">عباية كريب مطرزة يدوياً</div>
                    <div className="text-[11px] text-slate-500">SKU: ABY-CR-02 · مقاسات 52 - 58</div>
                  </div>
                  <div className="text-end">
                    <div className="font-bold text-slate-900">1,850 ج.م / 140 ر.س</div>
                    <div className="text-[11px] text-amber-600 font-semibold">متبقي 6 قطع (تنبيه مخزون منخفض)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 text-xs">
              <div className="font-bold text-slate-900 pb-2 border-b border-slate-100">
                {currentLang === 'ar' ? 'مناطق الشحن والتعريفات المعرفة:' : 'Configured Shipping Zones & Tariffs:'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 border border-slate-200 rounded-lg space-y-1">
                  <div className="font-bold text-slate-900">القاهرة الكبرى والجيزة</div>
                  <div className="text-slate-600">سعر الشحن: 45 ج.م · شحن مجاني للطلبات فوق 600 ج.م</div>
                </div>
                <div className="p-3 border border-slate-200 rounded-lg space-y-1">
                  <div className="font-bold text-slate-900">محافظات الإسكندرية والدلتا والقناة</div>
                  <div className="text-slate-600">سعر الشحن: 60 ج.م · شحن مجاني للطلبات فوق 800 ج.م</div>
                </div>
                <div className="p-3 border border-slate-200 rounded-lg space-y-1">
                  <div className="font-bold text-slate-900">محافظات الصعيد والحدودية</div>
                  <div className="text-slate-600">سعر الشحن: 85 ج.م · التوصيل خلال 48-72 ساعة</div>
                </div>
                <div className="p-3 border border-emerald-300 bg-emerald-50/50 rounded-lg space-y-1">
                  <div className="font-bold text-emerald-900">الشحن الدولي السريع (السعودية والإمارات)</div>
                  <div className="text-emerald-800">سعر الشحن: 45 ر.س / 45 د.إ · شحن جوي سريع من الباب للباب</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'marketing' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 text-xs">
              <div>
                <div className="font-bold text-slate-900">
                  {currentLang === 'ar' ? 'روابط التغذية الحية لكتالوج المنتجات (Live XML Feeds)' : 'Live XML Product Feeds'}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {currentLang === 'ar'
                    ? 'انسخ هذا الرابط وضعه في Meta Commerce Manager أو Google Merchant Center للتحديث التلقائي اللحظي.'
                    : 'Copy this URL into Meta Commerce Manager or Google Merchant Center for continuous sync.'}
                </p>
              </div>

              <div className="p-3 bg-slate-100 rounded-lg font-mono text-[11px] text-slate-700 break-all flex items-center justify-between">
                <span>https://saraya.sanad.app/feeds/catalog-meta.xml</span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">متزامن 100%</span>
              </div>

              <div className="p-3 bg-slate-100 rounded-lg font-mono text-[11px] text-slate-700 break-all flex items-center justify-between">
                <span>https://saraya.sanad.app/feeds/google-merchant.xml</span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">متزامن 100%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
