import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useBusinessCategory, BusinessCategory } from "@/hooks/useBusinessCategory";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Sparkles, Upload, X, ImageIcon } from "lucide-react";
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
  image_url: string | null;
  active: boolean;
};

const emptyForm = { name: "", description: "", price_text: "", duration_text: "", service_area: "", image_url: "", active: true };

const ServicesManager = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activePage } = useActivePage();
  const { category } = useBusinessCategory();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const cat = (category && category !== "ecommerce" ? category : "dental") as Exclude<BusinessCategory, "ecommerce">;

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services", activePage?.id, cat],
    enabled: !!user?.id && !!activePage?.id && category !== "ecommerce",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("fb_page_id", activePage!.id)
        .eq("category", cat)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRow[];
    },
  });

  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    try {
      setUploading(true);
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error(t("services.nameRequired"));
      const payload = {
        user_id: user!.id,
        fb_page_id: activePage?.id,
        category: cat,
        name: form.name.trim(),
        description: form.description || null,
        price_text: form.price_text || null,
        duration_text: form.duration_text || null,
        service_area: form.service_area || null,
        image_url: form.image_url || null,
        active: form.active,
      };
      if (editingId) {
        const { error } = await supabase.from("services").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success(t("services.saved"));
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
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
      const rows = PRESETS[cat].map((name) => ({ user_id: user!.id, fb_page_id: activePage?.id, category: cat, name, active: true }));
      const { error } = await supabase.from("services").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success(t("services.presetsAdded"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (s: ServiceRow) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      price_text: s.price_text || "",
      duration_text: s.duration_text || "",
      service_area: s.service_area || "",
      image_url: s.image_url || "",
      active: s.active,
    });
    setDialogOpen(true);
  };

  if (!category) return null;
  if (category === "ecommerce") {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("services.notForEcommerce")}</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t(`services.titleByCat.${cat}`)}</h2>
          <p className="text-muted-foreground">{t(`services.subtitle.${cat}`)}</p>
        </div>
        <div className="flex gap-2">
          {services.length === 0 && (
            <Button variant="outline" onClick={() => seedPresets.mutate()} disabled={seedPresets.isPending}>
              <Sparkles className="h-4 w-4 mr-2" />{t("services.addPresets")}
            </Button>
          )}
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />{t("services.add")}</Button>
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
                {s.image_url ? (
                  <img src={s.image_url} alt={s.name} className="h-16 w-16 rounded-lg object-cover border shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
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
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? t("services.editTitle") : t("services.addTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("services.fName")} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("services.fNamePh")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("services.fDesc")} *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("services.fDescPh")}
                rows={5}
              />
              <p className="text-[11px] text-muted-foreground">
                Describe what this service is for, who it helps, and common problems it solves. The AI uses this to match customer questions and suggest the right service.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                Image <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Optional</span>
              </Label>
              <div className="flex items-center gap-3">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="" className="h-20 w-20 rounded-lg object-cover border" />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, image_url: "" })}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <label className="inline-flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading..." : form.image_url ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickImage(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("services.fPrice")}</Label>
                <Input value={form.price_text} onChange={(e) => setForm({ ...form, price_text: e.target.value })} placeholder={cat === "hvac" ? "$100 - $300" : "$500"} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("services.fDuration")}</Label>
                <Input value={form.duration_text} onChange={(e) => setForm({ ...form, duration_text: e.target.value })} placeholder="45 min" />
              </div>
            </div>
            {cat === "hvac" && (
              <div className="space-y-1.5">
                <Label>{t("services.fArea")}</Label>
                <Input value={form.service_area} onChange={(e) => setForm({ ...form, service_area: e.target.value })} placeholder={t("services.fAreaPh")} />
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <Label>{t("common.active")}</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>{upsert.isPending ? t("common.saving") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesManager;
