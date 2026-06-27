import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, Zap, DollarSign } from "lucide-react";

const AdminAnalytics = () => {
  const { t } = useTranslation();

  const { data } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      // Load AI usage + user emails together
      const [usageRes, usersRes] = await Promise.all([
        supabase.from("ai_usage").select("user_id, estimated_cost, model, created_at").order("created_at", { ascending: false }).limit(5000),
        supabase.functions.invoke("admin-list-users"),
      ]);

      const usage = usageRes.data ?? [];
      const emails: Record<string, string> = usersRes.data?.emails ?? {};

      // Group cost per user
      const perUser: Record<string, { cost: number; calls: number }> = {};
      usage.forEach((u: any) => {
        if (!perUser[u.user_id]) perUser[u.user_id] = { cost: 0, calls: 0 };
        perUser[u.user_id].cost += Number(u.estimated_cost || 0);
        perUser[u.user_id].calls++;
      });

      const top = Object.entries(perUser)
        .sort(([, a], [, b]) => b.cost - a.cost)
        .slice(0, 10)
        .map(([user_id, { cost, calls }]) => ({
          user: emails[user_id] ? emails[user_id].split("@")[0] : user_id.slice(0, 8),
          email: emails[user_id] || user_id,
          cost: Number(cost.toFixed(4)),
          calls,
        }));

      // Model usage breakdown
      const perModel: Record<string, number> = {};
      usage.forEach((u: any) => {
        const m = (u.model || "unknown").split("/").pop() || "unknown";
        perModel[m] = (perModel[m] || 0) + 1;
      });
      const modelBreakdown = Object.entries(perModel)
        .sort(([, a], [, b]) => b - a)
        .map(([model, count]) => ({ model: model.replace("gemini-", "").replace("-preview", ""), count }));

      // Total cost
      const totalCost = usage.reduce((s, u: any) => s + Number(u.estimated_cost || 0), 0);

      // Last 7 days cost per day
      const last7: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        last7[d.toISOString().slice(0, 10)] = 0;
      }
      usage.forEach((u: any) => {
        const k = new Date(u.created_at).toISOString().slice(0, 10);
        if (k in last7) last7[k] += Number(u.estimated_cost || 0);
      });
      const costChart = Object.entries(last7).map(([date, cost]) => ({ date: date.slice(5), cost: Number(cost.toFixed(4)) }));

      return { top, totalUsage: usage.length, totalCost: totalCost.toFixed(4), modelBreakdown, costChart };
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{t("admin.analytics.title")}</h1>
        <p className="text-slate-500 mt-1">{t("admin.analytics.subtitle")}</p>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-soft">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.totalUsage ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total AI calls</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">${data?.totalCost ?? "0"}</p>
              <p className="text-xs text-muted-foreground">Total AI cost</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.modelBreakdown?.[0]?.model ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Most used model</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily cost chart */}
      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <h3 className="font-display font-semibold text-lg mb-4">AI Cost — Last 7 days ($)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.costChart ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip formatter={(v: any) => [`$${v}`, "Cost"]} />
                <Bar dataKey="cost" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top spenders with email */}
      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <h3 className="font-display font-semibold text-lg mb-4">{t("admin.analytics.topSpenders")}</h3>
          <div className="space-y-2">
            {(data?.top ?? []).map((u, i) => (
              <div key={u.email} className="flex items-center gap-3 py-2 border-b last:border-0">
                <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.calls} calls</p>
                </div>
                <span className="text-sm font-bold text-rose-600">${u.cost}</span>
              </div>
            ))}
            {!data?.top?.length && <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>}
          </div>
        </CardContent>
      </Card>

      {/* Model breakdown */}
      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Model Usage Breakdown</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.modelBreakdown ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="model" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
