import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessCategory, BusinessCategory } from "@/hooks/useBusinessCategory";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Brain, Save, Plus, X, MessageCircle, Send, Bot, User,
  Sparkles, Settings2, Loader2, CheckCircle, RotateCcw, Wand2, Pencil, Languages,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  buildSettingsMap,
  mergeGeneratedSettings,
  parseSettingsJson,
  type SettingsMap,
} from "@/lib/ai-training-settings";
import AutoLearnPanel from "@/components/AutoLearnPanel";

type CatField = { key: string; labelKey: string; phKey: string; type?: "text" | "textarea" };

const CATEGORY_FIELDS: Record<BusinessCategory, CatField[]> = {
  ecommerce: [
    { key: "delivery_info", labelKey: "aiTraining.deliveryInfo", phKey: "aiTraining.deliveryInfoPh" },
    { key: "payment_methods", labelKey: "aiTraining.paymentMethods", phKey: "aiTraining.paymentMethodsPh" },
    { key: "return_policy", labelKey: "aiTraining.returnPolicy", phKey: "aiTraining.returnPolicyPh" },
  ],
  dental: [
    { key: "operating_hours", labelKey: "aiTraining.operatingHours", phKey: "aiTraining.operatingHoursPh" },
    { key: "business_address", labelKey: "aiTraining.address", phKey: "aiTraining.addressPh" },
    { key: "insurance_accepted", labelKey: "aiTraining.insurance", phKey: "aiTraining.insurancePh" },
    { key: "emergency_policy", labelKey: "aiTraining.emergencyPolicy", phKey: "aiTraining.emergencyPolicyPh", type: "textarea" },
    { key: "cancellation_policy", labelKey: "aiTraining.cancellationPolicy", phKey: "aiTraining.cancellationPolicyPh", type: "textarea" },
  ],
  hvac: [
    { key: "operating_hours", labelKey: "aiTraining.operatingHours", phKey: "aiTraining.operatingHoursPh" },
    { key: "service_area_zips", labelKey: "aiTraining.serviceArea", phKey: "aiTraining.serviceAreaPh" },
    { key: "emergency_policy", labelKey: "aiTraining.emergencyAvailability", phKey: "aiTraining.emergencyAvailabilityPh", type: "textarea" },
    { key: "pricing_policy", labelKey: "aiTraining.pricingPolicy", phKey: "aiTraining.pricingPolicyPh", type: "textarea" },
  ],
  salon: [
    { key: "operating_hours", labelKey: "aiTraining.operatingHours", phKey: "aiTraining.operatingHoursPh" },
    { key: "business_address", labelKey: "aiTraining.address", phKey: "aiTraining.addressPh" },
    { key: "cancellation_policy", labelKey: "aiTraining.cancellationPolicy", phKey: "aiTraining.cancellationPolicyPh", type: "textarea" },
    { key: "deposit_policy", labelKey: "aiTraining.depositPolicy", phKey: "aiTraining.depositPolicyPh", type: "textarea" },
  ],
};

const QUICK_ADD_BY_CAT: Record<BusinessCategory, { qKey: string; aKey: string }[]> = {
  ecommerce: [
    { qKey: "autoReply.deliveryInfo", aKey: "autoReply.deliveryResp" },
    { qKey: "autoReply.paymentMethods", aKey: "autoReply.paymentResp" },
    { qKey: "autoReply.returnPolicy", aKey: "autoReply.returnResp" },
    { qKey: "autoReply.businessHours", aKey: "autoReply.hoursResp" },
  ],
  dental: [
    { qKey: "aiTraining.qa.dental.hours", aKey: "aiTraining.qa.dental.hoursA" },
    { qKey: "aiTraining.qa.dental.insurance", aKey: "aiTraining.qa.dental.insuranceA" },
    { qKey: "aiTraining.qa.dental.emergency", aKey: "aiTraining.qa.dental.emergencyA" },
    { qKey: "aiTraining.qa.dental.book", aKey: "aiTraining.qa.dental.bookA" },
  ],
  hvac: [
    { qKey: "aiTraining.qa.hvac.area", aKey: "aiTraining.qa.hvac.areaA" },
    { qKey: "aiTraining.qa.hvac.emergency", aKey: "aiTraining.qa.hvac.emergencyA" },
    { qKey: "aiTraining.qa.hvac.estimate", aKey: "aiTraining.qa.hvac.estimateA" },
    { qKey: "aiTraining.qa.hvac.hours", aKey: "aiTraining.qa.hvac.hoursA" },
  ],
  salon: [
    { qKey: "aiTraining.qa.salon.book", aKey: "aiTraining.qa.salon.bookA" },
    { qKey: "aiTraining.qa.salon.cancel", aKey: "aiTraining.qa.salon.cancelA" },
    { qKey: "aiTraining.qa.salon.hours", aKey: "aiTraining.qa.salon.hoursA" },
    { qKey: "aiTraining.qa.salon.deposit", aKey: "aiTraining.qa.salon.depositA" },
  ],
};

// Starter templates per niche — applied only to EMPTY fields (never overwrites edits).
const PRESET_TEMPLATES: Record<BusinessCategory, SettingsMap> = {
  ecommerce: {
    delivery_info: "Inside Dhaka 60৳, outside Dhaka 120৳. Standard delivery 1–3 days.",
    payment_methods: "Cash on Delivery, bKash, Nagad, Bank Transfer.",
    return_policy: "7-day return for unused items in original packaging. Buyer pays return shipping.",
    reply_tone: "Friendly, direct, helpful.",
  },
  dental: {
    operating_hours: "Sun–Thu 10:00am – 8:00pm. Fri closed.",
    business_address: "123 Main St, City",
    insurance_accepted: "We accept Delta Dental, MetLife and Cigna. Please share your card at the visit.",
    emergency_policy: "Same-day slots for acute pain or trauma — please call the front desk.",
    cancellation_policy: "Free reschedule with 24h notice. Later cancellations may forfeit any deposit.",
    reply_tone: "Warm, calm, professional.",
  },
  hvac: {
    operating_hours: "Mon–Sat 8:00am – 7:00pm. 24/7 emergency line available.",
    service_area_zips: "Dallas, TX and 25-mile radius. 75201, 75202, 75203…",
    emergency_policy: "Same-day visits for no-heat, no-cool, gas smell or active leaks.",
    pricing_policy: "Free phone estimates. On-site diagnostic $79, credited toward any repair.",
    reply_tone: "Clear, confident, helpful.",
  },
  salon: {
    operating_hours: "Tue–Sun 10:00am – 8:00pm. Mon closed.",
    business_address: "123 Beauty Ave, City",
    cancellation_policy: "24h notice required to reschedule. No-shows forfeit the deposit.",
    deposit_policy: "20% deposit on color and longer services, refundable up to 48h before the visit.",
    reply_tone: "Warm, polished, concierge-style.",
  },
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const AiTraining = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { category } = useBusinessCategory();
  const cat: BusinessCategory = (category as BusinessCategory) || "ecommerce";
  const isEcom = cat === "ecommerce";
  const catFields = CATEGORY_FIELDS[cat];
  const quickAdd = QUICK_ADD_BY_CAT[cat];
  const [settings, setSettings] = useState<SettingsMap>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Manual settings state
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [neverSayItem, setNeverSayItem] = useState("");
  const [aiSuggestedFaqs, setAiSuggestedFaqs] = useState<{q: string; a: string}[]>([]);
  const [isLoadingFaqSuggestions, setIsLoadingFaqSuggestions] = useState(false);
  const [editingSuggestionIdx, setEditingSuggestionIdx] = useState<number | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<{q: string; a: string}>({q: "", a: ""});

  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ["bot-settings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("bot_settings")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!dbSettings || hasChanges) return;
    const map = buildSettingsMap(dbSettings);
    setSettings(map);
    // Hydrate persisted chat history once per settings load
    const raw = map.ai_training_chat_history;
    if (raw && chatMessages.length === 0) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatMessages(parsed);
          setChatStarted(true);
        }
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSettings, hasChanges]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Persist chat history to bot_settings (best-effort, non-blocking)
  const persistChatHistory = async (msgs: ChatMessage[]) => {
    if (!user?.id) return;
    try {
      await supabase.from("bot_settings").upsert(
        [{ user_id: user.id, setting_key: "ai_training_chat_history", setting_value: JSON.stringify(msgs) }] as any,
        { onConflict: "user_id,setting_key" } as any,
      );
    } catch { /* ignore */ }
  };


  const upsertSettings = async (nextSettings: SettingsMap) => {
    if (!user?.id) throw new Error("Please log in again.");

    const payload = Object.entries(nextSettings).map(([setting_key, setting_value]) => ({
      setting_key,
      setting_value,
      user_id: user.id,
    }));

    if (payload.length === 0) return;

    const { error } = await supabase
      .from("bot_settings")
      .upsert(payload as any, { onConflict: "user_id,setting_key" } as any);

    if (error) throw error;
  };

  const persistSettings = async (
    nextSettings: SettingsMap,
    successMessage?: string,
  ) => {
    await upsertSettings(nextSettings);
    await queryClient.invalidateQueries({ queryKey: ["bot-settings", user?.id] });
    setHasChanges(false);
    toast.success(successMessage ?? t("aiTraining.saved"));
  };

  const saveMutation = useMutation({
    mutationFn: async (nextSettings: SettingsMap = settings) => persistSettings(nextSettings),
    onError: (e: any) => toast.error(e.message || "Failed to save settings"),
  });

  const update = (key: string, value: string) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setHasChanges(true);
  };

  const loadStarterTemplate = async () => {
    const preset = PRESET_TEMPLATES[cat];
    let filled = 0;
    const next: SettingsMap = { ...settings };
    for (const [k, v] of Object.entries(preset)) {
      if (!next[k] || !String(next[k]).trim()) {
        next[k] = v;
        filled++;
      }
    }
    if (filled === 0) {
      toast.info(t("aiTraining.templateAllSet"));
      return;
    }
    setSettings(next);
    setHasChanges(true);
    try {
      await persistSettings(next, t("aiTraining.templateLoaded", { count: filled }));
    } catch (e: any) {
      toast.error(e.message || "Failed to save template");
    }
  };


  const faqList = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
  const neverSayList = parseSettingsJson<string[]>(settings.never_say_list, []);

  // ---- Chat Functions ----

  const chatLang = settings.training_chat_language || "";
  const LANG_OPTIONS: { code: string; label: string }[] = [
    { code: "en", label: "English" },
    { code: "bn", label: "বাংলা" },
    { code: "es", label: "Español" },
    { code: "ko", label: "한국어" },
  ];
  const chatLangLabel = LANG_OPTIONS.find((l) => l.code === chatLang)?.label || "";

  const setChatLanguage = async (code: string) => {
    const next = { ...settings, training_chat_language: code };
    setSettings(next);
    try {
      await upsertSettings({ training_chat_language: code });
      await queryClient.invalidateQueries({ queryKey: ["bot-settings", user?.id] });
      const label = LANG_OPTIONS.find((l) => l.code === code)?.label || code;
      toast.success(t("aiTraining.languageLockedToast", { lang: label }));
    } catch (e: any) {
      toast.error(e.message || "Failed to save language");
    }
  };

  const startChat = async (overrideLang?: string) => {
    const lang = overrideLang || chatLang;
    if (!lang) return; // picker handles this
    setChatStarted(true);
    setIsChatLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-training-chat", {
        body: {
          messages: [{ role: "user", content: "Hi, I want to set up my bot. Help me." }],
          settings,
          category: cat,
          language: lang,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const initial: ChatMessage[] = [
        { role: "user", content: "Hi, I want to set up my bot." },
        { role: "assistant", content: data.reply },
      ];
      setChatMessages(initial);
      persistChatHistory(initial);
    } catch (e: any) {
      toast.error(e.message || "Failed to start training chat");
      setChatStarted(false);
    } finally {
      setIsChatLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user" as const, content: userMsg }];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-training-chat", {
        body: { messages: newMessages, settings, category: cat, language: chatLang },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const finalMsgs = [...newMessages, { role: "assistant" as const, content: data.reply }];
      setChatMessages(finalMsgs);
      persistChatHistory(finalMsgs);
    } catch (e: any) {
      toast.error(e.message || "Failed to get response");
      setChatMessages(newMessages);
    } finally {
      setIsChatLoading(false);
    }
  };

  const generateAndApplySettings = async () => {
    if (chatMessages.length < 4) {
      toast.error("Please answer a few more questions first.");
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-training-chat", {
        body: { messages: chatMessages, action: "generate_settings", settings, category: cat, language: chatLang },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const generated = (data.settings ?? {}) as Record<string, unknown>;
      const newSettings = mergeGeneratedSettings(settings, generated);

      if (JSON.stringify(newSettings) === JSON.stringify(settings)) {
        toast.info("No new changes found yet. Keep chatting and be a bit more specific.");
        return;
      }

      setSettings(newSettings);
      setHasChanges(true);
      await persistSettings(newSettings, "Wizard changes merged into Manual and saved.");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate settings");
    } finally {
      setIsGenerating(false);
    }
  };

  const resetChat = async () => {
    setChatMessages([]);
    setChatStarted(false);
    if (user?.id) {
      try {
        await supabase
          .from("bot_settings")
          .delete()
          .eq("user_id", user.id)
          .eq("setting_key", "ai_training_chat_history");
      } catch { /* ignore */ }
    }
  };

  const changeChatLanguage = async () => {
    // Clear language + history, return to picker
    setChatMessages([]);
    setChatStarted(false);
    const next = { ...settings };
    delete next.training_chat_language;
    setSettings(next);
    if (user?.id) {
      try {
        await supabase
          .from("bot_settings")
          .delete()
          .eq("user_id", user.id)
          .in("setting_key", ["training_chat_language", "ai_training_chat_history"]);
      } catch { /* ignore */ }
    }
  };



  // ---- Manual helpers ----
  const addFaq = () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    const existing = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
    existing.push({ q: faqQuestion, a: faqAnswer });
    update("faq_list", JSON.stringify(existing));
    setFaqQuestion("");
    setFaqAnswer("");
  };

  const removeFaq = (i: number) => {
    const existing = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
    existing.splice(i, 1);
    update("faq_list", JSON.stringify(existing));
  };

  const addNeverSay = () => {
    if (!neverSayItem.trim()) return;
    const existing = parseSettingsJson<string[]>(settings.never_say_list, []);
    existing.push(neverSayItem.trim());
    update("never_say_list", JSON.stringify(existing));
    setNeverSayItem("");
  };

  const removeNeverSay = (i: number) => {
    const existing = parseSettingsJson<string[]>(settings.never_say_list, []);
    existing.splice(i, 1);
    update("never_say_list", JSON.stringify(existing));
  };

  const generateFaqFromChats = async () => {
    setIsLoadingFaqSuggestions(true);
    try {
      // Fetch recent incoming messages from customers
      const { data: messages } = await supabase
        .from("messages")
        .select("content")
        .eq("direction", "incoming")
        .not("content", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!messages?.length) {
        toast.error("No customer messages found yet. Start chatting first!");
        setIsLoadingFaqSuggestions(false);
        return;
      }

      const customerMessages = messages.map(m => m.content).filter(Boolean).join("\n");

      const { data, error } = await supabase.functions.invoke("ai-training-chat", {
        body: {
          messages: [{ role: "user", content: `Analyze these real customer messages and suggest 8-10 FAQ entries (question + answer pairs). Focus on the MOST COMMON questions customers ask. Return JSON array: [{"q":"question","a":"suggested answer"}]. Customer messages:\n${customerMessages}` }],
          action: "faq_suggestions",
          settings,
          category: cat,
        },
      });


      if (error) throw error;
      if (data?.faqs) {
        const existingFaqs = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
        const filtered = data.faqs.filter((s: any) => !existingFaqs.some((f: any) => f.q === s.q));
        setAiSuggestedFaqs(filtered);
        if (filtered.length === 0) toast.info("No new suggestions — you've covered the common questions!");
      } else if (data?.reply) {
        // Try to parse from reply
        try {
          const parsed = JSON.parse(data.reply);
          const existingFaqs = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
          const filtered = (Array.isArray(parsed) ? parsed : []).filter((s: any) => !existingFaqs.some((f: any) => f.q === s.q));
          setAiSuggestedFaqs(filtered);
        } catch {
          toast.error("Couldn't parse suggestions. Try again.");
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate suggestions");
    } finally {
      setIsLoadingFaqSuggestions(false);
    }
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            {t(`aiTraining.titleByCat.${cat}`)}
          </h2>
          <p className="text-sm text-muted-foreground">{t(`aiTraining.subtitleByCat.${cat}`)}</p>

        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadStarterTemplate} variant="outline" size="sm" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {t("aiTraining.loadTemplate")}
          </Button>
          {hasChanges && (
            <Button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending} size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? t("aiTraining.saving") : t("aiTraining.save")}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="wizard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-10">
          <TabsTrigger value="wizard" className="gap-1.5 text-sm">
            <Sparkles className="h-3.5 w-3.5" /> {t("aiTraining.wizardTab")}
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5 text-sm">
            <Settings2 className="h-3.5 w-3.5" /> {t("aiTraining.manualTab")}
          </TabsTrigger>
          <TabsTrigger value="autolearn" className="gap-1.5 text-sm">
            <Brain className="h-3.5 w-3.5" /> {t("autoLearn.tab")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="autolearn"><AutoLearnPanel /></TabsContent>

        {/* ===== AI WIZARD TAB ===== */}
        <TabsContent value="wizard" className="space-y-4">
          {!chatStarted ? (
            !chatLang ? (
              <Card className="border-dashed border-primary/30">
                <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Languages className="h-7 w-7 text-primary" />
                  </div>
                  <div className="text-center space-y-1.5">
                    <h3 className="font-semibold text-lg">{t("aiTraining.chooseLanguageTitle")}</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {t("aiTraining.chooseLanguageDesc")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {LANG_OPTIONS.map((l) => (
                      <Button
                        key={l.code}
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await setChatLanguage(l.code);
                          await startChat(l.code);
                        }}
                        className="gap-1.5"
                      >
                        {l.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed border-primary/30">
                <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-7 w-7 text-primary" />
                  </div>
                  <div className="text-center space-y-1.5">
                    <h3 className="font-semibold text-lg">{t("aiTraining.wizardTitle")}</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {t("aiTraining.wizardDesc")}
                    </p>
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Languages className="h-3 w-3" /> {chatLangLabel}
                      <button onClick={changeChatLanguage} className="underline ml-1 hover:text-primary">
                        {t("aiTraining.changeLanguage")}
                      </button>
                    </p>
                  </div>
                  <Button onClick={() => startChat()} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    {t("aiTraining.startTraining")}
                  </Button>
                </CardContent>
              </Card>
            )
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card className="flex flex-col" style={{ height: "calc(100vh - 260px)", minHeight: "400px" }}>
              {/* Chat Header */}
              <CardHeader className="pb-2 pt-3 px-4 flex-row items-center justify-between space-y-0 border-b">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">{t("aiTraining.assistant")}</CardTitle>
                  {chatLangLabel && (
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-muted">
                      <Languages className="h-3 w-3" /> {chatLangLabel}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateAndApplySettings}
                    disabled={isGenerating || saveMutation.isPending || chatMessages.length < 4}
                    className="h-7 text-xs gap-1"
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                    {isGenerating ? t("aiTraining.generating") : t("aiTraining.applySettings")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={changeChatLanguage} className="h-7 text-xs gap-1" title={t("aiTraining.changeLanguage")}>
                    <Languages className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={resetChat} className="h-7 text-xs gap-1">
                    <RotateCcw className="h-3 w-3" /> {t("aiTraining.resetConversation")}
                  </Button>
                </div>
              </CardHeader>

              {/* Chat Messages */}
              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-3">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.content}
                      </div>
                      {msg.role === "user" && (
                        <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex gap-2 items-center">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="bg-muted rounded-xl px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Chat Input */}
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t("aiTraining.typeAnswer")}
                    className="h-9 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    disabled={isChatLoading}
                  />
                  <Button size="sm" onClick={sendMessage} disabled={isChatLoading || !chatInput.trim()} className="h-9 w-9 p-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                  {t("aiTraining.wizardHelper")}
                </p>
              </div>
            </Card>

            {/* Live Business Profile Summary */}
            <ProfileSummaryPanel
              cat={cat}
              settings={settings}
              catFields={catFields}
              onAsk={(label) => setChatInput(t("aiTraining.askHintPrefix") + " " + label)}
            />
            </div>
          )}
        </TabsContent>

        {/* ===== MANUAL TAB ===== */}
        <TabsContent value="manual" className="space-y-4">
          {/* Bot Identity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("aiTraining.botIdentity")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t("aiTraining.botName")}</Label>
                  <Input value={settings.bot_name || ""} onChange={(e) => update("bot_name", e.target.value)} placeholder={t("aiTraining.botNamePh")} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("botSettings.businessName")}</Label>
                  <Input value={settings.business_name || ""} onChange={(e) => update("business_name", e.target.value)} placeholder={t("botSettings.businessNamePh")} className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("botSettings.businessDesc")}</Label>
                <Textarea value={settings.business_description || ""} onChange={(e) => update("business_description", e.target.value)} placeholder={t("botSettings.businessDescPh")} className="min-h-[60px] text-sm" />
              </div>
            </CardContent>
          </Card>

          {/* Personality */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("botSettings.customInstructions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("aiTraining.botIdentity")}</Label>
                <Textarea value={settings.ai_personality || ""} onChange={(e) => update("ai_personality", e.target.value)} placeholder={t("botSettings.customInstructionsPh")} className="min-h-[80px] text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("botSettings.customInstructionsLabel")}</Label>
                <Textarea value={settings.custom_instructions || ""} onChange={(e) => update("custom_instructions", e.target.value)} placeholder={t("botSettings.customInstructionsPh")} className="min-h-[80px] text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("aiTraining.replyTone")}</Label>
                <Input value={settings.reply_tone || ""} onChange={(e) => update("reply_tone", e.target.value)} placeholder={t("aiTraining.replyTonePh")} className="h-8 text-sm" />
              </div>
            </CardContent>
          </Card>

          {/* Category-specific knowledge */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t(`aiTraining.kbTitle.${cat}`)}</CardTitle>
              <CardDescription className="text-xs">{t(`aiTraining.kbDesc.${cat}`)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {catFields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{t(f.labelKey)}</Label>
                  {f.type === "textarea" ? (
                    <Textarea
                      value={settings[f.key] || ""}
                      onChange={(e) => update(f.key, e.target.value)}
                      placeholder={t(f.phKey)}
                      className="min-h-[60px] text-sm"
                    />
                  ) : (
                    <Input
                      value={settings[f.key] || ""}
                      onChange={(e) => update(f.key, e.target.value)}
                      placeholder={t(f.phKey)}
                      className="h-8 text-sm"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>


          {/* Welcome */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> {t("aiTraining.welcomeMessage")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("aiTraining.welcomeMessage")}</Label>
                <Input value={settings.welcome_message || ""} onChange={(e) => update("welcome_message", e.target.value)} placeholder={t("aiTraining.welcomeMessagePh")} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("aiTraining.outOfStock")}</Label>
                <Input value={settings.out_of_stock_message || ""} onChange={(e) => update("out_of_stock_message", e.target.value)} placeholder={t("aiTraining.outOfStockPh")} className="h-8 text-sm" />
              </div>
            </CardContent>
          </Card>



          {/* FAQ */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("aiTraining.faq")}</CardTitle>
              <CardDescription className="text-xs">{t("aiTraining.faqDesc")}</CardDescription>
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
              <div className="space-y-2 border border-dashed rounded-md p-3">
                <Input value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)} placeholder={t("aiTraining.questionPh")} className="h-8 text-sm" />
                <Input value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)} placeholder={t("aiTraining.answerPh")} className="h-8 text-sm" />
                <Button size="sm" variant="outline" onClick={addFaq} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> {t("common.add")}
                </Button>
              </div>

              {/* AI-Generated Suggestions from Real Chats */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Wand2 className="h-3 w-3" /> {t("aiTraining.aiSuggestions")}
                  </p>
                  <Button size="sm" variant="outline" onClick={generateFaqFromChats} disabled={isLoadingFaqSuggestions} className="h-7 text-xs gap-1">
                    {isLoadingFaqSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {isLoadingFaqSuggestions ? t("aiTraining.analyzing") : t("aiTraining.suggestFromChats")}
                  </Button>
                </div>
              {aiSuggestedFaqs.length > 0 && (
                  <div className="grid gap-1.5">
                    {aiSuggestedFaqs.map((s, i) => (
                      editingSuggestionIdx === i ? (
                        <div key={`ai-edit-${i}`} className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                          <Input value={editingSuggestion.q} onChange={e => setEditingSuggestion(p => ({...p, q: e.target.value}))} placeholder={t("aiTraining.questionPh")} className="h-8 text-sm" />
                          <Input value={editingSuggestion.a} onChange={e => setEditingSuggestion(p => ({...p, a: e.target.value}))} placeholder={t("aiTraining.answerPh")} className="h-8 text-sm" />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => {
                              const existing = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
                              existing.push({ q: editingSuggestion.q, a: editingSuggestion.a });
                              update("faq_list", JSON.stringify(existing));
                              setAiSuggestedFaqs(prev => prev.filter((_, idx) => idx !== i));
                              setEditingSuggestionIdx(null);
                              toast.success(t("aiTraining.addedToast"));
                            }} disabled={!editingSuggestion.q.trim() || !editingSuggestion.a.trim()}>
                              <Plus className="h-3 w-3" /> {t("common.add")}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingSuggestionIdx(null)}>{t("common.cancel")}</Button>
                          </div>
                        </div>
                      ) : (
                        <div key={`ai-${i}`} className="flex items-center gap-2 text-left bg-primary/5 hover:bg-primary/10 border border-primary/10 hover:border-primary/20 rounded-lg p-2 transition-all group">
                          <button onClick={() => {
                            const existing = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
                            existing.push({ q: s.q, a: s.a });
                            update("faq_list", JSON.stringify(existing));
                            setAiSuggestedFaqs(prev => prev.filter((_, idx) => idx !== i));
                            toast.success(t("aiTraining.addedToast"));
                          }} className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                            <Plus className="h-3 w-3 text-primary" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">{s.q}</p>
                            <p className="text-[10px] text-muted-foreground">{s.a}</p>
                          </div>
                          <button onClick={() => { setEditingSuggestionIdx(i); setEditingSuggestion({q: s.q, a: s.a}); }} className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" title={t("common.edit")}>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Add — Common Questions */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> {t("aiTraining.quickAdd")}
                </p>
                <div className="grid gap-1.5">
                  {quickAdd
                    .map(({ qKey, aKey }) => ({ q: t(qKey), a: t(aKey) }))
                    .filter((s) => !faqList.some((f: any) => f.q === s.q))
                    .map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const existing = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
                          existing.push({ q: s.q, a: s.a });
                          update("faq_list", JSON.stringify(existing));
                          toast.success(t("aiTraining.addedToast"));
                        }}
                        className="flex items-center gap-2 text-left bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-primary/20 rounded-lg p-2 transition-all group"
                      >
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <Plus className="h-3 w-3 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{s.q}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{s.a}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Never Say */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("aiTraining.neverSay")}</CardTitle>
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
                <Input value={neverSayItem} onChange={(e) => setNeverSayItem(e.target.value)} placeholder={t("aiTraining.neverSayPh")} className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && addNeverSay()} />
                <Button size="sm" variant="outline" onClick={addNeverSay} className="h-8 text-xs shrink-0">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Comment Auto-Reply */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("aiTraining.commentAutoReply")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("aiTraining.enableCommentReplies")}</Label>
                <Switch
                  checked={settings.comment_auto_reply === "true"}
                  onCheckedChange={(v) => update("comment_auto_reply", v ? "true" : "false")}
                />
              </div>
              {settings.comment_auto_reply === "true" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("aiTraining.replyPrimary")}</Label>
                    <Input value={settings.comment_reply_text_en || ""} onChange={(e) => update("comment_reply_text_en", e.target.value)} placeholder={t("aiTraining.replyPrimaryPh")} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("aiTraining.replyAlt")}</Label>
                    <Input value={settings.comment_reply_text || ""} onChange={(e) => update("comment_reply_text", e.target.value)} placeholder={t("aiTraining.replyAltPh")} className="h-8 text-sm" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save */}
          {hasChanges && (
            <Button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending} className="w-full gap-2">
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? t("aiTraining.saving") : t("aiTraining.saveAll")}
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ----- Live Business Profile Summary -----
type ProfileSummaryProps = {
  cat: BusinessCategory;
  settings: SettingsMap;
  catFields: CatField[];
  onAsk: (label: string) => void;
};

const ProfileSummaryPanel = ({ cat, settings, catFields, onAsk }: ProfileSummaryProps) => {
  const { t } = useTranslation();

  // Core fields shown for every niche, then niche-specific fields
  const coreFields: { key: string; label: string }[] = [
    { key: "business_name", label: t("aiTraining.businessName", "Business name") },
    { key: "reply_tone", label: t("aiTraining.replyTone") },
    { key: "welcome_message", label: t("aiTraining.welcomeMessage") },
  ];
  const nicheFields = catFields.map((f) => ({ key: f.key, label: t(f.labelKey) }));

  // FAQ + Never-say counts treated as fields too
  const faqCount = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []).length;
  const neverCount = parseSettingsJson<string[]>(settings.never_say_list, []).length;

  const rows = [
    ...coreFields,
    ...nicheFields,
    { key: "faq_list", label: `${t("aiTraining.faq")} (${faqCount})`, isList: true, count: faqCount },
    { key: "never_say_list", label: `${t("aiTraining.neverSay")} (${neverCount})`, isList: true, count: neverCount },
  ] as { key: string; label: string; isList?: boolean; count?: number }[];

  const isFilled = (r: typeof rows[number]) => {
    if (r.isList) return (r.count ?? 0) > 0;
    return !!(settings[r.key] && String(settings[r.key]).trim());
  };
  const filledCount = rows.filter(isFilled).length;
  const pct = Math.round((filledCount / rows.length) * 100);

  return (
    <Card className="h-fit lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("aiTraining.profileTitle")}
        </CardTitle>
        <CardDescription className="text-xs">
          {filledCount === rows.length
            ? t("aiTraining.profileComplete")
            : t("aiTraining.profileProgress", { filled: filledCount, total: rows.length })}
        </CardDescription>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {rows.map((r) => {
          const filled = isFilled(r);
          const value = r.isList
            ? (r.count && r.count > 0 ? `${r.count} ${t("aiTraining.itemsLabel")}` : "")
            : String(settings[r.key] || "");
          return (
            <div
              key={r.key}
              className={`rounded-lg border px-2.5 py-2 text-xs flex items-start gap-2 ${
                filled ? "border-primary/20 bg-primary/5" : "border-dashed border-border bg-muted/30"
              }`}
            >
              {filled ? (
                <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground/90">{r.label}</div>
                {filled ? (
                  <div className="text-muted-foreground line-clamp-2 mt-0.5 break-words">{value}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAsk(r.label)}
                    className="text-primary hover:underline mt-0.5"
                  >
                    {t("aiTraining.notSetYet")} · {t("aiTraining.askAi")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AiTraining;

