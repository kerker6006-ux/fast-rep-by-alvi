import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check, X, Package, ImageIcon, Pencil, Globe } from "lucide-react";
import { useState } from "react";
import FbPostsBrowser from "./FbPostsBrowser";

const PendingProducts = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const { data: pending, isLoading } = useQuery({
    queryKey: ["pending-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_products")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (item: any) => {
      // Create the actual product
      const { error: productError } = await supabase.from("products").insert({
        user_id: user?.id,
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

      // Mark as approved
      const { error } = await supabase
        .from("pending_products")
        .update({ status: "approved" } as any)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product approved and added to catalog!");
    },
    onError: (e) => toast.error(e.message),
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
      toast.success("Product rejected");
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
    setEditForm({
      ai_name: item.ai_name,
      ai_name_bn: item.ai_name_bn,
      ai_category: item.ai_category,
      ai_color: item.ai_color,
      ai_price: item.ai_price,
      ai_material: item.ai_material,
    });
  };

  if (isLoading) {
    return <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  if (!pending?.length) {
    return (
      <Card className="p-8 text-center">
        <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">No pending products</h3>
        <p className="text-sm text-muted-foreground mt-1">When you post a photo on your Facebook Page, it will appear here for review.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">{pending.length} pending</Badge>
      </div>

      {pending.map((item: any) => (
        <Card key={item.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex gap-4">
              {/* Image */}
              <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 space-y-2">
                {editingId === item.id ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={editForm.ai_name || ""}
                        onChange={e => setEditForm(f => ({ ...f, ai_name: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Name (বাংলা)</Label>
                      <Input
                        value={editForm.ai_name_bn || ""}
                        onChange={e => setEditForm(f => ({ ...f, ai_name_bn: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Category</Label>
                      <Input
                        value={editForm.ai_category || ""}
                        onChange={e => setEditForm(f => ({ ...f, ai_category: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Color</Label>
                      <Input
                        value={editForm.ai_color || ""}
                        onChange={e => setEditForm(f => ({ ...f, ai_color: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Price (৳)</Label>
                      <Input
                        type="number"
                        value={editForm.ai_price || 0}
                        onChange={e => setEditForm(f => ({ ...f, ai_price: Number(e.target.value) }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Material</Label>
                      <Input
                        value={editForm.ai_material || ""}
                        onChange={e => setEditForm(f => ({ ...f, ai_material: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm truncate">{item.ai_name || "Unnamed"}</h4>
                      {item.ai_name_bn && <span className="text-xs text-muted-foreground">({item.ai_name_bn})</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.ai_category && <Badge variant="outline" className="text-[10px]">{item.ai_category}</Badge>}
                      {item.ai_color && <Badge variant="outline" className="text-[10px]">🎨 {item.ai_color}</Badge>}
                      {item.ai_material && <Badge variant="outline" className="text-[10px]">{item.ai_material}</Badge>}
                      <Badge variant="secondary" className="text-[10px]">৳{item.ai_price || 0}</Badge>
                    </div>
                    {item.post_caption && (
                      <p className="text-xs text-muted-foreground line-clamp-2">📝 {item.post_caption}</p>
                    )}
                    {item.ai_description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.ai_description}</p>
                    )}
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0">
                {editingId === item.id ? (
                  <>
                    <Button size="sm" onClick={() => saveEdit(item)} className="gap-1">
                      <Check className="h-3 w-3" /> Save & Add
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={() => approveMutation.mutate(item)} disabled={approveMutation.isPending} className="gap-1">
                      <Check className="h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startEdit(item)} className="gap-1">
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => rejectMutation.mutate(item.id)} className="gap-1 text-destructive">
                      <X className="h-3 w-3" /> Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PendingProducts;
