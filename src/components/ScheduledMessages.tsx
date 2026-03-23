import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Clock, Send, X } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const ScheduledMessages = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ conversationId: "", content: "", scheduledAt: "", messageType: "follow_up" });

  const { data: conversations } = useQuery({
    queryKey: ["conversations-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations").select("id, sender_name, fb_sender_id")
        .order("last_message_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: scheduled, isLoading } = useQuery({
    queryKey: ["scheduled-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("*, conversations(sender_name)")
        .order("scheduled_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const addMessage = useMutation({
    mutationFn: async () => {
      if (!form.conversationId || !form.content || !form.scheduledAt) throw new Error("All fields required");
      const { error } = await supabase.from("scheduled_messages").insert({
        conversation_id: form.conversationId,
        content: form.content,
        scheduled_at: new Date(form.scheduledAt).toISOString(),
        message_type: form.messageType,
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
      setOpen(false);
      setForm({ conversationId: "", content: "", scheduledAt: "", messageType: "follow_up" });
      toast.success("Message scheduled!");
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scheduled_messages").update({ status: "cancelled" as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
      toast.success("Message cancelled");
    },
  });

  if (isLoading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scheduled Messages</h2>
          <p className="text-muted-foreground">Schedule follow-ups, promotions, and reminders.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Schedule Message</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule a Message</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={form.conversationId} onValueChange={v => setForm(f => ({ ...f, conversationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {conversations?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.sender_name || c.fb_sender_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Hi! Just checking in..." />
              </div>
              <div className="space-y-2">
                <Label>Send At</Label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.messageType} onValueChange={v => setForm(f => ({ ...f, messageType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => addMessage.mutate()} disabled={addMessage.isPending} className="w-full">
                {addMessage.isPending ? "Scheduling..." : "Schedule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!scheduled?.length ? (
        <div className="text-center py-16">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No scheduled messages</h3>
          <p className="text-muted-foreground">Schedule messages to send at a specific time.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {scheduled.map((msg: any) => (
            <Card key={msg.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1 flex-1 mr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{msg.conversations?.sender_name || "Unknown"}</span>
                    <Badge className={statusColors[msg.status] || ""}>{msg.status}</Badge>
                    <Badge variant="outline" className="text-xs">{msg.message_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{msg.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {msg.status === "sent" ? `Sent: ${new Date(msg.sent_at).toLocaleString()}` : `Scheduled: ${new Date(msg.scheduled_at).toLocaleString()}`}
                  </p>
                </div>
                {msg.status === "pending" && (
                  <Button variant="ghost" size="icon" onClick={() => cancelMessage.mutate(msg.id)}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScheduledMessages;
