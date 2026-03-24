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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Clock, X, CalendarDays } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const QUICK_DAYS = [
  { label: "After 1 day", days: 1 },
  { label: "After 2 days", days: 2 },
  { label: "After 3 days", days: 3 },
  { label: "After 5 days", days: 5 },
  { label: "After 7 days", days: 7 },
];

const ScheduledMessages = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number | null>(1);
  const [customDays, setCustomDays] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [form, setForm] = useState({ content: "", messageType: "follow_up" });

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

  const addMessages = useMutation({
    mutationFn: async () => {
      if (!selectedConversations.length) throw new Error("Select at least one customer");
      if (!form.content) throw new Error("Message content is required");
      const days = useCustom ? parseInt(customDays) : selectedDays;
      if (!days || days < 1) throw new Error("Select when to send");

      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + days);

      const inserts = selectedConversations.map(cid => ({
        conversation_id: cid,
        content: form.content,
        scheduled_at: scheduledAt.toISOString(),
        message_type: form.messageType,
        user_id: user?.id,
      }));

      const { error } = await supabase.from("scheduled_messages").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
      setOpen(false);
      setForm({ content: "", messageType: "follow_up" });
      setSelectedConversations([]);
      setSelectedDays(1);
      setUseCustom(false);
      setCustomDays("");
      toast.success(`Messages scheduled for ${selectedConversations.length} customer(s)!`);
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

  const toggleConvo = (id: string) => {
    setSelectedConversations(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (!conversations) return;
    if (selectedConversations.length === conversations.length) {
      setSelectedConversations([]);
    } else {
      setSelectedConversations(conversations.map((c: any) => c.id));
    }
  };

  if (isLoading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scheduled Messages</h2>
          <p className="text-muted-foreground">Auto-send follow-ups after X days to selected customers.</p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Schedule Message
        </Button>
      </div>

      {/* Schedule Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Schedule a Message</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* When to send */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Send After</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_DAYS.map(d => (
                  <Button
                    key={d.days}
                    variant={!useCustom && selectedDays === d.days ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSelectedDays(d.days); setUseCustom(false); }}
                  >
                    {d.label}
                  </Button>
                ))}
                <Button
                  variant={useCustom ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseCustom(true)}
                >
                  Custom
                </Button>
              </div>
              {useCustom && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Days"
                    value={customDays}
                    onChange={e => setCustomDays(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">days from now</span>
                </div>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Message</Label>
              <Textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="আপু/ভাই, কেমন আছেন? নতুন কালেকশন এসেছে, দেখবেন? 😊"
                rows={3}
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Type</Label>
              <Select value={form.messageType} onValueChange={v => setForm(f => ({ ...f, messageType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="promotion">Promotion</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Select Customers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Select Customers ({selectedConversations.length})</Label>
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                  {selectedConversations.length === conversations?.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                {conversations?.map((c: any) => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-accent transition-colors ${selectedConversations.includes(c.id) ? "bg-accent" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedConversations.includes(c.id)}
                      onChange={() => toggleConvo(c.id)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium truncate">
                      {c.sender_name || c.fb_sender_id}
                    </span>
                  </label>
                ))}
                {!conversations?.length && (
                  <p className="text-sm text-muted-foreground p-3 text-center">No conversations yet</p>
                )}
              </div>
            </div>

            <Button onClick={() => addMessages.mutate()} disabled={addMessages.isPending} className="w-full">
              {addMessages.isPending ? "Scheduling..." : `Schedule for ${selectedConversations.length} customer(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!scheduled?.length ? (
        <div className="text-center py-16">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No scheduled messages</h3>
          <p className="text-muted-foreground">Schedule follow-ups to send after specific days.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {scheduled.map((msg: any) => (
            <Card key={msg.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1 flex-1 mr-4 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{msg.conversations?.sender_name || "Unknown"}</span>
                    <Badge className={statusColors[msg.status] || ""}>{msg.status}</Badge>
                    <Badge variant="outline" className="text-xs">{msg.message_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{msg.content}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
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
