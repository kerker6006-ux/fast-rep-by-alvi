import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const AdminAnnouncements = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data: items } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements").insert({ title, body, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.announcements.sent"));
      setTitle(""); setBody("");
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("common.deleted")); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{t("admin.announcements.title")}</h1>
        <p className="text-slate-500 mt-1">{t("admin.announcements.subtitle")}</p>
      </header>

      <Card className="border-0 shadow-soft max-w-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>{t("admin.announcements.titleField")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("admin.announcements.titlePlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.announcements.bodyField")}</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("admin.announcements.bodyPlaceholder")} />
          </div>
          <Button onClick={() => create.mutate()} disabled={!title || !body || create.isPending}>
            <Send className="h-4 w-4 mr-2" /> {t("admin.announcements.send")}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(items ?? []).map((a: any) => (
          <Card key={a.id} className="border-0 shadow-soft">
            <CardContent className="p-5 flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold">{a.title}</h3>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                <p className="text-xs text-slate-400 mt-2">{new Date(a.created_at).toLocaleString()}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove.mutate(a.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminAnnouncements;
