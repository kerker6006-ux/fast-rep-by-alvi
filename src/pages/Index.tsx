import { lazy, Suspense, useEffect, useState } from "react";
import DashboardSidebar from "@/components/DashboardSidebar";
import CategoryOnboarding from "@/components/CategoryOnboarding";
import NotificationBell from "@/components/NotificationBell";
import PaywallCard from "@/components/PaywallCard";
import PageSwitcher from "@/components/PageSwitcher";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useActivePage } from "@/contexts/ActivePageContext";
import { isTabAllowedForRole, MODERATOR_ALLOWED_TABS } from "@/lib/pageAccess";

// Lazy-load every dashboard tab — only the active one downloads.
const AnalyticsDashboard = lazy(() => import("@/components/AnalyticsDashboard"));
const CreditDashboard = lazy(() => import("@/components/CreditDashboard"));
const AiUsageDashboard = lazy(() => import("@/components/AiUsageDashboard"));
const AiTraining = lazy(() => import("@/components/AiTraining"));
const ProductsManager = lazy(() => import("@/components/ProductsManager"));
const ServicesManager = lazy(() => import("@/components/ServicesManager"));
const CoursesManager = lazy(() => import("@/components/CoursesManager"));
const EnrollmentsManager = lazy(() => import("@/components/EnrollmentsManager"));
const LeadsManager = lazy(() => import("@/components/LeadsManager"));
const PendingProducts = lazy(() => import("@/components/PendingProducts"));
const ProductSuggestions = lazy(() => import("@/components/ProductSuggestions"));
const WebsiteImport = lazy(() => import("@/components/WebsiteImport"));
const OrdersManager = lazy(() => import("@/components/OrdersManager"));
const ComplaintsManager = lazy(() => import("@/components/ComplaintsManager"));
const ConversationsView = lazy(() => import("@/components/ConversationsView"));
const AutoReplyRules = lazy(() => import("@/components/AutoReplyRules"));
const CommentTriggers = lazy(() => import("@/components/CommentTriggers"));
const Broadcast = lazy(() => import("@/components/Broadcast"));
const FbPageConnection = lazy(() => import("@/components/FbPageConnection"));
const BotSettings = lazy(() => import("@/components/BotSettings"));


const tabs: Record<string, React.ComponentType> = {
  analytics: AnalyticsDashboard,
  credits: CreditDashboard,
  "ai-usage": AiUsageDashboard,
  "ai-training": AiTraining,
  products: ProductsManager,
  services: ServicesManager,
  courses: CoursesManager,
  enrollments: EnrollmentsManager,
  leads: LeadsManager,
  "pending-products": PendingProducts,
  suggestions: ProductSuggestions,
  "website-import": WebsiteImport,
  orders: OrdersManager,
  complaints: ComplaintsManager,
  conversations: ConversationsView,
  "auto-reply": AutoReplyRules,
  "comment-triggers": CommentTriggers,
  broadcast: Broadcast,
  "fb-pages": FbPageConnection,
  settings: BotSettings,
  
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
  const { accessRole, activePage, pages } = useActivePage();

  // Bug #11 fix: redirect new users to connect page if they have no pages yet
  useEffect(() => {
    if (pages !== undefined && pages.length === 0 && activeTab !== "fb-pages") {
      setActiveTab("fb-pages");
    }
  }, [pages]);

  // Force moderator to an allowed tab if they land on a restricted one (e.g. after switching pages)
  useEffect(() => {
    if (accessRole === "moderator" && !isTabAllowedForRole(activeTab, accessRole)) {
      setActiveTab("conversations");
    }
  }, [accessRole, activeTab]);

  const safeTab = accessRole === "moderator" && !MODERATOR_ALLOWED_TABS.has(activeTab) ? "conversations" : activeTab;
  const ActiveComponent = tabs[safeTab] || AnalyticsDashboard;
  const { isLocked } = useSubscriptionStatus();

  // Tabs that remain usable when the free month has ended with no active subscription.
  const allowedWhenLocked = new Set([
    "credits",
    "comment-triggers",
    "fb-pages",

    "analytics",
  ]);
  const showPaywall = isLocked && !allowedWhenLocked.has(activeTab);

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
        <div className="sticky top-0 z-30 flex justify-between items-center gap-2 px-6 lg:px-8 py-3 bg-background/80 backdrop-blur border-b">
          <PageSwitcher />
          <NotificationBell />
        </div>
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
          {/* Admin announcements shown to all users */}
          <AnnouncementBanner />
          {/* Bug #11 fix: onboarding banner for new users with no page connected */}
          {pages !== undefined && pages.length === 0 && activeTab !== "fb-pages" && (
            <div className="mb-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-6 text-center space-y-3">
              <div className="text-4xl">🤖</div>
              <h2 className="text-xl font-bold">Welcome to LeadPilot!</h2>
              <p className="text-muted-foreground max-w-md mx-auto">Connect your Facebook page to activate your AI bot. It takes less than 2 minutes.</p>
              <button
                onClick={() => setActiveTab("fb-pages")}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Connect Facebook Page →
              </button>
            </div>
          )}
          {showPaywall ? (
            <PaywallCard onGoToBilling={() => setActiveTab("credits")} />
          ) : (
            <Suspense fallback={<TabFallback />}>
              <ActiveComponent />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
