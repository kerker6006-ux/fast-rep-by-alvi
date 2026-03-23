import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Brain, Sparkles, MessageCircle, Shield, Target,
  Save, Plus, X, Languages, ImageIcon, MessageSquareText
} from "lucide-react";

const AiTraining = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [exampleInput, setExampleInput] = useState("");
  const [exampleOutput, setExampleOutput] = useState("");

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
      toast.success("AI training saved! Changes take effect immediately.");
    },
    onError: (e) => toast.error(e.message),
  });

  const update = (key: string, value: string) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const addExample = () => {
    if (!exampleInput.trim() || !exampleOutput.trim()) return;
    const existing = settings.reply_examples ? JSON.parse(settings.reply_examples) : [];
    existing.push({ customer: exampleInput, reply: exampleOutput });
    update("reply_examples", JSON.stringify(existing));
    setExampleInput("");
    setExampleOutput("");
  };

  const removeExample = (index: number) => {
    const existing = settings.reply_examples ? JSON.parse(settings.reply_examples) : [];
    existing.splice(index, 1);
    update("reply_examples", JSON.stringify(existing));
  };

  const examples = settings.reply_examples ? (() => { try { return JSON.parse(settings.reply_examples); } catch { return []; } })() : [];

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
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          AI Training Center
        </h2>
        <p className="text-muted-foreground mt-1">
          Teach your AI how to talk, what to say, and how to understand customers. Changes apply instantly.
        </p>
      </div>

      <div className="grid gap-5">
        {/* Personality & Tone */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Personality & Tone
            </CardTitle>
            <CardDescription>Define how your AI speaks to customers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">AI Personality</Label>
              <Textarea
                value={settings.ai_personality || ""}
                onChange={(e) => update("ai_personality", e.target.value)}
                placeholder="e.g. You are a friendly, enthusiastic shop assistant named Rina. You love helping customers find the perfect product. You use emojis naturally and keep messages short and warm. You speak like a real person, not a robot."
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                Describe the personality, name, and speaking style of your AI bot.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Reply Tone</Label>
                <Input
                  value={settings.reply_tone || ""}
                  onChange={(e) => update("reply_tone", e.target.value)}
                  placeholder="e.g. Warm, friendly, professional"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Max Reply Length</Label>
                <Input
                  value={settings.max_reply_length || ""}
                  onChange={(e) => update("max_reply_length", e.target.value)}
                  placeholder="e.g. 2-3 sentences"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reply Examples */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-primary" />
              Reply Examples
            </CardTitle>
            <CardDescription>
              Show the AI exactly how you want it to reply. The more examples, the better it learns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {examples.length > 0 && (
              <div className="space-y-2">
                {examples.map((ex: any, i: number) => (
                  <div
                    key={i}
                    className="bg-muted/50 rounded-lg p-3 relative group"
                  >
                    <button
                      onClick={() => removeExample(i)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10"
                    >
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </button>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Customer:</p>
                    <p className="text-sm mb-2">{ex.customer}</p>
                    <p className="text-xs font-medium text-primary mb-1">Your ideal reply:</p>
                    <p className="text-sm">{ex.reply}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="border border-dashed rounded-lg p-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Customer says:</Label>
                <Input
                  value={exampleInput}
                  onChange={(e) => setExampleInput(e.target.value)}
                  placeholder="e.g. এই জিনিসটা কত দিয়ে দিবেন?"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">AI should reply:</Label>
                <Textarea
                  value={exampleOutput}
                  onChange={(e) => setExampleOutput(e.target.value)}
                  placeholder="e.g. ভাইয়া/আপু, এই প্রোডাক্টের দাম ৳500 😊 অর্ডার করতে চাইলে নাম, ফোন নম্বর আর ঠিকানা দিন!"
                  className="min-h-[70px]"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addExample}
                disabled={!exampleInput.trim() || !exampleOutput.trim()}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Example
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Understanding Rules */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Understanding Rules
            </CardTitle>
            <CardDescription>
              Tell the AI what to focus on and how to understand different customer intents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Custom Instructions</Label>
              <Textarea
                value={settings.custom_instructions || ""}
                onChange={(e) => update("custom_instructions", e.target.value)}
                placeholder="e.g.&#10;- If customer asks about discount, say 'We offer 10% off on orders above ৳1000'&#10;- If customer sends a product photo, identify the product and tell the price&#10;- Always ask for order details: name, phone, address&#10;- Don't discuss competitor products&#10;- If you don't know something, say 'আমি এই বিষয়ে নিশ্চিত না, একটু অপেক্ষা করুন'"
                className="min-h-[140px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Things the AI should NEVER say</Label>
              <Textarea
                value={settings.ai_never_say || ""}
                onChange={(e) => update("ai_never_say", e.target.value)}
                placeholder="e.g. Never give refund promises. Never share personal info. Never discuss politics or religion. Never use rude language."
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Image Understanding */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              Image Understanding
            </CardTitle>
            <CardDescription>
              How should the AI handle when customers send product photos?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Image Reply Instructions</Label>
              <Textarea
                value={settings.image_instructions || ""}
                onChange={(e) => update("image_instructions", e.target.value)}
                placeholder="e.g. When a customer sends a product image, try to match it with our catalog. If you find a match, tell them the product name, price, and availability. If you can't find a match, ask them what they're looking for."
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Language Settings */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" />
              Language & Greetings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Welcome Message (বাংলা)</Label>
                <Textarea
                  value={settings.welcome_message || ""}
                  onChange={(e) => update("welcome_message", e.target.value)}
                  placeholder="আসসালামু আলাইকুম! কিভাবে সাহায্য করতে পারি? 😊"
                  className="min-h-[70px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Welcome Message (English)</Label>
                <Textarea
                  value={settings.welcome_message_en || ""}
                  onChange={(e) => update("welcome_message_en", e.target.value)}
                  placeholder="Hello! How can I help you today? 😊"
                  className="min-h-[70px]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Out of Stock Message</Label>
              <Input
                value={settings.out_of_stock_message || ""}
                onChange={(e) => update("out_of_stock_message", e.target.value)}
                placeholder="দুঃখিত, এই পণ্যটি এখন স্টকে নেই।"
              />
            </div>
          </CardContent>
        </Card>

        {/* Comment Auto-Reply */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              Comment Auto-Reply
            </CardTitle>
            <CardDescription>
              Automatically reply to comments on your Facebook posts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Comment Auto-Reply</p>
                <p className="text-xs text-muted-foreground">
                  Bot will reply to every comment directing people to inbox
                </p>
              </div>
              <Switch
                checked={settings.comment_auto_reply === "true"}
                onCheckedChange={(v) => update("comment_auto_reply", v ? "true" : "false")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Comment Reply Text (বাংলা)</Label>
              <Textarea
                value={settings.comment_reply_text || ""}
                onChange={(e) => update("comment_reply_text", e.target.value)}
                placeholder="ধন্যবাদ! বিস্তারিত জানতে আমাদের পেজে ইনবক্স করুন 📩"
                className="min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Comment Reply Text (English)</Label>
              <Textarea
                value={settings.comment_reply_text_en || ""}
                onChange={(e) => update("comment_reply_text_en", e.target.value)}
                placeholder="Thanks! Please inbox us for details 📩"
                className="min-h-[60px]"
              />
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          size="lg"
          className="gap-2 w-full sm:w-auto"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save AI Training"}
        </Button>
      </div>
    </div>
  );
};

export default AiTraining;
