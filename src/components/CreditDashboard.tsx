import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Coins, MessageSquare, Image, ArrowDownCircle, ArrowUpCircle, Sparkles, CreditCard, Loader2 } from "lucide-react";

const fmtUSD = (n: number) => `$${Number(n).toFixed(3)}`;
const fmtBalance = (n: number) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CreditDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [topupAmount, setTopupAmount] = useState("5");
  const [loadingFlow, setLoadingFlow] = useState<null | "subscription" | "topup">(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("billing");
    if (!status) return;
    if (status === "success") toast.success("Subscription activated! $5 welcome bonus added.");
    else if (status === "topup-success") toast.success("Top-up successful! Balance updated.");
    else if (status === "cancelled") toast.info("Checkout cancelled.");
    params.delete("billing"); params.delete("session_id");
    const url = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", url);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["credits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [credits, transactions, settings, profile] = await Promise.all([
        supabase.from("user_credits").select("balance").eq("user_id", user!.id).maybeSingle(),
        supabase.from("credit_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("bot_settings").select("setting_key, setting_value").eq("user_id", user!.id).is("fb_page_id", null),
        supabase.from("profiles").select("subscription_status, subscription_plan, subscription_current_period_end, free_until").eq("id", user!.id).maybeSingle(),
      ]);

      const settingsMap: Record<string, string> = {};
      settings.data?.forEach((s: any) => { settingsMap[s.setting_key] = s.setting_value; });

      return {
        balance: credits.data?.balance ?? 0,
        transactions: transactions.data || [],
        costText: Number(settingsMap.credit_cost_text) || 0.003,
        costImage: Number(settingsMap.credit_cost_image) || 0.015,
        subscription: profile.data as any,
      };
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("session_id") || params.get("billing")) {
      const t1 = setTimeout(() => refetch(), 2000);
      const t2 = setTimeout(() => refetch(), 6000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [refetch]);

  const startCheckout = async (flow: "subscription" | "topup") => {
    setLoadingFlow(flow);
    try {
      const amount = flow === "topup" ? Number(topupAmount) : undefined;
      if (flow === "topup" && (!amount || amount < 1)) {
        toast.error("Minimum top-up is $1");
        setLoadingFlow(null);
        return;
      }
      const { data: resp, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { flow, amount },
      });
      if (error) throw error;
      if (resp?.url) window.location.href = resp.url;
      else throw new Error("No checkout URL returned");
    } catch (e: any) {
      toast.error(e?.message || "Could not start checkout");
      setLoadingFlow(null);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">{[1, 2].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>;
  }

  const costText = data?.costText ?? 0.003;
  const costImage = data?.costImage ?? 0.015;
  const msgsPerDollar = Math.floor(1 / costText);
  const imgsPerDollar = Math.floor(1 / costImage);

  const txLabel = (type: string) => {
    if (type === "recharge") return t("credits.tx.recharge");
    if (type === "text_reply") return t("credits.tx.textReply");
    if (type === "image_reply") return t("credits.tx.imageReply");
    return type;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("credits.title")}</h2>
        <p className="text-muted-foreground">{t("credits.subtitle")}</p>
      </div>

      {/* Free trial banner */}
      {(() => {
        const freeUntil = data?.subscription?.free_until ? new Date(data.subscription.free_until) : null;
        const daysLeft = freeUntil ? Math.max(0, Math.ceil((freeUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
        const inTrial = daysLeft > 0;
        const isActive = data?.subscription?.subscription_status === "active";
        if (isActive) return null;
        return (
          <Card className={inTrial ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}>
            <CardContent className="pt-5 pb-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                {inTrial ? (
                  <>
                    <p className="font-semibold">🎁 Free trial active — {daysLeft} day{daysLeft === 1 ? "" : "s"} left</p>
                    <p className="text-xs text-muted-foreground">Your $2 welcome credit is yours to use. Text replies cost ${(data?.costText ?? 0.003).toFixed(3)} each. When credit runs out, top up to keep your bot running. After {daysLeft} days the $20/mo plan unlocks image analysis.</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">Your free month has ended</p>
                    <p className="text-xs text-muted-foreground">Subscribe to the $20/mo plan to unlock image analysis. Text replies still work as long as you have balance.</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Balance Card */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Coins className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("credits.currentBalance")}</p>
              <p className="text-4xl font-bold">{fmtBalance(data?.balance ?? 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("credits.costPerMessage")}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-blue-600" /> {t("credits.textReply")}</span>
            <Badge variant="secondary">{fmtUSD(costText)}</Badge>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="flex items-center gap-2"><Image className="h-4 w-4 text-purple-600" /> {t("credits.imageReply")}</span>
            <Badge variant="secondary">{fmtUSD(costImage)}</Badge>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>{t("credits.orderDetection")}</span>
            <Badge variant="outline" className="text-emerald-600 border-emerald-600">{t("credits.free")}</Badge>
          </div>
          <div className="flex justify-between">
            <span>{t("credits.autoReplyKeyword")}</span>
            <Badge variant="outline" className="text-emerald-600 border-emerald-600">{t("credits.free")}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader><CardTitle className="text-base">{t("credits.what1Gets")}</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>{t("credits.with1")}</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><span className="font-semibold text-foreground">{t("credits.textRepliesLine", { count: msgsPerDollar })}</span></li>
            <li><span className="font-semibold text-foreground">{t("credits.imageRepliesLine", { count: imgsPerDollar })}</span></li>
          </ul>
        </CardContent>
      </Card>

      {/* Subscription */}
      {(() => {
        const sub = data?.subscription;
        const isActive = sub?.subscription_status === "active";
        return (
          <Card className={isActive ? "border-emerald-500/40 bg-emerald-500/5" : "border-primary/30 bg-primary/5"}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Basic Plan — $20/month
              </CardTitle>
              {isActive && <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>$5 welcome balance added on first subscription</li>
                <li>Unlocks balance top-ups (recharge anytime, min $1)</li>
                <li>Cancel anytime from Stripe</li>
              </ul>
              {!isActive ? (
                <Button onClick={() => startCheckout("subscription")} disabled={loadingFlow !== null} className="w-full">
                  {loadingFlow === "subscription" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-2" /> Subscribe with Stripe</>}
                </Button>
              ) : (
                <p className="text-xs text-emerald-700">
                  {sub?.subscription_current_period_end
                    ? `Renews on ${new Date(sub.subscription_current_period_end).toLocaleDateString()}`
                    : "Subscription is active."}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Top up balance — requires active subscription */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top up balance</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Recharge your account balance with Stripe. Minimum $1.</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                min="1"
                step="1"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="pl-7"
                placeholder="Amount"
              />
            </div>
            <Button
              onClick={() => startCheckout("topup")}
              disabled={loadingFlow !== null}
            >
              {loadingFlow === "topup" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Top up"}
            </Button>
          </div>
          <div className="flex gap-2">
            {[5, 10, 20, 50].map((v) => (
              <Button key={v} type="button" size="sm" variant="outline" onClick={() => setTopupAmount(String(v))}>
                ${v}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("credits.howBotWorks")}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t("credits.botIntro")}</p>
          <div className="space-y-2">
            <p className="font-medium text-foreground">{t("credits.botCan")}</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>{t("credits.botCan1")}</li>
              <li>{t("credits.botCan2")}</li>
              <li>{t("credits.botCan3")}</li>
              <li>{t("credits.botCan4")}</li>
              <li>{t("credits.botCan5")}</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">{t("credits.tipsTitle")}</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>{t("credits.tip1")}</li>
              <li>{t("credits.tip2")}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("credits.transactionHistory")}</CardTitle></CardHeader>
        <CardContent>
          {!data?.transactions?.length ? (
            <p className="text-sm text-muted-foreground">{t("credits.noTransactions")}</p>
          ) : (
            <div className="space-y-2">
              {data.transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    {tx.amount > 0 ? (
                      <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 text-rose-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{txLabel(tx.type)}</p>
                      {tx.description && <p className="text-xs text-muted-foreground">{tx.description}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${tx.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {tx.amount > 0 ? "+" : "−"}{fmtBalance(Math.abs(tx.amount))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CreditDashboard;
