import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageSquare, User, Clock, ArrowLeft, GraduationCap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
  created_at: string;
};

const ConversationsView = () => {
  const { t } = useTranslation();
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [trainOpen, setTrainOpen] = useState(false);
  const [trainData, setTrainData] = useState<{ customer: string; wrong: string }>({ customer: "", wrong: "" });

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("conversations").select("*").order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as Conversation[];
    },
    refetchInterval: 10000,
  });

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        {/* Conversation list - hide on mobile when a convo is selected */}
        <Card className={`md:col-span-1 overflow-hidden ${selectedConvo ? "hidden md:block" : ""}`}>
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : conversations?.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">{t("chats.empty")}</p>
              </div>
            ) : (
              <div className="divide-y">
                {conversations?.map(c => (
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
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Message thread - show on mobile when a convo is selected */}
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
              {/* Header with back button */}
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
            </>
          )}
        </Card>
      </div>
      <TrainBotDialog open={trainOpen} onOpenChange={setTrainOpen} customerMessage={trainData.customer} wrongReply={trainData.wrong} />
    </div>
  );
};

export default ConversationsView;
