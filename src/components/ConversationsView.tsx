import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, User, Clock, ArrowLeft, GraduationCap, Send, AlertTriangle, Check, CheckCheck, Inbox, Bell, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import TrainBotDialog from "@/components/TrainBotDialog";

type Conversation = {
  id: string;
  fb_sender_id: string;
  sender_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  needs_human?: boolean;
  followup_reason?: string | null;
  alert_seen_at?: string | null;
};

type Message = {
  id: string;
  direction: string;
  content: string | null;
  image_url: string | null;
  read_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

const FB_24H_MSG = "Facebook 24-hour rule: you can only reply within 24 hours of the customer's last message. They must message you again to reopen the chat.";

const ConversationsView = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activePage } = useActivePage();
  const qc = useQueryClient();
  const [view, setView] = useState<"all" | "alerts">(() =>
    typeof window !== "undefined" && (window.location.hash === "#conversations:alerts" || window.location.hash === "#conversations:images") ? "alerts" : "all"
  );
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [trainOpen, setTrainOpen] = useState(false);
  const [trainData, setTrainData] = useState<{ customer: string; wrong: string }>({ customer: "", wrong: "" });
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  // Bug #10 & #15 fix: clear needs_human at component level so both header button and sendReply can use it
  const clearNeedsHuman = async (convoId: string) => {
    await supabase.from("conversations")
      .update({ needs_human: false, followup_reason: null, alert_seen_at: new Date().toISOString() })
      .eq("id", convoId);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  // Load profile dismiss flags
  const { data: profile } = useQuery({
    queryKey: ["profile-dismiss", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("alert_box_intro_dismissed, fb_24h_notice_dismissed")
        .eq("id", user!.id)
        .maybeSingle();
      return data as { alert_box_intro_dismissed: boolean; fb_24h_notice_dismissed: boolean } | null;
    },
  });

  const dismissFlag = async (col: "alert_box_intro_dismissed" | "fb_24h_notice_dismissed") => {
    if (!user?.id) return;
    await supabase.from("profiles").update({ [col]: true } as any).eq("id", user.id);
    qc.invalidateQueries({ queryKey: ["profile-dismiss", user.id] });
  };

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", activePage?.id],
    enabled: !!user?.id && !!activePage?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations").select("*")
        .eq("fb_page_id", activePage!.id)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as Conversation[];
    },
    refetchInterval: 10000,
  });

  const isUnreadAlert = (c: Conversation) =>
    !!c.needs_human && (!c.alert_seen_at || (c.last_message_at && c.alert_seen_at < c.last_message_at));

  const alertConvos = (conversations || []).filter(c => c.needs_human);
  const unreadAlertCount = (conversations || []).filter(isUnreadAlert).length;

  const displayedConversations = view === "all" ? (conversations || []) : alertConvos;

  // Mark an alert seen when opened
  useEffect(() => {
    if (!selectedConvo || !user?.id) return;
    const c = conversations?.find(x => x.id === selectedConvo);
    if (c && isUnreadAlert(c)) {
      supabase.from("conversations")
        .update({ alert_seen_at: new Date().toISOString() })
        .eq("id", selectedConvo)
        .then(() => qc.invalidateQueries({ queryKey: ["conversations", user.id] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConvo]);

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedConvo],
    queryFn: async () => {
      if (!selectedConvo) return [];
      const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", selectedConvo).order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedConvo,
    refetchInterval: 5000,
  });

  const selectedConversation = conversations?.find(c => c.id === selectedConvo);
  const showAlertIntro = view === "alerts" && profile && !profile.alert_box_intro_dismissed;
  const show24hBanner = profile && !profile.fb_24h_notice_dismissed;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("chats.title")}</h2>
        <p className="text-muted-foreground">{t("chats.subtitle")}</p>
      </div>

      {/* View tabs */}
      <div className="inline-flex rounded-lg border bg-muted/40 p-1 gap-1">
        <button
          onClick={() => { setView("all"); setSelectedConvo(null); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "all" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Inbox className="h-4 w-4" /> All
          <span className="text-xs text-muted-foreground">({conversations?.length || 0})</span>
        </button>
        <button
          onClick={() => { setView("alerts"); setSelectedConvo(null); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors relative ${view === "alerts" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Bell className="h-4 w-4" /> Alert Box
          {unreadAlertCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold">
              {unreadAlertCount}
            </Badge>
          )}
        </button>
      </div>

      {/* Alert Box first-time explainer */}
      {showAlertIntro && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Bell className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">What is the Alert Box?</p>
            <p className="text-muted-foreground mt-0.5">
              When the bot isn't sure how to reply, or a customer sends something it can't handle (like an image on the free plan), the conversation lands here so you can reply yourself.
            </p>
          </div>
          <button onClick={() => dismissFlag("alert_box_intro_dismissed")} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        <Card className={`md:col-span-1 overflow-hidden ${selectedConvo ? "hidden md:block" : ""}`}>
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : displayedConversations.length === 0 ? (
              <div className="p-8 text-center">
                {view === "alerts" ? (
                  <>
                    <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No alerts. The bot is handling everything.</p>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">{t("chats.empty")}</p>
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {displayedConversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConvo(c.id)}
                    className={`w-full text-left p-4 hover:bg-accent transition-colors ${selectedConvo === c.id ? "bg-accent" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate flex items-center gap-2">
                          {c.sender_name || `${t("analytics.customer")} ${c.fb_sender_id.slice(-6)}`}
                          {c.needs_human && (
                            <span className="text-[10px] font-semibold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded">
                              REPLY ME
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{c.last_message || "No messages"}</p>
                        {c.followup_reason && (
                          <p className="text-xs text-destructive truncate mt-0.5">⚠ {c.followup_reason}</p>
                        )}
                        {c.last_message_at && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        <Card className={`md:col-span-2 overflow-hidden flex flex-col ${selectedConvo ? "" : "hidden md:flex"}`}>
          {!selectedConvo ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>{t("chats.empty")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setSelectedConvo(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-sm flex-1">
                  {selectedConversation?.sender_name || `${t("analytics.customer")} ${selectedConversation?.fb_sender_id.slice(-6)}`}
                </span>
                {/* Bug #15 fix: Mark as Resolved button clears needs_human alert */}
                {selectedConversation?.needs_human && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 border-green-500 text-green-600 hover:bg-green-50"
                    onClick={() => selectedConvo && clearNeedsHuman(selectedConvo)}
                  >
                    ✓ Mark Resolved
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages?.map((m, idx) => {
                    const prevIncoming = [...(messages ?? [])].slice(0, idx).reverse().find(x => x.direction === "incoming");
                    return (
                    <div key={m.id} className={`flex ${m.direction === "outgoing" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        m.direction === "outgoing"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}>
                        {m.image_url && (
                          <img src={m.image_url} alt="" className="rounded-lg max-w-[200px] mb-2" />
                        )}
                        {m.content && <p className="text-sm whitespace-pre-wrap">{m.content}</p>}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className={`text-xs ${m.direction === "outgoing" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {m.direction === "outgoing" ? "🤖 Bot" : "👤 Customer"} · {new Date(m.created_at).toLocaleTimeString()}
                            {m.direction === "outgoing" && (
                              m.read_at ? <CheckCheck className="inline h-3 w-3 ml-1 text-blue-300" />
                              : m.delivered_at ? <CheckCheck className="inline h-3 w-3 ml-1 opacity-70" />
                              : <Check className="inline h-3 w-3 ml-1 opacity-50" />
                            )}
                          </p>
                          {m.direction === "outgoing" && (
                            <button
                              onClick={() => { setTrainData({ customer: prevIncoming?.content ?? "", wrong: m.content ?? "" }); setTrainOpen(true); }}
                              className="text-[10px] underline opacity-80 hover:opacity-100 flex items-center gap-0.5"
                              title={t("trainBot.title")}
                            >
                              <GraduationCap className="h-3 w-3" /> {t("trainBot.button")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {(() => {
                const lastIncoming = [...(messages ?? [])].reverse().find(m => m.direction === "incoming");
                const hoursSince = lastIncoming ? (Date.now() - new Date(lastIncoming.created_at).getTime()) / 36e5 : Infinity;
                const outsideWindow = hoursSince > 24;
                const sendReply = async () => {
                  if (!selectedConvo || !replyText.trim()) return;
                  if (outsideWindow) {
                    toast.error(FB_24H_MSG);
                    return;
                  }
                  setSending(true);
                  try {
                    const { error } = await supabase.functions.invoke("send-fb-message", {
                      body: { conversation_id: selectedConvo, text: replyText.trim() },
                    });
                    if (error) throw error;
                    setReplyText("");
                    toast.success("Sent via Facebook");
                    // Bug #10 fix: clear needs_human flag after manual reply so alert badge disappears
                    await clearNeedsHuman(selectedConvo);
                  } catch (e: any) {
                    toast.error(e.message || "Failed to send");
                  } finally { setSending(false); }
                };
                return (
                  <div className="border-t p-3 space-y-2">
                    {show24hBanner && (
                      <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 rounded-md p-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="flex-1">{FB_24H_MSG}</span>
                        <button onClick={() => dismissFlag("fb_24h_notice_dismissed")} className="opacity-70 hover:opacity-100" aria-label="Dismiss">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type a reply..." className="min-h-[40px] max-h-32 resize-none text-sm" rows={1}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }} />
                      <Button size="icon" onClick={sendReply} disabled={!replyText.trim() || sending}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </Card>
      </div>
      <TrainBotDialog open={trainOpen} onOpenChange={setTrainOpen} customerMessage={trainData.customer} wrongReply={trainData.wrong} />
    </div>
  );
};

export default ConversationsView;
