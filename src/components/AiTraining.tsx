import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Brain, Save, Plus, X, MessageCircle } from "lucide-react";

const AiTraining = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [neverSayItem, setNeverSayItem] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ["bot-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_settings").select("*");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (dbSettings) {
      const map: Record<string, string> = {};
      dbSettings.forEach((s) => { map[s.setting_key] = s.setting_value; });
      setSettings(map);
    }
  }, [dbSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from("bot_settings")
          .upsert({ setting_key: key, setting_value: value, user_id: user?.id } as any, { onConflict: "user_id,setting_key" } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-settings"] });
      setHasChanges(false);
      toast.success("Saved! Changes apply instantly.");
    },
    onError: (e) => toast.error(e.message),
  });

  const update = (key: string, value: string) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setHasChanges(true);
  };

  const parseJSON = (str: string | undefined, fallback: any) => {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
  };

  const faqList = parseJSON(settings.faq_list, []);
  const neverSayList = parseJSON(settings.never_say_list, []);

  const addFaq = () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    const existing = parseJSON(settings.faq_list, []);
    existing.push({ q: faqQuestion, a: faqAnswer });
    update("faq_list", JSON.stringify(existing));
    setFaqQuestion("");
    setFaqAnswer("");
  };

  const removeFaq = (index: number) => {
    const existing = parseJSON(settings.faq_list, []);
    existing.splice(index, 1);
    update("faq_list", JSON.stringify(existing));
  };

  const addNeverSay = () => {
    if (!neverSayItem.trim()) return;
    const existing = parseJSON(settings.never_say_list, []);
    existing.push(neverSayItem.trim());
    update("never_say_list", JSON.stringify(existing));
    setNeverSayItem("");
  };

  const removeNeverSay = (index: number) => {
    const existing = parseJSON(settings.never_say_list, []);
    existing.splice(index, 1);
    update("never_say_list", JSON.stringify(existing));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Training
          </h2>
          <p className="text-sm text-muted-foreground">Tell the bot how to behave.</p>
        </div>
        {hasChanges && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      {/* Bot Identity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Bot Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Bot Name</Label>
              <Input value={settings.bot_name || ""} onChange={(e) => update("bot_name", e.target.value)} placeholder="e.g. Rina" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Business Name</Label>
              <Input value={settings.business_name || ""} onChange={(e) => update("business_name", e.target.value)} placeholder="Your shop name" className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Business Description</Label>
            <Textarea value={settings.business_description || ""} onChange={(e) => update("business_description", e.target.value)} placeholder="What does your business do? What do you sell?" className="min-h-[60px] text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Personality & Style */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Personality & Instructions</CardTitle>
          <CardDescription className="text-xs">How the bot should talk and behave.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Bot Personality</Label>
            <Textarea
              value={settings.ai_personality || ""}
              onChange={(e) => update("ai_personality", e.target.value)}
              placeholder="e.g. Friendly shop assistant, keeps replies short and helpful."
              className="min-h-[70px] text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Custom Instructions</Label>
            <Textarea
              value={settings.custom_instructions || ""}
              onChange={(e) => update("custom_instructions", e.target.value)}
              placeholder="e.g. Always mention free delivery above ৳500. Don't discuss competitors."
              className="min-h-[70px] text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Reply Tone</Label>
              <Input value={settings.reply_tone || ""} onChange={(e) => update("reply_tone", e.target.value)} placeholder="e.g. Friendly, direct" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delivery Info</Label>
              <Input value={settings.delivery_info || ""} onChange={(e) => update("delivery_info", e.target.value)} placeholder="e.g. Dhaka 60tk, outside 120tk" className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Payment Methods</Label>
            <Input value={settings.payment_methods || ""} onChange={(e) => update("payment_methods", e.target.value)} placeholder="e.g. bKash, Nagad, COD" className="h-8 text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Welcome Messages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" /> Welcome Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">বাংলা</Label>
              <Input value={settings.welcome_message || ""} onChange={(e) => update("welcome_message", e.target.value)} placeholder="আসসালামু আলাইকুম!" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">English</Label>
              <Input value={settings.welcome_message_en || ""} onChange={(e) => update("welcome_message_en", e.target.value)} placeholder="Hello!" className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Out of Stock Message</Label>
            <Input value={settings.out_of_stock_message || ""} onChange={(e) => update("out_of_stock_message", e.target.value)} placeholder="দুঃখিত, স্টকে নেই।" className="h-8 text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">FAQ (Common Questions)</CardTitle>
          <CardDescription className="text-xs">Add questions customers ask often. Bot uses these for accurate answers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {faqList.length > 0 && (
            <div className="space-y-2">
              {faqList.map((f: any, i: number) => (
                <div key={i} className="flex items-start gap-2 bg-muted/50 rounded-md p-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Q: {f.q}</p>
                    <p className="text-muted-foreground">A: {f.a}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeFaq(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 border border-dashed border-border rounded-md p-3">
            <Input value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)} placeholder="Customer question..." className="h-8 text-sm" />
            <Input value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)} placeholder="Your answer..." className="h-8 text-sm" />
            <Button size="sm" variant="outline" onClick={addFaq} className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" /> Add FAQ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Never Say */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Never Say</CardTitle>
          <CardDescription className="text-xs">Things the bot should never say or do.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {neverSayList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {neverSayList.map((item: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                  {item}
                  <button onClick={() => removeNeverSay(i)} className="ml-1 hover:text-destructive">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input value={neverSayItem} onChange={(e) => setNeverSayItem(e.target.value)} placeholder="e.g. Don't mention competitors" className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && addNeverSay()} />
            <Button size="sm" variant="outline" onClick={addNeverSay} className="h-8 text-xs shrink-0">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comment Auto-Reply */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Comment Auto-Reply</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Enable comment replies</Label>
            <Switch
              checked={settings.comment_auto_reply === "true"}
              onCheckedChange={(v) => update("comment_auto_reply", v ? "true" : "false")}
            />
          </div>
          {settings.comment_auto_reply === "true" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Reply (বাংলা)</Label>
                <Input value={settings.comment_reply_text || ""} onChange={(e) => update("comment_reply_text", e.target.value)} placeholder="ইনবক্স করুন 📩" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reply (English)</Label>
                <Input value={settings.comment_reply_text_en || ""} onChange={(e) => update("comment_reply_text_en", e.target.value)} placeholder="Please inbox us 📩" className="h-8 text-sm" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Save Button */}
      {hasChanges && (
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save All Changes"}
        </Button>
      )}
    </div>
  );
};

export default AiTraining;
