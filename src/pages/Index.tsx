import { useState } from "react";
import DashboardSidebar from "@/components/DashboardSidebar";
import ProductsManager from "@/components/ProductsManager";
import ConversationsView from "@/components/ConversationsView";
import BotSettings from "@/components/BotSettings";
import OrdersManager from "@/components/OrdersManager";
import AutoReplyRules from "@/components/AutoReplyRules";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import ScheduledMessages from "@/components/ScheduledMessages";
import AiTraining from "@/components/AiTraining";

const tabs: Record<string, React.ComponentType> = {
  analytics: AnalyticsDashboard,
  "ai-training": AiTraining,
  products: ProductsManager,
  orders: OrdersManager,
  conversations: ConversationsView,
  "auto-reply": AutoReplyRules,
  scheduled: ScheduledMessages,
  settings: BotSettings,
};

const Index = () => {
  const [activeTab, setActiveTab] = useState("analytics");
  const ActiveComponent = tabs[activeTab] || AnalyticsDashboard;

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="ml-[240px] transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
};

export default Index;
