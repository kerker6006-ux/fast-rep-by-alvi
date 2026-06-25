import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check, X, Package, ImageIcon, Pencil, Globe, Sparkles, Wrench } from "lucide-react";
import { useState } from "react";
import FbPostsBrowser from "./FbPostsBrowser";
import FbServicePostsBrowser from "./FbServicePostsBrowser";

const PendingProducts = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activePage } = useActivePage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const pageCategory = activePage?.page_category as string | undefined;
  const isServicePage = pageCategory === "service";

  const { data: pending, isLoading } = useQuery({
    queryKey: ["pending-products", activePage?.id],
    enabled: !!activePage?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_products")
        .select("*")
        .eq("fb_page_id", activePage!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Existing category suggestions for the combobox
  const { data: productCategories = [] } = useQuery({
    queryKey: ["product-categories", activePage?.id],
    enabled: !!activePage?.id && !isServicePage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("category")
        .eq("fb_page_id", activePage!.id);
      if (error) throw error;
      return Array.from(new Set((data || []).map((r: any) => r.category).filter(Boolean))) as string[];
    },
  });

  const { data: serviceCategories = [] } = useQuery({
    queryKey: ["service-categories", activePage?.id],
    enabled: !!activePage?.id && isServicePage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("category")
        .eq("fb_page_id", activePage!.id);
      if (error) throw error;
      return Array.from(new Set((data || []).map((r: any) => r.category).filter(Boolean))) as string[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (item: any) => {
      const treatAsService = item.kind === "service" || (!item.kind && isServicePage);

      if (treatAsService) {
        const { error: svcError } = await supabase.from("services").insert({
          user_id: user?.id,
          fb_page_id: activePage?.id,
          category: item.ai_category || null,
          name: item.ai_name || "Unnamed Service",
          description: item.ai_description || item.post_caption || null,
          price_text: item.ai_price_text || (item.ai_price ? String(item.ai_price) : null),
          duration_text: item.ai_duration_text || null,
          image_url: item.image_url,
          keywords: Array.isArray(item.ai_keywords) ? item.ai_keywords : [],
          active: true,
        });
        if (svcError) throw svcError;
      } else {
        const { error: productError } = await supabase.from("products").insert({
          user_id: user?.id,
          fb_page_id: activePage?.id,
          name: item.ai_name || "Unnamed",
          name_bn: item.ai_name_bn,
          description: item.ai_description,
          description_bn: item.ai_description_bn,
          category: item.ai_category,
          color: item.ai_color,
          price: item.ai_price || 0,
          material: item.ai_material,
          keywords: item.ai_keywords || [],
          image_url: item.image_url,
          is_active: true,
        });
        if (productError) throw productError;
      }

      const { error } = await supabase
        .from("pending_products")
        .update({ status: "approved" } as any)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: (_, item) => {
      queryClient.invalidateQueries({ queryKey: ["pending-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      const treatAsService = item.kind === "service" || (!item.kind && isServicePage);
      toast.success(treatAsService ? "Service added to your catalog!" : "Product approved and added to catalog!");
    },
    onError: (e: any) => toast.error(e.message || "Approve failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pending_products")
        .update({ status: "rejected" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-products"] });
      toast.success("Item rejected");
    },
  });

  const saveEdit = (item: any) => {
    const updated = { ...item, ...editForm };
    setEditingId(null);
    setEditForm({});
    approveMutation.mutate(updated);
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    const treatAsService = item.kind === "service" || (!item.kind && isServicePage);
    setEditForm(
      treatAsService
        ? {
            ai_name: item.ai_name,
            ai_category: item.ai_category,
            ai_description: item.ai_description,
            ai_price_text: item.ai_price_text || (item.ai_price ? String(item.ai_price) : ""),
            ai_duration_text: item.ai_duration_text,
          }
        : {
            ai_name: item.ai_name,
            ai_name_bn: item.ai_name_bn,
            ai_category: item.ai_category,
            ai_color: item.ai_color,
            ai_price: item.ai_price,
            ai_material: item.ai_material,
          }
    );
  };

  const pendingContent = isLoading ? (
    <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}</div>
  ) : !pending?.length ? (
    <Card className="p-8 text-center">
      <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
      <h3 className="font-semibold">{t("pendingProducts.empty")}</h3>
    </Card>
  ) : (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">{pending.length}</Badge>
      </div>
      {pending.map((item: any) => {
        const treatAsService = item.kind === "service" || (!item.kind && isServicePage);
        const suggestions = treatAsService ? serviceCategories : productCategories;
        const listId = `cat-suggest-${item.id}`;
        return (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {editingId === item.id ? (
                    treatAsService ? (
                      <div className="space-y-2">
                        <datalist id={listId}>
                          {suggestions.map((c) => <option key={c} value={c} />)}
                        </datalist>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Name</Label>
                            <Input value={editForm.ai_name || ""} onChange={e => setEditForm(f => ({ ...f, ai_name: e.target.value }))} className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Category</Label>
                            <Input list={listId} value={editForm.ai_category || ""} onChange={e => setEditForm(f => ({ ...f, ai_category: e.target.value }))} className="h-8 text-sm" placeholder="e.g. Consultation" />
                          </div>
                          <div>
                            <Label className="text-xs">Price (text)</Label>
                            <Input value={editForm.ai_price_text || ""} onChange={e => setEditForm(f => ({ ...f, ai_price_text: e.target.value }))} className="h-8 text-sm" placeholder="$500 or Contact for quote" />
                          </div>
                          <div>
                            <Label className="text-xs">Duration</Label>
                            <Input value={editForm.ai_duration_text || ""} onChange={e => setEditForm(f => ({ ...f, ai_duration_text: e.target.value }))} className="h-8 text-sm" placeholder="45 min" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Description</Label>
                          <Input value={editForm.ai_description || ""} onChange={e => setEditForm(f => ({ ...f, ai_description: e.target.value }))} className="h-8 text-sm" />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <datalist id={listId}>
                          {suggestions.map((c) => <option key={c} value={c} />)}
                        </datalist>
                        <div>
                          <Label className="text-xs">{t("pendingProducts.name")}</Label>
                          <Input value={editForm.ai_name || ""} onChange={e => setEditForm(f => ({ ...f, ai_name: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">{t("pendingProducts.nameAlt")}</Label>
                          <Input value={editForm.ai_name_bn || ""} onChange={e => setEditForm(f => ({ ...f, ai_name_bn: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">{t("pendingProducts.category")}</Label>
                          <Input list={listId} value={editForm.ai_category || ""} onChange={e => setEditForm(f => ({ ...f, ai_category: e.target.value }))} className="h-8 text-sm" placeholder="Type or pick" />
                        </div>
                        <div>
                          <Label className="text-xs">{t("pendingProducts.color")}</Label>
                          <Input value={editForm.ai_color || ""} onChange={e => setEditForm(f => ({ ...f, ai_color: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">{t("pendingProducts.price")}</Label>
                          <Input type="number" value={editForm.ai_price || 0} onChange={e => setEditForm(f => ({ ...f, ai_price: Number(e.target.value) }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">{t("products.material")}</Label>
                          <Input value={editForm.ai_material || ""} onChange={e => setEditForm(f => ({ ...f, ai_material: e.target.value }))} className="h-8 text-sm" />
                        </div>
                      </div>
                    )
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {treatAsService && <Badge variant="outline" className="text-[10px] gap-1"><Wrench className="h-2.5 w-2.5" /> Service</Badge>}
                        <h4 className="font-semibold text-sm truncate">{item.ai_name || "Unnamed"}</h4>
                        {item.ai_name_bn && <span className="text-xs text-muted-foreground">({item.ai_name_bn})</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {item.ai_category && <Badge variant="outline" className="text-[10px]">{item.ai_category}</Badge>}
                        {!treatAsService && item.ai_color && <Badge variant="outline" className="text-[10px]">🎨 {item.ai_color}</Badge>}
                        {!treatAsService && item.ai_material && <Badge variant="outline" className="text-[10px]">{item.ai_material}</Badge>}
                        {treatAsService
                          ? (item.ai_price_text && <Badge variant="secondary" className="text-[10px]">💵 {item.ai_price_text}</Badge>)
                          : <Badge variant="secondary" className="text-[10px]">${item.ai_price || 0}</Badge>}
                        {treatAsService && item.ai_duration_text && <Badge variant="outline" className="text-[10px]">⏱ {item.ai_duration_text}</Badge>}
                      </div>
                      {item.post_caption && <p className="text-xs text-muted-foreground line-clamp-2">📝 {item.post_caption}</p>}
                      {item.ai_description && <p className="text-xs text-muted-foreground line-clamp-2">{item.ai_description}</p>}
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {editingId === item.id ? (
                    <>
                      <Button size="sm" onClick={() => saveEdit(item)} className="gap-1"><Check className="h-3 w-3" /> {t("common.save")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>{t("common.cancel")}</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => approveMutation.mutate(item)} disabled={approveMutation.isPending} className="gap-1"><Check className="h-3 w-3" /> {t("pendingProducts.approve")}</Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(item)} className="gap-1"><Pencil className="h-3 w-3" /> {t("pendingProducts.edit")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => rejectMutation.mutate(item.id)} className="gap-1 text-destructive"><X className="h-3 w-3" /> {t("pendingProducts.reject")}</Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <Tabs defaultValue="pending" className="space-y-4">
      <TabsList>
        <TabsTrigger value="pending" className="gap-1.5">
          <Package className="h-4 w-4" /> Pending Review
          {pending?.length ? <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">{pending.length}</Badge> : null}
        </TabsTrigger>
        {isServicePage ? (
          <TabsTrigger value="fb-services" className="gap-1.5">
            <Wrench className="h-4 w-4" /> Import Services from FB
          </TabsTrigger>
        ) : (
          <TabsTrigger value="fb-posts" className="gap-1.5">
            <Globe className="h-4 w-4" /> Import Products from FB
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="pending">
        {pendingContent}
      </TabsContent>


      {isServicePage ? (
        <TabsContent value="fb-services">
          <FbServicePostsBrowser />
        </TabsContent>
      ) : (
        <TabsContent value="fb-posts">
          <FbPostsBrowser />
        </TabsContent>
      )}
    </Tabs>
  );
};

export default PendingProducts;
