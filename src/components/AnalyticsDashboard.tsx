import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, ShoppingCart, TrendingUp, Clock } from "lucide-react";

const AnalyticsDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

      const [convos, messages, todayMessages, orders, recentConvos] = await Promise.all([
        supabase.from("conversations").select("id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("orders").select("id, total, status", { count: "exact" }),
        supabase.from("conversations").select("id, sender_name, fb_sender_id, last_message, last_message_at")
          .gte("last_message_at", weekAgo).order("last_message_at", { ascending: false }).limit(10),
      ]);

      const orderData = orders.data || [];
      const totalRevenue = orderData.reduce((sum: number, o: any) => 
        o.status !== "cancelled" ? sum + (Number(o.total) || 0) : sum, 0);
      const deliveredOrders = orderData.filter((o: any) => o.status === "delivered").length;

      return {
        totalConversations: convos.count || 0,
        totalMessages: messages.count || 0,
        todayMessages: todayMessages.count || 0,
        totalOrders: orders.count || 0,
        deliveredOrders,
        totalRevenue,
        recentConversations: recentConvos.data || [],
      };
    },
  });

  if (isLoading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>;

  const cards = [
    { title: "Total Conversations", value: stats?.totalConversations || 0, icon: Users, color: "text-blue-600" },
    { title: "Total Messages", value: stats?.totalMessages || 0, icon: MessageSquare, color: "text-green-600" },
    { title: "Today's Messages", value: stats?.todayMessages || 0, icon: Clock, color: "text-orange-600" },
    { title: "Total Orders", value: stats?.totalOrders || 0, icon: ShoppingCart, color: "text-purple-600" },
    { title: "Delivered Orders", value: stats?.deliveredOrders || 0, icon: TrendingUp, color: "text-emerald-600" },
    { title: "Total Revenue", value: `৳${stats?.totalRevenue?.toLocaleString() || 0}`, icon: TrendingUp, color: "text-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">Overview of your bot's performance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Conversations (Last 7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentConversations?.length ? (
            <div className="space-y-3">
              {stats.recentConversations.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{c.sender_name || `Customer ${c.fb_sender_id?.slice(-4) || "?"}`}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{c.last_message}</p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent conversations.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
