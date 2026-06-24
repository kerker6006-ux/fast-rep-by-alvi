import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Zap, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Trigger = {
  id: string;
  name: string;
  keywords: string[];
  match_type: string;
  dm_message: string;
  dm_image_url: string | null;
  public_reply: string | null;
  is_enabled: boolean;
  daily_limit: number;
  sent_count: number;
  last_sent_at: string | null;
};

const empty = { name: "", keywords: "", match_type: "contains", dm_message: "", dm_image_url: "", public_reply: "", is_enabled: true, daily_limit: 1000 };

const CommentTriggers = () => {
  const { user } = useAuth();
  const { activePage } = useActivePage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trigger | null>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: triggers = [] } = useQuery({
    queryKey: ["comment-triggers", activePage?.fb_page_id],
    enabled: !!user && !!activePage?.fb_page_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("comment_triggers").select("*").eq("fb_page_id", activePage!.fb_page_id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Trigger[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["comment-trigger-logs", activePage?.fb_page_id],
    enabled: !!user && !!activePage?.fb_page_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("comment_trigger_logs").select("*").eq("fb_page_id", activePage!.fb_page_id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user!.id,
        fb_page_id: activePage?.fb_page_id,
        name: form.name,
        keywords: form.keywords.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean),
        match_type: form.match_type,
        dm_message: form.dm_message,
        dm_image_url: form.dm_image_url || null,
        public_reply: form.public_reply || null,
        is_enabled: form.is_enabled,
        daily_limit: Number(form.daily_limit) || 1000,
      };
      if (editing) {
        const { error } = await supabase.from("comment_triggers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comment_triggers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comment-triggers"] });
      toast.success(editing ? "Trigger updated" : "Trigger created");
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const { error } = await supabase.from("comment_triggers").update({ is_enabled: on }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comment-triggers"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comment_triggers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comment-triggers"] }); toast.success("Deleted"); },
  });

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (t: Trigger) => {
    setEditing(t);
    setForm({
      name: t.name, keywords: t.keywords.join(", "), match_type: t.match_type,
      dm_message: t.dm_message, dm_image_url: t.dm_image_url ?? "", public_reply: t.public_reply ?? "",
      is_enabled: t.is_enabled, daily_limit: t.daily_limit,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Zap className="h-6 w-6 text-primary" /> Comment Triggers</h2>
          <p className="text-muted-foreground">When someone comments a keyword on your FB post, auto-send them a Messenger DM.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> New Trigger</Button>
      </div>

      <Tabs defaultValue="triggers">
        <TabsList>
          <TabsTrigger value="triggers">Triggers ({triggers.length})</TabsTrigger>
          <TabsTrigger value="logs">Activity Log ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="triggers" className="space-y-3">
          {triggers.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No triggers yet. Create one to auto-DM commenters.</p>
            </CardContent></Card>
          ) : triggers.map(t => (
            <Card key={t.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <Switch checked={t.is_enabled} onCheckedChange={(v) => toggle.mutate({ id: t.id, on: v })} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{t.name}</h3>
                    <Badge variant="secondary">{t.match_type}</Badge>
                    {t.sent_count > 0 && <Badge variant="outline">{t.sent_count} sent</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {t.keywords.map(k => <Badge key={k} variant="outline" className="text-xs">{k}</Badge>)}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">→ {t.dm_message}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => confirm("Delete this trigger?") && del.mutate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="logs" className="space-y-2">
          {logs.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No activity yet.</CardContent></Card>
          ) : logs.map((l: any) => (
            <Card key={l.id}>
              <CardContent className="p-3 flex items-center gap-3 text-sm">
                {l.dm_status === "sent" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> :
                 l.dm_status === "failed" ? <XCircle className="h-4 w-4 text-destructive shrink-0" /> :
                 <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="truncate"><span className="font-medium">{l.commenter_name || "Anonymous"}</span> · "{l.comment_text}"</p>
                  <p className="text-xs text-muted-foreground">
                    matched <code className="bg-muted px-1 rounded">{l.matched_keyword}</code>
                    {l.error && <span className="text-destructive ml-2">{l.error}</span>}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Trigger" : "New Comment Trigger"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Trigger Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Price inquiry" />
            </div>
            <div className="space-y-2">
              <Label>Keywords (comma separated)</Label>
              <Input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} placeholder="price, work, info, dam, koto" />
              <p className="text-xs text-muted-foreground">Case-insensitive. Bangla supported.</p>
            </div>
            <div className="space-y-2">
              <Label>Match Type</Label>
              <Select value={form.match_type} onValueChange={v => setForm({ ...form, match_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains keyword</SelectItem>
                  <SelectItem value="exact">Exact match (whole comment)</SelectItem>
                  <SelectItem value="starts_with">Starts with</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>DM Message *</Label>
              <Textarea value={form.dm_message} onChange={e => setForm({ ...form, dm_message: e.target.value })} placeholder="Thanks for your interest! Our price is $19. To order, please share your name, phone & address." className="min-h-[100px]" />
            </div>
            <div className="space-y-2">
              <Label>DM Image URL (optional)</Label>
              <Input value={form.dm_image_url} onChange={e => setForm({ ...form, dm_image_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Public Reply (optional)</Label>
              <Input value={form.public_reply} onChange={e => setForm({ ...form, public_reply: e.target.value })} placeholder="Check your inbox 📩" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Daily limit</Label>
                <Input type="number" value={form.daily_limit} onChange={e => setForm({ ...form, daily_limit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Enabled</Label>
                <div className="h-10 flex items-center"><Switch checked={form.is_enabled} onCheckedChange={v => setForm({ ...form, is_enabled: v })} /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name || !form.dm_message || save.isPending}>
              {save.isPending ? "Saving..." : "Save Trigger"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommentTriggers;
