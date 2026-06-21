import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, User, Clock, ArrowLeft, GraduationCap, Send, AlertTriangle, Check, CheckCheck, Image as ImageIcon, Inbox } from "lucide-react";
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

type ImageRow = {
  id: string;
  conversation_id: string;
  created_at: string;
  read_at: string | null;
};

const ConversationsView = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"all" | "images">(() =>
    typeof window !== "undefined" && window.location.hash === "#conversations:images" ? "images" : "all"
  );
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [trainOpen, setTrainOpen] = useState(false);
  const [trainData, setTrainData] = useState<{ customer: string; wrong: string }>({ customer: "", wrong: "" });
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations").select("*")
        .eq("user_id", user!.id)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as Conversation[];
    },
    refetchInterval: 10000,
  });

  // Image messages — used for badge, filtering, and ordering in image view
  const { data: imageRows = [] } = useQuery({
    queryKey: ["conversation-images", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, created_at, read_at")
        .eq("user_id", user!.id)
        .eq("direction", "incoming")
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as ImageRow[];
    },
    refetchInterval: 15000,
  });

  const unreadImageCount = imageRows.filter(r => !r.read_at).length;

  // Latest image per conversation, for image-view sorting
  const latestImageAt = new Map<string, string>();
  for (const r of imageRows) {
    if (!latestImageAt.has(r.conversation_id)) latestImageAt.set(r.conversation_id, r.created_at);
  }

  const displayedConversations = (() => {
    if (!conversations) return [];
    if (view === "all") return conversations;
    return conversations
      .filter(c => latestImageAt.has(c.id))
      .sort((a, b) => (latestImageAt.get(b.id)! > latestImageAt.get(a.id)! ? 1 : -1));
  })();

  // Mark images read when entering image view
  useEffect(() => {
    if (view !== "images" || !user?.id || unreadImageCount === 0) return;
    (async () => {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("direction", "incoming")
        .not("image_url", "is", null)
        .is("read_at", null);
      qc.invalidateQueries({ queryKey: ["conversation-images", user.id] });
    })();
  }, [view, user?.id, unreadImageCount, qc]);

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
          onClick={() => { setView("images"); setSelectedConvo(null); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors relative ${view === "images" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <ImageIcon className="h-4 w-4" /> Image Inbox
          {unreadImageCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold">
              {unreadImageCount}
            </Badge>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        <Card className={`md:col-span-1 overflow-hidden ${selectedConvo ? "hidden md:block" : ""}`}>
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : displayedConversations.length === 0 ? (
              <div className="p-8 text-center">
                {view === "images" ? (
                  <>
                    <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No image messages yet.</p>
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
                {displayedConversations.map(c => {
                  const hasImg = latestImageAt.has(c.id);
                  return (
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
                          {hasImg && view === "images" && <ImageIcon className="h-3 w-3 text-purple-500" />}
                          {(c as any).needs_human && (
                            <span className="text-[10px] font-semibold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded">
                              REPLY ME
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{c.last_message || "No messages"}</p>
                        {(c as any).followup_reason && (
                          <p className="text-xs text-destructive truncate mt-0.5">⚠ {(c as any).followup_reason}</p>
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
                  );
                })}
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
                <span className="font-medium text-sm">
                  {selectedConversation?.sender_name || `${t("analytics.customer")} ${selectedConversation?.fb_sender_id.slice(-6)}`}
                </span>
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
                  setSending(true);
                  try {
                    const { error } = await supabase.functions.invoke("send-fb-message", {
                      body: { conversation_id: selectedConvo, text: replyText.trim() },
                    });
                    if (error) throw error;
                    setReplyText(""); toast.success("Sent via Facebook");
                  } catch (e: any) {
                    toast.error(e.message || "Failed to send");
                  } finally { setSending(false); }
                };
                return (
                  <div className="border-t p-3 space-y-2">
                    {outsideWindow && (
                      <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 rounded-md p-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>Outside Meta's 24-hour messaging window. Facebook will reject this send. Customer must message you first.</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type a reply..." className="min-h-[40px] max-h-32 resize-none text-sm" rows={1}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }} />
                      <Button size="icon" onClick={sendReply} disabled={!replyText.trim() || sending || outsideWindow}>
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
