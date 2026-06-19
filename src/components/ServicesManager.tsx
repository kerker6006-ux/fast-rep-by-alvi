import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessCategory, BusinessCategory } from "@/hooks/useBusinessCategory";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";

const PRESETS: Record<Exclude<BusinessCategory, "ecommerce">, string[]> = {
  dental: ["Dental Implant", "Braces", "Teeth Whitening", "Root Canal", "Cleaning", "Veneers"],
  hvac: ["AC Repair", "AC Installation", "Plumbing", "Electrical", "Cleaning", "Roofing"],
  salon: ["Hair Service", "Facial Treatment", "Skin Treatment", "Botox", "Fillers", "Laser Treatment"],
};

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  price_text: string | null;
  duration_text: string | null;
  service_area: string | null;
  active: boolean;
};

const empty = { name: "", description: "", price_text: "", duration_text: "", service_area: "", active: true };

const ServicesManager = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { category } = useBusinessCategory();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [form, setForm] = useState(empty);

  const cat = (category && category !== "ecommerce" ? category : "dental") as Exclude<BusinessCategory, "ecommerce">;

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services", user?.id, cat],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("user_id", user!.id)
        .eq("category", cat)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRow[];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error(t("services.nameRequired"));
      const payload = {
        user_id: user!.id,
        category: cat,
        name: form.name.trim(),
        description: form.description || null,
        price_text: form.price_text || null,
        duration_text: form.duration_text || null,
        service_area: form.service_area || null,
        active: form.active,
      };
      if (editing) {
        const { error } = await supabase.from("services").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success(t("services.saved"));
      setEditing(null);
      setForm(empty);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success(t("common.deleted"));
    },
  });

  const seedPresets = useMutation({
    mutationFn: async () => {
      const rows = PRESETS[cat].map((name) => ({
        user_id: user!.id,
        category: cat,
        name,
        active: true,
      }));
      const { error } = await supabase.from("services").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success(t("services.presetsAdded"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm(empty); };
  const openEdit = (s: ServiceRow) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description || "",
      price_text: s.price_text || "",
      duration_text: s.duration_text || "",
      service_area: s.service_area || "",
      active: s.active,
    });
  };

  if (!category) return null;
  if (category === "ecommerce") return (
    <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("services.notForEcommerce")}</CardContent></Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("services.title")}</h2>
          <p className="text-muted-foreground">{t(`services.subtitle.${cat}`)}</p>
        </div>
        <div className="flex gap-2">
          {services.length === 0 && (
            <Button variant="outline" onClick={() => seedPresets.mutate()} disabled={seedPresets.isPending}>
              <Sparkles className="h-4 w-4 mr-2" />{t("services.addPresets")}
            </Button>
          )}
          <Dialog open={editing !== null || form !== empty && form.name !== ""} onOpenChange={(o) => { if (!o) { setEditing(null); setForm(empty); } }}>
            <Button onClick={() => { openNew(); setForm({ ...empty, name: " " }); setForm(empty); document.getElementById("svc-add-trigger")?.click(); }} className="hidden" />
          </Dialog>
          <Button onClick={() => { openNew(); document.getElementById("svc-open")?.click(); }}>
            <Plus className="h-4 w-4 mr-2" />{t("services.add")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-lg" />)}</div>
      ) : services.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground text-sm">{t("services.empty")}</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {services.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{s.name}</p>
                    {!s.active && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t("common.inactive")}</span>}
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                    {s.price_text && <span>💵 {s.price_text}</span>}
                    {s.duration_text && <span>⏱ {s.duration_text}</span>}
                    {s.service_area && <span>📍 {s.service_area}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { openEdit(s); document.getElementById("svc-open")?.click(); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog>
        <button id="svc-open" className="hidden" onClick={(e) => { e.preventDefault(); (document.getElementById("svc-dialog-trigger") as HTMLButtonElement)?.click(); }} />
      </Dialog>

      <ServiceDialog
        category={cat}
        editing={editing}
        form={form}
        setForm={setForm}
        onClose={() => { setEditing(null); setForm(empty); }}
        onSave={() => upsert.mutate()}
        saving={upsert.isPending}
      />
    </div>
  );
};

const ServiceDialog = ({
  category, editing, form, setForm, onClose, onSave, saving,
}: {
  category: Exclude<BusinessCategory, "ecommerce">;
  editing: ServiceRow | null;
  form: typeof empty;
  setForm: (f: typeof empty) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) => {
  const { t } = useTranslation();
  // Use external open trigger via DOM click; simpler: use a controlled state in parent.
  return null as any;
};

export default ServicesManager;
