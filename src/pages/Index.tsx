import { lazy, Suspense, useState } from "react";
import DashboardSidebar from "@/components/DashboardSidebar";
import CategoryOnboarding from "@/components/CategoryOnboarding";
import NotificationBell from "@/components/NotificationBell";

// Lazy-load every dashboard tab — only the active one downloads.
const AnalyticsDashboard = lazy(() => import("@/components/AnalyticsDashboard"));
const CreditDashboard = lazy(() => import("@/components/CreditDashboard"));
const AiUsageDashboard = lazy(() => import("@/components/AiUsageDashboard"));
const AiTraining = lazy(() => import("@/components/AiTraining"));
const ProductsManager = lazy(() => import("@/components/ProductsManager"));
const ServicesManager = lazy(() => import("@/components/ServicesManager"));
const LeadsManager = lazy(() => import("@/components/LeadsManager"));
const PendingProducts = lazy(() => import("@/components/PendingProducts"));
const ProductSuggestions = lazy(() => import("@/components/ProductSuggestions"));
const WebsiteImport = lazy(() => import("@/components/WebsiteImport"));
const OrdersManager = lazy(() => import("@/components/OrdersManager"));
const ComplaintsManager = lazy(() => import("@/components/ComplaintsManager"));
const ConversationsView = lazy(() => import("@/components/ConversationsView"));
const AutoReplyRules = lazy(() => import("@/components/AutoReplyRules"));
const CommentTriggers = lazy(() => import("@/components/CommentTriggers"));
const ScheduledMessages = lazy(() => import("@/components/ScheduledMessages"));
const FbPageConnection = lazy(() => import("@/components/FbPageConnection"));
const BotSettings = lazy(() => import("@/components/BotSettings"));
const AdminPanel = lazy(() => import("@/components/AdminPanel"));

const tabs: Record<string, React.ComponentType> = {
  analytics: AnalyticsDashboard,
  credits: CreditDashboard,
  "ai-usage": AiUsageDashboard,
  "ai-training": AiTraining,
  products: ProductsManager,
  services: ServicesManager,
  leads: LeadsManager,
  "pending-products": PendingProducts,
  suggestions: ProductSuggestions,
  "website-import": WebsiteImport,
  orders: OrdersManager,
  complaints: ComplaintsManager,
  conversations: ConversationsView,
  "auto-reply": AutoReplyRules,
  "comment-triggers": CommentTriggers,
  scheduled: ScheduledMessages,
  "fb-pages": FbPageConnection,
  settings: BotSettings,
  admin: AdminPanel,
};

const TabFallback = () => (
  <div className="flex items-center justify-center py-20">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const Index = () => {
  const initialTab = (() => {
    if (typeof window === "undefined") return "analytics";
    const url = new URL(window.location.href);
    if (url.searchParams.get("fb_session") || url.searchParams.get("fb_error") || url.hash === "#fb-pages") return "fb-pages";
    return "analytics";
  })();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const ActiveComponent = tabs[activeTab] || AnalyticsDashboard;

  return (
    <div className="min-h-screen bg-background">
      <CategoryOnboarding />
      <DashboardSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <main
        className="transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? 72 : 240 }}
      >
        <div className="sticky top-0 z-30 flex justify-end items-center gap-2 px-6 lg:px-8 py-3 bg-background/80 backdrop-blur border-b">
          <NotificationBell />
        </div>
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
          <Suspense fallback={<TabFallback />}>
            <ActiveComponent />
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default Index;
