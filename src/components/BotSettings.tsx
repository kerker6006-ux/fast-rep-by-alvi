import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Save, Globe, MessageCircle, Info } from "lucide-react";

const BotSettings = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, string>>({});

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
      dbSettings.forEach(s => { map[s.setting_key] = s.setting_value; });
      setSettings(map);
    }
  }, [dbSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase.from("bot_settings").upsert({ setting_key: key, setting_value: value }, { onConflict: "setting_key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-settings"] });
      toast.success("Settings saved!");
    },
    onError: (e) => toast.error(e.message),
  });

  const update = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }));

  if (isLoading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bot Settings</h2>
        <p className="text-muted-foreground">Customize how your AI bot responds to customers.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Business Info</CardTitle>
            <CardDescription>Tell the AI about your business so it can represent you well.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={settings.business_name || ""} onChange={e => update("business_name", e.target.value)} placeholder="My Business" />
            </div>
            <div className="space-y-2">
              <Label>Business Description</Label>
              <Textarea value={settings.business_description || ""} onChange={e => update("business_description", e.target.value)} placeholder="Describe what your business does..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" /> Welcome Messages</CardTitle>
            <CardDescription>The first message customers receive when they message your page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Welcome Message (বাংলা)</Label>
              <Textarea value={settings.welcome_message || ""} onChange={e => update("welcome_message", e.target.value)} placeholder="আসসালামু আলাইকুম!" />
            </div>
            <div className="space-y-2">
              <Label>Welcome Message (English)</Label>
              <Textarea value={settings.welcome_message_en || ""} onChange={e => update("welcome_message_en", e.target.value)} placeholder="Welcome!" />
            </div>
            <div className="space-y-2">
              <Label>Out of Stock Message</Label>
              <Textarea value={settings.out_of_stock_message || ""} onChange={e => update("out_of_stock_message", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5" /> AI Custom Instructions</CardTitle>
            <CardDescription>Give the AI specific instructions on how to behave. Write in plain text.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Custom Instructions for AI</Label>
              <Textarea
                value={settings.custom_instructions || ""}
                onChange={e => update("custom_instructions", e.target.value)}
                placeholder="e.g. Always mention free delivery for orders above ৳500. Don't discuss competitor products."
                className="min-h-[120px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🔗 Facebook Connection</CardTitle>
            <CardDescription>Use these values when setting up your Facebook Webhook.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input readOnly value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fb-webhook`} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">Paste this in Facebook Developer App → Messenger → Webhooks → Callback URL</p>
            </div>
            <div className="space-y-2">
              <Label>Verify Token</Label>
              <Input readOnly value={settings.verify_token || "fb_bot_verify_2024"} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">Paste this in Facebook Developer App → Messenger → Webhooks → Verify Token</p>
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="lg" className="gap-2">
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </div>
  );
};

export default BotSettings;
