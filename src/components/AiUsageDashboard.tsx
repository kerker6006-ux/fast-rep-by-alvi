import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Image as ImageIcon, ShoppingCart, DollarSign, TrendingUp, Calendar, Type, Coins, Brain } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

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

      const textRows = rows.filter((r: any) => r.call_type === "text");
      const imageRows = rows.filter((r: any) => r.call_type === "image");
      const orderRows = rows.filter((r: any) => r.call_type === "order_detection");
      const trainingRows = rows.filter((r: any) => r.call_type === "training");

      const textCost = textRows.reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);
      const imageCost = imageRows.reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);
      const trainingCost = trainingRows.reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);
      const totalCost = textCost + imageCost + trainingCost + orderRows.reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);
      const totalTokens = textRows.reduce((s: number, r: any) => s + (Number(r.tokens_used) || 0), 0);

      const today = new Date(); today.setHours(0,0,0,0);
      const todayRows = rows.filter((r: any) => new Date(r.created_at) >= today);
      const todayTextCost = todayRows.filter((r: any) => r.call_type === "text").reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);
      const todayImageCost = todayRows.filter((r: any) => r.call_type === "image").reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);
      const todayTrainingCost = todayRows.filter((r: any) => r.call_type === "training").reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);

      const dailyMap: Record<string, { date: string; text: number; image: number; textCost: number; imageCost: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dailyMap[key] = { date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), text: 0, image: 0, textCost: 0, imageCost: 0 };
      }
      for (const r of rows) {
        const key = r.created_at.slice(0, 10);
        if (!dailyMap[key]) continue;
        if (r.call_type === "text") { dailyMap[key].text++; dailyMap[key].textCost += Number(r.estimated_cost) || 0; }
        else if (r.call_type === "image") { dailyMap[key].image++; dailyMap[key].imageCost += Number(r.estimated_cost) || 0; }
      }

      return {
        textCount: textRows.length, imageCount: imageRows.length, orderCount: orderRows.length, trainingCount: trainingRows.length,
        textCost, imageCost, trainingCost, totalCost, totalTokens,
        todayTextCost, todayImageCost, todayTrainingCost,
        chartData: Object.values(dailyMap),
        costText, costImage,
      };
    },
  });

  if (isLoading) {
    return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>;
  }

  const fmt = (n: number) => `$${(n || 0).toFixed(4)}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("aiUsage.title")}</h2>
        <p className="text-muted-foreground">{t("aiUsage.subtitle")}</p>
      </div>

      {/* PRIMARY COST CARDS — split by type */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Type className="h-4 w-4 text-blue-500" /> Text AI Cost</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmt(data?.textCost || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">{data?.textCount || 0} messages · {(data?.totalTokens || 0).toLocaleString()} tokens</p>
            <p className="text-xs text-emerald-600 mt-0.5">Today: {fmt(data?.todayTextCost || 0)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><ImageIcon className="h-4 w-4 text-purple-500" /> Image Cost</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmt(data?.imageCost || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">{data?.imageCount || 0} images analyzed</p>
            <p className="text-xs text-emerald-600 mt-0.5">Today: {fmt(data?.todayImageCost || 0)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Brain className="h-4 w-4 text-amber-500" /> AI Training Cost</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmt(data?.trainingCost || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">{data?.trainingCount || 0} training calls</p>
            <p className="text-xs text-emerald-600 mt-0.5">Today: {fmt(data?.todayTrainingCost || 0)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Coins className="h-4 w-4 text-emerald-500" /> Total AI Cost</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmt(data?.totalCost || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">All-time, all AI calls</p>
          </CardContent>
        </Card>
      </div>

      {/* SECONDARY STATS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Total Calls</CardTitle><TrendingUp className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold">{(data?.textCount || 0) + (data?.imageCount || 0) + (data?.orderCount || 0)}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Text Messages</CardTitle><MessageSquare className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{data?.textCount || 0}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Images</CardTitle><ImageIcon className="h-4 w-4 text-purple-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{data?.imageCount || 0}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Order Detections</CardTitle><ShoppingCart className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{data?.orderCount || 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Last 7 days — Text vs Image</CardTitle></CardHeader>
        <CardContent>
          {data?.chartData?.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="text" name="Text" stackId="a" fill="hsl(217 72% 52%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="image" name="Image" stackId="a" fill="hsl(262 80% 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">No data</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Per-Call Pricing</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Text Reply</span><span className="font-medium">${(data?.costText ?? 0).toFixed(3)} / message</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Image Analysis</span><span className="font-medium">${(data?.costImage ?? 0).toFixed(3)} / image</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Order Detection</span><span className="font-medium text-emerald-600">Free</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Auto-Reply Keywords</span><span className="font-medium text-emerald-600">Free</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AiUsageDashboard;
