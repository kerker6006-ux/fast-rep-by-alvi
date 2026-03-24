import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, MessageSquare, Image, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        costText: Number(settingsMap.credit_cost_text) || 1,
        costImage: Number(settingsMap.credit_cost_image) || 3,
      };
    },
  });

  if (isLoading) {
    return <div className="animate-pulse space-y-4">{[1, 2].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Credits & Billing</h2>
        <p className="text-muted-foreground">আপনার ক্রেডিট ব্যালেন্স ও রিচার্জ তথ্য</p>
      </div>

      {/* Balance Card */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Coins className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance / বর্তমান ব্যালেন্স</p>
              <p className="text-4xl font-bold">৳{Number(data?.balance).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing & Recharge Info - Bilingual */}
      <Tabs defaultValue="bangla">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bangla">বাংলা</TabsTrigger>
          <TabsTrigger value="english">English</TabsTrigger>
        </TabsList>

        <TabsContent value="bangla" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">💰 প্রতি মেসেজের খরচ</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-blue-600" /> টেক্সট রিপ্লাই (AI)</span>
                <Badge variant="secondary">৳{data?.costText} / মেসেজ</Badge>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="flex items-center gap-2"><Image className="h-4 w-4 text-purple-600" /> ছবি বিশ্লেষণ (AI)</span>
                <Badge variant="secondary">৳{data?.costImage} / মেসেজ</Badge>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span>🛒 অর্ডার ডিটেকশন</span>
                <Badge variant="outline" className="text-emerald-600 border-emerald-600">ফ্রি</Badge>
              </div>
              <div className="flex justify-between">
                <span>⚡ অটো-রিপ্লাই (কীওয়ার্ড)</span>
                <Badge variant="outline" className="text-emerald-600 border-emerald-600">ফ্রি</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">📱 বিকাশ দিয়ে রিচার্জ করুন</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="font-semibold">রিচার্জ করার নিয়ম:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                  <li>আমাদের বিকাশ নম্বরে <span className="font-bold text-foreground">Send Money</span> করুন</li>
                  <li>ট্রানজেকশন আইডি (TrxID) সেভ করুন</li>
                  <li>আমাদের জানান — আমরা আপনার অ্যাকাউন্টে ক্রেডিট যোগ করব</li>
                </ol>
              </div>
              <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">বিকাশ নম্বর</p>
                <p className="text-lg font-bold text-primary">01XXXXXXXXX</p>
                <p className="text-xs text-muted-foreground mt-1">(পার্সোনাল নম্বরে Send Money করুন)</p>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                ⏱️ রিচার্জ সাধারণত ১-২ ঘণ্টার মধ্যে আপডেট হয়
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">🤖 AI বট কিভাবে কাজ করে?</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>আপনার ফেসবুক পেজে কেউ মেসেজ পাঠালে আমাদের AI বট স্বয়ংক্রিয়ভাবে উত্তর দেয়।</p>
              <div className="space-y-2">
                <p className="font-medium text-foreground">বট যা করতে পারে:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>প্রোডাক্টের দাম ও তথ্য জানায়</li>
                  <li>ছবি পাঠালে প্রোডাক্ট চিনে দাম বলে</li>
                  <li>অর্ডার নেয় (নাম, ফোন, ঠিকানা)</li>
                  <li>বাংলা, ইংলিশ ও বাংলিশে কথা বলে</li>
                  <li>কাস্টম FAQ উত্তর দেয়</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">খরচ কমানোর টিপস:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>বেশি জিজ্ঞাসিত প্রশ্নে <span className="font-medium text-foreground">অটো-রিপ্লাই</span> সেট করুন (ফ্রি!)</li>
                  <li>কমন প্রশ্ন FAQ-তে যোগ করুন</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="english" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">💰 Cost Per Message</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-blue-600" /> Text Reply (AI)</span>
                <Badge variant="secondary">৳{data?.costText} / msg</Badge>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="flex items-center gap-2"><Image className="h-4 w-4 text-purple-600" /> Image Analysis (AI)</span>
                <Badge variant="secondary">৳{data?.costImage} / msg</Badge>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span>🛒 Order Detection</span>
                <Badge variant="outline" className="text-emerald-600 border-emerald-600">Free</Badge>
              </div>
              <div className="flex justify-between">
                <span>⚡ Auto-Reply (Keyword)</span>
                <Badge variant="outline" className="text-emerald-600 border-emerald-600">Free</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">📱 Recharge via bKash</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="font-semibold">How to recharge:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                  <li><span className="font-bold text-foreground">Send Money</span> to our bKash number</li>
                  <li>Save the Transaction ID (TrxID)</li>
                  <li>Contact us — we'll add credits to your account</li>
                </ol>
              </div>
              <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">bKash Number</p>
                <p className="text-lg font-bold text-primary">01XXXXXXXXX</p>
                <p className="text-xs text-muted-foreground mt-1">(Send Money to personal number)</p>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                ⏱️ Credits are usually updated within 1-2 hours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">🤖 How the AI Bot Works</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>When someone messages your Facebook page, our AI bot automatically replies.</p>
              <div className="space-y-2">
                <p className="font-medium text-foreground">What the bot can do:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Share product prices & details</li>
                  <li>Identify products from photos & give prices</li>
                  <li>Take orders (name, phone, address)</li>
                  <li>Chat in Bangla, English & Banglish</li>
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
        </TabsContent>
      </Tabs>

      {/* Transaction History */}
      <Card>
        <CardHeader><CardTitle className="text-base">Transaction History / লেনদেনের ইতিহাস</CardTitle></CardHeader>
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
                        {tx.type === "recharge" ? "Recharge / রিচার্জ" : tx.type === "text_reply" ? "Text Reply" : tx.type === "image_reply" ? "Image Reply" : tx.type}
                      </p>
                      {tx.description && <p className="text-xs text-muted-foreground">{tx.description}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${tx.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {tx.amount > 0 ? "+" : ""}৳{Number(tx.amount).toLocaleString()}
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
