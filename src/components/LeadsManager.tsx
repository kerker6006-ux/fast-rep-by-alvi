import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessCategory } from "@/hooks/useBusinessCategory";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  category: string;
  service_or_product: string | null;
  preferred_date: string | null;
  source: string;
  notes: string | null;
  status: string;
  created_at: string;
  conversation_id: string | null;
};

const STATUSES = ["new", "contacted", "booked", "closed"] as const;

const LeadsManager = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { category } = useBusinessCategory();
  const isService = category && category !== "ecommerce";
  const ns = isService ? "appointments" : "leads";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Lead | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Lead> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("leads").update(rest as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(t("leads.updated"));
    },
  });

  const filtered = leads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (l.name || "").toLowerCase().includes(s)
        || (l.phone || "").toLowerCase().includes(s)
        || (l.service_or_product || "").toLowerCase().includes(s);
    }
    return true;
  });

  const exportCsv = () => {
    const headers = ["Name", "Phone", "Category", "Service/Product", "Source", "Status", "Created"];
    const rows = filtered.map((l) => [l.name, l.phone, l.category, l.service_or_product, l.source, l.status, l.created_at]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("leads.title")}</h2>
          <p className="text-muted-foreground">{t("leads.subtitle")}</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" />{t("leads.export")}
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("leads.searchPh")} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`leads.status.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground text-sm">{t("leads.empty")}</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((l) => (
            <Card key={l.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelected(l)}>
              <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{l.name || t("leads.unknown")}</p>
                    <Badge variant={l.status === "new" ? "default" : "secondary"}>{t(`leads.status.${l.status}`)}</Badge>
                    <Badge variant="outline">{t(`category.${l.category}.name`)}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                    {l.phone && <span>📞 {l.phone}</span>}
                    {l.service_or_product && <span>🎯 {l.service_or_product}</span>}
                    {l.preferred_date && <span>📅 {l.preferred_date}</span>}
                    <span>📡 {l.source}</span>
                    <span>{new Date(l.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name || t("leads.unknown")}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <Field label={t("leads.fPhone")} value={selected.phone} />
                <Field label={t("leads.fAddress")} value={selected.address} />
                <Field label={t("leads.fService")} value={selected.service_or_product} />
                <Field label={t("leads.fDate")} value={selected.preferred_date} />
                <Field label={t("leads.fSource")} value={selected.source} />
                <Field label={t("leads.fCategory")} value={t(`category.${selected.category}.name`)} />
                <div className="space-y-1.5">
                  <Label>{t("leads.status.label")}</Label>
                  <Select
                    value={selected.status}
                    onValueChange={(v) => { update.mutate({ id: selected.id, status: v }); setSelected({ ...selected, status: v }); }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`leads.status.${s}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("leads.notes")}</Label>
                  <Textarea
                    value={selected.notes || ""}
                    onChange={(e) => setSelected({ ...selected, notes: e.target.value })}
                    onBlur={() => update.mutate({ id: selected.id, notes: selected.notes })}
                    rows={4}
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium">{value || "—"}</p>
  </div>
);

export default LeadsManager;
