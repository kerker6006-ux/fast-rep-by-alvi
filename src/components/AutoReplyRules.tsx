import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2, Zap, Pencil } from "lucide-react";

const AutoReplyRules = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [form, setForm] = useState({ keywords: "", response: "", responseBn: "", priority: 0 });

  const TEMPLATE_RULES = [
    { keywords: "delivery, shipping", response: t("autoReply.deliveryResp"), responseBn: "", label: t("autoReply.deliveryInfo") },
    { keywords: "payment, pay", response: t("autoReply.paymentResp"), responseBn: "", label: t("autoReply.paymentMethods") },
    { keywords: "return, exchange, refund", response: t("autoReply.returnResp"), responseBn: "", label: t("autoReply.returnPolicy") },
    { keywords: "open, close, time, hours", response: t("autoReply.hoursResp"), responseBn: "", label: t("autoReply.businessHours") },
  ];

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
      toast.success(t("autoReply.ruleAdded"));
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
      toast.success(t("autoReply.ruleUpdated"));
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
      toast.success(t("autoReply.ruleDeleted"));
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
          <h2 className="text-2xl font-bold tracking-tight">{t("autoReply.title")}</h2>
          <p className="text-muted-foreground">{t("autoReply.subtitle")}</p>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="h-4 w-4" /> {t("autoReply.addRule")}
        </Button>
      </div>

      {/* Quick Templates */}
      {(!rules || rules.length < 3) && (
        <div>
          <p className="text-sm font-medium mb-2">{t("autoReply.quickTemplates")}</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_RULES.map((tpl, i) => (
              <Button key={i} variant="outline" size="sm" onClick={() => addTemplate(tpl)} className="text-xs">
                {tpl.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={open || !!editingRule} onOpenChange={(v) => { if (!v) { setOpen(false); setEditingRule(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? t("autoReply.editRule") : t("autoReply.newRule")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("autoReply.triggerKeywords")}</Label>
              <Input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder={t("autoReply.keywordsPh")} />
              <p className="text-xs text-muted-foreground">{t("autoReply.keywordsHint")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("autoReply.response")}</Label>
              <Textarea value={form.response} onChange={e => setForm(f => ({ ...f, response: e.target.value }))} placeholder={t("autoReply.responsePh")} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t("autoReply.responseAlt")}</Label>
              <Textarea value={form.responseBn} onChange={e => setForm(f => ({ ...f, responseBn: e.target.value }))} placeholder={t("autoReply.responseAltPh")} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>{t("autoReply.priority")}</Label>
              <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
            </div>
            <Button
              onClick={() => editingRule ? updateRule.mutate() : addRule.mutate()}
              disabled={addRule.isPending || updateRule.isPending}
              className="w-full"
            >
              {(addRule.isPending || updateRule.isPending)
                ? t("common.saving")
                : editingRule ? t("autoReply.updateRule") : t("autoReply.addRule")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!rules?.length ? (
        <div className="text-center py-16">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">{t("autoReply.noRules")}</h3>
          <p className="text-muted-foreground">{t("autoReply.noRulesDesc")}</p>
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
                    <p className="text-xs text-muted-foreground line-clamp-1">{t("autoReply.altLabel")} {rule.response_text_bn}</p>
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
