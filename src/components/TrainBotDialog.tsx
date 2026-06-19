import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerMessage: string;
  wrongReply: string;
};

const TrainBotDialog = ({ open, onOpenChange, customerMessage, wrongReply }: Props) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [correct, setCorrect] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!correct.trim() || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("training_suggestions").insert({
        user_id: user.id,
        kind: "example",
        payload: { customer: customerMessage, wrong_reply: wrongReply, correct_reply: correct.trim() },
        reason: reason.trim() || null,
        status: "pending",
        source: "chat",
      });
      if (error) throw error;
      toast.success(t("trainBot.saved"));
      setCorrect(""); setReason("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("trainBot.title")}</DialogTitle>
          <DialogDescription>{t("trainBot.desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">{t("trainBot.customer")}</div>
          <div className="text-sm p-2 bg-muted rounded">{customerMessage || "—"}</div>
          <div className="text-xs text-destructive">{t("trainBot.wrong")}</div>
          <div className="text-sm p-2 bg-muted rounded line-through opacity-70">{wrongReply}</div>
          <div>
            <Label>{t("trainBot.correct")}</Label>
            <Textarea value={correct} onChange={(e) => setCorrect(e.target.value)} placeholder={t("trainBot.correctPh")} rows={3} />
          </div>
          <div>
            <Label>{t("trainBot.reason")} <span className="text-muted-foreground">({t("common.optional")})</span></Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={saving || !correct.trim()}>{saving ? t("common.saving") : t("trainBot.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TrainBotDialog;
