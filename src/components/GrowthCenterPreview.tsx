import React, { useState, useEffect, useCallback } from 'react';
import { Language } from '../data/translations';
import { api, ApiRequestError } from '../lib/api';
import {
  X,
  TrendingUp,
  Package,
  ShoppingBag,
  Settings,
  LogIn,
  Trash2,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface GrowthCenterPreviewProps {
  currentLang: Language;
  isOpen: boolean;
  storeSubdomain: string | null;
  onClose: () => void;
  onOpenStoreModal: () => void;
  onOpenLoginModal: () => void;
}

type Tab = 'overview' | 'orders' | 'products' | 'settings';

const NEXT_STATUS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

/** Merchant-facing display number (SND-4825 style); falls back to raw id. */
function displayOrderId(o: any): string {
  return o?.orderNumber != null ? `SND-${o.orderNumber}` : String(o?.id ?? '');
}

export const GrowthCenterPreview: React.FC<GrowthCenterPreviewProps> = ({
  currentLang,
  isOpen,
  storeSubdomain,
  onClose,
  onOpenStoreModal,
  onOpenLoginModal,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  // Product form
  const [pSku, setPSku] = useState('');
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pStock, setPStock] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');

  // Store settings form
  const [sName, setSName] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sCurrency, setSCurrency] = useState('EGP');

  // Password form
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const ar = currentLang === 'ar';

  const load = useCallback(async () => {
    if (!storeSubdomain) return;
    setIsLoading(true);
    setError('');
    try {
      const [s, o, p] = await Promise.all([
        api.dashboard.summary(storeSubdomain),
        api.orders.list(storeSubdomain, { pageSize: 50, status: statusFilter || undefined }),
        api.products.list(storeSubdomain, { pageSize: 100 }),
      ]);
      setSummary(s);
      setOrders(o.orders);
      setProducts(p.products);
      if (s?.store) {
        setSName(s.store.storeName ?? '');
        setSPhone(s.store.phone ?? '');
        setSCurrency(s.store.currency ?? 'EGP');
      }
    } catch (e) {
      setError(errMsg(e, ar ? 'تعذر تحميل بيانات المتجر.' : 'Could not load store data.'));
    } finally {
      setIsLoading(false);
    }
  }, [storeSubdomain, statusFilter, ar]);

  useEffect(() => {
    if (isOpen && storeSubdomain) load();
  }, [isOpen, storeSubdomain, load]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
      setNotice('');
      setError('');
    }
  }, [isOpen, storeSubdomain]);

  if (!isOpen) return null;

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    if (!storeSubdomain) return;
    try {
      await api.orders.setStatus(storeSubdomain, orderId, status);
      flash(ar ? 'تم تحديث حالة الطلب.' : 'Order status updated.');
      load();
    } catch (e) {
      setError(errMsg(e, ar ? 'تعذر تحديث الحالة.' : 'Could not update status.'));
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeSubdomain) return;
    try {
      await api.products.create(storeSubdomain, {
        sku: pSku.trim(),
        name_en: pName.trim(),
        price_egp: Number(pPrice) || 0,
        stock: Math.max(0, parseInt(pStock || '0', 10)),
      });
      setPSku('');
      setPName('');
      setPPrice('');
      setPStock('');
      flash(ar ? 'تمت إضافة المنتج.' : 'Product added.');
      load();
    } catch (e2) {
      setError(errMsg(e2, ar ? 'تعذر إضافة المنتج.' : 'Could not add product.'));
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!storeSubdomain) return;
    try {
      await api.products.remove(storeSubdomain, id);
      flash(ar ? 'تم حذف المنتج.' : 'Product deleted.');
      load();
    } catch (e) {
      setError(errMsg(e, ar ? 'تعذر حذف المنتج.' : 'Could not delete product.'));
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!storeSubdomain) return;
    try {
      await api.products.update(storeSubdomain, id, {
        price_egp: Number(editPrice),
        stock: Math.max(0, parseInt(editStock || '0', 10)),
      });
      setEditingId(null);
      flash(ar ? 'تم حفظ التعديل.' : 'Changes saved.');
      load();
    } catch (e) {
      setError(errMsg(e, ar ? 'تعذر حفظ التعديل.' : 'Could not save changes.'));
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.updateAccountStore({ storeName: sName.trim(), phone: sPhone.trim(), storeCurrency: sCurrency });
      setSName(res.store.storeName ?? '');
      setSPhone(res.store.phone ?? '');
      setSCurrency(res.store.currency ?? 'EGP');
      flash(ar ? 'تم حفظ إعدادات المتجر.' : 'Store settings saved.');
      load();
    } catch (e2) {
      setError(errMsg(e2, ar ? 'تعذر حفظ الإعدادات.' : 'Could not save settings.'));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.changePassword(curPw, newPw);
      setCurPw('');
      setNewPw('');
      flash(ar ? 'تم تغيير كلمة المرور.' : 'Password changed.');
    } catch (e2) {
      setError(errMsg(e2, ar ? 'تعذر تغيير كلمة المرور.' : 'Could not change password.'));
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: ar ? 'المؤشرات' : 'Overview', icon: <TrendingUp className="w-4 h-4 text-brand" /> },
    { id: 'orders', label: ar ? 'الطلبات' : 'Orders', icon: <ShoppingBag className="w-4 h-4 text-brand" /> },
    { id: 'products', label: ar ? 'المنتجات' : 'Products', icon: <Package className="w-4 h-4 text-brand" /> },
    { id: 'settings', label: ar ? 'الإعدادات' : 'Settings', icon: <Settings className="w-4 h-4 text-brand" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-secondary/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-card rounded-brand-lg shadow-2xl border border-line w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="bg-secondary text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-brand bg-white/10 border border-white/10 flex items-center justify-center text-brand-on-dark font-bold">
              سـ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base sm:text-lg text-white">
                  {ar ? 'مركز نمو التاجر' : 'Merchant Growth Center'}
                </h3>
                <span className="rounded border border-brand-on-dark/30 bg-brand-on-dark/10 px-2 py-0.5 text-[10px] font-semibold text-brand-on-dark">
                  {ar ? '0% عمولة' : '0% commission'}
                </span>
              </div>
              <p className="text-xs text-white/60">
                {storeSubdomain ? `${storeSubdomain}.sanad.app` : ar ? 'سجّل الدخول لعرض بيانات متجرك' : 'Sign in to view your store data'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!storeSubdomain && (
              <button
                onClick={onOpenStoreModal}
                className="bg-brand hover:bg-brand-hover text-white text-xs font-semibold px-3 py-2 rounded-brand-sm cursor-pointer transition-colors"
              >
                {ar ? 'أنشئ متجرك الآن' : 'Create your store'}
              </button>
            )}
            <button onClick={onClose} className="rounded-brand-sm p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!storeSubdomain ? (
          <div className="p-10 text-center space-y-4 bg-surface">
            <LogIn className="w-10 h-10 text-subtle mx-auto" />
            <h4 className="font-bold text-ink">{ar ? 'لوحة التحكم تتطلب تسجيل الدخول' : 'The console requires sign-in'}</h4>
            <p className="text-xs text-subtle max-w-sm mx-auto">
              {ar ? 'سجّل الدخول بحساب التاجر لعرض طلباتك ومنتجاتك ومؤشراتك الحقيقية.' : 'Sign in with your merchant account to see your real orders, products, and KPIs.'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button onClick={onOpenLoginModal} className="px-5 py-2.5 bg-secondary text-white text-xs font-bold rounded-brand-sm cursor-pointer">
                {ar ? 'تسجيل الدخول' : 'Sign in'}
              </button>
              <button onClick={onOpenStoreModal} className="px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-brand-sm cursor-pointer">
                {ar ? 'أنشئ متجرك' : 'Create store'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-surface border-b border-line px-4 sm:px-6 flex gap-2 overflow-x-auto text-xs font-medium py-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-1.5 rounded-brand-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === t.id ? 'bg-card text-ink shadow-xs font-bold' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
              <button onClick={load} className="ms-auto px-3 py-1.5 rounded-brand-sm text-ink-soft hover:text-ink flex items-center gap-1.5 cursor-pointer" title={ar ? 'تحديث' : 'Refresh'}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-surface">
              {error && (
                <div className="bg-danger-soft border border-danger-line text-danger text-xs font-semibold rounded-brand px-3 py-2.5 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {notice && (
                <div className="bg-brand-soft border border-brand-line text-brand text-xs font-semibold rounded-brand px-3 py-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              {isLoading && !summary ? (
                <div className="text-center py-12 text-xs text-subtle">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand" />
                  {ar ? 'جاري تحميل بيانات متجرك...' : 'Loading your store data...'}
                </div>
              ) : (
                <>
                  {activeTab === 'overview' && summary && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: ar ? 'صافي المبيعات' : 'Net sales', value: `${summary.kpis.total_sales_egp} ${ar ? 'ج.م' : 'EGP'}` },
                          { label: ar ? 'الطلبات' : 'Orders', value: String(summary.kpis.total_orders) },
                          { label: ar ? 'متوسط الطلب' : 'Avg order', value: `${summary.kpis.avg_order_egp} ${ar ? 'ج.م' : 'EGP'}` },
                          { label: ar ? 'طلبات مُسلّمة' : 'Delivered', value: String(summary.kpis.delivered_orders) },
                        ].map((k) => (
                          <div key={k.label} className="bg-card p-4 rounded-brand border border-line shadow-2xs">
                            <div className="text-[11px] text-subtle">{k.label}</div>
                            <div className="text-xl font-bold text-ink">{k.value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="bg-card rounded-brand border border-line p-4 space-y-2">
                        <h4 className="text-sm font-bold text-ink">{ar ? 'أحدث الطلبات' : 'Recent orders'}</h4>
                        {summary.recent_orders?.length === 0 && (
                          <p className="text-xs text-subtle">{ar ? 'لا توجد طلبات بعد.' : 'No orders yet.'}</p>
                        )}
                        {(summary.recent_orders ?? []).map((o: any) => (
                          <div key={o.id} className="py-2 border-t border-line text-xs flex items-center justify-between gap-2">
                            <span className="font-bold text-ink">{displayOrderId(o)} · <span className="font-medium text-ink-soft">{o.customerName}</span></span>
                            <span className="font-bold">{o.amountText}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'orders' && (
                    <div className="bg-card rounded-brand border border-line p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-ink">{ar ? 'الحالة:' : 'Status:'}</span>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-line rounded-brand-sm px-2 py-1.5 text-xs">
                          <option value="">{ar ? 'الكل' : 'All'}</option>
                          {['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      {orders.length === 0 && <p className="text-xs text-subtle">{ar ? 'لا توجد طلبات مطابقة.' : 'No matching orders.'}</p>}
                      {orders.map((o: any) => (
                        <div key={o.id} className="py-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="font-bold text-ink">{displayOrderId(o)} - {o.customerName}</div>
                            <div className="text-[11px] text-subtle">{o.city} · {o.itemsSummary}</div>
                            {(o.customerPhone || o.address) && (
                              <div className="text-[11px] text-subtle" dir="ltr">
                                {[o.customerPhone, o.address].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            <div className="text-[11px] font-bold">{o.amountText} · {o.paymentMethod}</div>
                          </div>
                          <select
                            value={o.status}
                            onChange={(e) => handleStatusChange(o.id, e.target.value)}
                            className="border border-line rounded-brand-sm px-2 py-1.5 text-xs font-semibold"
                          >
                            {[o.status, ...NEXT_STATUS[o.status]].map((s: string) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'products' && (
                    <div className="bg-card rounded-brand border border-line p-4 space-y-3">
                      <form onSubmit={handleAddProduct} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                        <input required value={pSku} onChange={(e) => setPSku(e.target.value)} placeholder="SKU" className="border border-line rounded-brand-sm px-2 py-2" />
                        <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder={ar ? 'الاسم' : 'Name'} className="border border-line rounded-brand-sm px-2 py-2" />
                        <input required value={pPrice} onChange={(e) => setPPrice(e.target.value)} placeholder={ar ? 'السعر' : 'Price'} inputMode="decimal" className="border border-line rounded-brand-sm px-2 py-2" />
                        <input value={pStock} onChange={(e) => setPStock(e.target.value)} placeholder={ar ? 'المخزون' : 'Stock'} inputMode="numeric" className="border border-line rounded-brand-sm px-2 py-2" />
                        <button type="submit" className="bg-brand hover:bg-brand-hover text-white rounded-brand-sm font-bold flex items-center justify-center gap-1 cursor-pointer">
                          <Plus className="w-4 h-4" /> {ar ? 'إضافة' : 'Add'}
                        </button>
                      </form>
                      {products.length === 0 && <p className="text-xs text-subtle">{ar ? 'لا توجد منتجات بعد. أضف منتجك الأول أعلاه.' : 'No products yet. Add your first product above.'}</p>}
                      {products.map((p: any) => (
                        <div key={p.id} className="p-3 bg-surface rounded-brand-sm flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="font-bold text-ink">{p.nameEn || p.nameAr || p.sku}</div>
                            <div className="text-[11px] text-subtle">SKU: {p.sku}</div>
                          </div>
                          {editingId === p.id ? (
                            <div className="flex items-center gap-2">
                              <input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder={ar ? 'السعر' : 'Price'} inputMode="decimal" className="w-20 border border-line rounded-brand-sm px-2 py-1.5" />
                              <input value={editStock} onChange={(e) => setEditStock(e.target.value)} placeholder={ar ? 'المخزون' : 'Stock'} inputMode="numeric" className="w-20 border border-line rounded-brand-sm px-2 py-1.5" />
                              <button onClick={() => handleSaveEdit(p.id)} className="px-2.5 py-1.5 bg-brand text-white rounded-brand-sm font-bold cursor-pointer">{ar ? 'حفظ' : 'Save'}</button>
                              <button onClick={() => setEditingId(null)} className="px-2.5 py-1.5 border border-line rounded-brand-sm cursor-pointer">{ar ? 'إلغاء' : 'Cancel'}</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{p.priceEgp} {ar ? 'ج.م' : 'EGP'}</span>
                              <span className="text-subtle">· {ar ? 'مخزون' : 'stock'}: {p.stock}</span>
                              <button
                                onClick={() => {
                                  setEditingId(p.id);
                                  setEditPrice(String(p.priceEgp));
                                  setEditStock(String(p.stock));
                                }}
                                className="px-2.5 py-1.5 border border-line rounded-brand-sm hover:bg-card cursor-pointer"
                              >
                                {ar ? 'تعديل' : 'Edit'}
                              </button>
                              <button onClick={() => handleDeleteProduct(p.id)} className="rounded-brand-sm bg-danger-soft p-1.5 text-danger transition hover:bg-danger/15 cursor-pointer" title={ar ? 'حذف' : 'Delete'}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'settings' && (
                    <div className="space-y-4">
                      <form onSubmit={handleSaveSettings} className="bg-card rounded-brand border border-line p-4 space-y-3 text-xs">
                        <h4 className="font-bold text-ink text-sm">{ar ? 'إعدادات المتجر' : 'Store settings'}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder={ar ? 'اسم المتجر' : 'Store name'} className="border border-line rounded-brand-sm px-2 py-2" />
                          <input value={sPhone} onChange={(e) => setSPhone(e.target.value)} placeholder={ar ? 'الهاتف' : 'Phone'} className="border border-line rounded-brand-sm px-2 py-2" />
                          <select value={sCurrency} onChange={(e) => setSCurrency(e.target.value)} className="border border-line rounded-brand-sm px-2 py-2">
                            {['EGP'].map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" className="px-4 py-2 bg-secondary text-white rounded-brand-sm font-bold cursor-pointer">{ar ? 'حفظ الإعدادات' : 'Save settings'}</button>
                      </form>

                      <form onSubmit={handleChangePassword} className="bg-card rounded-brand border border-line p-4 space-y-3 text-xs">
                        <h4 className="font-bold text-ink text-sm flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-subtle" />
                          {ar ? 'تغيير كلمة المرور' : 'Change password'}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input type="password" required autoComplete="current-password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder={ar ? 'الحالية' : 'Current password'} className="border border-line rounded-brand-sm px-2 py-2" />
                          <input type="password" required autoComplete="new-password" minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={ar ? 'الجديدة (8+ أحرف)' : 'New (8+ chars)'} className="border border-line rounded-brand-sm px-2 py-2" />
                        </div>
                        <button type="submit" className="px-4 py-2 bg-secondary text-white rounded-brand-sm font-bold cursor-pointer">{ar ? 'تغيير' : 'Change'}</button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
