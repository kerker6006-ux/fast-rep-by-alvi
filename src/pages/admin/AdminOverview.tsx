import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, ShoppingCart, MessageSquare, Coins, Bot, TrendingUp, CreditCard, UserCheck, Clock, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const AdminOverview = () => {
  const { t } = useTranslation();

  const { data: stats } = useQuery({
    queryKey: ["admin-overview-stats"],
    queryFn: async () => {
      const [users, orders, conversations, fbPages, creditsAgg, recentSignups, subStats, aiCost] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("conversations").select("id", { count: "exact", head: true }),
        supabase.from("fb_pages_safe").select("id", { count: "exact", head: true }),
        supabase.from("user_credits").select("balance"),
        supabase.from("profiles").select("created_at").order("created_at", { ascending: false }).limit(30),
        supabase.from("profiles").select("subscription_status, free_until"),
        supabase.from("ai_usage").select("estimated_cost").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const totalCredits = (creditsAgg.data ?? []).reduce((s, r: any) => s + Number(r.balance || 0), 0);

      // Subscription breakdown
      const profiles = subStats.data ?? [];
      const activeSubs = profiles.filter((p: any) => p.subscription_status === "active").length;
      const inTrial = profiles.filter((p: any) => p.free_until && new Date(p.free_until) > new Date()).length;
      const churned = profiles.filter((p: any) => !p.subscription_status && (!p.free_until || new Date(p.free_until) < new Date())).length;

      // MRR estimate ($20/mo per active sub)
      const mrr = activeSubs * 20;

      // AI cost this month
      const monthlyAiCost = (aiCost.data ?? []).reduce((s, r: any) => s + Number(r.estimated_cost || 0), 0);

      // Signup chart last 14 days
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
        totalCredits,
        activeSubs,
        inTrial,
        churned,
        mrr,
        monthlyAiCost: monthlyAiCost.toFixed(2),
        chart,
      };
    },
  });

  const tiles = [
    { icon: Users, label: "Total Users", value: stats?.users ?? 0, color: "from-blue-500 to-blue-600" },
    { icon: UserCheck, label: "Active Subscriptions", value: stats?.activeSubs ?? 0, color: "from-emerald-500 to-emerald-600" },
    { icon: Clock, label: "In Free Trial", value: stats?.inTrial ?? 0, color: "from-amber-500 to-amber-600" },
    { icon: UserX, label: "Churned Users", value: stats?.churned ?? 0, color: "from-rose-500 to-rose-600" },
    { icon: CreditCard, label: "MRR (est.)", value: `$${stats?.mrr ?? 0}`, color: "from-violet-500 to-violet-600" },
    { icon: Bot, label: "Connected Pages", value: stats?.fbPages ?? 0, color: "from-indigo-500 to-indigo-600" },
    { icon: MessageSquare, label: "Conversations", value: stats?.conversations ?? 0, color: "from-sky-500 to-sky-600" },
    { icon: ShoppingCart, label: "Orders", value: stats?.orders ?? 0, color: "from-cyan-500 to-cyan-600" },
    { icon: Coins, label: "Credits Balance", value: `$${(stats?.totalCredits ?? 0).toFixed(2)}`, color: "from-yellow-500 to-yellow-600" },
    { icon: TrendingUp, label: "AI Cost (30d)", value: `$${stats?.monthlyAiCost ?? "0.00"}`, color: "from-orange-500 to-orange-600" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-50">Dashboard Overview</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time platform metrics</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="border-0 shadow-soft hover:shadow-elevated transition-all overflow-hidden">
            <CardContent className="p-4">
              <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${tile.color} flex items-center justify-center mb-3`}>
                <tile.icon className="h-4 w-4 text-white" />
              </div>
              <p className="text-2xl font-display font-bold text-slate-900 dark:text-slate-50">{tile.value}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wide">{tile.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-soft">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h3 className="font-display font-semibold text-lg">Signups — Last 14 days</h3>
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
