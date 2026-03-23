import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, User, Bot, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Conversations</h2>
        <p className="text-muted-foreground">View all customer conversations with your AI bot.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        {/* Conversation list */}
        <Card className="md:col-span-1 overflow-hidden">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : conversations?.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No conversations yet. Messages will appear here when customers message your page.</p>
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
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.sender_name || c.fb_sender_id}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.last_message || "No messages"}</p>
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

        {/* Message thread */}
        <Card className="md:col-span-2 overflow-hidden flex flex-col">
          {!selectedConvo ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages?.map(m => (
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
                      <p className={`text-xs mt-1 ${m.direction === "outgoing" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {m.direction === "outgoing" ? "🤖 Bot" : "👤 Customer"} · {new Date(m.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ConversationsView;
