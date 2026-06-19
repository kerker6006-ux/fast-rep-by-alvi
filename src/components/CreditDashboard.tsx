import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, MessageSquare, Image, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

const fmtUSD = (n: number) => `$${Number(n).toFixed(3)}`;
const fmtBalance = (n: number) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CreditDashboard = () => {
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
  const msgsPerDime = Math.floor(0.10 / costText);
  const imgsPerDime = Math.floor(0.10 / costImage);
  const textCents = (costText * 100).toFixed(2);
  const imageCents = (costImage * 100).toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Credits & Billing</h2>
        <p className="text-muted-foreground">Your credit balance and recharge info.</p>
      </div>

      {/* Balance Card */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Coins className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-4xl font-bold">{fmtBalance(data?.balance ?? 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cost Per Message</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-blue-600" /> Text Reply (AI)</span>
            <Badge variant="secondary">{fmtUSD(costText)} / message ({textCents}¢)</Badge>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="flex items-center gap-2"><Image className="h-4 w-4 text-purple-600" /> Image Reply (AI)</span>
            <Badge variant="secondary">{fmtUSD(costImage)} / image ({imageCents}¢)</Badge>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>Order Detection</span>
            <Badge variant="outline" className="text-emerald-600 border-emerald-600">Free</Badge>
          </div>
          <div className="flex justify-between">
            <span>Auto-Reply (Keyword)</span>
            <Badge variant="outline" className="text-emerald-600 border-emerald-600">Free</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader><CardTitle className="text-base">What 10¢ Gets You</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>With <span className="font-bold">$0.10 (10¢)</span> you can send approximately:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><span className="font-semibold text-foreground">~{msgsPerDime} AI text replies</span> (at {textCents}¢ each)</li>
            <li><span className="font-semibold text-foreground">~{imgsPerDime} AI image replies</span> (1 image = {imageCents}¢)</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recharge Your Account</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="font-semibold">How to recharge:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
              <li>Contact the admin to request a recharge</li>
              <li>Send your payment using the agreed method</li>
              <li>Share your transaction reference — credits will be added to your account</li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Credits are usually updated within 1-2 hours.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">How the AI Bot Works</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>When someone messages your Facebook page, our AI bot automatically replies.</p>
          <div className="space-y-2">
            <p className="font-medium text-foreground">What the bot can do:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Share product prices and details</li>
              <li>Identify products from photos and reply with prices</li>
              <li>Take orders (name, phone, address)</li>
              <li>Reply in the language you configured</li>
              <li>Answer custom FAQ questions</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Tips to reduce costs:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Set <span className="font-medium text-foreground">Auto-Reply rules</span> for common questions (Free!)</li>
              <li>Add common questions to your FAQ list</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
        <CardContent>
          {!data?.transactions?.length ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
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
                      <p className="text-sm font-medium">
                        {tx.type === "recharge" ? "Recharge" : tx.type === "text_reply" ? "Text Reply" : tx.type === "image_reply" ? "Image Reply" : tx.type}
                      </p>
                      {tx.description && <p className="text-xs text-muted-foreground">{tx.description}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${tx.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {tx.amount > 0 ? "+" : ""}{fmtBalance(Math.abs(tx.amount))}{tx.amount < 0 ? "" : ""}
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
