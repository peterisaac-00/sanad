import React from "react";
import { Compass } from "lucide-react";
import { Link, usePath } from "../lib/router";
import { Card, EmptyState } from "../components/ui";
import { DashboardHome } from "./DashboardHome";
import { OrdersPage, OrderDetailPage, OrderNotFound } from "./pages/OrdersPages";
import { ProductsPage } from "./pages/ProductsPages";
import { CategoriesPage, ReviewsPage } from "./pages/CatalogPages";
import { CustomersPage } from "./pages/CustomersPages";
import { ShippingPage } from "./pages/ShippingPage";
import { CouponsPage } from "./pages/CouponsPage";
import { AbandonedCartsPage, UpsellsPage, RelatedProductsPage } from "./pages/GrowthPages";
import { AffiliatesPage, BlogPage, PagesPage } from "./pages/ContentPages";
import { LoyaltyPage } from "./pages/LoyaltyPage";
import { AssistantPage } from "./pages/AssistantPage";
import { WalletPage, DropshippingPage } from "./pages/WalletPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LearnPage } from "./pages/LearnPage";
import { FeatureGate } from "./FeatureGate";
import { FEATURE_REGISTRY, isFeatureGated } from "./features";

function gate(path: string, page: React.ReactNode) {
  const feature = FEATURE_REGISTRY[path];
  if (feature && isFeatureGated(path)) return <FeatureGate feature={feature} />;
  return page;
}

/**
 * Route table for the merchant console. Every navigation entry in the sidebar
 * maps to a real page component; unknown paths render a helpful 404 instead of
 * a silent fallback so broken links are visible during development.
 */
export function DashboardRouter() {
  const fullPath = usePath();
  const path = fullPath === "/" ? "/dashboard" : fullPath;

  if (path === "/dashboard") return <DashboardHome />;
  if (path === "/dashboard/orders") return <OrdersPage />;
  if (path.startsWith("/dashboard/orders/")) {
    const orderId = decodeURIComponent(path.slice("/dashboard/orders/".length));
    if (!orderId || orderId.includes("/")) return <OrderNotFound />;
    return <OrderDetailPage orderId={orderId} />;
  }
  if (path === "/dashboard/reports") return <ReportsPage />;
  if (path === "/dashboard/products") return <ProductsPage />;
  if (path === "/dashboard/categories") return <CategoriesPage />;
  if (path === "/dashboard/customers") return <CustomersPage />;
  if (path === "/dashboard/shipping") return <ShippingPage />;
  if (path === "/dashboard/reviews") return <ReviewsPage />;
  if (path === "/dashboard/abandoned-carts") return <AbandonedCartsPage />;
  if (path === "/dashboard/upsells") return gate(path, <UpsellsPage />);
  if (path === "/dashboard/related-products") return <RelatedProductsPage />;
  if (path === "/dashboard/coupons") return <CouponsPage />;
  if (path === "/dashboard/affiliates") return <AffiliatesPage />;
  if (path === "/dashboard/loyalty") return gate(path, <LoyaltyPage />);
  if (path === "/dashboard/assistant") return <AssistantPage />;
  if (path === "/dashboard/pages") return <PagesPage />;
  if (path === "/dashboard/blog") return <BlogPage />;
  if (path === "/dashboard/wallet") return gate(path, <WalletPage />);
  if (path === "/dashboard/dropshipping") return gate(path, <DropshippingPage />);
  if (path === "/dashboard/settings") return <SettingsPage />;
  if (path === "/dashboard/learn") return <LearnPage />;

  return (
    <Card>
      <EmptyState
        title="الصفحة غير موجودة"
        description={`لا يوجد قسم بهذا المسار: ${path}`}
        icon={<Compass className="h-5 w-5" />}
        action={<Link href="/dashboard" className="rounded-brand border border-line px-4 py-2 text-xs font-semibold text-ink transition hover:border-brand-line">العودة إلى لوحة التحكم</Link>}
      />
    </Card>
  );
}
