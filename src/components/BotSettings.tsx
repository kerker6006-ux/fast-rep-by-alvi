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
import { Save, Globe, MessageCircle, Info, Briefcase, AlertTriangle, ShoppingBag, Stethoscope, Wrench, Sparkles } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

  const { data: subProfile } = useQuery({
    queryKey: ["sub-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", user!.id)
        .maybeSingle();
      return data as { subscription_status: string | null } | null;
    },
  });
  const hasActiveSub = subProfile?.subscription_status === "active";

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
        <Card className="border-primary/30 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" /> Change Category</CardTitle>
            <CardDescription>
              Pick what your business does. The bot instantly rewires its brain — persona, lead questions, tone, and knowledge base all change to match.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CategoryPicker
              value={category || null}
              onPick={(v) => setCategory.mutate(v, { onSuccess: () => toast.success("Category updated — bot retrained") })}
              isSaving={setCategory.isPending}
            />
            <p className="text-xs text-muted-foreground flex items-start gap-2 pt-1">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
              Changing this immediately changes how the bot talks to every customer.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> {t("botSettings.replyLanguage", "Reply Language")}</CardTitle>
            <CardDescription>{t("botSettings.replyLanguageDesc", "Choose which language the bot should reply in. Mix mode auto-detects and mirrors the customer's language (first message is English; if unknown, the bot will ask).")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={settings.reply_language || "mix"}
              onValueChange={(v) => update("reply_language", v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mix">🌐 Mix (auto-detect & mirror)</SelectItem>
                <SelectItem value="bn">🇧🇩 Bangla only (বাংলা)</SelectItem>
                <SelectItem value="ko">🇰🇷 Korean only (한국어)</SelectItem>
                <SelectItem value="en">🇺🇸 English only</SelectItem>
                <SelectItem value="es">🇪🇸 Spanish only (Español)</SelectItem>
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
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("botSettings.autoCreateOrders")}</Label>
                <p className="text-xs text-muted-foreground">{t("botSettings.autoCreateOrdersDesc")}</p>
              </div>
              <Switch
                checked={settings.auto_create_orders !== "false"}
                onCheckedChange={(v) => update("auto_create_orders", v ? "true" : "false")}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("botSettings.autoCreateComplaints")}</Label>
                <p className="text-xs text-muted-foreground">{t("botSettings.autoCreateComplaintsDesc")}</p>
              </div>
              <Switch
                checked={settings.auto_create_complaints !== "false"}
                onCheckedChange={(v) => update("auto_create_complaints", v ? "true" : "false")}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("botSettings.autoCreateLeads")}</Label>
                <p className="text-xs text-muted-foreground">{t("botSettings.autoCreateLeadsDesc")}</p>
              </div>
              <Switch
                checked={settings.auto_create_leads !== "false"}
                onCheckedChange={(v) => update("auto_create_leads", v ? "true" : "false")}
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex-1 pr-3">
                <Label>Enable Image Analysis</Label>
                <p className="text-xs text-muted-foreground">When customers send images, use AI to analyze them. Turn OFF to save costs — images route to Image Inbox for manual reply.</p>
                {!hasActiveSub && (
                  <p className="text-xs text-amber-600 mt-1">🔒 Subscribe to the $20/mo plan to enable image analysis.</p>
                )}
              </div>
              <Switch
                disabled={!hasActiveSub}
                checked={hasActiveSub && settings.enable_image_analysis === "true"}
                onCheckedChange={(v) => update("enable_image_analysis", v ? "true" : "false")}
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

const CATEGORY_META: Record<BusinessCategory, {
  icon: any;
  title: string;
  tagline: string;
  bullets: string[];
}> = {
  ecommerce: {
    icon: ShoppingBag,
    title: "E-commerce store",
    tagline: "Online shop that takes orders on Messenger.",
    bullets: [
      "Acts as a sharp shopkeeper — pitches products, sends images, takes orders",
      "Collects: name, phone, full address, product, quantity",
      "Confirms the order before saving",
    ],
  },
  dental: {
    icon: Stethoscope,
    title: "Dental clinic",
    tagline: "Front-desk receptionist for a dental practice.",
    bullets: [
      "Answers treatment, hours, insurance and address questions only from your knowledge base",
      "Books appointments — captures patient name, phone, service, preferred date",
      "Never invents prices or medical advice",
    ],
  },
  hvac: {
    icon: Wrench,
    title: "HVAC / home services",
    tagline: "Dispatch coordinator for AC, plumbing, electrical jobs.",
    bullets: [
      "Triages job type and urgency, quotes only from your pricing policy",
      "Captures: name, phone, address, service needed, preferred visit date",
      "Handles emergency vs scheduled requests differently",
    ],
  },
  salon: {
    icon: Sparkles,
    title: "Beauty salon / med spa",
    tagline: "Front-desk concierge for hair, facial, botox, fillers.",
    bullets: [
      "Recommends services, explains deposit and cancellation policies",
      "Books: name, phone, service, preferred date",
      "Warm, polished tone — never pushy",
    ],
  },
};

const CategoryPicker = ({
  value,
  onPick,
  isSaving,
}: {
  value: BusinessCategory | null;
  onPick: (v: BusinessCategory) => void;
  isSaving: boolean;
}) => {
  const [pending, setPending] = useState<BusinessCategory | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BUSINESS_CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const Icon = meta.icon;
          const isActive = value === c;
          return (
            <button
              key={c}
              type="button"
              disabled={isSaving}
              onClick={() => {
                if (isActive) return;
                if (value) setPending(c);
                else onPick(c);
              }}
              className={`text-left p-4 rounded-xl border transition-all ${
                isActive
                  ? "border-primary bg-primary/5 shadow-glow ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{meta.title}</p>
                    {isActive && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">Active</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.tagline}</p>
                  <ul className="mt-2 space-y-1">
                    {meta.bullets.map((b) => (
                      <li key={b} className="text-[11px] text-muted-foreground leading-snug flex gap-1.5">
                        <span className="text-primary">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch category to {pending ? CATEGORY_META[pending].title : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              The bot will instantly retrain — its persona, lead questions and replies will all switch. Your products, services and knowledge stay safe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) onPick(pending);
                setPending(null);
              }}
            >
              Yes, retrain the bot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BotSettings;
