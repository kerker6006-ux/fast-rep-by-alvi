import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { MessageSquare, Users, ShoppingCart, TrendingUp, Clock, Sparkles, ArrowUpRight } from "lucide-react";

const AnalyticsDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

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
          .gte("last_message_at", weekAgo).order("last_message_at", { ascending: false }).limit(8),
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

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 bg-muted/40 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();
  const firstName = (user?.user_metadata?.display_name || user?.email?.split("@")[0] || "").split(" ")[0];

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 sm:p-8 shadow-glow">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-primary-glow/30 rounded-full blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-white/90 text-xs font-medium mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t("analytics.title")}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="text-white/85 mt-2 text-sm sm:text-base max-w-xl">{t("analytics.subtitle")}</p>
        </div>
      </div>

      {/* Bento stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-[minmax(120px,auto)]">
        {/* Revenue — big */}
        <Card className="col-span-2 lg:col-span-2 lg:row-span-2 p-6 rounded-3xl border-border/60 shadow-soft hover:shadow-elevated transition-shadow bg-gradient-soft relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
          <div className="relative flex flex-col h-full justify-between gap-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("analytics.totalRevenue")}</p>
                <p className="font-display text-4xl sm:text-5xl font-bold mt-2 text-gradient">৳{stats?.totalRevenue?.toLocaleString() || 0}</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {stats?.deliveredOrders || 0} {t("analytics.deliveredOrders").toLowerCase()}
              </span>
              <span>of {stats?.totalOrders || 0} {t("analytics.totalOrders").toLowerCase()}</span>
            </div>
          </div>
        </Card>

        <StatTile label={t("analytics.totalConversations")} value={stats?.totalConversations || 0} icon={Users} accent="blue" />
        <StatTile label={t("analytics.todayMessages")} value={stats?.todayMessages || 0} icon={Clock} accent="amber" />
        <StatTile label={t("analytics.totalMessages")} value={stats?.totalMessages || 0} icon={MessageSquare} accent="emerald" />
        <StatTile label={t("analytics.totalOrders")} value={stats?.totalOrders || 0} icon={ShoppingCart} accent="purple" />
      </div>

      {/* Recent conversations */}
      <Card className="rounded-3xl border-border/60 shadow-soft overflow-hidden">
        <div className="p-6 border-b border-border/60 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">{t("analytics.recentConversations")}</h3>
            <p className="text-xs text-muted-foreground">{t("analytics.last7Days")}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div className="divide-y divide-border/60">
          {stats?.recentConversations?.length ? (
            stats.recentConversations.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 px-6 py-4 hover:bg-accent/40 transition-colors">
                <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  {(c.sender_name || "C").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{c.sender_name || `${t("analytics.customer")} ${c.fb_sender_id?.slice(-4) || "?"}`}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : ""}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">{t("analytics.noRecent")}</p>
          )}
        </div>
      </Card>
    </div>
  );
};

const accents = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-600" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-600" },
} as const;

const StatTile = ({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: React.ElementType; accent: keyof typeof accents }) => {
  const a = accents[accent];
  return (
    <Card className="p-5 rounded-3xl border-border/60 shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className={`h-9 w-9 rounded-xl ${a.bg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${a.text}`} />
        </div>
      </div>
      <p className="font-display text-2xl sm:text-3xl font-bold">{value}</p>
    </Card>
  );
};

export default AnalyticsDashboard;
