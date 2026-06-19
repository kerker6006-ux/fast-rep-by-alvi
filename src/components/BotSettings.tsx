import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessCategory, BUSINESS_CATEGORIES, BusinessCategory } from "@/hooks/useBusinessCategory";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Save, Globe, MessageCircle, Info, Briefcase } from "lucide-react";

const BotSettings = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { category, setCategory } = useBusinessCategory();
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
        const { error } = await supabase.from("bot_settings").upsert({ setting_key: key, setting_value: value, user_id: user?.id } as any, { onConflict: "user_id,setting_key" } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-settings"] });
      toast.success(t("botSettings.saved"));
    },
    onError: (e) => toast.error(e.message),
  });

  const update = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }));

  if (isLoading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-lg" />)}</div>;

  const botOn = settings.bot_enabled !== "false";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("botSettings.title")}</h2>
          <p className="text-muted-foreground">{t("botSettings.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3 border rounded-xl px-4 py-3 bg-muted/50">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{botOn ? t("botSettings.botOn") : t("botSettings.botOff")}</span>
            <span className="text-xs text-muted-foreground">{botOn ? t("botSettings.replying") : t("botSettings.notReplying")}</span>
          </div>
          <Switch
            checked={botOn}
            onCheckedChange={(v) => update("bot_enabled", v ? "true" : "false")}
          />
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" /> {t("botSettings.businessCategory")}</CardTitle>
            <CardDescription>{t("botSettings.businessCategoryDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={category || ""}
              onValueChange={(v) => setCategory.mutate(v as BusinessCategory, { onSuccess: () => toast.success(t("onboarding.saved")) })}
            >
              <SelectTrigger><SelectValue placeholder={t("onboarding.pickOne")} /></SelectTrigger>
              <SelectContent>
                {BUSINESS_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{t(`category.${c}.name`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> {t("botSettings.businessInfo")}</CardTitle>
            <CardDescription>{t("botSettings.businessInfoDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("botSettings.businessName")}</Label>
              <Input value={settings.business_name || ""} onChange={e => update("business_name", e.target.value)} placeholder={t("botSettings.businessNamePh")} />
            </div>
            <div className="space-y-2">
              <Label>{t("botSettings.businessDesc")}</Label>
              <Textarea value={settings.business_description || ""} onChange={e => update("business_description", e.target.value)} placeholder={t("botSettings.businessDescPh")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" /> {t("botSettings.welcomeMessage")}</CardTitle>
            <CardDescription>{t("botSettings.welcomeDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("botSettings.welcomeMessage")}</Label>
              <Textarea value={settings.welcome_message || ""} onChange={e => update("welcome_message", e.target.value)} placeholder={t("botSettings.welcomePh")} />
            </div>
            <div className="space-y-2">
              <Label>{t("botSettings.outOfStock")}</Label>
              <Textarea value={settings.out_of_stock_message || ""} onChange={e => update("out_of_stock_message", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5" /> {t("botSettings.customInstructions")}</CardTitle>
            <CardDescription>{t("botSettings.customInstructionsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("botSettings.customInstructionsLabel")}</Label>
              <Textarea
                value={settings.custom_instructions || ""}
                onChange={e => update("custom_instructions", e.target.value)}
                placeholder={t("botSettings.customInstructionsPh")}
                className="min-h-[120px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" /> {t("botSettings.commentFeed")}</CardTitle>
            <CardDescription>{t("botSettings.commentFeedDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("botSettings.aiComments")}</Label>
                <p className="text-xs text-muted-foreground">{t("botSettings.aiCommentsDesc")}</p>
              </div>
              <Switch
                checked={settings.comment_ai_reply === "true"}
                onCheckedChange={(v) => update("comment_ai_reply", v ? "true" : "false")}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("botSettings.autoImport")}</Label>
                <p className="text-xs text-muted-foreground">{t("botSettings.autoImportDesc")}</p>
              </div>
              <Switch
                checked={settings.auto_import_products !== "false"}
                onCheckedChange={(v) => update("auto_import_products", v ? "true" : "false")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🔗 {t("botSettings.fbConnection")}</CardTitle>
            <CardDescription>{t("botSettings.fbConnectionDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("botSettings.webhookUrl")}</Label>
              <Input readOnly value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fb-webhook`} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">{t("botSettings.webhookHint")}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t("botSettings.eachPageHint")}</p>
          </CardContent>
        </Card>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="lg" className="gap-2">
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? t("common.saving") : t("botSettings.saveAll")}
        </Button>
      </div>
    </div>
  );
};

export default BotSettings;
