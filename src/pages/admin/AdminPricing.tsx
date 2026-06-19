import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react";

const AdminPricing = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [textCost, setTextCost] = useState("0.30");
  const [imageCost, setImageCost] = useState("1.50");
  const [signupBonus, setSignupBonus] = useState("0");

  const { data } = useQuery({
    queryKey: ["app-settings-pricing"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "pricing").maybeSingle();
      return (data?.value as any) ?? { text_cost: 0.3, image_cost: 1.5, signup_bonus: 0 };
    },
  });

  useEffect(() => {
    if (data) {
      setTextCost(String(data.text_cost ?? 0.3));
      setImageCost(String(data.image_cost ?? 1.5));
      setSignupBonus(String(data.signup_bonus ?? 0));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        text_cost: Number(textCost),
        image_cost: Number(imageCost),
        signup_bonus: Number(signupBonus),
      };
      const { error } = await supabase.from("app_settings").upsert({
        key: "pricing", value: payload, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("admin.pricing.saved")); qc.invalidateQueries({ queryKey: ["app-settings-pricing"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{t("admin.pricing.title")}</h1>
        <p className="text-slate-500 mt-1">{t("admin.pricing.subtitle")}</p>
      </header>

      <Card className="border-0 shadow-soft max-w-2xl">
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>{t("admin.pricing.textCost")}</Label>
            <Input type="number" step="0.01" value={textCost} onChange={(e) => setTextCost(e.target.value)} />
            <p className="text-xs text-slate-500">{t("admin.pricing.textCostHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("admin.pricing.imageCost")}</Label>
            <Input type="number" step="0.01" value={imageCost} onChange={(e) => setImageCost(e.target.value)} />
            <p className="text-xs text-slate-500">{t("admin.pricing.imageCostHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("admin.pricing.signupBonus")}</Label>
            <Input type="number" step="1" value={signupBonus} onChange={(e) => setSignupBonus(e.target.value)} />
            <p className="text-xs text-slate-500">{t("admin.pricing.signupBonusHint")}</p>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg">
            <Save className="h-4 w-4 mr-2" /> {t("admin.pricing.save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPricing;
