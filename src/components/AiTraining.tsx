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
  Briefcase, Megaphone,
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
    { key: "operating_hours", label: "Operating Hours", placeholder: "e.g. Mon–Fri 9am–6pm, Sat 10am–4pm" },
    { key: "business_address", label: "Address / Service Area", placeholder: "e.g. 123 Business Street, City, Country" },
    { key: "pricing_policy", label: "Pricing / Estimate Policy", placeholder: "e.g. Free consultation. Pricing depends on treatment selected.", type: "textarea" },
    { key: "cancellation_policy", label: "Cancellation / Booking Policy", placeholder: "e.g. Free reschedule with 24h notice.", type: "textarea" },
    { key: "emergency_policy", label: "Emergency / Same-Day Policy", placeholder: "e.g. Contact us directly for urgent appointments.", type: "textarea" },
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
    operating_hours: "",
    business_address: "",
    pricing_policy: "",
    cancellation_policy: "",
    emergency_policy: "",
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
  const [setupComplete, setSetupComplete] = useState(false);
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

  // Persist chat history to bot_settings so the wizard always reopens with the
  // last conversation for this Facebook page.
  const persistChatHistory = async (msgs: ChatMessage[]) => {
    if (!user?.id || !activePage?.id) return;
    const serialized = JSON.stringify(msgs);
    // Keep React state mirror in sync so re-hydration after a refetch
    // doesn't show a stale history.
    setSettings((s) => ({ ...s, ai_training_chat_history: serialized }));
    try {
      const { error } = await supabase.from("bot_settings").upsert(
        [{ user_id: user.id, fb_page_id: activePage.id, setting_key: "ai_training_chat_history", setting_value: serialized }] as any,
        { onConflict: "fb_page_id,setting_key" } as any,
      );
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["bot-settings"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to save AI training chat");
    }
  };


  // Keys that have their own persistence path and must NOT be touched by the
  // generic settings save (otherwise stale React state overwrites the newer
  // value in the database — e.g. chat history vanishing after Save).
  const SELF_PERSISTED_KEYS = new Set(["ai_training_chat_history"]);

  const upsertSettings = async (nextSettings: SettingsMap) => {
    if (!user?.id) throw new Error("Please log in again.");
    if (!activePage?.id) throw new Error("Select a page first.");

    const payload = Object.entries(nextSettings)
      .filter(([setting_key]) => !SELF_PERSISTED_KEYS.has(setting_key))
      .map(([setting_key, setting_value]) => ({
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
    await queryClient.invalidateQueries({ queryKey: ["bot-settings"] });
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
      await queryClient.invalidateQueries({ queryKey: ["bot-settings"] });
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
      setSetupComplete(!!data.setup_complete);
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
      setSetupComplete(!!data.setup_complete);
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

      // ── Save services to DB (service pages) ──────────────────────
      if (cat === "service" && generated.services_list) {
        try {
          const servicesList = typeof generated.services_list === "string"
            ? JSON.parse(generated.services_list)
            : generated.services_list;

          if (Array.isArray(servicesList) && servicesList.length > 0) {
            const toInsert = servicesList.map((s: any) => ({
              user_id: user!.id,
              fb_page_id: activePage!.id,
              name: s.name || "Unnamed Service",
              description: s.description || "",
              price_text: s.price_text || s.price || "",
              duration_text: s.duration_text || s.duration || "",
              category: s.category || "general",
              active: true,
              faqs: [],
              keywords: [],
            }));
            const { error: svcErr } = await supabase
              .from("services")
              .insert(toInsert);
            if (!svcErr) {
              toast.success(`✅ ${servicesList.length} services added! Check the Services tab.`);
            } else {
              console.error("services insert error", svcErr);
            }
          }
          delete generated.services_list;
        } catch (e) { console.error("services save error", e); }
      }

      // ── Save products to DB (ecommerce pages) ────────────────────
      if (cat === "ecommerce" && generated.products_list) {
        try {
          const productsList = typeof generated.products_list === "string"
            ? JSON.parse(generated.products_list)
            : generated.products_list;

          if (Array.isArray(productsList) && productsList.length > 0) {
            const toInsert = productsList.map((p: any) => ({
              user_id: user!.id,
              fb_page_id: activePage!.id,
              name: p.name || "Unnamed Product",
              description: p.description || "",
              price: parseFloat(p.price) || 0,
              category: p.category || "general",
              keywords: Array.isArray(p.keywords) ? p.keywords : (p.keywords ? [p.keywords] : []),
              is_active: true,
              size_variants: [],
            }));
            const { error: prodErr } = await supabase
              .from("products")
              .insert(toInsert);
            if (!prodErr) {
              toast.success(`✅ ${productsList.length} products added! Check the Products tab.`);
            } else {
              console.error("products insert error", prodErr);
            }
          }
          delete generated.products_list;
        } catch (e) { console.error("products save error", e); }
      }

      // ── Save bot settings ─────────────────────────────────────────
      const newSettings = mergeGeneratedSettings(settings, generated);

      if (JSON.stringify(newSettings) === JSON.stringify(settings)) {
        toast.info("No new changes found yet. Keep chatting and be more specific.");
        return;
      }

      setSettings(newSettings);
      setHasChanges(true);
      await persistSettings(newSettings, "✅ Bot settings saved! Services/products updated automatically.");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate settings");
    } finally {
      setIsGenerating(false);
    }
  };

  const resetChat = async () => {
    setChatMessages([]);
    setChatStarted(false);
    setSetupComplete(false);
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
    setSetupComplete(false);
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
        <TabsList className="grid w-full grid-cols-4 h-12 p-1 bg-muted/50 rounded-xl">
          <TabsTrigger value="wizard" className="gap-1.5 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex-col h-full py-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-[11px]">{t("aiTraining.wizardTab")}</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex-col h-full py-1">
            <Settings2 className="h-4 w-4" />
            <span className="text-[11px]">{t("aiTraining.manualTab")}</span>
          </TabsTrigger>
          <TabsTrigger value="autolearn" className="gap-1.5 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex-col h-full py-1">
            <Brain className="h-4 w-4" />
            <span className="text-[11px]">{t("autoLearn.tab")}</span>
          </TabsTrigger>
          <TabsTrigger value="test-bot" className="gap-1.5 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex-col h-full py-1">
            <Bot className="h-4 w-4" />
            <span className="text-[11px]">Test Bot</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="autolearn"><AutoLearnPanel /></TabsContent>

        {/* ===== TEST BOT TAB ===== */}
        <TabsContent value="test-bot" className="space-y-4">
          <TestBotPanel activePage={activePage} settings={settings} user={user} supabase={supabase} />
        </TabsContent>
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
                  {/* Progress indicator */}
                  {catFields && (() => {
                    const total = catFields.length;
                    const filled = catFields.filter((f: any) => {
                      const v = settings[f.key];
                      if (!v) return false;
                      const s = String(v).trim();
                      if (!s) return false;
                      if (f.key === "faq_list" || f.key === "never_say_list") {
                        try { const a = JSON.parse(s); return Array.isArray(a) && a.length > 0; } catch { return false; }
                      }
                      return true;
                    }).length;
                    const pct = Math.round((filled / total) * 100);
                    return (
                      <span className={`text-[10px] font-semibold ml-1 px-2 py-0.5 rounded-full ${filled === total ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"}`}>
                        {filled}/{total} fields {filled === total ? "✓ Complete" : "set"}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant={setupComplete ? "default" : "outline"}
                    size="sm"
                    onClick={generateAndApplySettings}
                    disabled={isGenerating || saveMutation.isPending || chatMessages.length < 4}
                    className={`h-7 text-xs gap-1 ${setupComplete ? "animate-pulse ring-2 ring-primary/40" : ""}`}
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

              {setupComplete && (
                <div className="mx-4 mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    <span>Your bot has been set. Click <strong>Apply Settings</strong> to save.</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={generateAndApplySettings}
                    disabled={isGenerating || saveMutation.isPending}
                    className="h-7 text-xs gap-1 shrink-0"
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                    {isGenerating ? t("aiTraining.generating") : t("aiTraining.applySettings")}
                  </Button>
                </div>
              )}

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

          {/* Header with progress */}
          {(() => {
            const allFields = ["business_name", "business_description", "ai_personality", "reply_tone", "welcome_message", "faq_list", "never_say_list", ...catFields.map((f: any) => f.key)];
            const filled = allFields.filter(k => {
              const v = settings[k];
              if (!v) return false;
              const s = String(v).trim();
              if (!s) return false;
              if (k === "faq_list" || k === "never_say_list") { try { const a = JSON.parse(s); return Array.isArray(a) && a.length > 0; } catch { return false; } }
              return true;
            }).length;
            const pct = Math.round((filled / allFields.length) * 100);
            return (
              <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-transparent p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Bot Configuration</span>
                    <span className="text-xs text-muted-foreground">{filled}/{allFields.length} fields complete</span>
                  </div>
                  {pct === 100 && <span className="text-xs font-semibold text-green-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> All set!</span>}
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                {pct < 50 && <p className="text-xs text-muted-foreground">💡 Use the <strong>AI Wizard tab</strong> to fill everything automatically in 2 minutes</p>}
              </div>
            );
          })()}

          {/* ── SECTION 1: Identity ── */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="h-5 w-5 rounded-full bg-blue-500/15 flex items-center justify-center">
                <Bot className="h-3 w-3 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identity</span>
            </div>
            <Card className="overflow-hidden border-blue-100 dark:border-blue-900/30">
              <div className="h-0.5 bg-blue-500/40" />
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Bot Name</Label>
                    <Input value={settings.bot_name || ""} onChange={e => update("bot_name", e.target.value)} placeholder="e.g. My Business Bot" className="h-9" />
                    <p className="text-[10px] text-muted-foreground">What customers see as the sender name</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Business Name</Label>
                    <Input value={settings.business_name || ""} onChange={e => update("business_name", e.target.value)} placeholder="e.g. My Business Name" className="h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Business Description</Label>
                  <Textarea value={settings.business_description || ""} onChange={e => update("business_description", e.target.value)} placeholder="Describe your business — what you do, who you serve, what makes you special" className="min-h-[70px] resize-none text-sm" />
                  <p className="text-[10px] text-muted-foreground">The bot uses this to understand and represent your business</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── SECTION 2: Personality ── */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="h-5 w-5 rounded-full bg-purple-500/15 flex items-center justify-center">
                <Brain className="h-3 w-3 text-purple-600" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Personality & Behavior</span>
            </div>
            <Card className="overflow-hidden border-purple-100 dark:border-purple-900/30">
              <div className="h-0.5 bg-purple-500/40" />
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">AI Personality</Label>
                    <span className="text-[10px] text-muted-foreground bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded-full">Most important field</span>
                  </div>
                  <Textarea value={settings.ai_personality || ""} onChange={e => update("ai_personality", e.target.value)} placeholder='e.g. "You are a friendly, helpful assistant for [Business Name]. When customers ask about products/services, provide accurate information and guide them toward making a purchase or booking..."' className="min-h-[100px] resize-none text-sm" />
                  <p className="text-[10px] text-muted-foreground">Direct instructions to the bot — write as "You are..." and "When a customer says X, you..."</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Reply Tone</Label>
                    <Input value={settings.reply_tone || ""} onChange={e => update("reply_tone", e.target.value)} placeholder="e.g. Warm, professional, brief" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Welcome Message</Label>
                    <Input value={settings.welcome_message || ""} onChange={e => update("welcome_message", e.target.value)} placeholder="Hi! How can I help you today?" className="h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Special Instructions</Label>
                  <Textarea value={settings.custom_instructions || ""} onChange={e => update("custom_instructions", e.target.value)} placeholder="e.g. Always greet warmly. Never quote a price without consultation. If customer is upset, apologize first..." className="min-h-[70px] resize-none text-sm" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── SECTION 3: Business Info (category-specific) ── */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="h-5 w-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Briefcase className="h-3 w-3 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{meta.kbTitle}</span>
            </div>
            <Card className="overflow-hidden border-emerald-100 dark:border-emerald-900/30">
              <div className="h-0.5 bg-emerald-500/40" />
              <CardContent className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">{meta.kbDesc}</p>
                {catFields.map((f: any) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs font-medium">{f.label}</Label>
                    {f.type === "textarea" ? (
                      <Textarea value={settings[f.key] || ""} onChange={e => update(f.key, e.target.value)} placeholder={f.placeholder} className="min-h-[60px] resize-none text-sm" />
                    ) : (
                      <Input value={settings[f.key] || ""} onChange={e => update(f.key, e.target.value)} placeholder={f.placeholder} className="h-9" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* ── SECTION 4: FAQ ── */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="h-5 w-5 rounded-full bg-amber-500/15 flex items-center justify-center">
                <MessageCircle className="h-3 w-3 text-amber-600" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                FAQ — Frequently Asked Questions
                {faqList.length > 0 && <span className="ml-2 text-primary">{faqList.length} added</span>}
              </span>
            </div>
            <Card className="overflow-hidden border-amber-100 dark:border-amber-900/30">
              <div className="h-0.5 bg-amber-500/40" />
              <CardContent className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">Add common questions customers ask. The bot will use these to give accurate, consistent answers.</p>

                {/* Existing FAQs */}
                {faqList.length > 0 && (
                  <div className="space-y-1.5">
                    {faqList.map((f: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 bg-muted/40 hover:bg-muted/70 rounded-lg p-3 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">Q: {f.q}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">A: {f.a}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" onClick={() => removeFaq(i)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new FAQ */}
                <div className="border border-dashed rounded-xl p-3 space-y-2 bg-muted/20">
                  <p className="text-[10px] font-semibold text-muted-foreground">ADD A QUESTION</p>
                  <Input value={faqQuestion} onChange={e => setFaqQuestion(e.target.value)} placeholder="e.g. How long does delivery take?" className="h-9 text-sm" />
                  <Input value={faqAnswer} onChange={e => setFaqAnswer(e.target.value)} placeholder="e.g. Delivery takes 3-5 business days nationwide." className="h-9 text-sm" onKeyDown={e => e.key === "Enter" && addFaq()} />
                  <Button size="sm" variant="default" onClick={addFaq} disabled={!faqQuestion.trim() || !faqAnswer.trim()} className="h-8 text-xs gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add FAQ
                  </Button>
                </div>

                {/* AI Suggestions */}
                <div className="space-y-2 pt-1 border-t">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <Wand2 className="h-3.5 w-3.5 text-primary" />
                      AI Suggestions from your chats
                    </p>
                    <Button size="sm" variant="outline" onClick={generateFaqFromChats} disabled={isLoadingFaqSuggestions} className="h-7 text-xs gap-1">
                      {isLoadingFaqSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      {isLoadingFaqSuggestions ? "Analyzing..." : "Generate from chats"}
                    </Button>
                  </div>
                  {aiSuggestedFaqs.length > 0 && (
                    <div className="grid gap-1.5">
                      {aiSuggestedFaqs.map((s, i) => (
                        editingSuggestionIdx === i ? (
                          <div key={`edit-${i}`} className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                            <Input value={editingSuggestion.q} onChange={e => setEditingSuggestion(p => ({...p, q: e.target.value}))} placeholder="Question" className="h-8 text-sm" />
                            <Input value={editingSuggestion.a} onChange={e => setEditingSuggestion(p => ({...p, a: e.target.value}))} placeholder="Answer" className="h-8 text-sm" />
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7 text-xs" onClick={() => { const ex = parseSettingsJson<any[]>(settings.faq_list, []); ex.push(editingSuggestion); update("faq_list", JSON.stringify(ex)); setAiSuggestedFaqs(p => p.filter((_, idx) => idx !== i)); setEditingSuggestionIdx(null); toast.success("Added!"); }} disabled={!editingSuggestion.q.trim()}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingSuggestionIdx(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div key={`sug-${i}`} className="flex items-center gap-2 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-lg p-2.5 transition-all group cursor-pointer" onClick={() => { const ex = parseSettingsJson<any[]>(settings.faq_list, []); ex.push({q: s.q, a: s.a}); update("faq_list", JSON.stringify(ex)); setAiSuggestedFaqs(p => p.filter((_, idx) => idx !== i)); toast.success("Added!"); }}>
                            <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0"><Plus className="h-3 w-3 text-primary" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{s.q}</p>
                              <p className="text-[10px] text-muted-foreground">{s.a}</p>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded-full bg-muted flex items-center justify-center" onClick={e => { e.stopPropagation(); setEditingSuggestionIdx(i); setEditingSuggestion({q: s.q, a: s.a}); }}><Pencil className="h-3 w-3" /></button>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick add */}
                {quickAdd.filter((s: any) => !faqList.some((f: any) => f.q === s.q)).length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t">
                    <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3" /> QUICK ADD</p>
                    <div className="grid gap-1">
                      {quickAdd.filter((s: any) => !faqList.some((f: any) => f.q === s.q)).map((s: any, i: number) => (
                        <button key={i} onClick={() => { const ex = parseSettingsJson<any[]>(settings.faq_list, []); ex.push({q: s.q, a: s.a}); update("faq_list", JSON.stringify(ex)); toast.success("Added!"); }} className="flex items-center gap-2 text-left bg-muted/20 hover:bg-muted/50 rounded-lg p-2 transition-colors group">
                          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20"><Plus className="h-3 w-3 text-primary" /></div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{s.q}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{s.a}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── SECTION 5: Never Say ── */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="h-5 w-5 rounded-full bg-red-500/15 flex items-center justify-center">
                <X className="h-3 w-3 text-red-600" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Never Say</span>
            </div>
            <Card className="overflow-hidden border-red-100 dark:border-red-900/30">
              <div className="h-0.5 bg-red-500/40" />
              <CardContent className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">Phrases the bot should NEVER use. Add specific things that sound wrong for your brand.</p>
                {neverSayList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {neverSayList.map((item: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                        🚫 {item}
                        <button onClick={() => removeNeverSay(i)} className="ml-0.5 hover:text-red-900"><X className="h-2.5 w-2.5" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input value={neverSayItem} onChange={e => setNeverSayItem(e.target.value)} placeholder={`e.g. "I don't know", "I am just an AI", "I cannot help"`} className="h-9 text-sm" onKeyDown={e => e.key === "Enter" && addNeverSay()} />
                  <Button size="sm" onClick={addNeverSay} disabled={!neverSayItem.trim()} className="h-9 px-4 shrink-0">Add</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── SECTION 6: Comment Auto-Reply ── */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <div className="h-5 w-5 rounded-full bg-sky-500/15 flex items-center justify-center">
                <Megaphone className="h-3 w-3 text-sky-600" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comment Auto-Reply</span>
            </div>
            <Card className="overflow-hidden border-sky-100 dark:border-sky-900/30">
              <div className="h-0.5 bg-sky-500/40" />
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto-reply to Facebook comments</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Bot replies publicly to comments on your page posts</p>
                  </div>
                  <Switch checked={settings.comment_auto_reply === "true"} onCheckedChange={v => update("comment_auto_reply", v ? "true" : "false")} />
                </div>
                {settings.comment_auto_reply === "true" && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">English reply</Label>
                      <Input value={settings.comment_reply_text_en || ""} onChange={e => update("comment_reply_text_en", e.target.value)} placeholder="Thanks! Please inbox us for details 📩" className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Bangla reply</Label>
                      <Input value={settings.comment_reply_text || ""} onChange={e => update("comment_reply_text", e.target.value)} placeholder="ধন্যবাদ! বিস্তারিত জানতে ইনবক্স করুন 📩" className="h-9 text-sm" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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

// ===== TEST BOT PANEL (Bug #12 fix) =====
const SUGGESTED_TESTS: Record<string, string[]> = {
  ecommerce: [
    "Hi, what products do you have?",
    "How much is delivery?",
    "Do you have this in blue?",
    "I want to order 2 pieces",
    "What's your return policy?",
  ],
  service: [
    "Hi, I want to book an appointment",
    "How much does a session cost?",
    "What are your working hours?",
    "I have dark circles under my eyes",
    "Can I come tomorrow at 3pm?",
  ],
  content_creator: [
    "What courses do you have?",
    "How much is the beginner course?",
    "How do I enroll?",
    "Is there a refund policy?",
    "When does the next batch start?",
  ],
};

const TestBotPanel = ({ activePage, settings, user, supabase }: any) => {
  const [messages, setMessages] = useState<{role: "user"|"bot", text: string}[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const category = activePage?.page_category || "ecommerce";
  const suggestions = SUGGESTED_TESTS[category] || SUGGESTED_TESTS.ecommerce;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!activePage) {
    return (
      <div className="rounded-xl border-2 border-dashed border-muted p-10 text-center space-y-3">
        <Bot className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <p className="font-medium">Connect a Facebook page first</p>
        <p className="text-sm text-muted-foreground">The bot test uses your page settings. Select or connect a page to begin.</p>
      </div>
    );
  }

  const sendTest = async (messageToSend?: string) => {
    const msg = messageToSend || input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const biz = settings.business_name || "our business";
      const aiPersonality = settings.ai_personality || `You are the AI assistant for "${biz}".`;
      const replyLang = settings.reply_language || "mix";
      const custom = settings.custom_instructions || "";
      const tone = settings.reply_tone || "friendly, helpful, brief";

      let faqs = [];
      let neverSay = [];
      try { faqs = JSON.parse(settings.faq_list || "[]"); } catch {}
      try { neverSay = JSON.parse(settings.never_say_list || "[]"); } catch {}

      const langRule = replyLang === "bn" ? "ALWAYS reply in Bangla (বাংলা). No exceptions."
        : replyLang === "ko" ? "ALWAYS reply in Korean (한국어)."
        : replyLang === "en" ? "ALWAYS reply in English."
        : "Detect customer language and reply in the same language.";

      const systemPrompt = [
        aiPersonality,
        settings.business_description && `About: ${settings.business_description}`,
        settings.business_address && `Address: ${settings.business_address}`,
        settings.operating_hours && `Hours: ${settings.operating_hours}`,
        settings.payment_methods && `Payment: ${settings.payment_methods}`,
        faqs.length > 0 && `FAQ:\n${faqs.map((f: any) => `Q: ${f.q}\nA: ${f.a}`).join("\n")}`,
        neverSay.length > 0 && `NEVER say: ${neverSay.join(", ")}`,
        custom && `SPECIAL INSTRUCTIONS: ${custom}`,
        `TONE: ${tone}. Max 3-4 sentences per reply.`,
        `LANGUAGE: ${langRule}`,
        `[TEST MODE — Reply exactly as you would to a real customer]`,
      ].filter(Boolean).join("\n\n");

      const historyForApi = messages.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

      // Use Supabase function (has API key server-side)
      const { data, error } = await supabase.functions.invoke("ai-training-chat", {
        body: {
          messages: [...historyForApi, { role: "user", content: msg }],
          settings,
          category,
          language: settings.reply_language || "mix",
          action: "test_bot",
        },
      });
      if (error) throw error;
      const reply = data?.reply || "Sorry, couldn't get a reply. Make sure your settings are saved.";
      setMessages(prev => [...prev, { role: "bot", text: reply }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "bot", text: "⚠️ Could not get reply. Make sure you clicked Apply Settings first." }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">Test Your Bot</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Chat with your bot exactly like a customer would. No real Facebook messages sent.
            {settings.reply_language && settings.reply_language !== "mix" && (
              <span className="ml-1 text-primary font-medium">
                Bot will reply in {settings.reply_language === "bn" ? "Bangla 🇧🇩" : settings.reply_language === "ko" ? "Korean 🇰🇷" : settings.reply_language === "en" ? "English 🇺🇸" : "detected language"}.
              </span>
            )}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {/* Chat window */}
      <div className="rounded-xl border bg-muted/20 flex flex-col" style={{ height: "380px" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle className="h-7 w-7 text-primary/60" />
              </div>
              <div>
                <p className="font-medium text-sm">Try a test message</p>
                <p className="text-xs text-muted-foreground mt-1">Click a suggestion below or type your own</p>
              </div>
              {/* Suggested messages */}
              <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendTest(s)}
                    className="text-xs bg-background border rounded-full px-3 py-1.5 hover:bg-primary/5 hover:border-primary/30 transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "bot" && (
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-white dark:bg-muted border rounded-bl-md shadow-sm"
                  }`}>
                    {m.role === "bot" && <span className="text-[10px] text-muted-foreground block mb-1">🤖 Bot reply</span>}
                    {m.text}
                  </div>
                  {m.role === "user" && (
                    <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 ml-2 mt-0.5">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-white dark:bg-muted border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3 bg-background rounded-b-xl">
          {messages.length > 0 && (
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {suggestions.slice(0, 3).map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendTest(s)}
                  className="text-[10px] bg-muted rounded-full px-2.5 py-1 hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border bg-muted/30 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-colors"
              placeholder="Type a customer message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTest(); } }}
              disabled={loading}
            />
            <button
              onClick={() => sendTest()}
              disabled={!input.trim() || loading}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-xl disabled:opacity-40 hover:bg-primary/90 transition-colors flex items-center gap-1.5 text-sm font-medium"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
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
    refetchInterval: 8000,
    queryFn: async () => {
      // Get ALL AI usage for this user
      const { data: allRows } = await supabase
        .from("ai_usage")
        .select("estimated_cost, created_at, model, call_type")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      const rows = allRows || [];
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const monthRows = rows.filter((r: any) => new Date(r.created_at) >= monthStart);
      const total = rows.reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);
      const month = monthRows.reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);
      // Training-specific
      const trainingRows = rows.filter((r: any) => (r.call_type || "").includes("training"));
      const trainingMonth = trainingRows
        .filter((r: any) => new Date(r.created_at) >= monthStart)
        .reduce((s: number, r: any) => s + (Number(r.estimated_cost) || 0), 0);
      const lastCall = rows[0];
      const lastCost = lastCall ? Number(lastCall.estimated_cost) || 0 : 0;
      const lastModel = lastCall?.model?.replace("google/", "").replace("gemini-", "") || "";
      const lastAction = lastCall?.call_type?.replace("training_", "").replace("_", " ") || "";
      return { total, month, count: rows.length, trainingMonth, trainingCount: trainingRows.length, lastCost, lastModel, lastAction };
    },
  });
  const fmt = (n: number) => `$${(n || 0).toFixed(4)}`;
  const fmtWon = (n: number) => `₩${Math.round((n || 0) * 1350)}`;
  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">AI Training spend this month</p>
              <p className="text-xl font-bold">{fmt(data?.trainingMonth || 0)} <span className="text-sm font-normal text-muted-foreground">({fmtWon(data?.trainingMonth || 0)})</span></p>
              <p className="text-[10px] text-muted-foreground">{data?.trainingCount || 0} training calls total</p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            <p className="text-[10px] font-medium text-foreground">All AI (bot + training)</p>
            <p>This month: <span className="font-semibold">{fmtWon(data?.month || 0)}</span></p>
            <p>All time: <span className="font-semibold">{fmtWon(data?.total || 0)}</span></p>
            {data?.lastCost ? (
              <p className="text-[10px] text-emerald-600 mt-1">
                Last: {fmtWon(data.lastCost)} · {data.lastModel} · {data.lastAction}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AiTraining;


