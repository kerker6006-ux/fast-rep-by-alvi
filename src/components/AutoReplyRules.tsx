import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";

const AutoReplyRules = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ keywords: "", response: "", responseBn: "", priority: 0 });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["auto-reply-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auto_reply_rules")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addRule = useMutation({
    mutationFn: async () => {
      const keywords = form.keywords.split(",").map(k => k.trim()).filter(Boolean);
      if (!keywords.length || !form.response) throw new Error("Keywords and response are required");
      const { error } = await supabase.from("auto_reply_rules").insert({
        trigger_keywords: keywords,
        response_text: form.response,
        response_text_bn: form.responseBn || null,
        priority: form.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-reply-rules"] });
      setOpen(false);
      setForm({ keywords: "", response: "", responseBn: "", priority: 0 });
      toast.success("Rule added!");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("auto_reply_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auto-reply-rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("auto_reply_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-reply-rules"] });
      toast.success("Rule deleted");
    },
  });

  if (isLoading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Auto-Reply Rules</h2>
          <p className="text-muted-foreground">Keyword-based instant replies (bypasses AI).</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Auto-Reply Rule</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Trigger Keywords (comma separated)</Label>
                <Input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="delivery, ডেলিভারি, shipping" />
              </div>
              <div className="space-y-2">
                <Label>Response (English)</Label>
                <Textarea value={form.response} onChange={e => setForm(f => ({ ...f, response: e.target.value }))} placeholder="We deliver within 2-3 business days..." />
              </div>
              <div className="space-y-2">
                <Label>Response (বাংলা) — optional</Label>
                <Textarea value={form.responseBn} onChange={e => setForm(f => ({ ...f, responseBn: e.target.value }))} placeholder="আমরা ২-৩ কার্যদিবসের মধ্যে ডেলিভারি দিই..." />
              </div>
              <div className="space-y-2">
                <Label>Priority (higher = checked first)</Label>
                <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
              </div>
              <Button onClick={() => addRule.mutate()} disabled={addRule.isPending} className="w-full">
                {addRule.isPending ? "Adding..." : "Add Rule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!rules?.length ? (
        <div className="text-center py-16">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No auto-reply rules</h3>
          <p className="text-muted-foreground">Add keyword triggers for instant responses.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rules.map((rule: any) => (
            <Card key={rule.id} className={!rule.is_active ? "opacity-50" : ""}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1 flex-1 mr-4">
                  <div className="flex flex-wrap gap-1.5">
                    {rule.trigger_keywords?.map((kw: string, i: number) => (
                      <span key={i} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">{kw}</span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{rule.response_text}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => deleteRule.mutate(rule.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutoReplyRules;
