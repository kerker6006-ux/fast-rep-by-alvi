import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Megaphone, Users, Send, Clock, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";

type BroadcastRecord = {
  id: string;
  message: string;
  status: "pending" | "sending" | "done" | "failed";
  total_recipients: number | null;
  sent_count: number | null;
  failed_count: number | null;
  created_at: string;
  sent_at: string | null;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  sending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const Broadcast = () => {
  const { user } = useAuth();
  const { activePage } = useActivePage();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Count eligible recipients (people who messaged in last 24h — Facebook's free window)
  const { data: recipientCount = 0 } = useQuery({
    queryKey: ["broadcast-recipients", activePage?.id],
    enabled: !!activePage?.id,
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("fb_page_id", activePage!.id)
        .gte("last_message_at", since24h);
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Count all-time subscribers (people who ever messaged)
  const { data: totalSubscribers = 0 } = useQuery({
    queryKey: ["broadcast-total", activePage?.id],
    enabled: !!activePage?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("fb_page_id", activePage!.id);
      return count || 0;
    },
  });

  // Load broadcast history
  const { data: broadcasts = [] } = useQuery({
    queryKey: ["broadcasts", activePage?.id],
    enabled: !!activePage?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("broadcasts")
        .select("*")
        .eq("fb_page_id", activePage!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as BroadcastRecord[];
    },
    refetchInterval: 5000,
  });

  const sendBroadcast = async () => {
    if (!message.trim() || !activePage?.id || !user?.id) return;
    if (recipientCount === 0) {
      toast.error("No recipients available. Customers must have messaged you in the last 24 hours.");
      return;
    }

    setSending(true);
    try {
      // Insert broadcast record
      const { data: broadcast, error } = await supabase
        .from("broadcasts")
        .insert({
          user_id: user.id,
          fb_page_id: activePage.id,
          message: message.trim(),
          status: "pending",
          total_recipients: recipientCount,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger the broadcast edge function
      const { error: fnErr } = await supabase.functions.invoke("send-broadcast", {
        body: { broadcast_id: broadcast.id },
      });

      if (fnErr) throw fnErr;

      toast.success(`Broadcast queued for ${recipientCount} recipients!`);
      setMessage("");
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
    } catch (e: any) {
      // If broadcast table doesn't exist yet, show helpful message
      if (e.message?.includes("relation") || e.message?.includes("does not exist")) {
        toast.error("Broadcast feature needs a quick setup. Please contact support.");
      } else {
        toast.error(e.message || "Failed to send broadcast");
      }
    } finally {
      setSending(false);
    }
  };

  if (!activePage) {
    return (
      <div className="rounded-xl border-2 border-dashed border-muted p-10 text-center space-y-3">
        <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <p className="font-medium">Connect a Facebook page first</p>
        <p className="text-sm text-muted-foreground">Broadcast sends a message to all your subscribers at once.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="h-6 w-6" /> Broadcast
        </h2>
        <p className="text-muted-foreground mt-1">Send a message to all your subscribers at once.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{recipientCount}</p>
              <p className="text-xs text-muted-foreground">Available now (24h window)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalSubscribers}</p>
              <p className="text-xs text-muted-foreground">Total subscribers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Facebook 24h rule notice */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
          <p className="font-semibold">Facebook 24-hour rule</p>
          <p>You can only send free broadcasts to customers who messaged your page in the <strong>last 24 hours</strong>. Currently <strong>{recipientCount} people</strong> qualify. The remaining {totalSubscribers - recipientCount} subscribers require a paid Message Tag.</p>
        </div>
      </div>

      {/* Compose */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compose Broadcast</CardTitle>
          <CardDescription>This message will be sent to {recipientCount} subscribers immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your broadcast message here... e.g. 'নতুন কালেকশন এসেছে! আজকেই অর্ডার করুন 🎁'"
            className="min-h-[120px] resize-none"
            maxLength={1000}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{message.length}/1000 characters</p>
            <Button
              onClick={sendBroadcast}
              disabled={!message.trim() || sending || recipientCount === 0}
              className="gap-2"
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4" /> Send to {recipientCount} subscribers</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Broadcast history */}
      {broadcasts.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Broadcast History</h3>
          {broadcasts.map(b => (
            <Card key={b.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">{b.message}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(b.created_at).toLocaleString()}
                      </span>
                      {b.sent_count !== null && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" /> {b.sent_count} sent
                        </span>
                      )}
                      {b.failed_count !== null && b.failed_count > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                          <XCircle className="h-3 w-3" /> {b.failed_count} failed
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className={statusColors[b.status] || ""} variant="outline">
                    {b.status === "sending" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    {b.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {broadcasts.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No broadcasts sent yet. Send your first one above!</p>
        </div>
      )}
    </div>
  );
};

export default Broadcast;
