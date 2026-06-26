import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Megaphone, Users, Send, Clock, CheckCircle, XCircle, AlertTriangle, Loader2, Info } from "lucide-react";

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

// Facebook approved Message Tags
const MESSAGE_TAGS = [
  {
    value: "none",
    label: "24h window only (free)",
    description: "Only people who messaged in last 24 hours",
    useCase: "Promotions, new products, sales — must be within 24h",
  },
  {
    value: "CONFIRMED_EVENT_UPDATE",
    label: "Confirmed Event Update",
    description: "Remind about a booked appointment or event",
    useCase: "e.g. 'Your appointment tomorrow at 3pm is confirmed'",
  },
  {
    value: "POST_PURCHASE_UPDATE",
    label: "Post Purchase Update",
    description: "Order or delivery status update",
    useCase: "e.g. 'Your order has been shipped'",
  },
  {
    value: "ACCOUNT_UPDATE",
    label: "Account Update",
    description: "Important account or subscription update",
    useCase: "e.g. 'Your subscription has been renewed'",
  },
];

const Broadcast = () => {
  const { user } = useAuth();
  const { activePage } = useActivePage();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [messageTag, setMessageTag] = useState("none");
  const [sending, setSending] = useState(false);

  const selectedTag = MESSAGE_TAGS.find(t => t.value === messageTag) || MESSAGE_TAGS[0];

  // Count eligible recipients based on tag
  const { data: recipientCount = 0 } = useQuery({
    queryKey: ["broadcast-recipients", activePage?.id, messageTag],
    enabled: !!activePage?.id,
    queryFn: async () => {
      let query = supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("fb_page_id", activePage!.id);

      // 24h window — only recent messagers
      if (messageTag === "none") {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("last_message_at", since24h);
      }
      // With a tag — can reach all subscribers (opted-in only)
      // opted_out filter would go here when column exists

      const { count } = await query;
      return count || 0;
    },
    refetchInterval: 30000,
  });

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
      toast.error("No recipients available.");
      return;
    }

    // Facebook policy: promotional content ONLY allowed in 24h window
    if (messageTag !== "none") {
      const promoWords = /sale|discount|offer|promo|buy now|shop now|limited|deal|off|ছাড়|অফার|বিক্রয়/i;
      if (promoWords.test(message)) {
        toast.error("Promotional content (sales, discounts, offers) is NOT allowed with Message Tags. This violates Facebook policy. Use 24h window only for promotions.");
        return;
      }
    }

    setSending(true);
    try {
      const { data: broadcast, error } = await supabase
        .from("broadcasts")
        .insert({
          user_id: user.id,
          fb_page_id: activePage.id,
          message: message.trim(),
          message_tag: messageTag === "none" ? null : messageTag,
          status: "pending",
          total_recipients: recipientCount,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: fnErr } = await supabase.functions.invoke("send-broadcast", {
        body: { broadcast_id: broadcast.id },
      });

      if (fnErr) throw fnErr;

      toast.success(`Broadcast queued for ${recipientCount} recipients!`);
      setMessage("");
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  if (!activePage) {
    return (
      <div className="rounded-xl border-2 border-dashed border-muted p-10 text-center space-y-3">
        <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <p className="font-medium">Connect a Facebook page first</p>
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
              <p className="text-xs text-muted-foreground">
                {messageTag === "none" ? "Available now (24h window)" : "Available with this tag"}
              </p>
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

      {/* Compose */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compose Broadcast</CardTitle>
          <CardDescription>Choose your audience and write your message.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Message Tag Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Send to</label>
            <Select value={messageTag} onValueChange={setMessageTag}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESSAGE_TAGS.map(tag => (
                  <SelectItem key={tag.value} value={tag.value}>
                    <div>
                      <p className="font-medium text-sm">{tag.label}</p>
                      <p className="text-xs text-muted-foreground">{tag.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tag info */}
            <div className={`rounded-lg border p-3 text-xs flex gap-2 ${messageTag === "none" ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200" : "border-blue-200 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200"}`}>
              {messageTag === "none" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
              <div>
                <p className="font-semibold">{selectedTag.label}</p>
                <p className="mt-0.5">{selectedTag.useCase}</p>
                {messageTag !== "none" && (
                  <p className="mt-1 text-red-600 dark:text-red-400 font-semibold">⚠️ Facebook policy: NO promotional content allowed with this tag. Only send genuine updates.</p>
                )}
              </div>
            </div>
          </div>

          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={messageTag === "none"
              ? "e.g. নতুন কালেকশন এসেছে! আজকেই অর্ডার করুন 🎁"
              : messageTag === "CONFIRMED_EVENT_UPDATE"
              ? "e.g. আপনার কাল ৩টার অ্যাপয়েন্টমেন্ট নিশ্চিত ✅"
              : messageTag === "POST_PURCHASE_UPDATE"
              ? "e.g. আপনার অর্ডার শিপ হয়েছে 🚚"
              : "e.g. আপনার সাবস্ক্রিপশন রিনিউ হয়েছে ✅"
            }
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
          <p className="text-sm">No broadcasts sent yet.</p>
        </div>
      )}
    </div>
  );
};

export default Broadcast;

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
