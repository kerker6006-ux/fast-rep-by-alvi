import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Check, X, Loader2, Brain, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { buildSettingsMap, mergeGeneratedSettings } from "@/lib/ai-training-settings";

type Suggestion = {
  id: string;
  kind: "faq" | "rule" | "personality" | "example" | "never_say";
  payload: any;
  reason: string | null;
  status: string;
  source: string;
  created_at: string;
};

const kindLabel = (t: any, k: string) => t(`autoLearn.kind.${k}`, k);

const AutoLearnPanel = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["training_suggestions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_suggestions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Suggestion[];
    },
    enabled: !!user,
  });

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-auto-learn", {
        body: { limit: 100, language: i18n.language },
      });
      if (error) throw error;
      toast.success(t("autoLearn.analyzedOk", { n: data?.suggestions?.length ?? 0 }));
      qc.invalidateQueries({ queryKey: ["training_suggestions"] });
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const applyMutation = useMutation({
    mutationFn: async (s: Suggestion) => {
      // Load current settings
      const { data: rows } = await supabase
        .from("bot_settings").select("setting_key, setting_value").eq("user_id", user!.id);
      const current = buildSettingsMap(rows ?? []);
      const patch: Record<string, unknown> = {};

      if (s.kind === "faq") {
        patch.faq_list = JSON.stringify([{ q: s.payload.q, a: s.payload.a }]);
      } else if (s.kind === "never_say") {
        patch.never_say_list = JSON.stringify([s.payload.phrase]);
      } else if (s.kind === "example") {
        patch.reply_examples = JSON.stringify([{
          customer: s.payload.customer,
          reply: s.payload.correct_reply,
          category: "training",
        }]);
      } else if (s.kind === "personality") {
        patch.ai_personality = s.payload.addition;
      } else if (s.kind === "rule") {
        const { error } = await supabase.from("auto_reply_rules").insert({
          user_id: user!.id,
          trigger_keywords: [s.payload.keyword],
          response_text: s.payload.response,
          is_active: true,
          priority: 5,
        });
        if (error) throw error;
        await supabase.from("training_suggestions").update({ status: "applied" }).eq("id", s.id);
        return;
      }

      const next = mergeGeneratedSettings(current, patch);
      const upserts = Object.entries(next)
        .filter(([k]) => patch[k] !== undefined)
        .map(([setting_key, setting_value]) => ({ user_id: user!.id, setting_key, setting_value }));
      if (upserts.length) {
        const { error } = await supabase.from("bot_settings").upsert(upserts, { onConflict: "user_id,setting_key" });
        if (error) throw error;
      }
      await supabase.from("training_suggestions").update({ status: "applied" }).eq("id", s.id);
    },
    onSuccess: () => {
      toast.success(t("autoLearn.applied"));
      qc.invalidateQueries({ queryKey: ["training_suggestions"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_suggestions").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("autoLearn.rejected"));
      qc.invalidateQueries({ queryKey: ["training_suggestions"] });
    },
  });

  const renderPayload = (s: Suggestion) => {
    const p = s.payload || {};
    if (s.kind === "faq") return <><div><b>Q:</b> {p.q}</div><div><b>A:</b> {p.a}</div></>;
    if (s.kind === "example") return <>
      <div className="text-xs text-muted-foreground">{t("autoLearn.customerSaid")}</div>
      <div>{p.customer}</div>
      {p.wrong_reply && <><div className="text-xs text-destructive mt-2">{t("autoLearn.wrongReply")}</div><div className="line-through opacity-70">{p.wrong_reply}</div></>}
      <div className="text-xs text-green-600 mt-2">{t("autoLearn.correctReply")}</div>
      <div>{p.correct_reply}</div>
    </>;
    if (s.kind === "personality") return <div>{p.addition}</div>;
    if (s.kind === "never_say") return <div>"{p.phrase}"</div>;
    if (s.kind === "rule") return <><div><b>{t("autoLearn.keyword")}:</b> {p.keyword}</div><div><b>{t("autoLearn.response")}:</b> {p.response}</div></>;
    return <pre className="text-xs">{JSON.stringify(p, null, 2)}</pre>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> {t("autoLearn.title")}</CardTitle>
          <CardDescription>{t("autoLearn.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={analyze} disabled={analyzing} className="gap-2">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analyzing ? t("autoLearn.analyzing") : t("autoLearn.analyzeBtn")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("autoLearn.pending")}</CardTitle>
          <CardDescription>{t("autoLearn.pendingDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
          ) : !suggestions?.length ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
              <MessageSquare className="h-4 w-4" /> {t("autoLearn.empty")}
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3">
                {suggestions.map((s) => (
                  <div key={s.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{kindLabel(t, s.kind)}</Badge>
                      <Badge variant="secondary" className="text-xs">{s.source === "chat" ? t("autoLearn.fromChat") : t("autoLearn.fromAuto")}</Badge>
                    </div>
                    <div className="text-sm space-y-1">{renderPayload(s)}</div>
                    {s.reason && <div className="text-xs text-muted-foreground italic">💡 {s.reason}</div>}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => applyMutation.mutate(s)} disabled={applyMutation.isPending} className="gap-1">
                        <Check className="h-3.5 w-3.5" /> {t("autoLearn.approve")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(s.id)} disabled={rejectMutation.isPending} className="gap-1">
                        <X className="h-3.5 w-3.5" /> {t("autoLearn.reject")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AutoLearnPanel;
