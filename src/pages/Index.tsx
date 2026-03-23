import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, MessageSquare, Settings, ShoppingCart, Zap, BarChart3, Clock } from "lucide-react";
import ProductsManager from "@/components/ProductsManager";
import ConversationsView from "@/components/ConversationsView";
import BotSettings from "@/components/BotSettings";
import OrdersManager from "@/components/OrdersManager";
import AutoReplyRules from "@/components/AutoReplyRules";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import ScheduledMessages from "@/components/ScheduledMessages";
import DashboardHeader from "@/components/DashboardHeader";

const Index = () => {
  const [activeTab, setActiveTab] = useState("analytics");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex w-full max-w-4xl mx-auto overflow-x-auto">
            <TabsTrigger value="analytics" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="conversations" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chats</span>
            </TabsTrigger>
            <TabsTrigger value="auto-reply" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Auto-Reply</span>
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Scheduled</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics"><AnalyticsDashboard /></TabsContent>
          <TabsContent value="products"><ProductsManager /></TabsContent>
          <TabsContent value="orders"><OrdersManager /></TabsContent>
          <TabsContent value="conversations"><ConversationsView /></TabsContent>
          <TabsContent value="auto-reply"><AutoReplyRules /></TabsContent>
          <TabsContent value="scheduled"><ScheduledMessages /></TabsContent>
          <TabsContent value="settings"><BotSettings /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
