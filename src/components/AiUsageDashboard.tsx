import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Image, ShoppingCart, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const AiUsageDashboard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-usage"],
    queryFn: async () => {
      const { data: usage, error } = await supabase
        .from("ai_usage")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = usage || [];

      const textCalls = rows.filter((r: any) => r.call_type === "text").length;
      const imageCalls = rows.filter((r: any) => r.call_type === "image").length;
      const orderCalls = rows.filter((r: any) => r.call_type === "order_detection").length;
      const totalCost = rows.reduce((sum: number, r: any) => sum + (Number(r.estimated_cost) || 0), 0);

      // Today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayRows = rows.filter((r: any) => new Date(r.created_at) >= today);
      const todayCost = todayRows.reduce((sum: number, r: any) => sum + (Number(r.estimated_cost) || 0), 0);

      // Last 7 days chart
      const dailyMap: Record<string, { date: string; text: number; image: number; cost: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en", { month: "short", day: "numeric" });
        dailyMap[key] = { date: label, text: 0, image: 0, cost: 0 };
      }
      for (const r of rows) {
        const key = r.created_at.slice(0, 10);
        if (dailyMap[key]) {
          if (r.call_type === "text") dailyMap[key].text++;
          else if (r.call_type === "image") dailyMap[key].image++;
          dailyMap[key].cost += Number(r.estimated_cost) || 0;
        }
      }
      const chartData = Object.values(dailyMap);

      return { textCalls, imageCalls, orderCalls, totalCost, todayCost, totalCalls: rows.length, chartData };
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  const cards = [
    { title: "Total AI Calls", value: data?.totalCalls || 0, icon: TrendingUp, color: "text-primary" },
    { title: "Text Messages", value: data?.textCalls || 0, icon: MessageSquare, color: "text-blue-600" },
    { title: "Image Analyses", value: data?.imageCalls || 0, icon: Image, color: "text-purple-600" },
    { title: "Order Detections", value: data?.orderCalls || 0, icon: ShoppingCart, color: "text-orange-600" },
    { title: "Today's Cost", value: `$${data?.todayCost?.toFixed(4) || "0.0000"}`, icon: Calendar, color: "text-emerald-600" },
    { title: "Total Cost", value: `$${data?.totalCost?.toFixed(4) || "0.0000"}`, icon: DollarSign, color: "text-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Usage</h2>
        <p className="text-muted-foreground">Track your bot's AI credit consumption.</p>
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
          <CardTitle className="text-base">Last 7 Days Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.chartData?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="text" name="Text" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="image" name="Image" fill="hsl(262 80% 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No usage data yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Text message (AI reply)</span>
              <span className="font-medium">~$0.0005 / call</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Image analysis (with product comparison)</span>
              <span className="font-medium">~$0.003 / call</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Order detection</span>
              <span className="font-medium">~$0.0002 / call</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auto-reply (keyword match)</span>
              <span className="font-medium text-emerald-600">Free</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AiUsageDashboard;
