import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2, Zap, Pencil, X } from "lucide-react";

const TEMPLATE_RULES = [
  { keywords: "delivery, shipping", response: "We deliver within 2-3 business days. Standard delivery rates apply.", responseBn: "", label: "🚚 Delivery Info" },
  { keywords: "payment, pay", response: "We accept Cash on Delivery and other payment methods.", responseBn: "", label: "💳 Payment Methods" },
  { keywords: "return, exchange, refund", response: "If there's any issue with the product, let us know within 3 days for a return or exchange.", responseBn: "", label: "🔄 Return Policy" },
  { keywords: "open, close, time, hours", response: "We're open every day from 10 AM to 10 PM.", responseBn: "", label: "🕐 Business Hours" },
];

const AutoReplyRules = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
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
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-reply-rules"] });
      setOpen(false);
      resetForm();
      toast.success("Rule added!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRule = useMutation({
    mutationFn: async () => {
      if (!editingRule) return;
      const keywords = form.keywords.split(",").map(k => k.trim()).filter(Boolean);
      if (!keywords.length || !form.response) throw new Error("Keywords and response are required");
      const { error } = await supabase.from("auto_reply_rules").update({
        trigger_keywords: keywords,
        response_text: form.response,
        response_text_bn: form.responseBn || null,
        priority: form.priority,
      }).eq("id", editingRule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-reply-rules"] });
      setEditingRule(null);
      resetForm();
      toast.success("Rule updated!");
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

  const resetForm = () => setForm({ keywords: "", response: "", responseBn: "", priority: 0 });

  const addTemplate = (template: typeof TEMPLATE_RULES[0]) => {
    setForm({ keywords: template.keywords, response: template.response, responseBn: template.responseBn, priority: 0 });
    setOpen(true);
  };

  const startEdit = (rule: any) => {
    setForm({
      keywords: rule.trigger_keywords?.join(", ") || "",
      response: rule.response_text || "",
      responseBn: rule.response_text_bn || "",
      priority: rule.priority || 0,
    });
    setEditingRule(rule);
  };

  if (isLoading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Auto-Reply Rules</h2>
          <p className="text-muted-foreground">Keyword-based instant replies (bypasses AI).</p>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Rule
        </Button>
      </div>

      {/* Quick Templates */}
      {(!rules || rules.length < 3) && (
        <div>
          <p className="text-sm font-medium mb-2">Quick Templates — click to add:</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_RULES.map((t, i) => (
              <Button key={i} variant="outline" size="sm" onClick={() => addTemplate(t)} className="text-xs">
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={open || !!editingRule} onOpenChange={(v) => { if (!v) { setOpen(false); setEditingRule(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "New Auto-Reply Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Trigger Keywords (comma separated)</Label>
              <Input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="delivery, shipping, price" />
              <p className="text-xs text-muted-foreground">When a customer message contains any of these words, this reply is sent instantly.</p>
            </div>
            <div className="space-y-2">
              <Label>Response</Label>
              <Textarea value={form.response} onChange={e => setForm(f => ({ ...f, response: e.target.value }))} placeholder="We deliver within 2-3 business days..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Response (alternate language, optional)</Label>
              <Textarea value={form.responseBn} onChange={e => setForm(f => ({ ...f, responseBn: e.target.value }))} placeholder="Optional second-language version of the same reply…" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Priority (higher = checked first)</Label>
              <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
            </div>
            <Button
              onClick={() => editingRule ? updateRule.mutate() : addRule.mutate()}
              disabled={addRule.isPending || updateRule.isPending}
              className="w-full"
            >
              {(addRule.isPending || updateRule.isPending) ? "Saving..." : editingRule ? "Update Rule" : "Add Rule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!rules?.length ? (
        <div className="text-center py-16">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No auto-reply rules</h3>
          <p className="text-muted-foreground">Add keyword triggers for instant responses. Use the templates above to get started!</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rules.map((rule: any) => (
            <Card key={rule.id} className={!rule.is_active ? "opacity-50" : ""}>
              <CardContent className="flex items-start justify-between py-4 gap-3">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    {rule.trigger_keywords?.map((kw: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{rule.response_text}</p>
                  {rule.response_text_bn && (
                    <p className="text-xs text-muted-foreground line-clamp-1">Alt: {rule.response_text_bn}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => startEdit(rule)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
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
