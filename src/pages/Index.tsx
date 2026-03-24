import { useState } from "react";
import DashboardSidebar from "@/components/DashboardSidebar";
import ProductsManager from "@/components/ProductsManager";
import ConversationsView from "@/components/ConversationsView";
import BotSettings from "@/components/BotSettings";
import OrdersManager from "@/components/OrdersManager";
import ComplaintsManager from "@/components/ComplaintsManager";
import AutoReplyRules from "@/components/AutoReplyRules";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import ScheduledMessages from "@/components/ScheduledMessages";
import AiTraining from "@/components/AiTraining";
import AdminPanel from "@/components/AdminPanel";
import FbPageConnection from "@/components/FbPageConnection";
import AiUsageDashboard from "@/components/AiUsageDashboard";
import CreditDashboard from "@/components/CreditDashboard";

const tabs: Record<string, React.ComponentType> = {
  analytics: AnalyticsDashboard,
  credits: CreditDashboard,
  "ai-usage": AiUsageDashboard,
  "ai-training": AiTraining,
  products: ProductsManager,
  orders: OrdersManager,
  complaints: ComplaintsManager,
  conversations: ConversationsView,
  "auto-reply": AutoReplyRules,
  scheduled: ScheduledMessages,
  "fb-pages": FbPageConnection,
  settings: BotSettings,
  admin: AdminPanel,
};

const Index = () => {
  const [activeTab, setActiveTab] = useState("analytics");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const ActiveComponent = tabs[activeTab] || AnalyticsDashboard;

  return (
    <div className="min-h-screen bg-background">
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
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
};

export default Index;
