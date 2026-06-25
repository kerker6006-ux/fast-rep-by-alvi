import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActivePage, PageCategory } from "@/contexts/ActivePageContext";
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

type Cat = PageCategory; // "ecommerce" | "service" | "content_creator"
type CatField = { key: string; label: string; placeholder: string; type?: "text" | "textarea" };

const CATEGORY_META: Record<Cat, { title: string; subtitle: string; kbTitle: string; kbDesc: string }> = {
  ecommerce: {
    title: "AI Shopkeeper Training",
    subtitle: "Train your store assistant to pitch products, take orders, and answer about delivery & payments.",
    kbTitle: "Shop Knowledge",
    kbDesc: "Shipping, payment and return policies the bot will use.",
  },
  service: {
    title: "AI Receptionist Training",
    subtitle: "Train your front-desk to qualify leads, book appointments, and answer service questions.",
    kbTitle: "Service Business Knowledge",
    kbDesc: "Hours, location, service area, pricing and booking policies the bot will use.",
  },
  content_creator: {
    title: "AI Course Assistant Training",
    subtitle: "Train your bot to pitch courses, capture leads, and handle access/enrollment questions.",
    kbTitle: "Creator Knowledge",
    kbDesc: "Course lineup, enrollment, refund policy and access info the bot will use.",
  },
};

const CATEGORY_FIELDS: Record<Cat, CatField[]> = {
  ecommerce: [
    { key: "delivery_info", label: "Delivery Info", placeholder: "Flat $5 shipping. 3–5 business days nationwide." },
    { key: "payment_methods", label: "Payment Methods", placeholder: "Card, PayPal, Cash on Delivery." },
    { key: "return_policy", label: "Return Policy", placeholder: "7-day return on unused items in original packaging." },
  ],
  service: [
    { key: "operating_hours", label: "Operating Hours", placeholder: "Mon–Sat 9am–7pm. Sun closed." },
    { key: "business_address", label: "Address / Service Area", placeholder: "123 Main St, City — or 25-mile radius." },
    { key: "pricing_policy", label: "Pricing / Estimate Policy", placeholder: "Free phone estimate. $79 on-site diagnostic, credited toward repair.", type: "textarea" },
    { key: "cancellation_policy", label: "Cancellation / Booking Policy", placeholder: "Free reschedule with 24h notice. No-shows forfeit any deposit.", type: "textarea" },
    { key: "emergency_policy", label: "Emergency / Same-Day Policy", placeholder: "Same-day slots for urgent cases — please call the front desk.", type: "textarea" },
  ],
  content_creator: [
    { key: "course_lineup", label: "Course / Product Lineup", placeholder: "Beginner course — $49. Advanced cohort — $199 (live).", type: "textarea" },
    { key: "enrollment_info", label: "Enrollment & Access", placeholder: "After payment, access link is emailed within 5 minutes. Lifetime access.", type: "textarea" },
    { key: "refund_policy", label: "Refund Policy", placeholder: "7-day refund if less than 20% consumed." },
    { key: "support_channel", label: "Support Channel", placeholder: "Email support@yourdomain.com — replies within 12h." },
  ],
};

const QUICK_ADD_BY_CAT: Record<Cat, { q: string; a: string }[]> = {
  ecommerce: [
    { q: "How much is delivery?", a: "Flat $5 nationwide, delivered in 3–5 business days." },
    { q: "What payment methods do you accept?", a: "Card, PayPal and Cash on Delivery." },
    { q: "What is your return policy?", a: "7-day return on unused items in original packaging." },
    { q: "Do you have it in stock?", a: "Let me check — share the product name or photo." },
  ],
  service: [
    { q: "What are your hours?", a: "We're open Mon–Sat 9am–7pm. Sun closed." },
    { q: "Where are you located?", a: "123 Main St, City. We also serve a 25-mile radius." },
    { q: "How much does it cost?", a: "Estimates are free over phone. A detailed quote is shared after a quick consultation." },
    { q: "How do I book an appointment?", a: "Share your name, phone and preferred date — I'll book you in." },
  ],
  content_creator: [
    { q: "How do I enroll?", a: "Share your name and email — I'll send the enrollment link right away." },
    { q: "How long is access?", a: "You get lifetime access to the course after purchase." },
    { q: "Do you offer refunds?", a: "Yes — within 7 days if you've consumed less than 20% of the course." },
    { q: "Can I get a discount?", a: "Special bundles are posted on the page. DM us 'BUNDLE' to see current offers." },
  ],
};

// Starter templates per niche — applied only to EMPTY fields (never overwrites edits).
const PRESET_TEMPLATES: Record<Cat, SettingsMap> = {
  ecommerce: {
    delivery_info: "Flat $5 shipping. Standard delivery 3–5 business days.",
    payment_methods: "Credit/Debit card, PayPal, Cash on Delivery.",
    return_policy: "7-day return for unused items in original packaging. Buyer pays return shipping.",
    reply_tone: "Friendly, direct, helpful — sharp shopkeeper energy.",
    welcome_message: "Hi! Welcome to our shop. What are you looking for today?",
    out_of_stock_message: "That item is out of stock right now. Want me to suggest a similar one?",
    ai_personality: "You are a sharp shopkeeper. Pitch products, send images, capture name/phone/address/quantity, and confirm orders before saving. Never invent prices.",
  },
  service: {
    operating_hours: "Mon–Sat 9:00am – 7:00pm. Sun closed.",
    business_address: "123 Main St, City",
    pricing_policy: "Free phone estimates. On-site diagnostic $79, credited toward any repair.",
    cancellation_policy: "Free reschedule with 24h notice. Later cancellations may forfeit any deposit.",
    emergency_policy: "Same-day slots available for urgent cases — please call the front desk.",
    reply_tone: "Warm, calm, professional front-desk receptionist.",
    welcome_message: "Hi! Thanks for reaching out. How can we help you today?",
    ai_personality: "You are a professional front-desk receptionist. Qualify the request, capture name/phone/service-needed/preferred-date, and book the appointment. Never invent prices or policies — only answer from the knowledge base.",
  },
  content_creator: {
    course_lineup: "Beginner course — $49. Advanced cohort — $199 (live, monthly).",
    enrollment_info: "After payment, access link is emailed within 5 minutes. Lifetime access.",
    refund_policy: "7-day refund if less than 20% of the course is consumed.",
    support_channel: "Email support@yourdomain.com or DM us — replies within 12h.",
    reply_tone: "Warm, encouraging, knowledgeable mentor.",
    welcome_message: "Hey! Glad you're here. Which course are you interested in?",
    ai_personality: "You are a course support assistant. Pitch the right course, capture name + email/phone + course of interest, and answer enrollment/access questions. Never impersonate the creator and never invent course content.",
  },
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const AiTraining = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activePage } = useActivePage();
  const cat: Cat = (activePage?.page_category as Cat) || "ecommerce";
  const meta = CATEGORY_META[cat];
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

  // Auto-analysis state
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzePhase, setAnalyzePhase] = useState<string>("");
  const [analyzeStats, setAnalyzeStats] = useState<{ messages: number; conversations: number } | null>(null);

  // Manual settings state
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [neverSayItem, setNeverSayItem] = useState("");
  const [aiSuggestedFaqs, setAiSuggestedFaqs] = useState<{q: string; a: string}[]>([]);
  const [isLoadingFaqSuggestions, setIsLoadingFaqSuggestions] = useState(false);
  const [editingSuggestionIdx, setEditingSuggestionIdx] = useState<number | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<{q: string; a: string}>({q: "", a: ""});

  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ["bot-settings", activePage?.id],
    enabled: !!activePage?.id,
    queryFn: async () => {
      if (!activePage?.id) return [];
      const { data, error } = await supabase
        .from("bot_settings")
        .select("*")
        .eq("fb_page_id", activePage.id);
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
    if (!user?.id || !activePage?.id) return;
    try {
      await supabase.from("bot_settings").upsert(
        [{ user_id: user.id, fb_page_id: activePage.id, setting_key: "ai_training_chat_history", setting_value: JSON.stringify(msgs) }] as any,
        { onConflict: "fb_page_id,setting_key" } as any,
      );
    } catch { /* ignore */ }
  };


  const upsertSettings = async (nextSettings: SettingsMap) => {
    if (!user?.id) throw new Error("Please log in again.");
    if (!activePage?.id) throw new Error("Select a page first.");

    const payload = Object.entries(nextSettings).map(([setting_key, setting_value]) => ({
      setting_key,
      setting_value,
      user_id: user.id,
      fb_page_id: activePage.id,
    }));

    if (payload.length === 0) return;

    const { error } = await supabase
      .from("bot_settings")
      .upsert(payload as any, { onConflict: "fb_page_id,setting_key" } as any);

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

  // --- Auto-analysis ---
  const runAnalysis = async (opts: { force?: boolean; lang?: string } = {}): Promise<any | null> => {
    if (!activePage?.id) return null;
    setAnalyzing(true);
    setAnalyzePhase("Reading your past Messenger chats…");
    try {
      const { data, error } = await supabase.functions.invoke("wizard-auto-analyze", {
        body: {
          fb_page_id: activePage.id,
          language: opts.lang || chatLang || "en",
          category: cat,
          force: !!opts.force,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const a = data?.analysis || null;
      setAnalysis(a);
      setAnalyzeStats({
        messages: data?.messages_scanned ?? a?.stats?.messages_scanned ?? 0,
        conversations: data?.conversations_scanned ?? a?.stats?.conversations_scanned ?? 0,
      });
      setAnalyzePhase("Drafting your bot settings…");

      if (a?.draft_settings && Object.keys(a.draft_settings).length > 0) {
        const merged = mergeGeneratedSettings(settings, a.draft_settings as any);
        if (JSON.stringify(merged) !== JSON.stringify(settings)) {
          setSettings(merged);
          setHasChanges(true);
        }
      }
      if (Array.isArray(a?.draft_faqs) && a.draft_faqs.length) {
        const existing = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
        const filtered = a.draft_faqs.filter((s: any) => s?.q && !existing.some((f) => f.q === s.q));
        if (filtered.length) setAiSuggestedFaqs(filtered);
      }
      return a;
    } catch (e: any) {
      toast.error(e.message || "Couldn't analyze past chats");
      return null;
    } finally {
      setAnalyzing(false);
      setAnalyzePhase("");
    }
  };

  const startChat = async (overrideLang?: string) => {
    const lang = overrideLang || chatLang;
    if (!lang) return; // picker handles this
    setChatStarted(true);
    setIsChatLoading(true);

    // Run analysis FIRST (cached after first call)
    const a = await runAnalysis({ lang });

    try {
      const hasInsights = !!(a && !a.insufficient_data && (a.tone_summary || (a.top_questions?.length ?? 0) > 0));
      const opener = hasInsights
        ? "Hi — please use what you learned from my past chats and walk me through setup."
        : "Hi, I want to set up my bot. Help me.";
      const { data, error } = await supabase.functions.invoke("ai-training-chat", {
        body: {
          messages: [{ role: "user", content: opener }],
          settings,
          category: cat,
          language: lang,
          analysis_context: a || undefined,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const initial: ChatMessage[] = [
        { role: "user", content: opener },
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
        body: { messages: newMessages, settings, category: cat, language: chatLang, analysis_context: analysis || undefined },
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
    if (activePage?.id) {
      try {
        await supabase
          .from("bot_settings")
          .delete()
          .eq("fb_page_id", activePage.id)
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
    if (activePage?.id) {
      try {
        await supabase
          .from("bot_settings")
          .delete()
          .eq("fb_page_id", activePage.id)
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
            {meta.title}
          </h2>
          <p className="text-sm text-muted-foreground">{meta.subtitle}</p>

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

      <TrainingSpendCard />


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
          {analyzing && chatMessages.length === 0 ? (
            <Card className="border-dashed border-primary/30">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                </div>
                <div className="text-center space-y-1.5 max-w-md">
                  <h3 className="font-semibold text-lg">Analyzing your past conversations…</h3>
                  <p className="text-sm text-muted-foreground">{analyzePhase || "Learning how customers ask and how you reply, so the bot inherits your voice."}</p>
                  {analyzeStats && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Scanned {analyzeStats.messages} messages across {analyzeStats.conversations} conversations.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : !chatStarted ? (
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
            <div className="space-y-3 flex flex-col" style={{ height: "calc(100vh - 260px)", minHeight: "400px" }}>
            {analysis && !analysis.insufficient_data && (analysis.tone_summary || (analysis.top_questions?.length ?? 0) > 0) && (
              <Card className="border-primary/30 bg-primary/5 shrink-0">
                <CardContent className="py-3 px-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Sparkles className="h-3.5 w-3.5" /> Learned from {analyzeStats?.messages ?? analysis.stats?.messages_scanned ?? 0} past messages
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => runAnalysis({ force: true })} disabled={analyzing}>
                      {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Re-analyze
                    </Button>
                  </div>
                  {analysis.tone_summary && (
                    <p className="text-xs text-muted-foreground"><b>Your tone:</b> {analysis.tone_summary}</p>
                  )}
                  {Array.isArray(analysis.top_questions) && analysis.top_questions.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Top customer questions detected: {analysis.top_questions.slice(0, 3).map((q: any) => `"${q.customer_q}"`).join(", ")}
                      {analysis.top_questions.length > 3 ? `, +${analysis.top_questions.length - 3} more` : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            <Card className="flex flex-col flex-1 min-h-0">
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
            </div>

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
              <CardTitle className="text-sm">{meta.kbTitle}</CardTitle>
              <CardDescription className="text-xs">{meta.kbDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {catFields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  {f.type === "textarea" ? (
                    <Textarea
                      value={settings[f.key] || ""}
                      onChange={(e) => update(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="min-h-[60px] text-sm"
                    />
                  ) : (
                    <Input
                      value={settings[f.key] || ""}
                      onChange={(e) => update(f.key, e.target.value)}
                      placeholder={f.placeholder}
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
  cat: Cat;
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
  const nicheFields = catFields.map((f) => ({ key: f.key, label: f.label }));

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

const TrainingSpendCard = () => {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["training-spend", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_usage")
        .select("estimated_cost, created_at")
        .eq("user_id", user!.id)
        .eq("call_type", "training");
      const rows = data || [];
      const total = rows.reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const month = rows.filter((r: any) => new Date(r.created_at) >= monthStart)
        .reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);
      return { total, month, count: rows.length };
    },
  });
  const fmt = (n: number) => `$${(n || 0).toFixed(4)}`;
  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">AI Training spend</p>
            <p className="text-xl font-bold">{fmt(data?.total || 0)}</p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>This month: <span className="font-semibold text-foreground">{fmt(data?.month || 0)}</span></p>
          <p>{data?.count || 0} training calls</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AiTraining;


