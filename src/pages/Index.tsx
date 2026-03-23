import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, MessageSquare, Settings, Bot } from "lucide-react";
import ProductsManager from "@/components/ProductsManager";
import ConversationsView from "@/components/ConversationsView";
import BotSettings from "@/components/BotSettings";
import DashboardHeader from "@/components/DashboardHeader";

const Index = () => {
  const [activeTab, setActiveTab] = useState("products");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3 mx-auto">
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="conversations" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversations
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <ProductsManager />
          </TabsContent>
          <TabsContent value="conversations">
            <ConversationsView />
          </TabsContent>
          <TabsContent value="settings">
            <BotSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
