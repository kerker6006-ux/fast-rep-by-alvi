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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Brain, Sparkles, MessageCircle, Shield, Target,
  Save, Plus, X, Languages, ImageIcon, MessageSquareText,
  Zap, BookOpen, AlertTriangle, Users, ShoppingBag,
  Clock, Heart, ThumbsDown, CheckCircle, Lightbulb,
} from "lucide-react";

const AiTraining = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [exampleInput, setExampleInput] = useState("");
  const [exampleOutput, setExampleOutput] = useState("");
  const [exampleCategory, setExampleCategory] = useState("general");
  const [neverSayItem, setNeverSayItem] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
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
          .upsert({ setting_key: key, setting_value: value }, { onConflict: "setting_key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-settings"] });
      setHasChanges(false);
      toast.success("AI training saved! Changes apply instantly to all new conversations.");
    },
    onError: (e) => toast.error(e.message),
  });

  const update = (key: string, value: string) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setHasChanges(true);
  };

  // Reply Examples
  const addExample = () => {
    if (!exampleInput.trim() || !exampleOutput.trim()) return;
    const existing = parseJSON(settings.reply_examples, []);
    existing.push({ customer: exampleInput, reply: exampleOutput, category: exampleCategory });
    update("reply_examples", JSON.stringify(existing));
    setExampleInput("");
    setExampleOutput("");
  };

  const removeExample = (index: number) => {
    const existing = parseJSON(settings.reply_examples, []);
    existing.splice(index, 1);
    update("reply_examples", JSON.stringify(existing));
  };

  // Never-say list
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

  // FAQ
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

  const parseJSON = (str: string | undefined, fallback: any) => {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
  };

  const examples = parseJSON(settings.reply_examples, []);
  const neverSayList = parseJSON(settings.never_say_list, []);
  const faqList = parseJSON(settings.faq_list, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Training Center
          </h2>
          <p className="text-muted-foreground mt-1">
            Train your AI to reply exactly how you want. Every change applies instantly.
          </p>
        </div>
        {hasChanges && (
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2 animate-pulse"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      <Tabs defaultValue="personality" className="space-y-5">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1">
          <TabsTrigger value="personality" className="text-xs gap-1 py-2">
            <Sparkles className="h-3.5 w-3.5" /> Personality
          </TabsTrigger>
          <TabsTrigger value="examples" className="text-xs gap-1 py-2">
            <MessageSquareText className="h-3.5 w-3.5" /> Examples
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs gap-1 py-2">
            <Shield className="h-3.5 w-3.5" /> Rules
          </TabsTrigger>
          <TabsTrigger value="faq" className="text-xs gap-1 py-2">
            <BookOpen className="h-3.5 w-3.5" /> FAQ
          </TabsTrigger>
          <TabsTrigger value="comments" className="text-xs gap-1 py-2">
            <MessageCircle className="h-3.5 w-3.5" /> Comments
          </TabsTrigger>
        </TabsList>

        {/* ===== PERSONALITY TAB ===== */}
        <TabsContent value="personality" className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Bot Identity
              </CardTitle>
              <CardDescription>Give your bot a name, personality, and speaking style.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bot Name</Label>
                  <Input
                    value={settings.bot_name || ""}
                    onChange={(e) => update("bot_name", e.target.value)}
                    placeholder="e.g. Rina, Fast Rep"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input
                    value={settings.business_name || ""}
                    onChange={(e) => update("business_name", e.target.value)}
                    placeholder="Your shop/business name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Business Description</Label>
                <Textarea
                  value={settings.business_description || ""}
                  onChange={(e) => update("business_description", e.target.value)}
                  placeholder="e.g. We sell premium quality clothing for men and women at affordable prices. Free delivery in Dhaka."
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label>AI Personality</Label>
                <Textarea
                  value={settings.ai_personality || ""}
                  onChange={(e) => update("ai_personality", e.target.value)}
                  placeholder="e.g. You are a friendly shop assistant. You love helping customers find perfect products. You use emojis naturally, keep messages short, warm, and feel like chatting with a real person — not a robot."
                  className="min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  This is the core instruction for how your bot behaves. Be specific!
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Tone & Style
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reply Tone</Label>
                  <Input
                    value={settings.reply_tone || ""}
                    onChange={(e) => update("reply_tone", e.target.value)}
                    placeholder="e.g. Warm, friendly, professional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Reply Length</Label>
                  <Input
                    value={settings.max_reply_length || ""}
                    onChange={(e) => update("max_reply_length", e.target.value)}
                    placeholder="e.g. 2-3 sentences"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Emoji Usage</Label>
                <Input
                  value={settings.emoji_style || ""}
                  onChange={(e) => update("emoji_style", e.target.value)}
                  placeholder="e.g. Use emojis naturally but not too many, 1-2 per message"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Languages className="h-4 w-4 text-primary" /> Language & Greetings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Welcome Message (বাংলা)</Label>
                  <Textarea
                    value={settings.welcome_message || ""}
                    onChange={(e) => update("welcome_message", e.target.value)}
                    placeholder="আসসালামু আলাইকুম! কিভাবে সাহায্য করতে পারি? 😊"
                    className="min-h-[70px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Welcome Message (English)</Label>
                  <Textarea
                    value={settings.welcome_message_en || ""}
                    onChange={(e) => update("welcome_message_en", e.target.value)}
                    placeholder="Hello! How can I help you today? 😊"
                    className="min-h-[70px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Out of Stock Message</Label>
                  <Input
                    value={settings.out_of_stock_message || ""}
                    onChange={(e) => update("out_of_stock_message", e.target.value)}
                    placeholder="দুঃখিত, এই পণ্যটি এখন স্টকে নেই।"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Closing Message</Label>
                  <Input
                    value={settings.closing_message || ""}
                    onChange={(e) => update("closing_message", e.target.value)}
                    placeholder="ধন্যবাদ! আবার কিছু লাগলে জানাবেন 😊"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" /> Image Understanding
              </CardTitle>
              <CardDescription>How should the bot handle product photos from customers?</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.image_instructions || ""}
                onChange={(e) => update("image_instructions", e.target.value)}
                placeholder="e.g. When customer sends a product image, match it with our catalog. Tell them the name, price, and availability. If no match, describe what you see and ask for details."
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" /> Order Handling
              </CardTitle>
              <CardDescription>How the bot collects order information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Order Collection Instructions</Label>
                <Textarea
                  value={settings.order_instructions || ""}
                  onChange={(e) => update("order_instructions", e.target.value)}
                  placeholder="e.g. When customer wants to order, ask for: 1) Full name 2) Phone number 3) Delivery address 4) Confirm items and total. Then say 'আপনার অর্ডার নেওয়া হয়েছে! ধন্যবাদ 😊'"
                  className="min-h-[100px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Delivery Info</Label>
                  <Input
                    value={settings.delivery_info || ""}
                    onChange={(e) => update("delivery_info", e.target.value)}
                    placeholder="e.g. Dhaka 60tk, outside Dhaka 120tk, 2-3 days"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Methods</Label>
                  <Input
                    value={settings.payment_methods || ""}
                    onChange={(e) => update("payment_methods", e.target.value)}
                    placeholder="e.g. bKash, Nagad, Cash on Delivery"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== EXAMPLES TAB ===== */}
        <TabsContent value="examples" className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-primary" /> Reply Examples
              </CardTitle>
              <CardDescription>
                Show the AI exactly how you want it to reply. More examples = better accuracy.
                <span className="block mt-1 font-medium text-foreground">
                  {examples.length} example{examples.length !== 1 ? "s" : ""} added
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new example form */}
              <div className="border border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add New Example
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <select
                      value={exampleCategory}
                      onChange={(e) => setExampleCategory(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="general">General</option>
                      <option value="pricing">Pricing</option>
                      <option value="order">Order</option>
                      <option value="complaint">Complaint</option>
                      <option value="greeting">Greeting</option>
                      <option value="product">Product Info</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer says:</Label>
                  <Input
                    value={exampleInput}
                    onChange={(e) => setExampleInput(e.target.value)}
                    placeholder="e.g. এই জিনিসটা কত দিয়ে দিবেন?"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">AI should reply:</Label>
                  <Textarea
                    value={exampleOutput}
                    onChange={(e) => setExampleOutput(e.target.value)}
                    placeholder="e.g. ভাইয়া, এই প্রোডাক্টের দাম ৳500 😊 অর্ডার করতে নাম, ফোন, ঠিকানা দিন!"
                    className="min-h-[60px]"
                  />
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={addExample}
                  disabled={!exampleInput.trim() || !exampleOutput.trim()}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Example
                </Button>
              </div>

              {/* List examples */}
              {examples.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {examples.map((ex: any, i: number) => (
                    <div key={i} className="bg-muted/50 rounded-lg p-3 relative group border border-transparent hover:border-border transition-colors">
                      <button
                        onClick={() => removeExample(i)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10"
                      >
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </button>
                      {ex.category && (
                        <Badge variant="secondary" className="text-[10px] mb-1.5">{ex.category}</Badge>
                      )}
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Customer:</p>
                      <p className="text-sm mb-2">{ex.customer}</p>
                      <p className="text-xs font-medium text-primary mb-0.5">Your reply:</p>
                      <p className="text-sm">{ex.reply}</p>
                    </div>
                  ))}
                </div>
              )}

              {examples.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No examples yet. Add at least 5-10 examples for best results!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== RULES TAB ===== */}
        <TabsContent value="rules" className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Custom Instructions
              </CardTitle>
              <CardDescription>Special rules the AI must follow when replying.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.custom_instructions || ""}
                onChange={(e) => update("custom_instructions", e.target.value)}
                placeholder={"e.g.\n- If customer asks discount, say '৳1000+ orders get 10% off'\n- If customer sends product photo, identify it and tell price\n- Always ask for order details: name, phone, address\n- Don't discuss competitor products\n- If confused, say 'একটু অপেক্ষা করুন, আমি চেক করছি'"}
                className="min-h-[180px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Never Say List
              </CardTitle>
              <CardDescription>Things the AI must NEVER say or do.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={neverSayItem}
                  onChange={(e) => setNeverSayItem(e.target.value)}
                  placeholder="e.g. Never promise refunds"
                  onKeyDown={(e) => e.key === "Enter" && addNeverSay()}
                />
                <Button variant="outline" size="sm" onClick={addNeverSay} disabled={!neverSayItem.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {neverSayList.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {neverSayList.map((item: string, i: number) => (
                    <Badge key={i} variant="destructive" className="gap-1 pr-1 cursor-pointer hover:opacity-80" onClick={() => removeNeverSay(i)}>
                      {item}
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
              {neverSayList.length === 0 && (
                <p className="text-xs text-muted-foreground">No items yet. Add things like "Never discuss politics" or "Never give refund promises".</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Customer Handling
              </CardTitle>
              <CardDescription>How to handle different types of customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5 text-red-400" /> Angry/Frustrated Customers</Label>
                <Textarea
                  value={settings.angry_customer_handling || ""}
                  onChange={(e) => update("angry_customer_handling", e.target.value)}
                  placeholder="e.g. Be extra patient and empathetic. Apologize sincerely. Offer to solve the issue. Never argue back."
                  className="min-h-[70px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-500" /> After Hours / Slow Response</Label>
                <Textarea
                  value={settings.after_hours_message || ""}
                  onChange={(e) => update("after_hours_message", e.target.value)}
                  placeholder="e.g. If a question is complex, say 'আমাদের টিম শীঘ্রই আপনার সাথে যোগাযোগ করবে'"
                  className="min-h-[70px]"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== FAQ TAB ===== */}
        <TabsContent value="faq" className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> FAQ Knowledge Base
              </CardTitle>
              <CardDescription>
                Add common questions and answers. The AI will use these to give accurate replies.
                <span className="block mt-1 font-medium text-foreground">
                  {faqList.length} FAQ{faqList.length !== 1 ? "s" : ""} added
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
                <div className="space-y-1.5">
                  <Label className="text-xs">Question (customer might ask):</Label>
                  <Input
                    value={faqQuestion}
                    onChange={(e) => setFaqQuestion(e.target.value)}
                    placeholder="e.g. ডেলিভারি চার্জ কত?"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Answer:</Label>
                  <Textarea
                    value={faqAnswer}
                    onChange={(e) => setFaqAnswer(e.target.value)}
                    placeholder="e.g. ঢাকায় ৳60, ঢাকার বাইরে ৳120। অর্ডার করার 2-3 দিনের মধ্যে ডেলিভারি হয়ে যায় 😊"
                    className="min-h-[60px]"
                  />
                </div>
                <Button size="sm" onClick={addFaq} disabled={!faqQuestion.trim() || !faqAnswer.trim()} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add FAQ
                </Button>
              </div>

              {faqList.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {faqList.map((faq: any, i: number) => (
                    <div key={i} className="bg-muted/50 rounded-lg p-3 relative group border border-transparent hover:border-border transition-colors">
                      <button onClick={() => removeFaq(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10">
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </button>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Q:</p>
                      <p className="text-sm font-medium mb-1.5">{faq.q}</p>
                      <p className="text-xs font-medium text-primary mb-0.5">A:</p>
                      <p className="text-sm">{faq.a}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No FAQs yet. Add common questions customers ask!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== COMMENTS TAB ===== */}
        <TabsContent value="comments" className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" /> Comment Auto-Reply
              </CardTitle>
              <CardDescription>
                Automatically reply to Facebook post comments directing people to inbox.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Enable Comment Auto-Reply</p>
                  <p className="text-xs text-muted-foreground">
                    Bot replies to every comment with your inbox message
                  </p>
                </div>
                <Switch
                  checked={settings.comment_auto_reply === "true"}
                  onCheckedChange={(v) => update("comment_auto_reply", v ? "true" : "false")}
                />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Comment Reply (বাংলা)</Label>
                  <Textarea
                    value={settings.comment_reply_text || ""}
                    onChange={(e) => update("comment_reply_text", e.target.value)}
                    placeholder="ধন্যবাদ! বিস্তারিত জানতে আমাদের পেজে ইনবক্স করুন 📩"
                    className="min-h-[80px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Comment Reply (English)</Label>
                  <Textarea
                    value={settings.comment_reply_text_en || ""}
                    onChange={(e) => update("comment_reply_text_en", e.target.value)}
                    placeholder="Thanks! Please inbox us for details 📩"
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating save button */}
      <div className="sticky bottom-4 flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !hasChanges}
          size="lg"
          className="gap-2 shadow-lg"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : hasChanges ? "Save All Changes" : "All Saved ✓"}
        </Button>
      </div>
    </div>
  );
};

export default AiTraining;
