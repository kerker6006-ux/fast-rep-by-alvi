import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const AdminAnalytics = () => {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const { data: usage } = await supabase
        .from("ai_usage")
        .select("user_id, tokens_used, cost, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      // Group cost per user
      const perUser: Record<string, number> = {};
      (usage ?? []).forEach((u: any) => {
        perUser[u.user_id] = (perUser[u.user_id] || 0) + Number(u.cost || 0);
      });
      const top = Object.entries(perUser)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([user_id, cost]) => ({ user: user_id.slice(0, 8), cost: Number(cost.toFixed(2)) }));
      return { top, totalUsage: usage?.length ?? 0 };
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{t("admin.analytics.title")}</h1>
        <p className="text-slate-500 mt-1">{t("admin.analytics.subtitle")}</p>
      </header>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <h3 className="font-display font-semibold text-lg mb-4">{t("admin.analytics.topSpenders")}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.top ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="user" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Bar dataKey="cost" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
