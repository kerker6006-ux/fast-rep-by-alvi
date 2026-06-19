import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, MessageSquare, Image, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

const fmtUSD = (n: number) => `$${Number(n).toFixed(3)}`;
const fmtBalance = (n: number) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CreditDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["credits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [credits, transactions, settings] = await Promise.all([
        supabase.from("user_credits").select("balance").eq("user_id", user!.id).maybeSingle(),
        supabase.from("credit_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("bot_settings").select("setting_key, setting_value").eq("user_id", user!.id),
      ]);

      const settingsMap: Record<string, string> = {};
      settings.data?.forEach((s: any) => { settingsMap[s.setting_key] = s.setting_value; });

      return {
        balance: credits.data?.balance ?? 0,
        transactions: transactions.data || [],
        costText: Number(settingsMap.credit_cost_text) || 0.003,
        costImage: Number(settingsMap.credit_cost_image) || 0.015,
      };
    },
  });

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
            <Badge variant="secondary">{fmtUSD(costText)} ({textCents}¢)</Badge>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="flex items-center gap-2"><Image className="h-4 w-4 text-purple-600" /> {t("credits.imageReply")}</span>
            <Badge variant="secondary">{fmtUSD(costImage)} ({imageCents}¢)</Badge>
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
        <CardHeader><CardTitle className="text-base">{t("credits.what10cGets")}</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>{t("credits.with10c")}</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><span className="font-semibold text-foreground">{t("credits.textRepliesLine", { count: msgsPerDime, cents: textCents })}</span></li>
            <li><span className="font-semibold text-foreground">{t("credits.imageRepliesLine", { count: imgsPerDime, cents: imageCents })}</span></li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("credits.recharge")}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="font-semibold">{t("credits.howToRecharge")}</p>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
              <li>{t("credits.rechargeStep1")}</li>
              <li>{t("credits.rechargeStep2")}</li>
              <li>{t("credits.rechargeStep3")}</li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground text-center">{t("credits.rechargeNote")}</p>
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
