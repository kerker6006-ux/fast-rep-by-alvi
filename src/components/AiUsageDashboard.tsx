import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Image, ShoppingCart, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const AiUsageDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["ai-usage", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [usageRes, settingsRes] = await Promise.all([
        supabase.from("ai_usage").select("*").order("created_at", { ascending: false }),
        supabase.from("bot_settings").select("setting_key, setting_value").eq("user_id", user!.id),
      ]);

      if (usageRes.error) throw usageRes.error;
      const rows = usageRes.data || [];

      const settingsMap: Record<string, string> = {};
      settingsRes.data?.forEach((s: any) => { settingsMap[s.setting_key] = s.setting_value; });
      const costText = Number(settingsMap.credit_cost_text) || 0.003;
      const costImage = Number(settingsMap.credit_cost_image) || 0.015;

      const textCalls = rows.filter((r: any) => r.call_type === "text").length;
      const imageCalls = rows.filter((r: any) => r.call_type === "image").length;
      const orderCalls = rows.filter((r: any) => r.call_type === "order_detection").length;
      const totalCost = rows.reduce((sum: number, r: any) => sum + (Number(r.estimated_cost) || 0), 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayRows = rows.filter((r: any) => new Date(r.created_at) >= today);
      const todayCost = todayRows.reduce((sum: number, r: any) => sum + (Number(r.estimated_cost) || 0), 0);

      const dailyMap: Record<string, { date: string; text: number; image: number; cost: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

      return {
        textCalls, imageCalls, orderCalls, totalCost, todayCost,
        totalCalls: rows.length, chartData: Object.values(dailyMap),
        costText, costImage,
      };
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

  const costText = data?.costText ?? 0.003;
  const costImage = data?.costImage ?? 0.015;

  const cards = [
    { title: t("aiUsage.totalCalls"), value: data?.totalCalls || 0, icon: TrendingUp, color: "text-primary" },
    { title: t("aiUsage.textMessages"), value: data?.textCalls || 0, icon: MessageSquare, color: "text-blue-600" },
    { title: t("aiUsage.imageAnalyses"), value: data?.imageCalls || 0, icon: Image, color: "text-purple-600" },
    { title: t("aiUsage.orderDetections"), value: data?.orderCalls || 0, icon: ShoppingCart, color: "text-orange-600" },
    { title: t("aiUsage.todayCost"), value: `$${data?.todayCost?.toFixed(4) || "0.0000"}`, icon: Calendar, color: "text-emerald-600" },
    { title: t("aiUsage.totalCost"), value: `$${data?.totalCost?.toFixed(4) || "0.0000"}`, icon: DollarSign, color: "text-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("aiUsage.title")}</h2>
        <p className="text-muted-foreground">{t("aiUsage.subtitle")}</p>
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
          <CardTitle className="text-base">{t("aiUsage.last7DaysUsage")}</CardTitle>
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
                <Bar dataKey="text" name={t("aiUsage.textMessages")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="image" name={t("aiUsage.imageAnalyses")} fill="hsl(262 80% 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">{t("aiUsage.noData")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("aiUsage.costBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">{t("aiUsage.textReply")}</span>
              <span className="font-medium">${costText.toFixed(3)} / {t("aiUsage.perMessage")}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">{t("aiUsage.imageReply")}</span>
              <span className="font-medium">${costImage.toFixed(3)} / {t("aiUsage.perImage")}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">{t("aiUsage.orderDetection")}</span>
              <span className="font-medium text-emerald-600">{t("common.free")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("aiUsage.autoReplyKeyword")}</span>
              <span className="font-medium text-emerald-600">{t("common.free")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AiUsageDashboard;
