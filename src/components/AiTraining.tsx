import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
import { toast } from "sonner";
import {
  Brain, Save, Plus, X, MessageCircle, Send, Bot, User,
  Sparkles, Settings2, Loader2, CheckCircle, RotateCcw, Wand2, Pencil,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  buildSettingsMap,
  mergeGeneratedSettings,
  parseSettingsJson,
  type SettingsMap,
} from "@/lib/ai-training-settings";

type ChatMessage = { role: "user" | "assistant"; content: string };

const AiTraining = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
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
    setSettings(buildSettingsMap(dbSettings));
  }, [dbSettings, hasChanges]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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

  const faqList = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
  const neverSayList = parseSettingsJson<string[]>(settings.never_say_list, []);

  // ---- Chat Functions ----

  const startChat = async () => {
    setChatStarted(true);
    setIsChatLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-training-chat", {
        body: {
          messages: [{ role: "user", content: "Hi, I want to set up my bot. Help me." }],
          settings,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setChatMessages([
        { role: "user", content: "Hi, I want to set up my bot." },
        { role: "assistant", content: data.reply },
      ]);
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
        body: { messages: newMessages, settings },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setChatMessages([...newMessages, { role: "assistant", content: data.reply }]);
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
        body: { messages: chatMessages, action: "generate_settings", settings },
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

  const resetChat = () => {
    setChatMessages([]);
    setChatStarted(false);
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
            {t("aiTraining.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("aiTraining.subtitle")}</p>
        </div>
        {hasChanges && (
          <Button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending} size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? t("aiTraining.saving") : t("aiTraining.save")}
          </Button>
        )}
      </div>

      <Tabs defaultValue="wizard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-10">
          <TabsTrigger value="wizard" className="gap-1.5 text-sm">
            <Sparkles className="h-3.5 w-3.5" /> {t("aiTraining.wizardTab")}
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5 text-sm">
            <Settings2 className="h-3.5 w-3.5" /> {t("aiTraining.manualTab")}
          </TabsTrigger>
        </TabsList>

        {/* ===== AI WIZARD TAB ===== */}
        <TabsContent value="wizard" className="space-y-4">
          {!chatStarted ? (
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
                </div>
                <Button onClick={startChat} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  {t("aiTraining.startTraining")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col" style={{ height: "calc(100vh - 260px)", minHeight: "400px" }}>
              {/* Chat Header */}
              <CardHeader className="pb-2 pt-3 px-4 flex-row items-center justify-between space-y-0 border-b">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">{t("aiTraining.assistant")}</CardTitle>
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
                  <Button variant="ghost" size="sm" onClick={resetChat} className="h-7 text-xs gap-1">
                    <RotateCcw className="h-3 w-3" /> {t("aiTraining.reset")}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t("aiTraining.replyTone")}</Label>
                  <Input value={settings.reply_tone || ""} onChange={(e) => update("reply_tone", e.target.value)} placeholder={t("aiTraining.replyTonePh")} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("aiTraining.deliveryInfo")}</Label>
                  <Input value={settings.delivery_info || ""} onChange={(e) => update("delivery_info", e.target.value)} placeholder={t("aiTraining.deliveryInfoPh")} className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("aiTraining.paymentMethods")}</Label>
                <Input value={settings.payment_methods || ""} onChange={(e) => update("payment_methods", e.target.value)} placeholder={t("aiTraining.paymentMethodsPh")} className="h-8 text-sm" />
              </div>
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
              <CardTitle className="text-sm">FAQ</CardTitle>
              <CardDescription className="text-xs">Add common questions customers ask. Use suggestions below to get started quickly.</CardDescription>
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
                <Input value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)} placeholder="Customer question..." className="h-8 text-sm" />
                <Input value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)} placeholder="Your answer..." className="h-8 text-sm" />
                <Button size="sm" variant="outline" onClick={addFaq} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>

              {/* AI-Generated Suggestions from Real Chats */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Wand2 className="h-3 w-3" /> AI Suggestions from Real Chats
                  </p>
                  <Button size="sm" variant="outline" onClick={generateFaqFromChats} disabled={isLoadingFaqSuggestions} className="h-7 text-xs gap-1">
                    {isLoadingFaqSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {isLoadingFaqSuggestions ? "Analyzing..." : "Suggest from Chats"}
                  </Button>
                </div>
              {aiSuggestedFaqs.length > 0 && (
                  <div className="grid gap-1.5">
                    {aiSuggestedFaqs.map((s, i) => (
                      editingSuggestionIdx === i ? (
                        <div key={`ai-edit-${i}`} className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                          <Input value={editingSuggestion.q} onChange={e => setEditingSuggestion(p => ({...p, q: e.target.value}))} placeholder="Question..." className="h-8 text-sm" />
                          <Input value={editingSuggestion.a} onChange={e => setEditingSuggestion(p => ({...p, a: e.target.value}))} placeholder="Answer..." className="h-8 text-sm" />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => {
                              const existing = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
                              existing.push({ q: editingSuggestion.q, a: editingSuggestion.a });
                              update("faq_list", JSON.stringify(existing));
                              setAiSuggestedFaqs(prev => prev.filter((_, idx) => idx !== i));
                              setEditingSuggestionIdx(null);
                              toast.success("Added!");
                            }} disabled={!editingSuggestion.q.trim() || !editingSuggestion.a.trim()}>
                              <Plus className="h-3 w-3" /> Add
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingSuggestionIdx(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div key={`ai-${i}`} className="flex items-center gap-2 text-left bg-primary/5 hover:bg-primary/10 border border-primary/10 hover:border-primary/20 rounded-lg p-2 transition-all group">
                          <button onClick={() => {
                            const existing = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
                            existing.push({ q: s.q, a: s.a });
                            update("faq_list", JSON.stringify(existing));
                            setAiSuggestedFaqs(prev => prev.filter((_, idx) => idx !== i));
                            toast.success("Added!");
                          }} className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                            <Plus className="h-3 w-3 text-primary" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">{s.q}</p>
                            <p className="text-[10px] text-muted-foreground">{s.a}</p>
                          </div>
                          <button onClick={() => { setEditingSuggestionIdx(i); setEditingSuggestion({q: s.q, a: s.a}); }} className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" title="Edit before adding">
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
                  <Sparkles className="h-3 w-3" /> Quick Add — Common Questions
                </p>
                <div className="grid gap-1.5">
                  {[
                    { q: "How much is delivery?", a: settings.delivery_info || "Standard delivery rates apply." },
                    { q: "How can I pay?", a: settings.payment_methods || "Cash on Delivery and other methods accepted." },
                    { q: "How long is delivery?", a: "Usually 1-3 business days." },
                    { q: "Do you have a return policy?", a: "Yes, return/exchange within 3 days of receiving the product." },
                    { q: "How do I order?", a: "Send your name, phone and address. We'll confirm your order." },
                    { q: "Is COD available?", a: "Yes, Cash on Delivery is available." },
                  ]
                    .filter((s) => !faqList.some((f: any) => f.q === s.q))
                    .map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const existing = parseSettingsJson<{ q: string; a: string }[]>(settings.faq_list, []);
                          existing.push({ q: s.q, a: s.a });
                          update("faq_list", JSON.stringify(existing));
                          toast.success("Added!");
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
              <CardTitle className="text-sm">Never Say</CardTitle>
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
                    <Label className="text-xs">Reply (primary)</Label>
                    <Input value={settings.comment_reply_text_en || ""} onChange={(e) => update("comment_reply_text_en", e.target.value)} placeholder="Please inbox us 📩" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Reply (alternate language, optional)</Label>
                    <Input value={settings.comment_reply_text || ""} onChange={(e) => update("comment_reply_text", e.target.value)} placeholder="Alternate language reply…" className="h-8 text-sm" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save */}
          {hasChanges && (
            <Button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending} className="w-full gap-2">
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Saving..." : "Save All Changes"}
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AiTraining;
