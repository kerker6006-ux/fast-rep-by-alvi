import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, ShoppingCart, MessageSquare, Globe, Coins, Bot, Package, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const AdminOverview = () => {
  const { t } = useTranslation();
  const { data: stats } = useQuery({
    queryKey: ["admin-overview-stats"],
    queryFn: async () => {
      const [users, orders, conversations, fbPages, products, creditsAgg, recentSignups] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("conversations").select("id", { count: "exact", head: true }),
        supabase.from("fb_pages_safe").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("user_credits").select("balance"),
        supabase.from("profiles").select("created_at").order("created_at", { ascending: false }).limit(30),
      ]);
      const totalCredits = (creditsAgg.data ?? []).reduce((s, r: any) => s + Number(r.balance || 0), 0);
      // Group signups per day (last 14 days)
      const byDay: Record<string, number> = {};
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        byDay[d.toISOString().slice(0, 10)] = 0;
      }
      (recentSignups.data ?? []).forEach((r: any) => {
        const k = new Date(r.created_at).toISOString().slice(0, 10);
        if (k in byDay) byDay[k]++;
      });
      const chart = Object.entries(byDay).map(([date, count]) => ({ date: date.slice(5), count }));
      return {
        users: users.count ?? 0,
        orders: orders.count ?? 0,
        conversations: conversations.count ?? 0,
        fbPages: fbPages.count ?? 0,
        products: products.count ?? 0,
        totalCredits,
        chart,
      };
    },
  });

  const tiles = [
    { icon: Users, label: t("admin.stats.users"), value: stats?.users ?? 0, color: "from-blue-500 to-blue-600" },
    { icon: Bot, label: t("admin.stats.fbPages"), value: stats?.fbPages ?? 0, color: "from-indigo-500 to-indigo-600" },
    { icon: Package, label: t("admin.stats.products"), value: stats?.products ?? 0, color: "from-sky-500 to-sky-600" },
    { icon: ShoppingCart, label: t("admin.stats.orders"), value: stats?.orders ?? 0, color: "from-cyan-500 to-cyan-600" },
    { icon: MessageSquare, label: t("admin.stats.conversations"), value: stats?.conversations ?? 0, color: "from-violet-500 to-violet-600" },
    { icon: Coins, label: t("admin.stats.totalCredits"), value: `$${(stats?.totalCredits ?? 0).toLocaleString()}`, color: "from-amber-500 to-amber-600" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-50">{t("admin.overview.title")}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{t("admin.overview.subtitle")}</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="border-0 shadow-soft hover:shadow-elevated transition-all overflow-hidden">
            <CardContent className="p-5">
              <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${tile.color} flex items-center justify-center mb-4`}>
                <tile.icon className="h-5 w-5 text-white" />
              </div>
              <p className="text-3xl font-display font-bold text-slate-900 dark:text-slate-50">{tile.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">{tile.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h3 className="font-display font-semibold text-lg">{t("admin.overview.signups14d")}</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.chart ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
