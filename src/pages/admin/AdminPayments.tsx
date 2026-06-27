import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ExternalLink, TrendingUp, Users, DollarSign, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

const AdminPayments = () => {
  const { t } = useTranslation();

  const { data: paymentData, isLoading, refetch } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const [profilesRes, usersRes] = await Promise.all([
        supabase.from("profiles").select("id, subscription_status, subscription_plan, subscription_current_period_end, free_until, created_at").order("created_at", { ascending: false }),
        supabase.functions.invoke("admin-list-users"),
      ]);

      const profiles = profilesRes.data ?? [];
      const emails: Record<string, string> = usersRes.data?.emails ?? {};

      const activeSubs = profiles.filter((p: any) => p.subscription_status === "active");
      const trialUsers = profiles.filter((p: any) => p.free_until && new Date(p.free_until) > new Date());
      const mrr = activeSubs.length * 20;

      return { activeSubs, trialUsers, mrr, profiles, emails };
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">{t("admin.payments.title")}</h1>
          <p className="text-slate-500 mt-1">{t("admin.payments.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => window.open("https://dashboard.stripe.com", "_blank")}>
            <ExternalLink className="h-4 w-4 mr-1" /> Stripe Dashboard
          </Button>
        </div>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-soft">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">${paymentData?.mrr ?? 0}</p>
              <p className="text-xs text-muted-foreground">MRR (est.)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{paymentData?.activeSubs?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active subscribers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-soft">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{paymentData?.trialUsers?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">In free trial</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active subscribers */}
      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Active Subscribers
            </h3>
            <Badge className="bg-emerald-100 text-emerald-700">{paymentData?.activeSubs?.length ?? 0} active</Badge>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Renews</th>
              </tr>
            </thead>
            <tbody>
              {(paymentData?.activeSubs ?? []).map((p: any) => (
                <tr key={p.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs">{paymentData?.emails?.[p.id] || p.id.slice(0, 12)}</td>
                  <td className="px-4 py-3 text-xs">{p.subscription_plan || "$20/mo"}</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">{p.subscription_status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.subscription_current_period_end ? new Date(p.subscription_current_period_end).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
              {!paymentData?.activeSubs?.length && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500 text-sm">No active subscribers yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Trial users */}
      <Card className="border-0 shadow-soft">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Free Trial Users</h3>
            <Badge className="bg-amber-100 text-amber-700">{paymentData?.trialUsers?.length ?? 0} users</Badge>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Trial ends</th>
                <th className="px-4 py-3 text-left">Days left</th>
              </tr>
            </thead>
            <tbody>
              {(paymentData?.trialUsers ?? []).map((p: any) => {
                const daysLeft = Math.max(0, Math.ceil((new Date(p.free_until).getTime() - Date.now()) / 86400000));
                return (
                  <tr key={p.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs">{paymentData?.emails?.[p.id] || p.id.slice(0, 12)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.free_until).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Badge className={daysLeft <= 3 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"} variant="outline">
                        {daysLeft}d left
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {!paymentData?.trialUsers?.length && (
                <tr><td colSpan={3} className="p-8 text-center text-slate-500 text-sm">No trial users</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPayments;
